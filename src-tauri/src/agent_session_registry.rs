use serde::{Deserialize, Serialize};
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
        provider_id: &str,
        workspace_root: &Path,
        archived: bool,
        cursor: Option<&str>,
        limit: usize,
    ) -> Result<RegistryPage, String> {
        let _guard = self
            .write_lock
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let mut sessions = load_document(path)?
            .sessions
            .into_iter()
            .filter(|record| {
                record.provider_id == provider_id
                    && record.workspace_root == workspace_root
                    && record.archived == archived
            })
            .collect::<Vec<_>>();
        sessions.sort_by(|left, right| {
            right
                .updated_at
                .cmp(&left.updated_at)
                .then_with(|| right.client_session_id.cmp(&left.client_session_id))
        });
        let start = cursor
            .and_then(|cursor| {
                sessions
                    .iter()
                    .position(|record| record.client_session_id == cursor)
            })
            .map(|index| index + 1)
            .unwrap_or(0);
        let page_size = limit.clamp(1, MAX_PAGE_SIZE);
        let page = sessions
            .into_iter()
            .skip(start)
            .take(page_size + 1)
            .collect::<Vec<_>>();
        let has_more = page.len() > page_size;
        let sessions = page.into_iter().take(page_size).collect::<Vec<_>>();
        let next_cursor = has_more
            .then(|| {
                sessions
                    .last()
                    .map(|record| record.client_session_id.clone())
            })
            .flatten();
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
            .list(&path, "codex-app-server", root.path(), false, None, 50)
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
            .list(&path, "codex-app-server", root.path(), false, None, 2)
            .unwrap();
        let second = registry
            .list(
                &path,
                "codex-app-server",
                root.path(),
                false,
                first.next_cursor.as_deref(),
                2,
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
