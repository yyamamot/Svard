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
pub struct PlantUmlSvgCacheReadInput {
    pub key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PlantUmlSvgCacheReadResult {
    pub status: String,
    pub svg: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PlantUmlSvgCacheMetadata {
    pub renderer: String,
    pub theme: String,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PlantUmlSvgCacheWriteInput {
    pub key: String,
    pub svg: String,
    pub metadata: Option<PlantUmlSvgCacheMetadata>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PlantUmlSvgCacheWriteResult {
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalPlantUmlRenderInput {
    pub source: String,
    pub theme: String,
    pub timeout_ms: u64,
    pub binary_path: Option<String>,
    #[serde(default)]
    pub dot_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalPlantUmlTestInput {
    pub timeout_ms: u64,
    pub binary_path: Option<String>,
    #[serde(default)]
    pub dot_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PlantUmlRenderMetrics {
    pub render_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub svg_bytes: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cache_status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cache_layer: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub external_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PlantUmlRenderResult {
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub svg: Option<String>,
    pub diagnostics: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metrics: Option<PlantUmlRenderMetrics>,
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
