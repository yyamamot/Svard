use super::*;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentContextUsage {
    pub(super) used_tokens: u64,
    pub(super) context_window_tokens: u64,
    pub(super) remaining_percent: u8,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentTokenUsageBreakdown {
    pub(super) input_tokens: u64,
    pub(super) cached_input_tokens: u64,
    pub(super) output_tokens: u64,
    pub(super) reasoning_output_tokens: u64,
    pub(super) total_tokens: u64,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum AgentTokenUsageProvenance {
    ProviderReported,
    AggregatedProviderReports,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentTokenUsageSeries {
    pub(super) provenance: AgentTokenUsageProvenance,
    pub(super) usage: AgentTokenUsageBreakdown,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentTokenUsageDiagnostics {
    pub(super) latest_request: AgentTokenUsageSeries,
    pub(super) turn: Option<AgentTokenUsageSeries>,
    pub(super) conversation: AgentTokenUsageSeries,
}

#[derive(Debug, Default)]
pub(super) struct AgentTokenUsageTracking {
    pub(super) latest_request: Option<AgentTokenUsageBreakdown>,
    pub(super) last_conversation_total: Option<AgentTokenUsageBreakdown>,
    pub(super) active_turn: Option<AgentTokenUsageBreakdown>,
    pub(super) active_turn_overflowed: bool,
    pub(super) latest_turn: Option<AgentTokenUsageBreakdown>,
}
