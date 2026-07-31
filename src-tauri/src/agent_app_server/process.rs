use super::*;

const GRACEFUL_PROCESS_EXIT_TIMEOUT: Duration = Duration::from_secs(2);
const FORCED_PROCESS_EXIT_TIMEOUT: Duration = Duration::from_millis(500);
const PROCESS_EXIT_POLL_INTERVAL: Duration = Duration::from_millis(20);

pub(super) fn configure_owned_process(command: &mut Command) {
    #[cfg(unix)]
    command.process_group(0);
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
    child: &mut Child,
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

pub(super) fn terminate_owned_process(child: &mut Child) -> Result<(), String> {
    #[cfg(unix)]
    {
        let process_group_id = child.id();
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

    #[cfg(not(unix))]
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
        Ok(())
    }
}

pub(super) fn terminate_owned_process_slot(slot: &Mutex<Option<Child>>) -> Result<(), String> {
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
        configure_owned_process(&mut command);
        let mut child = command.spawn().unwrap();
        let process_group_id = child.id();
        thread::sleep(Duration::from_millis(50));

        terminate_owned_process(&mut child).unwrap();

        assert!(!process_group_exists(process_group_id));
    }
}
