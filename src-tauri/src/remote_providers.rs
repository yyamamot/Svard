use std::path::Path;

use reqwest::blocking::Client;
use reqwest::header::{ACCEPT, AUTHORIZATION, HeaderMap, HeaderValue, USER_AGENT};
use serde::Deserialize;
use url::Url;

use crate::backend_types::{
    HttpProxyConfig, HttpProxyMode, NetworkConfig, ProviderTokenStatus, RemoteProviderConfig,
    RemoteProviderTestStatus, RemoteProvidersConfig,
};
use crate::git_diff::GitBranchDiffProviderBaseCandidate;

const SECRET_SERVICE: &str = "svard";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RemoteProviderKind {
    Github,
    Gitlab,
}

impl RemoteProviderKind {
    pub fn parse(value: &str) -> Result<Self, String> {
        match value {
            "github" => Ok(Self::Github),
            "gitlab" => Ok(Self::Gitlab),
            _ => Err("Unsupported remote provider.".to_string()),
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::Github => "github",
            Self::Gitlab => "gitlab",
        }
    }
}

pub fn save_provider_token_inner(
    provider: &str,
    host_url: &str,
    token: &str,
) -> Result<ProviderTokenStatus, String> {
    let provider = RemoteProviderKind::parse(provider)?;
    let normalized_host = normalize_host_url(host_url)?;
    let token = token.trim();
    if token.is_empty() {
        return Err("Provider token cannot be empty.".to_string());
    }
    secret_entry(provider, &normalized_host)?
        .set_password(token)
        .map_err(|_| "Failed to store provider token in the OS credential store.".to_string())?;
    Ok(ProviderTokenStatus {
        stored: true,
        message: Some("Token stored in OS credential store.".to_string()),
    })
}

pub fn delete_provider_token_inner(
    provider: &str,
    host_url: &str,
) -> Result<ProviderTokenStatus, String> {
    let provider = RemoteProviderKind::parse(provider)?;
    let normalized_host = normalize_host_url(host_url)?;
    match secret_entry(provider, &normalized_host)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(ProviderTokenStatus {
            stored: false,
            message: Some("Token removed from OS credential store.".to_string()),
        }),
        Err(_) => Err("Failed to remove provider token from the OS credential store.".to_string()),
    }
}

pub fn get_provider_token_status_inner(
    provider: &str,
    host_url: &str,
) -> Result<ProviderTokenStatus, String> {
    let provider = RemoteProviderKind::parse(provider)?;
    let normalized_host = normalize_host_url(host_url)?;
    Ok(ProviderTokenStatus {
        stored: read_provider_token(provider, &normalized_host)?.is_some(),
        message: None,
    })
}

pub fn test_provider_connection_inner(
    provider: &str,
    host_url: &str,
    network: &NetworkConfig,
) -> Result<RemoteProviderTestStatus, String> {
    let provider = RemoteProviderKind::parse(provider)?;
    let normalized_host = normalize_host_url(host_url)?;
    let Some(token) = read_provider_token(provider, &normalized_host)? else {
        return Ok(RemoteProviderTestStatus {
            status: "error".to_string(),
            message: Some("Token is not configured.".to_string()),
        });
    };
    let client = provider_client(&network.http_proxy)?;
    let result = match provider {
        RemoteProviderKind::Github => github_get_user(&client, &normalized_host, &token),
        RemoteProviderKind::Gitlab => gitlab_get_user(&client, &normalized_host, &token),
    };
    match result {
        Ok(()) => Ok(RemoteProviderTestStatus {
            status: "ok".to_string(),
            message: Some("Connection test succeeded.".to_string()),
        }),
        Err(message) => Ok(RemoteProviderTestStatus {
            status: "error".to_string(),
            message: Some(message),
        }),
    }
}

pub fn detect_provider_base_candidates(
    workdir: &Path,
    current_branch: Option<&str>,
    local_candidates: &[String],
    providers: Option<&RemoteProvidersConfig>,
    network: Option<&NetworkConfig>,
) -> Vec<GitBranchDiffProviderBaseCandidate> {
    let Some(current_branch) = current_branch.filter(|branch| !branch.trim().is_empty()) else {
        return Vec::new();
    };
    let Some(providers) = providers else {
        return Vec::new();
    };
    let remote_url = match origin_remote_url(workdir) {
        Ok(value) => value,
        Err(_) => return Vec::new(),
    };
    let Some(remote) = parse_remote_url(&remote_url) else {
        return Vec::new();
    };
    let Some((kind, config)) = matching_provider_config(&remote, providers) else {
        return Vec::new();
    };
    if !config.enabled || !config.token_stored {
        return Vec::new();
    }
    let Ok(normalized_host) = normalize_host_url(&config.host_url) else {
        return Vec::new();
    };
    let Ok(Some(token)) = read_provider_token(kind, &normalized_host) else {
        return Vec::new();
    };
    let fallback_network = NetworkConfig {
        http_proxy: HttpProxyConfig {
            mode: HttpProxyMode::Disabled,
            url: None,
        },
    };
    let network = network.unwrap_or(&fallback_network);
    let Ok(client) = provider_client(&network.http_proxy) else {
        return Vec::new();
    };
    let targets = match kind {
        RemoteProviderKind::Github => github_pull_targets(
            &client,
            &normalized_host,
            &remote.path,
            current_branch,
            &token,
        ),
        RemoteProviderKind::Gitlab => gitlab_merge_request_targets(
            &client,
            &normalized_host,
            &remote.path,
            current_branch,
            &token,
        ),
    };
    targets
        .unwrap_or_default()
        .into_iter()
        .map(|target| provider_candidate(kind, current_branch, &target, local_candidates))
        .collect()
}

pub fn normalize_host_url(value: &str) -> Result<String, String> {
    let trimmed = value.trim().trim_end_matches('/');
    let url = Url::parse(trimmed).map_err(|_| "Provider host URL is invalid.".to_string())?;
    match url.scheme() {
        "http" | "https" => {}
        _ => return Err("Provider host URL must use http or https.".to_string()),
    }
    let host = url
        .host_str()
        .ok_or_else(|| "Provider host URL must include a host.".to_string())?;
    Ok(format!("{}://{}", url.scheme(), host))
}

fn secret_entry(
    provider: RemoteProviderKind,
    normalized_host: &str,
) -> Result<keyring::Entry, String> {
    keyring::Entry::new(
        SECRET_SERVICE,
        &format!("{}:{normalized_host}", provider.as_str()),
    )
    .map_err(|_| "OS credential store is unavailable.".to_string())
}

fn read_provider_token(
    provider: RemoteProviderKind,
    normalized_host: &str,
) -> Result<Option<String>, String> {
    match secret_entry(provider, normalized_host)?.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(_) => Err("Failed to read provider token from the OS credential store.".to_string()),
    }
}

fn provider_client(proxy: &HttpProxyConfig) -> Result<Client, String> {
    let mut builder = Client::builder().timeout(std::time::Duration::from_secs(10));
    if proxy.mode == "custom" {
        if let Some(url) = proxy.url.as_ref().filter(|url| !url.trim().is_empty()) {
            let proxy =
                reqwest::Proxy::all(url).map_err(|_| "HTTP proxy URL is invalid.".to_string())?;
            builder = builder.proxy(proxy);
        }
    }
    builder
        .build()
        .map_err(|_| "Failed to create provider HTTP client.".to_string())
}

fn github_headers(token: &str) -> Result<HeaderMap, String> {
    let mut headers = HeaderMap::new();
    headers.insert(USER_AGENT, HeaderValue::from_static("svard"));
    headers.insert(
        ACCEPT,
        HeaderValue::from_static("application/vnd.github+json"),
    );
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&format!("Bearer {token}"))
            .map_err(|_| "Provider token is invalid.".to_string())?,
    );
    Ok(headers)
}

fn gitlab_headers(token: &str) -> Result<HeaderMap, String> {
    let mut headers = HeaderMap::new();
    headers.insert(USER_AGENT, HeaderValue::from_static("svard"));
    headers.insert(
        "PRIVATE-TOKEN",
        HeaderValue::from_str(token).map_err(|_| "Provider token is invalid.".to_string())?,
    );
    Ok(headers)
}

fn github_api_base(host: &str) -> String {
    if host == "https://github.com" {
        "https://api.github.com".to_string()
    } else {
        format!("{host}/api/v3")
    }
}

fn gitlab_api_base(host: &str) -> String {
    format!("{host}/api/v4")
}

fn github_get_user(client: &Client, host: &str, token: &str) -> Result<(), String> {
    let response = client
        .get(format!("{}/user", github_api_base(host)))
        .headers(github_headers(token)?)
        .send()
        .map_err(|_| "GitHub connection failed.".to_string())?;
    if response.status().is_success() {
        Ok(())
    } else {
        Err(provider_status_message(
            "GitHub",
            response.status().as_u16(),
        ))
    }
}

fn gitlab_get_user(client: &Client, host: &str, token: &str) -> Result<(), String> {
    let response = client
        .get(format!("{}/user", gitlab_api_base(host)))
        .headers(gitlab_headers(token)?)
        .send()
        .map_err(|_| "GitLab connection failed.".to_string())?;
    if response.status().is_success() {
        Ok(())
    } else {
        Err(provider_status_message(
            "GitLab",
            response.status().as_u16(),
        ))
    }
}

fn github_pull_targets(
    client: &Client,
    host: &str,
    repo_path: &str,
    branch: &str,
    token: &str,
) -> Result<Vec<String>, String> {
    let owner = repo_path.split('/').next().unwrap_or_default();
    let response = client
        .get(format!("{}/repos/{repo_path}/pulls", github_api_base(host)))
        .query(&[("state", "open"), ("head", &format!("{owner}:{branch}"))])
        .headers(github_headers(token)?)
        .send()
        .map_err(|_| "GitHub PR lookup failed.".to_string())?;
    if !response.status().is_success() {
        return Err(provider_status_message(
            "GitHub",
            response.status().as_u16(),
        ));
    }
    let pulls: Vec<GithubPull> = response
        .json()
        .map_err(|_| "GitHub PR response could not be parsed.".to_string())?;
    Ok(pulls.into_iter().map(|pull| pull.base.ref_name).collect())
}

fn gitlab_merge_request_targets(
    client: &Client,
    host: &str,
    project_path: &str,
    branch: &str,
    token: &str,
) -> Result<Vec<String>, String> {
    let project = urlencoding::encode(project_path);
    let response = client
        .get(format!(
            "{}/projects/{project}/merge_requests",
            gitlab_api_base(host)
        ))
        .query(&[("state", "opened"), ("source_branch", branch)])
        .headers(gitlab_headers(token)?)
        .send()
        .map_err(|_| "GitLab MR lookup failed.".to_string())?;
    if !response.status().is_success() {
        return Err(provider_status_message(
            "GitLab",
            response.status().as_u16(),
        ));
    }
    let merge_requests: Vec<GitlabMergeRequest> = response
        .json()
        .map_err(|_| "GitLab MR response could not be parsed.".to_string())?;
    Ok(merge_requests
        .into_iter()
        .map(|merge_request| merge_request.target_branch)
        .collect())
}

fn provider_status_message(provider: &str, status: u16) -> String {
    match status {
        401 | 403 => format!("{provider} authentication failed."),
        404 => format!("{provider} repository was not found."),
        429 => format!("{provider} rate limit was reached."),
        _ => format!("{provider} request failed."),
    }
}

#[derive(Debug, Deserialize)]
struct GithubPull {
    base: GithubPullBase,
}

#[derive(Debug, Deserialize)]
struct GithubPullBase {
    #[serde(rename = "ref")]
    ref_name: String,
}

#[derive(Debug, Deserialize)]
struct GitlabMergeRequest {
    target_branch: String,
}

struct ParsedRemote {
    host: String,
    path: String,
}

fn parse_remote_url(value: &str) -> Option<ParsedRemote> {
    if let Ok(url) = Url::parse(value) {
        let host = url.host_str()?.to_string();
        let path = normalize_repo_path(url.path().trim_start_matches('/'))?;
        return Some(ParsedRemote { host, path });
    }
    let (user_host, path) = value.split_once(':')?;
    let host = user_host
        .rsplit_once('@')
        .map_or(user_host, |(_, host)| host);
    Some(ParsedRemote {
        host: host.to_string(),
        path: normalize_repo_path(path)?,
    })
}

fn normalize_repo_path(path: &str) -> Option<String> {
    let path = path.trim().trim_end_matches(".git").trim_matches('/');
    if path.is_empty() {
        None
    } else {
        Some(path.to_string())
    }
}

fn matching_provider_config<'a>(
    remote: &ParsedRemote,
    providers: &'a RemoteProvidersConfig,
) -> Option<(RemoteProviderKind, &'a RemoteProviderConfig)> {
    let github_host = normalize_host_url(&providers.github.host_url)
        .ok()
        .and_then(|host| Url::parse(&host).ok())
        .and_then(|url| url.host_str().map(ToString::to_string));
    if github_host.as_deref() == Some(remote.host.as_str()) {
        return Some((RemoteProviderKind::Github, &providers.github));
    }
    let gitlab_host = normalize_host_url(&providers.gitlab.host_url)
        .ok()
        .and_then(|host| Url::parse(&host).ok())
        .and_then(|url| url.host_str().map(ToString::to_string));
    if gitlab_host.as_deref() == Some(remote.host.as_str()) {
        return Some((RemoteProviderKind::Gitlab, &providers.gitlab));
    }
    None
}

fn provider_candidate(
    provider: RemoteProviderKind,
    source_branch: &str,
    target_branch: &str,
    local_candidates: &[String],
) -> GitBranchDiffProviderBaseCandidate {
    let remote_ref = format!("origin/{target_branch}");
    let base_ref = if local_candidates
        .iter()
        .any(|candidate| candidate == &remote_ref)
    {
        remote_ref
    } else if local_candidates
        .iter()
        .any(|candidate| candidate == target_branch)
    {
        target_branch.to_string()
    } else {
        remote_ref
    };
    let available = local_candidates
        .iter()
        .any(|candidate| candidate == &base_ref);
    let provider_label = match provider {
        RemoteProviderKind::Github => "PR target",
        RemoteProviderKind::Gitlab => "MR target",
    };
    GitBranchDiffProviderBaseCandidate {
        provider: provider.as_str().to_string(),
        label: format!("{provider_label}: {base_ref}"),
        base_ref,
        source_branch: source_branch.to_string(),
        target_branch: target_branch.to_string(),
        available,
        message: if available {
            None
        } else {
            Some("Target branch was detected but local ref is unavailable.".to_string())
        },
    }
}

fn origin_remote_url(workdir: &Path) -> Result<String, String> {
    let repo = gix::discover(workdir).map_err(|_| "Git repository was not found.".to_string())?;
    let remote = repo
        .find_remote("origin")
        .map_err(|_| "Git origin remote was not found.".to_string())?;
    remote
        .url(gix::remote::Direction::Fetch)
        .map(|url| url.to_bstring().to_string())
        .ok_or_else(|| "Git origin remote URL was not found.".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn parses_github_https_remote() {
        let remote = parse_remote_url("https://github.com/acme/docs.git").unwrap();
        assert_eq!(remote.host, "github.com");
        assert_eq!(remote.path, "acme/docs");
    }

    #[test]
    fn parses_gitlab_ssh_remote_with_nested_project() {
        let remote = parse_remote_url("git@gitlab.example.com:group/sub/docs.git").unwrap();
        assert_eq!(remote.host, "gitlab.example.com");
        assert_eq!(remote.path, "group/sub/docs");
    }

    #[test]
    fn provider_candidate_prefers_available_remote_ref() {
        let candidate = provider_candidate(
            RemoteProviderKind::Github,
            "feature/docs",
            "main",
            &["origin/main".to_string(), "main".to_string()],
        );
        assert_eq!(candidate.base_ref, "origin/main");
        assert!(candidate.available);
    }

    #[test]
    fn provider_candidate_marks_missing_local_ref_unavailable() {
        let candidate =
            provider_candidate(RemoteProviderKind::Gitlab, "feature/docs", "release", &[]);
        assert_eq!(candidate.base_ref, "origin/release");
        assert!(!candidate.available);
        assert!(candidate.message.is_some());
    }

    #[test]
    fn origin_remote_url_reads_remote_without_git_cli() {
        let dir = tempdir().expect("temp dir");
        gix::init(dir.path()).expect("init repository");
        fs::write(
            dir.path().join(".git").join("config"),
            "[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = false\n[remote \"origin\"]\n\turl = https://github.com/acme/docs.git\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n",
        )
        .expect("write config");

        let url = origin_remote_url(dir.path()).expect("origin remote URL");

        assert_eq!(url, "https://github.com/acme/docs.git");
    }
}
