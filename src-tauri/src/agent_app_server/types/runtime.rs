use super::*;

pub(in crate::agent_app_server) const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);
pub(in crate::agent_app_server) const TURN_TIMEOUT: Duration = Duration::from_secs(120);
pub(in crate::agent_app_server) const QUESTION_LIMIT: usize = 8 * 1024;
pub(in crate::agent_app_server) const VISUALIZATION_INSTRUCTIONS_LIMIT: usize = 256 * 1024;
pub(in crate::agent_app_server) const MAX_FOCUS_FILES: usize = 50;
pub(in crate::agent_app_server) const MAX_ATTACHMENTS: usize = 12;
pub(in crate::agent_app_server) const MAX_ATTACHMENT_BYTES: usize = 256 * 1024;
pub(in crate::agent_app_server) const MAX_ATTACHMENT_TOTAL_BYTES: usize = 1024 * 1024;
pub(in crate::agent_app_server) const MAX_LINE_BYTES: usize = 1024 * 1024;
pub(in crate::agent_app_server) const MAX_IMAGES_PER_TURN: usize = 4;
pub(in crate::agent_app_server) const MAX_IMAGE_SOURCE_BYTES: usize = 10 * 1024 * 1024;
pub(in crate::agent_app_server) const MAX_IMAGE_TOTAL_BYTES: usize = 20 * 1024 * 1024;
pub(in crate::agent_app_server) const MAX_IMAGE_PIXELS: u64 = 40_000_000;
pub(in crate::agent_app_server) const SVARD_TURN_ENVELOPE_V1: &str = "SVARD_TURN_V1";
pub(in crate::agent_app_server) const SVARD_STEER_ENVELOPE_V1: &str = "SVARD_STEER_V1";
pub(in crate::agent_app_server) const AUTO_RESPONSE_INSTRUCTION: &str = "\
Answer the user's question in normal Markdown. Do not return OpenUI Lang, \
Mermaid, HTML, a website, or a generated visualization file.";
pub(in crate::agent_app_server) const VISUALIZE_RESPONSE_INSTRUCTION: &str = "\
Return only a structured Svard OpenUI Lang interface. Do not invoke a visualize \
skill or produce Mermaid, HTML, a website, or a generated visualization file. \
Follow these OpenUI instructions:";
pub(in crate::agent_app_server) const LEGACY_AUTO_OPENUI_BRIDGE: &str = "\
Use a structured interface only when it materially improves this answer; \
otherwise answer in plain text. If you use one, follow these OpenUI instructions:";
pub(in crate::agent_app_server) const LEGACY_VISUALIZE_OPENUI_BRIDGE: &str = "\
Return a structured interface unless it would make the answer less useful. \
Follow these OpenUI instructions:";
pub(in crate::agent_app_server) const SVARD_AGENT_DEVELOPER_INSTRUCTIONS: &str = "\
Use normal Markdown for ordinary turns. Only return Svard OpenUI Lang when the \
user turn explicitly includes the Svard OpenUI contract. In that case, follow \
the contract instead of invoking a visualization skill or producing Mermaid, \
HTML, a website, or a visualization file.";
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentCapabilities {
    pub(in crate::agent_app_server) reasoning_summary: bool,
    pub(in crate::agent_app_server) plan: bool,
    pub(in crate::agent_app_server) tool_activity: bool,
    pub(in crate::agent_app_server) approvals: bool,
    pub(in crate::agent_app_server) workspace_write: bool,
    pub(in crate::agent_app_server) full_access: bool,
    pub(in crate::agent_app_server) network_access: bool,
    pub(in crate::agent_app_server) web_search: bool,
    pub(in crate::agent_app_server) structured_final_answer: bool,
    pub(in crate::agent_app_server) image_input: bool,
    pub(in crate::agent_app_server) ordered_mixed_input: bool,
    pub(in crate::agent_app_server) turn_steering: bool,
    pub(in crate::agent_app_server) context_usage: bool,
    pub(in crate::agent_app_server) token_usage_diagnostics: bool,
    pub(in crate::agent_app_server) manual_compaction: bool,
    pub(in crate::agent_app_server) focused_context: bool,
}
impl Default for AgentCapabilities {
    fn default() -> Self {
        Self {
            reasoning_summary: true,
            plan: true,
            tool_activity: true,
            approvals: true,
            workspace_write: true,
            full_access: true,
            network_access: true,
            web_search: true,
            structured_final_answer: true,
            image_input: false,
            ordered_mixed_input: false,
            turn_steering: false,
            context_usage: false,
            token_usage_diagnostics: false,
            manual_compaction: false,
            focused_context: false,
        }
    }
}
impl AgentCapabilities {
    pub(in crate::agent_app_server) fn with_protocol_features(
        image_input: bool,
        turn_steering: bool,
        context_usage: bool,
        token_usage_diagnostics: bool,
        manual_compaction: bool,
        focused_context: bool,
    ) -> Self {
        Self {
            image_input,
            ordered_mixed_input: image_input,
            turn_steering,
            context_usage,
            token_usage_diagnostics,
            manual_compaction,
            focused_context,
            ..Self::default()
        }
    }
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentProbe {
    pub(in crate::agent_app_server) provider_id: &'static str,
    pub(in crate::agent_app_server) state: &'static str,
    pub(in crate::agent_app_server) source: Option<&'static str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(in crate::agent_app_server) version: Option<String>,
    pub(in crate::agent_app_server) capabilities: AgentCapabilities,
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentReasoningEffortDescriptor {
    pub(in crate::agent_app_server) value: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(in crate::agent_app_server) description: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentModelDescriptor {
    pub(in crate::agent_app_server) id: String,
    pub(in crate::agent_app_server) model: String,
    pub(in crate::agent_app_server) display_name: String,
    pub(in crate::agent_app_server) description: String,
    pub(in crate::agent_app_server) is_default: bool,
    pub(in crate::agent_app_server) default_reasoning_effort: Option<String>,
    pub(in crate::agent_app_server) supported_reasoning_efforts:
        Vec<AgentReasoningEffortDescriptor>,
    pub(in crate::agent_app_server) supports_personality: bool,
    pub(in crate::agent_app_server) input_modalities: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentModelCatalog {
    pub(in crate::agent_app_server) provider_id: &'static str,
    pub(in crate::agent_app_server) models: Vec<AgentModelDescriptor>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentProviderRuntimeIssue {
    pub(in crate::agent_app_server) code: &'static str,
    pub(in crate::agent_app_server) message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentProviderRuntimeSnapshot {
    pub(in crate::agent_app_server) provider_id: &'static str,
    pub(in crate::agent_app_server) probe: AgentProbe,
    pub(in crate::agent_app_server) installation: Option<AgentInstallationDescriptor>,
    pub(in crate::agent_app_server) catalog: Option<AgentModelCatalog>,
    pub(in crate::agent_app_server) issue: Option<AgentProviderRuntimeIssue>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentInstallationDescriptor {
    pub(in crate::agent_app_server) source: &'static str,
    pub(in crate::agent_app_server) display_name: &'static str,
    pub(in crate::agent_app_server) version: String,
}
