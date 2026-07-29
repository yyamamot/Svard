use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use image::{codecs::jpeg::JpegEncoder, DynamicImage, ImageFormat};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
#[cfg(unix)]
use std::os::unix::fs::DirBuilderExt;
use std::{
    collections::HashMap,
    env, fs,
    io::{BufRead, BufReader, Cursor, Read, Write},
    path::{Path, PathBuf},
    process::{Child, ChildStdin, Command, Stdio},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        mpsc, Arc, Condvar, Mutex,
    },
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{ipc::Channel, Manager, State};

use crate::agent_session_registry::{
    now_seconds, AgentSessionRecord, AgentSessionRegistry, AgentSessionSnapshot,
};
use crate::codex_executable::{
    executable_candidates, CodexExecutable, CodexExecutableMode, CodexExecutablePreference,
};

mod compaction;
mod history;
mod lifecycle;
mod management;
mod provider;
mod steer;
mod title;
mod token_usage;
mod transport;
mod turn;
mod types;

pub use compaction::compact_agent_session;
pub use lifecycle::{
    list_agent_sessions, read_agent_session_history, resume_agent_session, start_agent_session,
};
pub use management::{
    close_agent_session, delete_agent_session, rename_agent_session, set_agent_session_archived,
};
pub use provider::get_agent_provider_runtime;
pub use steer::steer_agent_turn;
pub use token_usage::*;
pub use turn::{
    cancel_agent_turn, discard_agent_image, respond_to_agent_approval, send_agent_turn,
    stage_agent_image,
};
pub use types::*;

use compaction::*;
use history::*;
use lifecycle::*;
use provider::*;
#[cfg(test)]
use steer::steer_prompt;
use title::*;
use transport::*;

#[cfg(test)]
mod tests;
