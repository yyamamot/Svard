use super::*;

pub(super) fn resolve_executable() -> Result<CodexExecutable, CodexCliProbe> {
    executable_candidates(&CodexExecutablePreference::default())
        .ok()
        .and_then(|candidates| candidates.into_iter().next())
        .ok_or(CodexCliProbe {
            state: "notFound",
            source: None,
            version: None,
        })
}

struct ProbeOutput {
    status: ExitStatus,
    stdout: Vec<u8>,
    stderr: Vec<u8>,
}

fn bounded_output(mut command: Command, timeout: Duration) -> Result<ProbeOutput, std::io::Error> {
    command.stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = command.spawn()?;
    let started = Instant::now();
    loop {
        if child.try_wait()?.is_some() {
            let output = child.wait_with_output()?;
            return Ok(ProbeOutput {
                status: output.status,
                stdout: output.stdout,
                stderr: output.stderr,
            });
        }
        if started.elapsed() >= timeout {
            let _ = child.kill();
            let output = child.wait_with_output()?;
            return Ok(ProbeOutput {
                status: output.status,
                stdout: output.stdout,
                stderr: output.stderr,
            });
        }
        thread::sleep(Duration::from_millis(20));
    }
}

fn bounded_text(output: &ProbeOutput) -> String {
    let mut bytes = Vec::new();
    bytes.extend(output.stdout.iter().copied().take(STDERR_LIMIT));
    bytes.extend(output.stderr.iter().copied().take(STDERR_LIMIT));
    String::from_utf8_lossy(&bytes).to_lowercase()
}

#[tauri::command]
pub fn probe_codex() -> CodexCliProbe {
    let executable = match resolve_executable() {
        Ok(executable) => executable,
        Err(probe) => return probe,
    };
    let source = Some(executable.source().id());
    let mut version_command = executable.command();
    version_command.arg("--version");
    let version_output = match bounded_output(version_command, PROBE_TIMEOUT) {
        Ok(output) => output,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return CodexCliProbe {
                state: "notFound",
                source: None,
                version: None,
            };
        }
        Err(_) => {
            return CodexCliProbe {
                state: "broken",
                source,
                version: None,
            };
        }
    };
    if !version_output.status.success() {
        return CodexCliProbe {
            state: "broken",
            source,
            version: None,
        };
    }
    let version = String::from_utf8_lossy(&version_output.stdout)
        .trim()
        .chars()
        .take(80)
        .collect::<String>();
    if !version.to_lowercase().contains("codex") {
        return CodexCliProbe {
            state: "unsupportedVersion",
            source,
            version: None,
        };
    }

    for (arguments, required_terms) in [
        (&["exec", "--help"][..], &["--json", "resume"][..]),
        (
            &["exec", "resume", "--help"][..],
            &["--json", "session"][..],
        ),
    ] {
        let mut help_command = executable.command();
        help_command.args(arguments);
        let help_output = match bounded_output(help_command, PROBE_TIMEOUT) {
            Ok(output) => output,
            Err(_) => {
                return CodexCliProbe {
                    state: "broken",
                    source,
                    version: Some(version),
                };
            }
        };
        let help_text = bounded_text(&help_output);
        if !help_output.status.success()
            || required_terms.iter().any(|term| !help_text.contains(term))
        {
            return CodexCliProbe {
                state: "unsupportedVersion",
                source,
                version: Some(version),
            };
        }
    }

    let mut auth_command = executable.command();
    auth_command.args(["login", "status"]);
    let auth_output = match bounded_output(auth_command, PROBE_TIMEOUT) {
        Ok(output) => output,
        Err(_) => {
            return CodexCliProbe {
                state: "broken",
                source,
                version: Some(version),
            };
        }
    };
    if !auth_output.status.success() {
        let text = bounded_text(&auth_output);
        let state = if text.contains("not logged")
            || text.contains("authentication")
            || text.contains("login")
        {
            "authenticationRequired"
        } else {
            "broken"
        };
        return CodexCliProbe {
            state,
            source,
            version: Some(version),
        };
    }
    CodexCliProbe {
        state: "ready",
        source,
        version: Some(version),
    }
}
