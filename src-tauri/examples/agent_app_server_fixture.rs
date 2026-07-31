use serde_json::{json, Value};
use std::{
    env, fs,
    io::{self, BufRead, Write},
    path::Path,
    process::{Command, Stdio},
    thread,
    time::Duration,
};

fn write_json(value: &Value) -> io::Result<()> {
    let mut stdout = io::stdout().lock();
    serde_json::to_writer(&mut stdout, value)?;
    stdout.write_all(b"\n")?;
    stdout.flush()
}

fn generate_schema(arguments: &[String]) -> io::Result<()> {
    let output = arguments
        .iter()
        .position(|argument| argument == "--out")
        .and_then(|index| arguments.get(index + 1))
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "missing --out"))?;
    let output = Path::new(output);
    fs::create_dir_all(output.join("v2"))?;
    fs::write(
        output.join("protocol.json"),
        r#"{"localImage":true,"turn/steer":true,"thread/tokenUsage/updated":true,"modelContextWindow":1,"totalTokens":1,"thread/compact/start":true,"contextCompaction":true,"thread/start":true,"thread/resume":true,"skills/list":true,"SkillsListResponse":true,"config":true}"#,
    )?;
    fs::write(output.join("v2/ThreadStartParams.json"), r#"{"config":{}}"#)?;
    fs::write(
        output.join("v2/ThreadResumeParams.json"),
        r#"{"config":{}}"#,
    )?;
    fs::write(
        output.join("v2/ThreadTokenUsageUpdatedNotification.json"),
        r#"{"last":{"inputTokens":1,"cachedInputTokens":1,"outputTokens":1,"reasoningOutputTokens":1,"totalTokens":1},"total":{"inputTokens":1,"cachedInputTokens":1,"outputTokens":1,"reasoningOutputTokens":1,"totalTokens":1}}"#,
    )?;
    fs::write(output.join("v2/SkillsListParams.json"), r#"{"cwds":[]}"#)?;
    fs::write(output.join("v2/SkillsListResponse.json"), r#"{"data":[]}"#)
}

fn fixture_mode() -> String {
    env::current_exe()
        .ok()
        .and_then(|path| {
            path.file_stem()
                .map(|value| value.to_string_lossy().into_owned())
        })
        .unwrap_or_default()
        .to_ascii_lowercase()
}

fn start_descendant() -> io::Result<()> {
    let executable = env::current_exe()?;
    let child = Command::new(executable)
        .arg("fixture-descendant")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()?;
    fs::write("fixture-descendant.pid", child.id().to_string())
}

fn run_server(mode: &str) -> io::Result<()> {
    let executable = env::current_exe()?;
    let request_log = executable.with_extension("requests.jsonl");
    let cwd_log = executable.with_extension("cwd.txt");
    fs::write(cwd_log, env::current_dir()?.to_string_lossy().as_bytes())?;

    let mut descendant_started = false;
    for line in io::stdin().lock().lines() {
        let line = line?;
        let value: Value = match serde_json::from_str(&line) {
            Ok(value) => value,
            Err(_) => continue,
        };
        let Some(id) = value.get("id").cloned() else {
            continue;
        };
        let method = value
            .get("method")
            .and_then(Value::as_str)
            .unwrap_or_default();
        match method {
            "initialize" => {
                if mode.contains("tree") && !descendant_started {
                    start_descendant()?;
                    descendant_started = true;
                }
                write_json(&json!({"id": id, "result": {}}))?;
            }
            "skills/list" => write_json(&json!({
                "id": id,
                "result": {"data":[{"cwd":"fixture","errors":[],"skills":[{"name":"docs"}]}]}
            }))?,
            "thread/start" | "thread/resume" => {
                let mut log = fs::OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open(&request_log)?;
                writeln!(log, "{value}")?;
                write_json(&json!({"id": id, "result":{"thread":{"id":"fixture-thread"}}}))?;
            }
            "model/list" => write_json(&json!({
                "id": id,
                "result": {
                    "data":[{
                        "id":"available","model":"available","displayName":"Available",
                        "description":"Test model","hidden":false,"isDefault":true,
                        "defaultReasoningEffort":"medium",
                        "supportedReasoningEfforts":[{"reasoningEffort":"medium"}],
                        "supportsPersonality":false,"inputModalities":["text"]
                    }],
                    "nextCursor":null
                }
            }))?,
            "turn/start" => {
                let mut log = fs::OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open(&request_log)?;
                writeln!(log, "{value}")?;
                write_json(&json!({"id": id, "result":{"turn":{"id":"fixture-turn"}}}))?;
                if mode.contains("timeout") {
                    thread::sleep(Duration::from_secs(30));
                    continue;
                }
                write_json(&json!({
                    "method":"item/completed",
                    "params":{"item":{"type":"agentMessage","phase":"commentary","text":"ignore me"}}
                }))?;
                write_json(&json!({
                    "method":"item/completed",
                    "params":{"item":{"type":"agentMessage","phase":"final_answer","text":"AI Chat title support"}}
                }))?;
                write_json(&json!({
                    "method":"turn/completed",
                    "params":{"turn":{"id":"fixture-turn","status":"completed"}}
                }))?;
            }
            _ => write_json(&json!({"id": id, "result": {}}))?,
        }
    }
    Ok(())
}

fn main() -> io::Result<()> {
    let arguments = env::args().skip(1).collect::<Vec<_>>();
    if arguments.first().map(String::as_str) == Some("fixture-descendant") {
        loop {
            thread::sleep(Duration::from_secs(30));
        }
    }
    if arguments.get(0).map(String::as_str) == Some("app-server")
        && arguments.get(1).map(String::as_str) == Some("generate-json-schema")
    {
        return generate_schema(&arguments);
    }
    run_server(&fixture_mode())
}
