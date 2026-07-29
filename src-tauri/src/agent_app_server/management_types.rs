use super::*;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentSessionManagementCapabilities {
    pub(super) list: bool,
    pub(super) search: bool,
    pub(super) resume: bool,
    pub(super) rename: bool,
    pub(super) archive: bool,
    pub(super) restore: bool,
    pub(super) delete: bool,
    pub(super) fork: bool,
}

impl Default for AgentSessionManagementCapabilities {
    fn default() -> Self {
        Self {
            list: true,
            search: true,
            resume: true,
            rename: true,
            archive: true,
            restore: true,
            delete: true,
            fork: false,
        }
    }
}
