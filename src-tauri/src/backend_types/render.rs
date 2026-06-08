use serde::{Deserialize, Serialize};

use super::KrokiConfig;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct KrokiRequest {
    pub diagram_type: String,
    pub source: String,
    pub config: KrokiConfig,
    pub confirmed_remote_send: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct KrokiResult {
    pub status: String,
    pub message: Option<String>,
    pub artifact_url: Option<String>,
    pub media_type: Option<String>,
    pub content: Option<String>,
    pub cache_status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalImageResult {
    pub status: String,
    pub media_type: Option<String>,
    pub content: Option<String>,
    pub encoding: Option<String>,
    pub placeholder_text: Option<String>,
}
