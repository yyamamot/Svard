use super::*;

use std::ops::{Deref, DerefMut};

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

const GRACEFUL_PROCESS_EXIT_TIMEOUT: Duration = Duration::from_secs(2);
const FORCED_PROCESS_EXIT_TIMEOUT: Duration = Duration::from_secs(2);
const PROCESS_EXIT_POLL_INTERVAL: Duration = Duration::from_millis(20);

fn configure_owned_process(command: &mut Command) {
    #[cfg(unix)]
    command.process_group(0);
}

#[cfg(windows)]
struct WindowsJob {
    handle: HANDLE,
}

#[cfg(windows)]
unsafe impl Send for WindowsJob {}

#[cfg(windows)]
impl WindowsJob {
    fn new() -> Result<Self, String> {
        let handle = unsafe { CreateJobObjectW(std::ptr::null(), std::ptr::null()) };
        if handle.is_null() {
            return Err("The Codex app-server process job could not be created.".to_string());
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
            unsafe {
                CloseHandle(handle);
            }
            return Err("The Codex app-server process job could not be configured.".to_string());
        }
        Ok(Self { handle })
    }

    fn assign(&self, child: &std::process::Child) -> Result<(), String> {
        let assigned =
            unsafe { AssignProcessToJobObject(self.handle, child.as_raw_handle() as HANDLE) };
        (assigned != 0)
            .then_some(())
            .ok_or_else(|| "The Codex app-server process could not join its job.".to_string())
    }

    fn terminate(&self) -> Result<(), String> {
        let terminated = unsafe { TerminateJobObject(self.handle, 1) };
        (terminated != 0)
            .then_some(())
            .ok_or_else(|| "The Codex app-server process job could not be terminated.".to_string())
    }
}

#[cfg(windows)]
impl Drop for WindowsJob {
    fn drop(&mut self) {
        unsafe {
            CloseHandle(self.handle);
        }
    }
}

pub(super) struct OwnedProcess {
    child: std::process::Child,
    #[cfg(windows)]
    job: WindowsJob,
}

impl Deref for OwnedProcess {
    type Target = std::process::Child;

    fn deref(&self) -> &Self::Target {
        &self.child
    }
}

impl DerefMut for OwnedProcess {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.child
    }
}

pub(super) fn spawn_owned_process(command: &mut Command) -> Result<OwnedProcess, String> {
    configure_owned_process(command);

    #[cfg(windows)]
    let job = WindowsJob::new()?;
    let child = command
        .spawn()
        .map_err(|_| "The Codex app-server process could not start.".to_string())?;
    #[cfg(windows)]
    {
        let mut child = child;
        if let Err(error) = job.assign(&child) {
            let _ = child.kill();
            let _ = child.wait();
            return Err(error);
        }
        return Ok(OwnedProcess { child, job });
    }
    #[cfg(not(windows))]
    Ok(OwnedProcess { child })
}

#[cfg(all(test, windows))]
pub(super) fn windows_fixture_executable(directory: &Path, name: &str) -> PathBuf {
    let source = env::var_os("SVARD_AGENT_APP_SERVER_FIXTURE")
        .map(PathBuf::from)
        .expect(
            "build the agent_app_server_fixture example and set SVARD_AGENT_APP_SERVER_FIXTURE",
        );
    let target = directory.join(format!("{name}.exe"));
    fs::copy(source, &target).expect("copy the Windows Agent Chat fixture");
    target
}

#[cfg(unix)]
fn process_group_exists(process_group_id: u32) -> bool {
    let result = unsafe { libc::kill(-(process_group_id as i32), 0) };
    if result == 0 {
        return true;
    }
    std::io::Error::last_os_error().raw_os_error() != Some(libc::ESRCH)
}

#[cfg(unix)]
fn signal_process_group(process_group_id: u32, signal: i32) -> Result<(), String> {
    let result = unsafe { libc::kill(-(process_group_id as i32), signal) };
    if result == 0 {
        return Ok(());
    }
    if std::io::Error::last_os_error().raw_os_error() == Some(libc::ESRCH) {
        return Ok(());
    }
    Err("The Codex app-server process could not be terminated.".to_string())
}

#[cfg(unix)]
fn wait_for_process_group_exit(
    child: &mut OwnedProcess,
    process_group_id: u32,
    timeout: Duration,
) -> Result<bool, String> {
    let deadline = std::time::Instant::now() + timeout;
    loop {
        child
            .try_wait()
            .map_err(|_| "The Codex app-server process state is unavailable.".to_string())?;
        if !process_group_exists(process_group_id) {
            return Ok(true);
        }
        if std::time::Instant::now() >= deadline {
            return Ok(false);
        }
        thread::sleep(PROCESS_EXIT_POLL_INTERVAL);
    }
}

pub(super) fn terminate_owned_process(child: &mut OwnedProcess) -> Result<(), String> {
    #[cfg(unix)]
    {
        let process_group_id = child.id();
        child
            .try_wait()
            .map_err(|_| "The Codex app-server process state is unavailable.".to_string())?;
        signal_process_group(process_group_id, libc::SIGTERM)?;
        if !wait_for_process_group_exit(child, process_group_id, GRACEFUL_PROCESS_EXIT_TIMEOUT)? {
            signal_process_group(process_group_id, libc::SIGKILL)?;
        }
        child
            .wait()
            .map_err(|_| "The Codex app-server process could not be reaped.".to_string())?;
        if !wait_for_process_group_exit(child, process_group_id, FORCED_PROCESS_EXIT_TIMEOUT)? {
            return Err("The Codex app-server process did not exit.".to_string());
        }
        return Ok(());
    }

    #[cfg(windows)]
    {
        child.job.terminate()?;
        child
            .wait()
            .map_err(|_| "The Codex app-server process could not be reaped.".to_string())?;
        return Ok(());
    }

    #[cfg(not(any(unix, windows)))]
    {
        if child
            .try_wait()
            .map_err(|_| "The Codex app-server process state is unavailable.".to_string())?
            .is_none()
        {
            child
                .kill()
                .map_err(|_| "The Codex app-server process could not be terminated.".to_string())?;
        }
        child
            .wait()
            .map_err(|_| "The Codex app-server process could not be reaped.".to_string())?;
        return Ok(());
    }
}

pub(super) fn terminate_owned_process_slot(
    slot: &Mutex<Option<OwnedProcess>>,
) -> Result<(), String> {
    let mut slot = slot.lock().unwrap_or_else(|error| error.into_inner());
    let Some(child) = slot.as_mut() else {
        return Ok(());
    };
    terminate_owned_process(child)?;
    slot.take();
    Ok(())
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;

    #[test]
    fn owned_process_cleanup_terminates_its_process_group() {
        let mut command = Command::new("/bin/sh");
        command
            .args(["-c", "trap '' TERM; while :; do sleep 1; done"])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        let mut child = spawn_owned_process(&mut command).unwrap();
        let process_group_id = child.id();
        thread::sleep(Duration::from_millis(50));

        terminate_owned_process(&mut child).unwrap();

        assert!(!process_group_exists(process_group_id));
    }

    #[test]
    fn owned_process_cleanup_reaps_an_externally_killed_direct_child() {
        let mut command = Command::new("/bin/sh");
        command
            .args([
                "-c",
                "trap '' TERM; (trap '' TERM; while :; do sleep 1; done) & wait",
            ])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        let mut child = spawn_owned_process(&mut command).unwrap();
        let process_group_id = child.id();
        thread::sleep(Duration::from_millis(50));

        let result = unsafe { libc::kill(child.id() as i32, libc::SIGKILL) };
        assert_eq!(result, 0);
        thread::sleep(Duration::from_millis(2_500));

        terminate_owned_process(&mut child).unwrap();

        assert!(!process_group_exists(process_group_id));
        assert!(child.try_wait().unwrap().is_some());
    }

    #[test]
    fn owned_process_slot_cleanup_is_idempotent_under_contention() {
        let mut command = Command::new("/bin/sh");
        command
            .args(["-c", "while :; do sleep 1; done"])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        let slot = Arc::new(Mutex::new(Some(spawn_owned_process(&mut command).unwrap())));
        let first = Arc::clone(&slot);
        let second = Arc::clone(&slot);

        let first_cleanup = thread::spawn(move || terminate_owned_process_slot(&first));
        let second_cleanup = thread::spawn(move || terminate_owned_process_slot(&second));

        first_cleanup.join().unwrap().unwrap();
        second_cleanup.join().unwrap().unwrap();
        assert!(slot
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .is_none());
    }
}

#[cfg(all(test, windows))]
mod windows_tests {
    use super::*;
    use windows_sys::Win32::{
        Foundation::{CloseHandle, WAIT_OBJECT_0},
        System::Threading::{OpenProcess, WaitForSingleObject},
    };

    const PROCESS_SYNCHRONIZE: u32 = 0x0010_0000;

    fn process_has_exited(process_id: u32) -> bool {
        let handle = unsafe { OpenProcess(PROCESS_SYNCHRONIZE, 0, process_id) };
        if handle.is_null() {
            return true;
        }
        let result = unsafe { WaitForSingleObject(handle, 0) } == WAIT_OBJECT_0;
        unsafe {
            CloseHandle(handle);
        }
        result
    }

    #[test]
    fn owned_process_cleanup_terminates_windows_job_descendants() {
        let workspace = tempfile::tempdir().unwrap();
        let executable = windows_fixture_executable(workspace.path(), "fake-codex-tree");
        let mut command = Command::new(executable);
        command
            .args(["app-server", "--stdio"])
            .current_dir(workspace.path())
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        let mut child = spawn_owned_process(&mut command).unwrap();
        child
            .stdin
            .as_mut()
            .unwrap()
            .write_all(b"{\"id\":1,\"method\":\"initialize\",\"params\":{}}\n")
            .unwrap();
        child.stdin.as_mut().unwrap().flush().unwrap();
        let pid_path = workspace.path().join("fixture-descendant.pid");
        let deadline = std::time::Instant::now() + Duration::from_secs(2);
        while !pid_path.is_file() && std::time::Instant::now() < deadline {
            thread::sleep(Duration::from_millis(20));
        }
        let descendant_id = fs::read_to_string(pid_path)
            .unwrap()
            .trim()
            .parse::<u32>()
            .unwrap();

        terminate_owned_process(&mut child).unwrap();

        let deadline = std::time::Instant::now() + Duration::from_secs(2);
        while !process_has_exited(descendant_id) && std::time::Instant::now() < deadline {
            thread::sleep(Duration::from_millis(20));
        }
        assert!(process_has_exited(descendant_id));
    }

    #[test]
    fn owned_process_cleanup_reaps_an_externally_killed_windows_child() {
        let workspace = tempfile::tempdir().unwrap();
        let executable = windows_fixture_executable(workspace.path(), "fake-codex");
        let mut command = Command::new(executable);
        command
            .args(["app-server", "--stdio"])
            .current_dir(workspace.path())
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        let mut child = spawn_owned_process(&mut command).unwrap();

        child.kill().unwrap();
        terminate_owned_process(&mut child).unwrap();

        assert!(child.try_wait().unwrap().is_some());
    }

    #[test]
    fn owned_process_slot_cleanup_is_idempotent_under_windows_contention() {
        let workspace = tempfile::tempdir().unwrap();
        let executable = windows_fixture_executable(workspace.path(), "fake-codex");
        let mut command = Command::new(executable);
        command
            .args(["app-server", "--stdio"])
            .current_dir(workspace.path())
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        let slot = Arc::new(Mutex::new(Some(spawn_owned_process(&mut command).unwrap())));
        let first = Arc::clone(&slot);
        let second = Arc::clone(&slot);

        let first_cleanup = thread::spawn(move || terminate_owned_process_slot(&first));
        let second_cleanup = thread::spawn(move || terminate_owned_process_slot(&second));

        assert!(first_cleanup.join().unwrap().is_ok());
        assert!(second_cleanup.join().unwrap().is_ok());
        assert!(slot.lock().unwrap().is_none());
        assert!(terminate_owned_process_slot(&slot).is_ok());
    }
}
