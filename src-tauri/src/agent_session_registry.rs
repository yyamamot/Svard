use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::Manager;

const REGISTRY_FILE_NAME: &str = "agent-sessions.json";
const REGISTRY_VERSION: u32 = 1;
const MAX_PAGE_SIZE: usize = 50;
const SEARCH_CURSOR_VERSION: u32 = 1;
const MAX_SEARCH_QUERY_CHARS: usize = 120;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentSessionSnapshot {
    pub(crate) permission_mode: String,
    pub(crate) network_access: bool,
    pub(crate) web_search: bool,
    #[serde(default = "default_context_profile")]
    pub(crate) context_profile: String,
    pub(crate) model: Option<String>,
    pub(crate) reasoning_effort: Option<String>,
    pub(crate) personality: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentSessionRecord {
    pub(crate) client_session_id: String,
    pub(crate) provider_id: String,
    pub(crate) provider_thread_id: String,
    pub(crate) workspace_root: PathBuf,
    pub(crate) title: String,
    pub(crate) created_at: u64,
    pub(crate) updated_at: u64,
    pub(crate) archived: bool,
    #[serde(default = "default_available")]
    pub(crate) available: bool,
    pub(crate) snapshot: AgentSessionSnapshot,
}

fn default_available() -> bool {
    true
}

fn default_context_profile() -> String {
    "providerDefaults".to_string()
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RegistryDocument {
    version: u32,
    sessions: Vec<AgentSessionRecord>,
}

impl Default for RegistryDocument {
    fn default() -> Self {
        Self {
            version: REGISTRY_VERSION,
            sessions: Vec::new(),
        }
    }
}

#[derive(Debug, Clone)]
pub(crate) struct RegistryPage {
    pub(crate) sessions: Vec<AgentSessionRecord>,
    pub(crate) next_cursor: Option<String>,
}

pub(crate) struct AgentSessionListQuery<'a> {
    pub(crate) provider_id: &'a str,
    pub(crate) workspace_root: &'a Path,
    pub(crate) archived: bool,
    pub(crate) query: Option<&'a str>,
    pub(crate) updated_at_from: Option<u64>,
    pub(crate) updated_at_before: Option<u64>,
    pub(crate) cursor: Option<&'a str>,
    pub(crate) limit: usize,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SearchCursor {
    version: u32,
    scope_digest: String,
    updated_at: u64,
    client_session_id: String,
}

#[derive(Default)]
pub(crate) struct AgentSessionRegistry {
    write_lock: Mutex<()>,
}

impl AgentSessionRegistry {
    pub(crate) fn path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
        Ok(app
            .path()
            .app_config_dir()
            .map_err(|_| "The agent session store is unavailable.".to_string())?
            .join(REGISTRY_FILE_NAME))
    }

    pub(crate) fn insert(&self, path: &Path, record: AgentSessionRecord) -> Result<(), String> {
        self.update(path, |document| {
            if document
                .sessions
                .iter()
                .any(|existing| existing.client_session_id == record.client_session_id)
            {
                return Err("This agent session already exists.".to_string());
            }
            document.sessions.push(record);
            Ok(())
        })
    }

    pub(crate) fn get(
        &self,
        path: &Path,
        client_session_id: &str,
    ) -> Result<AgentSessionRecord, String> {
        let _guard = self
            .write_lock
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        load_document(path)?
            .sessions
            .into_iter()
            .find(|record| record.client_session_id == client_session_id)
            .ok_or_else(|| "The saved agent session is unavailable.".to_string())
    }

    pub(crate) fn list(
        &self,
        path: &Path,
        input: AgentSessionListQuery<'_>,
    ) -> Result<RegistryPage, String> {
        let normalized_query = normalize_search_query(input.query)?;
        if matches!(
            (input.updated_at_from, input.updated_at_before),
            (Some(from), Some(before)) if from >= before
        ) {
            return Err("The chat history date filter is invalid.".to_string());
        }
        let scope_digest = search_scope_digest(&input, &normalized_query);
        let cursor = input
            .cursor
            .map(|value| decode_search_cursor(value, &scope_digest))
            .transpose()?;
        let _guard = self
            .write_lock
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let mut sessions = load_document(path)?
            .sessions
            .into_iter()
            .filter(|record| {
                record.provider_id == input.provider_id
                    && record.workspace_root == input.workspace_root
                    && record.archived == input.archived
                    && input
                        .updated_at_from
                        .is_none_or(|from| record.updated_at >= from)
                    && input
                        .updated_at_before
                        .is_none_or(|before| record.updated_at < before)
                    && title_matches_query(&record.title, &normalized_query)
            })
            .collect::<Vec<_>>();
        sessions.sort_by(|left, right| {
            right
                .updated_at
                .cmp(&left.updated_at)
                .then_with(|| right.client_session_id.cmp(&left.client_session_id))
        });
        if let Some(cursor) = cursor {
            sessions.retain(|record| {
                record.updated_at < cursor.updated_at
                    || (record.updated_at == cursor.updated_at
                        && record.client_session_id < cursor.client_session_id)
            });
        }
        let page_size = input.limit.clamp(1, MAX_PAGE_SIZE);
        let page = sessions.into_iter().take(page_size + 1).collect::<Vec<_>>();
        let has_more = page.len() > page_size;
        let sessions = page.into_iter().take(page_size).collect::<Vec<_>>();
        let next_cursor = if has_more {
            sessions
                .last()
                .map(|record| encode_search_cursor(record, &scope_digest))
                .transpose()?
        } else {
            None
        };
        Ok(RegistryPage {
            sessions,
            next_cursor,
        })
    }

    pub(crate) fn rename(
        &self,
        path: &Path,
        client_session_id: &str,
        title: String,
    ) -> Result<(), String> {
        self.update_record(path, client_session_id, |record| {
            record.title = title;
            record.updated_at = now_seconds();
        })
    }

    pub(crate) fn set_archived(
        &self,
        path: &Path,
        client_session_id: &str,
        archived: bool,
    ) -> Result<(), String> {
        self.update_record(path, client_session_id, |record| {
            record.archived = archived;
            record.updated_at = now_seconds();
        })
    }

    pub(crate) fn set_available(
        &self,
        path: &Path,
        client_session_id: &str,
        available: bool,
    ) -> Result<(), String> {
        self.update_record(path, client_session_id, |record| {
            record.available = available;
        })
    }

    pub(crate) fn touch(&self, path: &Path, client_session_id: &str) -> Result<(), String> {
        self.update_record(path, client_session_id, |record| {
            record.updated_at = now_seconds();
        })
    }

    pub(crate) fn remove(&self, path: &Path, client_session_id: &str) -> Result<(), String> {
        self.update(path, |document| {
            let previous_len = document.sessions.len();
            document
                .sessions
                .retain(|record| record.client_session_id != client_session_id);
            if document.sessions.len() == previous_len {
                return Err("The saved agent session is unavailable.".to_string());
            }
            Ok(())
        })
    }

    fn update_record(
        &self,
        path: &Path,
        client_session_id: &str,
        apply: impl FnOnce(&mut AgentSessionRecord),
    ) -> Result<(), String> {
        self.update(path, |document| {
            let record = document
                .sessions
                .iter_mut()
                .find(|record| record.client_session_id == client_session_id)
                .ok_or_else(|| "The saved agent session is unavailable.".to_string())?;
            apply(record);
            Ok(())
        })
    }

    fn update(
        &self,
        path: &Path,
        apply: impl FnOnce(&mut RegistryDocument) -> Result<(), String>,
    ) -> Result<(), String> {
        let _guard = self
            .write_lock
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let mut document = load_document(path)?;
        apply(&mut document)?;
        write_document(path, &document)
    }
}

fn normalize_search_query(query: Option<&str>) -> Result<Vec<String>, String> {
    let query = query.unwrap_or_default().trim();
    if query.chars().count() > MAX_SEARCH_QUERY_CHARS
        || query
            .chars()
            .any(|character| character.is_control() && !character.is_whitespace())
    {
        return Err("The chat history search is invalid.".to_string());
    }
    Ok(query
        .split_whitespace()
        .map(|term| term.to_lowercase())
        .collect())
}

fn title_matches_query(title: &str, terms: &[String]) -> bool {
    let title = title.to_lowercase();
    terms.iter().all(|term| title.contains(term))
}

fn search_scope_digest(input: &AgentSessionListQuery<'_>, terms: &[String]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.provider_id.as_bytes());
    hasher.update([0]);
    hasher.update(input.workspace_root.to_string_lossy().as_bytes());
    hasher.update([input.archived as u8]);
    for term in terms {
        hasher.update(term.as_bytes());
        hasher.update([0]);
    }
    hasher.update(input.updated_at_from.unwrap_or_default().to_le_bytes());
    hasher.update(input.updated_at_before.unwrap_or_default().to_le_bytes());
    format!("{:x}", hasher.finalize())
}

fn encode_search_cursor(record: &AgentSessionRecord, scope_digest: &str) -> Result<String, String> {
    let cursor = SearchCursor {
        version: SEARCH_CURSOR_VERSION,
        scope_digest: scope_digest.to_string(),
        updated_at: record.updated_at,
        client_session_id: record.client_session_id.clone(),
    };
    serde_json::to_vec(&cursor)
        .map(|payload| URL_SAFE_NO_PAD.encode(payload))
        .map_err(|_| "The chat history cursor is unavailable.".to_string())
}

fn decode_search_cursor(value: &str, scope_digest: &str) -> Result<SearchCursor, String> {
    let cursor = URL_SAFE_NO_PAD
        .decode(value)
        .ok()
        .and_then(|payload| serde_json::from_slice::<SearchCursor>(&payload).ok())
        .filter(|cursor| {
            cursor.version == SEARCH_CURSOR_VERSION
                && cursor.scope_digest == scope_digest
                && !cursor.client_session_id.is_empty()
        })
        .ok_or_else(|| "The chat history cursor is invalid.".to_string())?;
    Ok(cursor)
}

pub(crate) fn now_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn load_document(path: &Path) -> Result<RegistryDocument, String> {
    let source = match fs::read(path) {
        Ok(source) => source,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(RegistryDocument::default())
        }
        Err(_) => return Err("The agent session store could not be read.".to_string()),
    };
    let document: RegistryDocument = serde_json::from_slice(&source)
        .map_err(|_| "The agent session store is invalid.".to_string())?;
    if document.version != REGISTRY_VERSION {
        return Err("The agent session store version is unsupported.".to_string());
    }
    let mut ids = std::collections::HashSet::new();
    if document
        .sessions
        .iter()
        .any(|record| !ids.insert(record.client_session_id.as_str()))
    {
        return Err("The agent session store contains duplicate sessions.".to_string());
    }
    Ok(document)
}

fn write_document(path: &Path, document: &RegistryDocument) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "The agent session store path is invalid.".to_string())?;
    let mut builder = fs::DirBuilder::new();
    builder.recursive(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::DirBuilderExt;
        builder.mode(0o700);
    }
    builder
        .create(parent)
        .map_err(|_| "The agent session store could not be prepared.".to_string())?;
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let temporary_path = parent.join(format!(
        ".{REGISTRY_FILE_NAME}.{}.{}.tmp",
        std::process::id(),
        nonce
    ));
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let result = (|| -> Result<(), String> {
        let mut file = options
            .open(&temporary_path)
            .map_err(|_| "The agent session store could not be updated.".to_string())?;
        serde_json::to_writer_pretty(&mut file, document)
            .map_err(|_| "The agent session store could not be encoded.".to_string())?;
        file.write_all(b"\n")
            .and_then(|_| file.sync_all())
            .map_err(|_| "The agent session store could not be updated.".to_string())?;
        fs::rename(&temporary_path, path)
            .map_err(|_| "The agent session store could not be replaced.".to_string())?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary_path);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    fn list_query<'a>(
        workspace_root: &'a Path,
        cursor: Option<&'a str>,
        limit: usize,
    ) -> AgentSessionListQuery<'a> {
        AgentSessionListQuery {
            provider_id: "codex-app-server",
            workspace_root,
            archived: false,
            query: None,
            updated_at_from: None,
            updated_at_before: None,
            cursor,
            limit,
        }
    }

    fn record(id: &str, workspace_root: &Path, updated_at: u64) -> AgentSessionRecord {
        AgentSessionRecord {
            client_session_id: id.to_string(),
            provider_id: "codex-app-server".to_string(),
            provider_thread_id: format!("provider-{id}"),
            workspace_root: workspace_root.to_path_buf(),
            title: format!("Chat {id}"),
            created_at: updated_at,
            updated_at,
            archived: false,
            available: true,
            snapshot: AgentSessionSnapshot {
                permission_mode: "agent".to_string(),
                network_access: false,
                web_search: false,
                context_profile: "focused".to_string(),
                model: None,
                reasoning_effort: None,
                personality: None,
            },
        }
    }

    #[test]
    fn registry_round_trip_and_workspace_filtering() {
        let root = tempfile::tempdir().unwrap();
        let other = tempfile::tempdir().unwrap();
        let path = root.path().join("registry.json");
        let registry = AgentSessionRegistry::default();
        registry
            .insert(&path, record("older", root.path(), 10))
            .unwrap();
        registry
            .insert(&path, record("newer", root.path(), 20))
            .unwrap();
        registry
            .insert(&path, record("other", other.path(), 30))
            .unwrap();

        let page = registry
            .list(&path, list_query(root.path(), None, 50))
            .unwrap();
        assert_eq!(
            page.sessions
                .iter()
                .map(|record| record.client_session_id.as_str())
                .collect::<Vec<_>>(),
            vec!["newer", "older"]
        );
        assert!(page.next_cursor.is_none());
    }

    #[test]
    fn legacy_snapshot_without_context_profile_uses_provider_defaults() {
        let snapshot: AgentSessionSnapshot = serde_json::from_value(serde_json::json!({
            "permissionMode": "observe",
            "networkAccess": false,
            "webSearch": false,
            "model": null,
            "reasoningEffort": null,
            "personality": null
        }))
        .unwrap();
        assert_eq!(snapshot.context_profile, "providerDefaults");
    }

    #[test]
    fn registry_paginates_without_duplicates() {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("registry.json");
        let registry = AgentSessionRegistry::default();
        for index in 0..3 {
            registry
                .insert(
                    &path,
                    record(&format!("session-{index}"), root.path(), index),
                )
                .unwrap();
        }

        let first = registry
            .list(&path, list_query(root.path(), None, 2))
            .unwrap();
        let second = registry
            .list(
                &path,
                list_query(root.path(), first.next_cursor.as_deref(), 2),
            )
            .unwrap();
        assert_eq!(first.sessions.len(), 2);
        assert_eq!(second.sessions.len(), 1);
        assert_ne!(
            first.sessions.last().unwrap().client_session_id,
            second.sessions[0].client_session_id
        );
    }

    #[test]
    fn registry_searches_titles_and_updated_dates_before_pagination() {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("registry.json");
        let registry = AgentSessionRegistry::default();
        let mut japanese = record("japanese", root.path(), 30);
        japanese.title = "設計 Design Review Notes".to_string();
        let mut matching = record("matching", root.path(), 20);
        matching.title = "review design follow-up".to_string();
        let mut too_old = record("old", root.path(), 10);
        too_old.title = "Design review archive".to_string();
        registry.insert(&path, japanese).unwrap();
        registry.insert(&path, matching).unwrap();
        registry.insert(&path, too_old).unwrap();

        let page = registry
            .list(
                &path,
                AgentSessionListQuery {
                    query: Some("  REVIEW   design "),
                    updated_at_from: Some(15),
                    updated_at_before: Some(31),
                    ..list_query(root.path(), None, 50)
                },
            )
            .unwrap();
        assert_eq!(
            page.sessions
                .iter()
                .map(|record| record.client_session_id.as_str())
                .collect::<Vec<_>>(),
            vec!["japanese", "matching"]
        );

        let japanese_page = registry
            .list(
                &path,
                AgentSessionListQuery {
                    query: Some("設計"),
                    ..list_query(root.path(), None, 50)
                },
            )
            .unwrap();
        assert_eq!(japanese_page.sessions.len(), 1);
    }

    #[test]
    fn registry_cursor_is_query_scoped_and_survives_deleted_boundary_record() {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("registry.json");
        let registry = AgentSessionRegistry::default();
        for index in 0..3 {
            let mut item = record(&format!("session-{index}"), root.path(), index);
            item.title = "Search target".to_string();
            registry.insert(&path, item).unwrap();
        }
        let first = registry
            .list(
                &path,
                AgentSessionListQuery {
                    query: Some("search"),
                    ..list_query(root.path(), None, 1)
                },
            )
            .unwrap();
        let cursor = first.next_cursor.clone().unwrap();
        assert!(!cursor.contains(&root.path().to_string_lossy().to_string()));
        assert!(registry
            .list(
                &path,
                AgentSessionListQuery {
                    query: Some("different"),
                    cursor: Some(&cursor),
                    ..list_query(root.path(), None, 1)
                },
            )
            .unwrap_err()
            .contains("cursor"));

        registry
            .remove(&path, &first.sessions[0].client_session_id)
            .unwrap();
        let second = registry
            .list(
                &path,
                AgentSessionListQuery {
                    query: Some("search"),
                    cursor: Some(&cursor),
                    ..list_query(root.path(), None, 1)
                },
            )
            .unwrap();
        assert_eq!(second.sessions.len(), 1);
        assert_ne!(
            first.sessions[0].client_session_id,
            second.sessions[0].client_session_id
        );
    }

    #[test]
    fn registry_rejects_invalid_search_and_cursor_values() {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("registry.json");
        let registry = AgentSessionRegistry::default();
        let long_query = "a".repeat(MAX_SEARCH_QUERY_CHARS + 1);
        for query in [Some(long_query.as_str()), Some("bad\u{0}query")] {
            assert!(registry
                .list(
                    &path,
                    AgentSessionListQuery {
                        query,
                        ..list_query(root.path(), None, 10)
                    },
                )
                .is_err());
        }
        assert!(registry
            .list(
                &path,
                AgentSessionListQuery {
                    updated_at_from: Some(20),
                    updated_at_before: Some(20),
                    ..list_query(root.path(), None, 10)
                },
            )
            .is_err());
        assert!(registry
            .list(
                &path,
                AgentSessionListQuery {
                    cursor: Some("legacy-session-id"),
                    ..list_query(root.path(), None, 10)
                },
            )
            .is_err());
    }

    #[test]
    fn registry_rejects_unknown_version_and_duplicate_ids() {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("registry.json");
        fs::write(&path, r#"{"version":2,"sessions":[]}"#).unwrap();
        assert!(load_document(&path).unwrap_err().contains("version"));
        fs::write(
            &path,
            format!(
                r#"{{"version":1,"sessions":[{},{}]}}"#,
                serde_json::to_string(&record("same", root.path(), 1)).unwrap(),
                serde_json::to_string(&record("same", root.path(), 2)).unwrap()
            ),
        )
        .unwrap();
        assert!(load_document(&path).unwrap_err().contains("duplicate"));
    }

    #[cfg(unix)]
    #[test]
    fn registry_file_is_owner_only() {
        use std::os::unix::fs::PermissionsExt;
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("registry.json");
        AgentSessionRegistry::default()
            .insert(&path, record("secure", root.path(), 1))
            .unwrap();
        assert_eq!(
            fs::metadata(path).unwrap().permissions().mode() & 0o777,
            0o600
        );
    }
}
