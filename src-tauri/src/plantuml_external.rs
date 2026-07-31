use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::mpsc,
    thread,
    time::{Duration, Instant, UNIX_EPOCH},
};

use crate::{
    prune_cache_dir, remove_oversized_cache_file, touch_cache_file, ExternalPlantUmlRenderInput,
    ExternalPlantUmlTestInput, PlantUmlRenderMetrics, PlantUmlRenderResult,
};

const MIN_TIMEOUT_MS: u64 = 1_000;
const MAX_TIMEOUT_MS: u64 = 60_000;
const MAX_STDOUT_BYTES: usize = 2 * 1024 * 1024;
const MAX_STDERR_BYTES: usize = 64 * 1024;
const PIPE_DRAIN_GRACE_MS: u64 = 1_000;
const MAX_CACHE_TOTAL_BYTES: u64 = 128 * 1024 * 1024;
const EXTERNAL_PLANTUML_CACHE_VERSION: &str = "plantuml-external-v1";
const TEST_SOURCE: &str = "@startuml\nAlice -> Bob: test\n@enduml\n";

pub(crate) fn render_external_plantuml_with_cache_dir(
    input: ExternalPlantUmlRenderInput,
    cache_dir: &Path,
) -> Result<PlantUmlRenderResult, String> {
    let binary_path = match validate_user_path(input.binary_path.as_deref()) {
        Ok(path) => path,
        Err(message) => return Ok(error_result("error", &message, 0, "disabled")),
    };
    let dot_path = match validate_optional_user_path(input.dot_path.as_deref()) {
        Ok(path) => path,
        Err(message) => return Ok(error_result("error", &message, 0, "disabled")),
    };
    let timeout_ms = validate_timeout(input.timeout_ms);
    let key = external_cache_key(&input.source, &input.theme, &binary_path, dot_path.as_ref())?;
    let cache_file = cache_dir.join(format!("{key}.svg"));

    if cache_file.exists() {
        let metadata = fs::metadata(&cache_file)
            .map_err(|error| format!("failed to read external PlantUML cache metadata: {error}"))?;
        if metadata.len() as usize > MAX_STDOUT_BYTES {
            let _ = remove_oversized_cache_file(&cache_file);
        } else {
            let _ = touch_cache_file(&cache_file);
            let svg = fs::read_to_string(&cache_file)
                .map_err(|error| format!("failed to read external PlantUML cache: {error}"))?;
            return Ok(rendered(svg, 0, "hit", Some("persistent")));
        }
    }

    let started = Instant::now();
    let output =
        match run_plantuml_command(&binary_path, dot_path.as_ref(), &input.source, timeout_ms) {
            Ok(output) => output,
            Err(message) => return Ok(error_result("error", &message, 0, "not-written")),
        };
    let render_ms = started.elapsed().as_millis() as u64;

    if output.timed_out {
        return Ok(error_result(
            "timeout",
            "External PlantUML render timed out.",
            render_ms,
            "not-written",
        ));
    }
    if !output.status_success {
        return Ok(error_result(
            "error",
            "External PlantUML returned an error.",
            render_ms,
            "not-written",
        ));
    }
    if output.stdout.len() > MAX_STDOUT_BYTES {
        return Ok(error_result(
            "error",
            "External PlantUML SVG output exceeded the size limit.",
            render_ms,
            "not-written",
        ));
    }
    let svg = String::from_utf8(output.stdout)
        .map_err(|_| "External PlantUML returned non-UTF-8 output instead of SVG.".to_string())?;
    if !looks_like_svg(&svg) {
        return Ok(error_result(
            "error",
            "External PlantUML did not return SVG output.",
            render_ms,
            "not-written",
        ));
    }

    let mut cache_status = "not-written";
    if fs::create_dir_all(cache_dir).is_ok() && fs::write(&cache_file, &svg).is_ok() {
        cache_status = "miss";
        let _ = prune_cache_dir(cache_dir, MAX_CACHE_TOTAL_BYTES);
    }

    Ok(rendered(svg, render_ms, cache_status, Some("persistent")))
}

pub(crate) fn test_external_plantuml(
    input: ExternalPlantUmlTestInput,
) -> Result<PlantUmlRenderResult, String> {
    let binary_path = validate_user_path(input.binary_path.as_deref())?;
    let dot_path = validate_optional_user_path(input.dot_path.as_deref())?;
    let timeout_ms = validate_timeout(input.timeout_ms);
    let started = Instant::now();
    let output = run_plantuml_command(&binary_path, dot_path.as_ref(), TEST_SOURCE, timeout_ms)?;
    let render_ms = started.elapsed().as_millis() as u64;
    if output.timed_out {
        return Ok(error_result(
            "timeout",
            "External PlantUML test timed out.",
            render_ms,
            "disabled",
        ));
    }
    if !output.status_success {
        return Ok(error_result(
            "error",
            "External PlantUML test returned an error.",
            render_ms,
            "disabled",
        ));
    }
    if output.stdout.len() > MAX_STDOUT_BYTES {
        return Ok(error_result(
            "error",
            "External PlantUML test SVG output exceeded the size limit.",
            render_ms,
            "disabled",
        ));
    }
    let svg = String::from_utf8(output.stdout).map_err(|_| {
        "External PlantUML test returned non-UTF-8 output instead of SVG.".to_string()
    })?;
    if !looks_like_svg(&svg) {
        return Ok(error_result(
            "error",
            "External PlantUML test did not return SVG output.",
            render_ms,
            "disabled",
        ));
    }
    Ok(rendered(svg, render_ms, "disabled", None))
}

struct CommandOutput {
    status_success: bool,
    timed_out: bool,
    stdout: Vec<u8>,
}

fn run_plantuml_command(
    binary_path: &Path,
    dot_path: Option<&PathBuf>,
    source: &str,
    timeout_ms: u64,
) -> Result<CommandOutput, String> {
    let mut command = Command::new(binary_path);
    command.args(["-tsvg", "-pipe"]);
    if let Some(dot_path) = dot_path {
        command.env("GRAPHVIZ_DOT", dot_path);
    }
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = command
        .spawn()
        .map_err(|_| "Failed to start external PlantUML binary.".to_string())?;
    if let Some(mut stdin) = child.stdin.take() {
        let source = source.as_bytes().to_vec();
        thread::spawn(move || {
            let _ = stdin.write_all(&source);
        });
    }

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let stdout_reader = spawn_limited_reader(stdout, MAX_STDOUT_BYTES + 1);
    let stderr_reader = spawn_limited_reader(stderr, MAX_STDERR_BYTES);

    let deadline = Instant::now() + Duration::from_millis(timeout_ms);
    let mut timed_out = false;
    let status_success = loop {
        match child
            .try_wait()
            .map_err(|_| "Failed to wait for external PlantUML.".to_string())?
        {
            Some(status) => break status.success(),
            None if Instant::now() >= deadline => {
                timed_out = true;
                let _ = child.kill();
                let _ = child.wait();
                break false;
            }
            None => thread::sleep(Duration::from_millis(10)),
        }
    };

    let pipe_drain_deadline = Instant::now() + Duration::from_millis(PIPE_DRAIN_GRACE_MS);
    let stdout = recv_limited_reader_until(stdout_reader, pipe_drain_deadline);
    let _stderr = recv_limited_reader_until(stderr_reader, pipe_drain_deadline);

    Ok(CommandOutput {
        status_success,
        timed_out,
        stdout,
    })
}

fn spawn_limited_reader<R: Read + Send + 'static>(
    reader: Option<R>,
    max_bytes: usize,
) -> mpsc::Receiver<Vec<u8>> {
    let (sender, receiver) = mpsc::channel();
    thread::spawn(move || {
        let _ = sender.send(read_limited(reader, max_bytes));
    });
    receiver
}

fn recv_limited_reader_until(receiver: mpsc::Receiver<Vec<u8>>, deadline: Instant) -> Vec<u8> {
    receiver
        .recv_timeout(deadline.saturating_duration_since(Instant::now()))
        .unwrap_or_else(|_| Vec::new())
}

fn read_limited<R: Read>(reader: Option<R>, max_bytes: usize) -> Vec<u8> {
    let Some(mut reader) = reader else {
        return Vec::new();
    };
    let mut buffer = Vec::new();
    let mut chunk = [0_u8; 8192];
    loop {
        match reader.read(&mut chunk) {
            Ok(0) | Err(_) => break,
            Ok(read) => {
                if buffer.len() < max_bytes {
                    let remaining = max_bytes.saturating_sub(buffer.len());
                    buffer.extend_from_slice(&chunk[..read.min(remaining)]);
                }
            }
        }
    }
    buffer
}

fn validate_user_path(path: Option<&str>) -> Result<PathBuf, String> {
    let Some(path) = path.map(str::trim).filter(|value| !value.is_empty()) else {
        return Err("External PlantUML binary path is required.".to_string());
    };
    let path = PathBuf::from(path);
    if !path.is_file() {
        return Err("External PlantUML binary was not found.".to_string());
    }
    Ok(path)
}

fn validate_optional_user_path(path: Option<&str>) -> Result<Option<PathBuf>, String> {
    let Some(path) = path.map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok(None);
    };
    let path = PathBuf::from(path);
    if !path.is_file() {
        return Err("External Graphviz dot path was not found.".to_string());
    }
    Ok(Some(path))
}

fn validate_timeout(timeout_ms: u64) -> u64 {
    timeout_ms.clamp(MIN_TIMEOUT_MS, MAX_TIMEOUT_MS)
}

fn external_cache_key(
    source: &str,
    theme: &str,
    binary_path: &Path,
    dot_path: Option<&PathBuf>,
) -> Result<String, String> {
    let mut hasher = Sha256::new();
    hasher.update(EXTERNAL_PLANTUML_CACHE_VERSION.as_bytes());
    hasher.update(source.as_bytes());
    hasher.update(theme.as_bytes());
    hasher.update(path_identity(binary_path)?.as_bytes());
    if let Some(dot_path) = dot_path {
        hasher.update(path_identity(dot_path)?.as_bytes());
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn path_identity(path: &Path) -> Result<String, String> {
    let metadata = fs::metadata(path)
        .map_err(|_| "Failed to read external PlantUML binary metadata.".to_string())?;
    let modified = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_secs())
        .unwrap_or(0);
    let mut hasher = Sha256::new();
    hasher.update(path.to_string_lossy().as_bytes());
    hasher.update(metadata.len().to_string().as_bytes());
    hasher.update(modified.to_string().as_bytes());
    Ok(format!("{:x}", hasher.finalize()))
}

fn looks_like_svg(value: &str) -> bool {
    let trimmed = value.trim_start();
    trimmed.starts_with("<svg") || trimmed.starts_with("<?xml") && trimmed.contains("<svg")
}

fn rendered(
    svg: String,
    render_ms: u64,
    cache_status: &str,
    cache_layer: Option<&str>,
) -> PlantUmlRenderResult {
    PlantUmlRenderResult {
        status: "rendered".to_string(),
        svg: Some(svg.clone()),
        diagnostics: Vec::new(),
        metrics: Some(PlantUmlRenderMetrics {
            render_ms,
            svg_bytes: Some(svg.len()),
            cache_status: Some(cache_status.to_string()),
            cache_layer: cache_layer.map(str::to_string),
            external_version: Some(EXTERNAL_PLANTUML_CACHE_VERSION.to_string()),
        }),
    }
}

fn error_result(
    status: &str,
    diagnostic: &str,
    render_ms: u64,
    cache_status: &str,
) -> PlantUmlRenderResult {
    PlantUmlRenderResult {
        status: status.to_string(),
        svg: None,
        diagnostics: vec![diagnostic.to_string()],
        metrics: Some(PlantUmlRenderMetrics {
            render_ms,
            svg_bytes: None,
            cache_status: Some(cache_status.to_string()),
            cache_layer: Some("persistent".to_string()),
            external_version: Some(EXTERNAL_PLANTUML_CACHE_VERSION.to_string()),
        }),
    }
}
