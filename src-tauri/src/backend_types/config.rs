use serde::{Deserialize, Serialize};

use super::workspace::{default_workspace_state, WorkspaceState};

macro_rules! string_enum {
    (
        $vis:vis enum $name:ident {
            default $default:ident = $default_value:literal,
            $($variant:ident = $value:literal),* $(,)?
        }
    ) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq)]
        $vis enum $name {
            $default,
            $($variant),*
        }

        impl $name {
            pub(crate) fn as_str(self) -> &'static str {
                match self {
                    Self::$default => $default_value,
                    $(Self::$variant => $value),*
                }
            }

            pub(crate) fn from_value(value: &str) -> Self {
                match value {
                    $default_value => Self::$default,
                    $($value => Self::$variant,)*
                    _ => Self::$default,
                }
            }
        }

        impl Default for $name {
            fn default() -> Self {
                Self::$default
            }
        }

        impl Serialize for $name {
            fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
            where
                S: serde::Serializer,
            {
                serializer.serialize_str(self.as_str())
            }
        }

        impl<'de> Deserialize<'de> for $name {
            fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
            where
                D: serde::Deserializer<'de>,
            {
                let value = String::deserialize(deserializer)?;
                Ok(Self::from_value(&value))
            }
        }

        impl From<&str> for $name {
            fn from(value: &str) -> Self {
                Self::from_value(value)
            }
        }

        impl From<String> for $name {
            fn from(value: String) -> Self {
                Self::from_value(&value)
            }
        }

        impl PartialEq<&str> for $name {
            fn eq(&self, other: &&str) -> bool {
                self.as_str() == *other
            }
        }

        impl PartialEq<$name> for &str {
            fn eq(&self, other: &$name) -> bool {
                *self == other.as_str()
            }
        }
    };
}

string_enum!(pub enum ConfigTheme {
    default Light = "light",
    Dark = "dark",
});

string_enum!(pub enum AsciiDocTheme {
    default Antora = "antora",
    Asciidoctor = "asciidoctor",
});

string_enum!(pub enum WorkspaceSidebarTab {
    default Files = "files",
    Bookmarks = "bookmarks",
    SourceControl = "sourceControl",
});

string_enum!(pub enum SourceControlView {
    default Changes = "changes",
    BranchDiff = "branchDiff",
    Graph = "graph",
});

string_enum!(pub enum SourceControlGraphScope {
    default Repository = "repository",
    File = "file",
});

string_enum!(pub enum DiagramRenderer {
    default Local = "local",
    Kroki = "kroki",
});

string_enum!(pub enum KrokiMode {
    default Disabled = "disabled",
    Local = "local",
    Remote = "remote",
    Public = "public",
});

string_enum!(pub enum KrokiOutputFormat {
    default Svg = "svg",
    Png = "png",
});

string_enum!(pub enum HttpProxyMode {
    default Disabled = "disabled",
    Custom = "custom",
});

string_enum!(pub enum BookmarkKind {
    default File = "file",
    Directory = "directory",
});

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    #[serde(default)]
    pub theme: ConfigTheme,
    pub sidebar_visible: bool,
    pub right_sidebar_visible: bool,
    pub zoom: u16,
    #[serde(default)]
    pub zoom_with_mouse_wheel: bool,
    #[serde(default = "default_reader_config")]
    pub reader: ReaderConfig,
    #[serde(default = "default_zen_mode_config")]
    pub zen_mode: ZenModeConfig,
    #[serde(default = "default_layout_config")]
    pub layout: LayoutConfig,
    #[serde(default = "default_workspace_state")]
    pub workspace: WorkspaceState,
    #[serde(default = "default_diagram_config")]
    pub diagram: DiagramConfig,
    pub kroki: KrokiConfig,
    #[serde(default = "default_network_config")]
    pub network: NetworkConfig,
    #[serde(default = "default_remote_providers_config")]
    pub remote_providers: RemoteProvidersConfig,
    pub security: SecurityConfig,
    #[serde(default = "default_experimental_config")]
    pub experimental: ExperimentalConfig,
    #[serde(default = "default_keybindings_config")]
    pub keybindings: KeybindingsConfig,
    #[serde(default = "default_mouse_gestures_config")]
    pub mouse_gestures: MouseGesturesConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ReaderConfig {
    #[serde(default = "default_asciidoc_theme")]
    pub asciidoc_theme: AsciiDocTheme,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExperimentalConfig {
    #[serde(default)]
    pub search_hit_ruler: bool,
    #[serde(default)]
    pub restore_additional_windows_on_startup: bool,
    #[serde(default = "default_true")]
    pub diagram_placeholder_rendering: bool,
    #[serde(default)]
    pub diagram_placeholder_rendering_configured: bool,
    #[serde(default)]
    pub post_diff_git_markers: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ZenModeConfig {
    #[serde(default = "default_true")]
    pub center_layout: bool,
    #[serde(default = "default_zen_mode_max_content_width")]
    pub max_content_width: u16,
    #[serde(default = "default_true")]
    pub hide_topbar: bool,
    #[serde(default = "default_true")]
    pub hide_tabs: bool,
    #[serde(default = "default_true")]
    pub hide_left_sidebar: bool,
    #[serde(default = "default_true")]
    pub hide_right_sidebar: bool,
    #[serde(default = "default_true")]
    pub hide_status_bar: bool,
    #[serde(default)]
    pub full_screen: bool,
    #[serde(default = "default_true")]
    pub exit_on_escape: bool,
    #[serde(default = "default_true")]
    pub restore_previous_layout: bool,
    #[serde(default)]
    pub apply_to_diff_preview: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LayoutConfig {
    #[serde(default = "default_left_sidebar_width")]
    pub left_sidebar_width: u16,
    #[serde(default = "default_right_sidebar_width")]
    pub right_sidebar_width: u16,
    #[serde(default = "default_open_files_height")]
    pub open_files_height: u16,
    #[serde(default)]
    pub open_files_collapsed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DiagramConfig {
    #[serde(default = "default_mermaid_renderer")]
    pub mermaid_renderer: DiagramRenderer,
    #[serde(default = "default_plantuml_renderer")]
    pub plantuml_renderer: DiagramRenderer,
    #[serde(default = "default_plantuml_timeout_ms")]
    pub plantuml_timeout_ms: u64,
    #[serde(default = "default_graphviz_renderer")]
    pub graphviz_renderer: DiagramRenderer,
    #[serde(default = "default_graphviz_timeout_ms")]
    pub graphviz_timeout_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct KrokiConfig {
    #[serde(default)]
    pub mode: KrokiMode,
    pub endpoint_url: Option<String>,
    #[serde(default)]
    pub output_format: KrokiOutputFormat,
    pub timeout_ms: u64,
    pub max_body_bytes: u64,
    pub cache_enabled: bool,
    pub require_remote_confirmation: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NetworkConfig {
    #[serde(default = "default_http_proxy_config")]
    pub http_proxy: HttpProxyConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HttpProxyConfig {
    #[serde(default = "default_http_proxy_mode")]
    pub mode: HttpProxyMode,
    #[serde(default)]
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteProvidersConfig {
    #[serde(default = "default_github_provider_config")]
    pub github: RemoteProviderConfig,
    #[serde(default = "default_gitlab_provider_config")]
    pub gitlab: RemoteProviderConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteProviderConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub host_url: String,
    #[serde(default)]
    pub token_stored: bool,
    #[serde(default)]
    pub last_test_status: Option<RemoteProviderTestStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteProviderTestStatus {
    pub status: String,
    #[serde(default)]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProviderTokenStatus {
    pub stored: bool,
    #[serde(default)]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SecurityConfig {
    pub allow_local_images: bool,
    #[serde(default)]
    pub show_external_images: bool,
    pub confirm_external_links: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct KeybindingsConfig {
    pub preset: String,
    #[serde(default)]
    pub mappings: Vec<KeybindingMappingConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct KeybindingMappingConfig {
    pub keys: String,
    pub command_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub context: Option<String>,
    #[serde(default)]
    pub built_in: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MouseGesturesConfig {
    pub enabled: bool,
    pub trigger: String,
    pub show_trail: bool,
    pub min_distance_px: u16,
    #[serde(default)]
    pub mappings: Vec<MouseGestureMappingConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MouseGestureMappingConfig {
    pub pattern: String,
    pub command_id: String,
    #[serde(default)]
    pub built_in: bool,
}

fn default_diagram_config() -> DiagramConfig {
    DiagramConfig {
        mermaid_renderer: default_mermaid_renderer(),
        plantuml_renderer: default_plantuml_renderer(),
        plantuml_timeout_ms: default_plantuml_timeout_ms(),
        graphviz_renderer: default_graphviz_renderer(),
        graphviz_timeout_ms: default_graphviz_timeout_ms(),
    }
}

fn default_mermaid_renderer() -> DiagramRenderer {
    DiagramRenderer::Local
}

fn default_plantuml_renderer() -> DiagramRenderer {
    DiagramRenderer::Local
}

fn default_plantuml_timeout_ms() -> u64 {
    10_000
}

fn default_graphviz_renderer() -> DiagramRenderer {
    DiagramRenderer::Local
}

fn default_graphviz_timeout_ms() -> u64 {
    10_000
}

fn default_http_proxy_mode() -> HttpProxyMode {
    HttpProxyMode::Disabled
}

fn default_http_proxy_config() -> HttpProxyConfig {
    HttpProxyConfig {
        mode: default_http_proxy_mode(),
        url: None,
    }
}

fn default_network_config() -> NetworkConfig {
    NetworkConfig {
        http_proxy: default_http_proxy_config(),
    }
}

fn default_github_provider_config() -> RemoteProviderConfig {
    RemoteProviderConfig {
        enabled: false,
        host_url: "https://github.com".to_string(),
        token_stored: false,
        last_test_status: None,
    }
}

fn default_gitlab_provider_config() -> RemoteProviderConfig {
    RemoteProviderConfig {
        enabled: false,
        host_url: "https://gitlab.com".to_string(),
        token_stored: false,
        last_test_status: None,
    }
}

fn default_remote_providers_config() -> RemoteProvidersConfig {
    RemoteProvidersConfig {
        github: default_github_provider_config(),
        gitlab: default_gitlab_provider_config(),
    }
}

fn default_keybindings_config() -> KeybindingsConfig {
    KeybindingsConfig {
        preset: "native".to_string(),
        mappings: Vec::new(),
    }
}

fn default_mouse_gestures_config() -> MouseGesturesConfig {
    MouseGesturesConfig {
        enabled: false,
        trigger: "rightButton".to_string(),
        show_trail: true,
        min_distance_px: 32,
        mappings: Vec::new(),
    }
}

fn default_left_sidebar_width() -> u16 {
    260
}

fn default_right_sidebar_width() -> u16 {
    320
}

fn default_open_files_height() -> u16 {
    144
}

fn default_asciidoc_theme() -> AsciiDocTheme {
    AsciiDocTheme::Antora
}

fn default_true() -> bool {
    true
}

fn default_zen_mode_max_content_width() -> u16 {
    960
}

fn default_zen_mode_config() -> ZenModeConfig {
    ZenModeConfig {
        center_layout: true,
        max_content_width: default_zen_mode_max_content_width(),
        hide_topbar: true,
        hide_tabs: true,
        hide_left_sidebar: true,
        hide_right_sidebar: true,
        hide_status_bar: true,
        full_screen: false,
        exit_on_escape: true,
        restore_previous_layout: true,
        apply_to_diff_preview: false,
    }
}

fn default_reader_config() -> ReaderConfig {
    ReaderConfig {
        asciidoc_theme: default_asciidoc_theme(),
    }
}

fn default_layout_config() -> LayoutConfig {
    LayoutConfig {
        left_sidebar_width: default_left_sidebar_width(),
        right_sidebar_width: default_right_sidebar_width(),
        open_files_height: default_open_files_height(),
        open_files_collapsed: false,
    }
}

fn default_experimental_config() -> ExperimentalConfig {
    ExperimentalConfig {
        search_hit_ruler: false,
        restore_additional_windows_on_startup: false,
        diagram_placeholder_rendering: true,
        diagram_placeholder_rendering_configured: true,
        post_diff_git_markers: false,
    }
}

pub fn default_config() -> AppConfig {
    AppConfig {
        theme: ConfigTheme::Light,
        sidebar_visible: true,
        right_sidebar_visible: true,
        zoom: 100,
        zoom_with_mouse_wheel: false,
        reader: default_reader_config(),
        zen_mode: default_zen_mode_config(),
        layout: default_layout_config(),
        workspace: default_workspace_state(),
        diagram: default_diagram_config(),
        kroki: KrokiConfig {
            mode: KrokiMode::Disabled,
            endpoint_url: None,
            output_format: KrokiOutputFormat::Svg,
            timeout_ms: 10_000,
            max_body_bytes: 1_048_576,
            cache_enabled: true,
            require_remote_confirmation: true,
        },
        network: default_network_config(),
        remote_providers: default_remote_providers_config(),
        security: SecurityConfig {
            allow_local_images: true,
            show_external_images: false,
            confirm_external_links: true,
        },
        experimental: default_experimental_config(),
        keybindings: default_keybindings_config(),
        mouse_gestures: default_mouse_gestures_config(),
    }
}
