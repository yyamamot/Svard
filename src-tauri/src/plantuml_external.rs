use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{mpsc, Mutex, OnceLock},
    thread,
    time::{Duration, Instant, UNIX_EPOCH},
};

#[cfg(unix)]
use std::os::unix::process::CommandExt;

#[cfg(windows)]
use std::os::windows::io::AsRawHandle;

#[cfg(windows)]
use windows_sys::Win32::{
    Foundation::{CloseHandle, HANDLE},
    System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
        SetInformationJobObject, TerminateJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
        JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    },
};

use crate::{
    prune_cache_dir, remove_oversized_cache_file, touch_cache_file, ExternalPlantUmlRenderInput,
    ExternalPlantUmlTestInput, PlantUmlRenderMetrics, PlantUmlRenderResult,
};

const MIN_TIMEOUT_MS: u64 = 1_000;
const MAX_TIMEOUT_MS: u64 = 60_000;
const MAX_STDOUT_BYTES: usize = 2 * 1024 * 1024;
const MAX_VERSION_STDOUT_BYTES: usize = 64 * 1024;
const MAX_STDERR_BYTES: usize = 64 * 1024;
const PIPE_DRAIN_GRACE_MS: u64 = 1_000;
const MAX_CACHE_TOTAL_BYTES: u64 = 128 * 1024 * 1024;
const EXTERNAL_PLANTUML_CACHE_VERSION: &str = "plantuml-external-v2-sandbox";
const TEST_SOURCE: &str = "@startuml\nAlice -> Bob: test\n@enduml\n";
const SANDBOX_VALIDATION_ERROR: &str = "External PlantUML sandbox validation failed.";
const SANDBOX_PROFILE: &str = "SANDBOX";
const PLANTUML_LIMIT_SIZE: &str = "4096";
const SANDBOX_PROFILE_PROBE_MARKER: &str = "SVARD_PROFILE_SANDBOX";
const SANDBOX_PROFILE_PROBE_SOURCE: &str =
    "@startuml\ntitle SVARD_PROFILE_%getenv(\"PLANTUML_SECURITY_PROFILE\")\nAlice -> Bob\n@enduml\n";
const MIN_SANDBOX_VERSION: PlantUmlVersion = PlantUmlVersion {
    major: 1,
    year: 2020,
    release: 11,
};

static SANDBOX_VALIDATION_CACHE: OnceLock<Mutex<HashMap<String, bool>>> = OnceLock::new();

#[cfg(windows)]
struct ExternalProcessJob {
    handle: HANDLE,
}

#[cfg(windows)]
unsafe impl Send for ExternalProcessJob {}

#[cfg(windows)]
impl ExternalProcessJob {
    fn new() -> Result<Self, String> {
        let handle = unsafe { CreateJobObjectW(std::ptr::null(), std::ptr::null()) };
        if handle.is_null() {
            return Err("Failed to isolate external PlantUML process tree.".to_string());
        }
        let mut information = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
        information.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        let configured = unsafe {
            SetInformationJobObject(
                handle,
                JobObjectExtendedLimitInformation,
                std::ptr::addr_of!(information).cast(),
                std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            )
        };
        if configured == 0 {
            unsafe { CloseHandle(handle) };
            return Err("Failed to isolate external PlantUML process tree.".to_string());
        }
        Ok(Self { handle })
    }

    fn assign(&self, child: &Child) -> Result<(), String> {
        let assigned =
            unsafe { AssignProcessToJobObject(self.handle, child.as_raw_handle() as HANDLE) };
        (assigned != 0)
            .then_some(())
            .ok_or_else(|| "Failed to isolate external PlantUML process tree.".to_string())
    }

    fn terminate(&self) -> Result<(), String> {
        let terminated = unsafe { TerminateJobObject(self.handle, 1) };
        (terminated != 0)
            .then_some(())
            .ok_or_else(|| "Failed to terminate external PlantUML process tree.".to_string())
    }
}

#[cfg(windows)]
impl Drop for ExternalProcessJob {
    fn drop(&mut self) {
        unsafe { CloseHandle(self.handle) };
    }
}

struct ExternalProcess {
    child: Child,
    #[cfg(windows)]
    job: ExternalProcessJob,
}

fn spawn_external_process(command: &mut Command) -> Result<ExternalProcess, String> {
    #[cfg(unix)]
    command.process_group(0);

    #[cfg(windows)]
    let job = ExternalProcessJob::new()?;
    let child = command
        .spawn()
        .map_err(|_| "Failed to start external PlantUML binary.".to_string())?;
    #[cfg(windows)]
    {
        let mut child = child;
        if let Err(error) = job.assign(&child) {
            let _ = child.kill();
            let _ = child.wait();
            return Err(error);
        }
        return Ok(ExternalProcess { child, job });
    }
    #[cfg(not(windows))]
    Ok(ExternalProcess { child })
}

fn terminate_external_process_tree(process: &mut ExternalProcess) -> Result<(), String> {
    #[cfg(unix)]
    {
        let process_group_id = process.child.id() as i32;
        let result = unsafe { libc::kill(-process_group_id, libc::SIGKILL) };
        if result != 0 && std::io::Error::last_os_error().raw_os_error() != Some(libc::ESRCH) {
            return Err("Failed to terminate external PlantUML process tree.".to_string());
        }
    }
    #[cfg(windows)]
    process.job.terminate()?;
    #[cfg(not(any(unix, windows)))]
    if process.child.try_wait().ok().flatten().is_none() {
        process
            .child
            .kill()
            .map_err(|_| "Failed to terminate external PlantUML process tree.".to_string())?;
    }
    Ok(())
}

#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
struct PlantUmlVersion {
    major: u32,
    year: u32,
    release: u32,
}

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
    let deadline = started + Duration::from_millis(timeout_ms);
    if ensure_sandbox_validated(&binary_path, dot_path.as_ref(), deadline).is_err() {
        return Ok(error_result(
            "error",
            SANDBOX_VALIDATION_ERROR,
            started.elapsed().as_millis() as u64,
            "not-written",
        ));
    }
    let output =
        match run_plantuml_command(&binary_path, dot_path.as_ref(), &input.source, deadline) {
            Ok(output) => output,
            Err(message) => {
                return Ok(error_result(
                    "error",
                    &message,
                    started.elapsed().as_millis() as u64,
                    "not-written",
                ))
            }
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
    let deadline = started + Duration::from_millis(timeout_ms);
    ensure_sandbox_validated(&binary_path, dot_path.as_ref(), deadline)?;
    let output = run_plantuml_command(&binary_path, dot_path.as_ref(), TEST_SOURCE, deadline)?;
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

fn ensure_sandbox_validated(
    binary_path: &Path,
    dot_path: Option<&PathBuf>,
    deadline: Instant,
) -> Result<(), String> {
    let identity = path_identity(binary_path).map_err(|_| SANDBOX_VALIDATION_ERROR.to_string())?;
    if let Some(valid) = sandbox_validation_cache()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .get(&identity)
        .copied()
    {
        return valid
            .then_some(())
            .ok_or_else(|| SANDBOX_VALIDATION_ERROR.to_string());
    }

    let valid = validate_sandbox_support(binary_path, dot_path, deadline).is_ok();
    sandbox_validation_cache()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .insert(identity, valid);
    valid
        .then_some(())
        .ok_or_else(|| SANDBOX_VALIDATION_ERROR.to_string())
}

fn validate_sandbox_support(
    binary_path: &Path,
    dot_path: Option<&PathBuf>,
    deadline: Instant,
) -> Result<(), ()> {
    let version_output = run_external_command(
        binary_path,
        dot_path,
        &["-version"],
        None,
        deadline,
        MAX_VERSION_STDOUT_BYTES,
    )
    .map_err(|_| ())?;
    if version_output.timed_out
        || !version_output.status_success
        || version_output.stdout.len() > MAX_VERSION_STDOUT_BYTES
    {
        return Err(());
    }
    let version_text = std::str::from_utf8(&version_output.stdout).map_err(|_| ())?;
    let version = parse_plantuml_version(version_text).ok_or(())?;
    if version < MIN_SANDBOX_VERSION {
        return Err(());
    }

    let profile_output = run_plantuml_command(
        binary_path,
        dot_path,
        SANDBOX_PROFILE_PROBE_SOURCE,
        deadline,
    )
    .map_err(|_| ())?;
    if profile_output.timed_out
        || !profile_output.status_success
        || profile_output.stdout.len() > MAX_STDOUT_BYTES
    {
        return Err(());
    }
    let profile_svg = std::str::from_utf8(&profile_output.stdout).map_err(|_| ())?;
    if !looks_like_svg(profile_svg) || !profile_svg.contains(SANDBOX_PROFILE_PROBE_MARKER) {
        return Err(());
    }
    Ok(())
}

fn sandbox_validation_cache() -> &'static Mutex<HashMap<String, bool>> {
    SANDBOX_VALIDATION_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

#[cfg(test)]
pub(crate) fn trust_external_plantuml_binary_for_test(binary_path: &Path) {
    let identity = path_identity(binary_path).expect("test binary identity");
    sandbox_validation_cache()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .insert(identity, true);
}

fn parse_plantuml_version(output: &str) -> Option<PlantUmlVersion> {
    let value = output.lines().find_map(|line| {
        line.trim()
            .strip_prefix("PlantUML version ")
            .and_then(|suffix| suffix.split_ascii_whitespace().next())
    })?;
    let mut components = value.split('.');
    let version = PlantUmlVersion {
        major: components.next()?.parse().ok()?,
        year: components.next()?.parse().ok()?,
        release: components.next()?.parse().ok()?,
    };
    components.next().is_none().then_some(version)
}

fn run_plantuml_command(
    binary_path: &Path,
    dot_path: Option<&PathBuf>,
    source: &str,
    deadline: Instant,
) -> Result<CommandOutput, String> {
    run_external_command(
        binary_path,
        dot_path,
        &["-tsvg", "-pipe"],
        Some(source),
        deadline,
        MAX_STDOUT_BYTES,
    )
}

fn run_external_command(
    binary_path: &Path,
    dot_path: Option<&PathBuf>,
    args: &[&str],
    source: Option<&str>,
    deadline: Instant,
    max_stdout_bytes: usize,
) -> Result<CommandOutput, String> {
    let mut command = Command::new(binary_path);
    command.args(args);
    command.env_clear();
    command.env("PLANTUML_SECURITY_PROFILE", SANDBOX_PROFILE);
    command.env("PLANTUML_LIMIT_SIZE", PLANTUML_LIMIT_SIZE);
    if let Some(dot_path) = dot_path {
        command.env("GRAPHVIZ_DOT", dot_path);
    }
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut process = spawn_external_process(&mut command)?;
    if let (Some(mut stdin), Some(source)) = (process.child.stdin.take(), source) {
        let source = source.as_bytes().to_vec();
        thread::spawn(move || {
            let _ = stdin.write_all(&source);
        });
    }

    let stdout = process.child.stdout.take();
    let stderr = process.child.stderr.take();
    let stdout_reader = spawn_limited_reader(stdout, max_stdout_bytes + 1);
    let stderr_reader = spawn_limited_reader(stderr, MAX_STDERR_BYTES);

    let mut timed_out = false;
    let status_success = loop {
        match process
            .child
            .try_wait()
            .map_err(|_| "Failed to wait for external PlantUML.".to_string())?
        {
            Some(status) => break status.success(),
            None if Instant::now() >= deadline => {
                timed_out = true;
                terminate_external_process_tree(&mut process)?;
                let _ = process.child.wait();
                break false;
            }
            None => thread::sleep(Duration::from_millis(10)),
        }
    };

    // A wrapper or Graphviz descendant can retain inherited pipes after the direct
    // PlantUML process exits. Always close the owned process tree before draining
    // output so those descendants cannot outlive the request.
    if !timed_out {
        terminate_external_process_tree(&mut process)?;
    }

    let pipe_drain_deadline =
        (Instant::now() + Duration::from_millis(PIPE_DRAIN_GRACE_MS)).min(deadline);
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
        .map(|duration| duration.as_nanos())
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_only_strict_three_component_plantuml_versions() {
        assert_eq!(
            parse_plantuml_version("PlantUML version 1.2020.11 / test"),
            Some(MIN_SANDBOX_VERSION)
        );
        assert!(
            parse_plantuml_version("PlantUML version 1.2020.10 / test") < Some(MIN_SANDBOX_VERSION)
        );
        assert_eq!(
            parse_plantuml_version("PlantUML version 1.2026.4 / test"),
            Some(PlantUmlVersion {
                major: 1,
                year: 2026,
                release: 4,
            })
        );
        assert_eq!(parse_plantuml_version("PlantUML version current"), None);
        assert_eq!(parse_plantuml_version("PlantUML version 1.2026.4.1"), None);
    }
}
