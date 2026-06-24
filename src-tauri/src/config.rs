use std::{fs, path::Path};

use crate::app_error::{AppError, AppErrorCode};
use crate::backend_types::{
    AppConfig, AsciiDocTheme, HttpProxyMode, KrokiMode, RemoteProviderConfig,
    RemoteProviderTestStatus, default_config,
};

pub(crate) fn load_config_from_path(path: &Path) -> Result<AppConfig, AppError> {
    if !path.exists() {
        return Ok(default_config());
    }

    let source = fs::read_to_string(path).map_err(|error| {
        AppError::new(AppErrorCode::Io, format!("failed to read config: {error}"))
    })?;
    let mut config: AppConfig = serde_json::from_str(&source).map_err(|error| {
        AppError::new(
            AppErrorCode::ConfigParse,
            format!("failed to parse config: {error}"),
        )
    })?;
    normalize_config(&mut config);
    Ok(config)
}

fn normalize_config(config: &mut AppConfig) {
    if config.reader.asciidoc_theme != AsciiDocTheme::Asciidoctor {
        config.reader.asciidoc_theme = AsciiDocTheme::Antora;
    }
    if config.kroki.mode == KrokiMode::Local {
        config.kroki.mode = KrokiMode::Remote;
    }
    if config.network.http_proxy.mode != HttpProxyMode::Custom {
        config.network.http_proxy.mode = HttpProxyMode::Disabled;
    }
    config.network.http_proxy.url = config
        .network
        .http_proxy
        .url
        .as_ref()
        .map(|url| url.trim())
        .filter(|url| !url.is_empty())
        .map(ToString::to_string);
    normalize_remote_provider(&mut config.remote_providers.github, "https://github.com");
    normalize_remote_provider(&mut config.remote_providers.gitlab, "https://gitlab.com");
}

fn normalize_remote_provider(provider: &mut RemoteProviderConfig, fallback_host: &str) {
    provider.host_url = provider.host_url.trim().to_string();
    if provider.host_url.is_empty() {
        provider.host_url = fallback_host.to_string();
    }
    provider.last_test_status = provider.last_test_status.as_ref().and_then(|status| {
        if matches!(status.status.as_str(), "untested" | "ok" | "error") {
            Some(RemoteProviderTestStatus {
                status: status.status.clone(),
                message: status
                    .message
                    .as_ref()
                    .map(|message| message.trim())
                    .filter(|message| !message.is_empty())
                    .map(ToString::to_string),
            })
        } else {
            None
        }
    });
}

pub(crate) fn save_config_to_path(path: &Path, config: &AppConfig) -> Result<(), AppError> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            AppError::new(
                AppErrorCode::Io,
                format!("failed to create config dir: {error}"),
            )
        })?;
    }

    let source = serde_json::to_string_pretty(config).map_err(|error| {
        AppError::new(
            AppErrorCode::ConfigSerialize,
            format!("failed to serialize config: {error}"),
        )
    })?;
    fs::write(path, format!("{source}\n")).map_err(|error| {
        AppError::new(AppErrorCode::Io, format!("failed to write config: {error}"))
    })
}
