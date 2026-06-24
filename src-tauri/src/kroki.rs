use base64::{Engine as _, engine::general_purpose};
use sha2::{Digest, Sha256};
use std::{fs, io::Read, path::Path, time::Duration};
use url::Url;

use crate::{
    KrokiConfig, KrokiRequest, KrokiResult, prune_cache_dir, remove_oversized_cache_file,
    touch_cache_file,
};

pub(crate) const PUBLIC_KROKI_ENDPOINT: &str = "https://kroki.io";

const KROKI_MIN_TIMEOUT_MS: u64 = 1_000;
const KROKI_MAX_TIMEOUT_MS: u64 = 60_000;
const KROKI_MIN_BODY_BYTES: u64 = 1;
const KROKI_MAX_BODY_BYTES: u64 = 2 * 1024 * 1024;
const KROKI_MAX_CACHE_ENTRY_BYTES: usize = 2 * 1024 * 1024;
const KROKI_MAX_CACHE_TOTAL_BYTES: u64 = 128 * 1024 * 1024;
const KROKI_DIAGRAM_TYPES: &[&str] = &[
    "actdiag",
    "blockdiag",
    "bpmn",
    "bytefield",
    "c4plantuml",
    "d2",
    "dbml",
    "ditaa",
    "erd",
    "excalidraw",
    "graphviz",
    "mermaid",
    "nomnoml",
    "nwdiag",
    "packetdiag",
    "pikchr",
    "plantuml",
    "rackdiag",
    "seqdiag",
    "structurizr",
    "svgbob",
    "symbolator",
    "tikz",
    "umlet",
    "vega",
    "vegalite",
    "wavedrom",
    "wireviz",
];

pub(crate) fn render_diagram_with_cache_dir(
    input: KrokiRequest,
    cache_dir: &Path,
) -> Result<KrokiResult, String> {
    let mode = validate_kroki_mode(input.config.mode.as_str())?;
    let output_format = validate_kroki_output_format(input.config.output_format.as_str())?;
    let diagram_type = validate_kroki_diagram_type(&input.diagram_type)?;
    let timeout_ms = validate_kroki_timeout(input.config.timeout_ms)?;
    let max_body_bytes = validate_kroki_body_limit(input.config.max_body_bytes)?;

    if mode == "disabled" {
        return Ok(KrokiResult {
            status: "disabled".to_string(),
            message: Some(
                "Kroki is disabled. Configure a self-managed endpoint in Preferences.".to_string(),
            ),
            artifact_url: None,
            media_type: None,
            content: None,
            cache_status: Some("disabled".to_string()),
        });
    }

    if input.source.len() > max_body_bytes as usize {
        return Ok(KrokiResult {
            status: "error".to_string(),
            message: Some("Diagram source exceeds configured Kroki body limit.".to_string()),
            artifact_url: None,
            media_type: None,
            content: None,
            cache_status: Some("not-written".to_string()),
        });
    }

    if requires_remote_confirmation(mode, &input.config)
        && input.confirmed_remote_send != Some(true)
    {
        return Ok(KrokiResult {
            status: "error".to_string(),
            message: Some(format!(
                "{} Kroki rendering requires an explicit per-request confirmation before sending diagram source.",
                mode
            )),
            artifact_url: None,
            media_type: None,
            content: None,
            cache_status: Some("not-written".to_string()),
        });
    }

    let endpoint = match endpoint_for_config(&input.config)
        .and_then(|endpoint| validate_kroki_endpoint(&endpoint).map(|_| endpoint))
    {
        Ok(endpoint) => endpoint,
        Err(message) => return Ok(error_result(message)),
    };
    let media_type = media_type_for_format(output_format).to_string();
    let cache_file = cache_dir.join(cache_file_name(
        diagram_type,
        output_format,
        &input.source,
        &endpoint,
    ));

    if input.config.cache_enabled && cache_file.exists() {
        let metadata = fs::metadata(&cache_file)
            .map_err(|error| format!("failed to read Kroki cache metadata: {error}"))?;
        if metadata.len() as usize > KROKI_MAX_CACHE_ENTRY_BYTES {
            let _ = remove_oversized_cache_file(&cache_file);
        } else {
            let _ = touch_cache_file(&cache_file);
            let content = fs::read_to_string(&cache_file)
                .map_err(|error| format!("failed to read Kroki cache: {error}"))?;
            return Ok(KrokiResult {
                status: "rendered".to_string(),
                message: Some("Rendered from Kroki cache.".to_string()),
                artifact_url: None,
                media_type: Some(media_type),
                content: Some(content),
                cache_status: Some("hit".to_string()),
            });
        }
    }

    let render_url = format!(
        "{}/{}/{}",
        endpoint.trim_end_matches('/'),
        diagram_type,
        output_format
    );
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_millis(timeout_ms))
        .build()
        .map_err(|_| "Failed to initialize Kroki client.".to_string());
    let client = match client {
        Ok(client) => client,
        Err(message) => return Ok(error_result(message)),
    };
    let response = client
        .post(render_url)
        .header(reqwest::header::CONTENT_TYPE, "text/plain; charset=utf-8")
        .body(input.source)
        .send()
        .map_err(|error| {
            if error.is_timeout() {
                "Kroki endpoint timed out.".to_string()
            } else {
                "Kroki endpoint is unreachable.".to_string()
            }
        });
    let response = match response {
        Ok(response) => response,
        Err(message) => return Ok(error_result(message)),
    };

    if !response.status().is_success() {
        return Ok(KrokiResult {
            status: "error".to_string(),
            message: Some(format!(
                "Kroki endpoint returned HTTP {}.",
                response.status()
            )),
            artifact_url: None,
            media_type: None,
            content: None,
            cache_status: Some("not-written".to_string()),
        });
    }

    let mut limited_response = response.take((KROKI_MAX_CACHE_ENTRY_BYTES + 1) as u64);
    let mut response_bytes = Vec::new();
    if limited_response.read_to_end(&mut response_bytes).is_err() {
        return Ok(error_result("Failed to read Kroki response.".to_string()));
    }
    if response_bytes.len() > KROKI_MAX_CACHE_ENTRY_BYTES {
        return Ok(KrokiResult {
            status: "error".to_string(),
            message: Some("Kroki response exceeds supported size.".to_string()),
            artifact_url: None,
            media_type: None,
            content: None,
            cache_status: Some("not-written".to_string()),
        });
    }
    let content = if output_format == "png" {
        general_purpose::STANDARD.encode(response_bytes)
    } else {
        match String::from_utf8(response_bytes) {
            Ok(content) => content,
            Err(_) => {
                return Ok(error_result(
                    "Kroki SVG response is not valid UTF-8.".to_string(),
                ));
            }
        }
    };

    let should_write_cache =
        input.config.cache_enabled && content.len() <= KROKI_MAX_CACHE_ENTRY_BYTES;
    let mut cache_status = if input.config.cache_enabled {
        "not-written"
    } else {
        "disabled"
    };
    if should_write_cache {
        let write_result = fs::create_dir_all(cache_dir)
            .map_err(|error| format!("failed to create Kroki cache dir: {error}"))
            .and_then(|_| {
                fs::write(&cache_file, &content)
                    .map_err(|error| format!("failed to write Kroki cache: {error}"))
            });
        if write_result.is_ok() {
            cache_status = "miss";
            let _ = prune_cache_dir(cache_dir, KROKI_MAX_CACHE_TOTAL_BYTES);
        }
    }

    Ok(KrokiResult {
        status: "rendered".to_string(),
        message: Some("Rendered by Kroki endpoint.".to_string()),
        artifact_url: None,
        media_type: Some(media_type),
        content: Some(content),
        cache_status: Some(cache_status.to_string()),
    })
}

pub(crate) fn clear_kroki_cache_dir(cache_dir: &Path) -> Result<(), String> {
    if cache_dir.exists() {
        fs::remove_dir_all(cache_dir).map_err(|error| {
            format!(
                "failed to clear Kroki cache {}: {error}",
                cache_dir.display()
            )
        })?;
    }
    Ok(())
}

fn endpoint_for_config(config: &KrokiConfig) -> Result<String, String> {
    if config.mode == "public" {
        return Ok(PUBLIC_KROKI_ENDPOINT.to_string());
    }

    config
        .endpoint_url
        .clone()
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "Kroki endpoint URL is required for this mode.".to_string())
}

fn error_result(message: String) -> KrokiResult {
    KrokiResult {
        status: "error".to_string(),
        message: Some(message),
        artifact_url: None,
        media_type: None,
        content: None,
        cache_status: Some("not-written".to_string()),
    }
}

fn requires_remote_confirmation(mode: &str, config: &KrokiConfig) -> bool {
    mode == "public" || (mode == "remote" && config.require_remote_confirmation)
}

pub(crate) fn validate_kroki_mode(mode: &str) -> Result<&str, String> {
    match mode {
        "disabled" | "remote" | "public" => Ok(mode),
        _ => Err("Unsupported Kroki mode.".to_string()),
    }
}

pub(crate) fn validate_kroki_output_format(format: &str) -> Result<&str, String> {
    match format {
        "svg" | "png" => Ok(format),
        _ => Err("Unsupported Kroki output format.".to_string()),
    }
}

pub(crate) fn validate_kroki_diagram_type(diagram_type: &str) -> Result<&str, String> {
    if KROKI_DIAGRAM_TYPES.contains(&diagram_type) {
        Ok(diagram_type)
    } else {
        Err("Unsupported Kroki diagram type.".to_string())
    }
}

pub(crate) fn validate_kroki_timeout(timeout_ms: u64) -> Result<u64, String> {
    if (KROKI_MIN_TIMEOUT_MS..=KROKI_MAX_TIMEOUT_MS).contains(&timeout_ms) {
        Ok(timeout_ms)
    } else {
        Err("Kroki timeout is outside the supported range.".to_string())
    }
}

pub(crate) fn validate_kroki_body_limit(max_body_bytes: u64) -> Result<u64, String> {
    if (KROKI_MIN_BODY_BYTES..=KROKI_MAX_BODY_BYTES).contains(&max_body_bytes) {
        Ok(max_body_bytes)
    } else {
        Err("Kroki body limit is outside the supported range.".to_string())
    }
}

pub(crate) fn validate_kroki_endpoint(endpoint: &str) -> Result<(), String> {
    let url = Url::parse(endpoint).map_err(|_| "Invalid Kroki endpoint URL.".to_string())?;
    match url.scheme() {
        "http" | "https" => {}
        _ => return Err("Kroki endpoint URL must use http or https.".to_string()),
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err("Kroki endpoint URL must not include credentials.".to_string());
    }
    if url.host_str().is_none() {
        return Err("Kroki endpoint URL must include a host.".to_string());
    }

    Ok(())
}

fn media_type_for_format(format: &str) -> &'static str {
    match format {
        "png" => "image/png",
        _ => "image/svg+xml",
    }
}

pub(crate) fn cache_file_name(
    diagram_type: &str,
    output_format: &str,
    source: &str,
    endpoint: &str,
) -> String {
    let mut hasher = Sha256::new();
    hasher.update(endpoint.as_bytes());
    hasher.update(diagram_type.as_bytes());
    hasher.update(output_format.as_bytes());
    hasher.update(source.as_bytes());
    format!("{:x}.{output_format}", hasher.finalize())
}
