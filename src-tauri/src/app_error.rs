use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub code: AppErrorCode,
    pub message: String,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum AppErrorCode {
    InvalidPath,
    OutsideWorkspace,
    UnsupportedDocument,
    NotFound,
    Io,
    ConfigParse,
    ConfigSerialize,
    Lock,
    Unknown,
}

impl AppError {
    pub(crate) fn new(code: AppErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    pub(crate) fn from_message(message: impl Into<String>) -> Self {
        let message = message.into();
        let lower = message.to_lowercase();
        let code = if lower.contains("outside the current workspace") {
            AppErrorCode::OutsideWorkspace
        } else if lower.contains("only supported markup")
            || lower.contains("supported markup documents")
        {
            AppErrorCode::UnsupportedDocument
        } else if lower.contains("does not exist")
            || lower.contains("not found")
            || lower.contains("failed to resolve")
        {
            AppErrorCode::NotFound
        } else if lower.contains("failed to lock") {
            AppErrorCode::Lock
        } else if lower.contains("failed to parse config") {
            AppErrorCode::ConfigParse
        } else if lower.contains("failed to serialize config") {
            AppErrorCode::ConfigSerialize
        } else if lower.contains("failed to read")
            || lower.contains("failed to write")
            || lower.contains("failed to create")
            || lower.contains("failed to list")
        {
            AppErrorCode::Io
        } else if lower.contains("invalid") {
            AppErrorCode::InvalidPath
        } else {
            AppErrorCode::Unknown
        };
        Self { code, message }
    }
}

impl From<String> for AppError {
    fn from(message: String) -> Self {
        Self::from_message(message)
    }
}

impl From<&str> for AppError {
    fn from(message: &str) -> Self {
        Self::from_message(message)
    }
}
