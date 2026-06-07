import type { PointerEvent as ReactPointerEvent } from "react";
import type {
  AppConfig,
  HostAdapter,
  KeybindingMappingConfig,
  KrokiResult,
  MouseGestureMappingConfig,
} from "../../../core/types";
import type { KeybindingPreset, Platform } from "../../../core/keybindings";

export type PreferencesSectionId =
  | "general"
  | "zenMode"
  | "diagrams"
  | "kroki"
  | "network"
  | "remoteProviders"
  | "security"
  | "experimental"
  | "cache"
  | "mouseGestures"
  | "keybindings";

export interface KrokiTestState {
  status: "idle" | "running" | "success" | "error";
  result?: KrokiResult;
  message?: string;
}

export interface GeneralSectionProps {
  config: AppConfig;
  zoomValue: number;
  onUpdateTheme: (theme: AppConfig["theme"]) => void;
  onUpdateAsciiDocTheme: (
    asciidocTheme: AppConfig["reader"]["asciidocTheme"],
  ) => void;
  onUpdateZoom: (zoom: number) => void;
  onUpdateZoomWithMouseWheel: (enabled: boolean) => void;
}

export interface ZenModeSectionProps {
  config: AppConfig;
  onUpdateZenMode: (zenMode: AppConfig["zenMode"]) => void;
}

export interface DiagramsSectionProps {
  config: AppConfig;
  onOpenKrokiSettings: () => void;
  onUpdateRenderer: (
    renderer: "plantumlRenderer" | "graphvizRenderer",
    value: AppConfig["diagram"]["plantumlRenderer"],
  ) => void;
  onUpdateTimeout: (
    field: "plantumlTimeoutMs" | "graphvizTimeoutMs",
    value: number,
  ) => void;
}

export interface KrokiSectionProps {
  config: AppConfig;
  krokiModeHelpText: string;
  krokiTest: KrokiTestState;
  onChange: (config: AppConfig) => void;
  onRunKrokiTest: () => void;
  onUpdateKrokiMode: (mode: AppConfig["kroki"]["mode"]) => void;
}

export interface NetworkSectionProps {
  config: AppConfig;
  onChange: (config: AppConfig) => void;
}

export interface RemoteProvidersSectionProps {
  config: AppConfig;
  host: HostAdapter;
  onChange: (config: AppConfig) => void;
}

export interface SecuritySectionProps {
  config: AppConfig;
  onChange: (config: AppConfig) => void;
}

export interface ExperimentalSectionProps {
  config: AppConfig;
  onChange: (config: AppConfig) => void;
}

export interface CacheSectionProps {
  config: AppConfig;
  onChange: (config: AppConfig) => void;
  onClearKrokiCache: () => void;
}

export interface MouseGesturesSectionProps {
  config: AppConfig;
  gestureErrors: Record<number, string>;
  recordingGestureIndex: number | null;
  recordingPattern: string;
  onChange: (config: AppConfig) => void;
  onResetMappings: () => void;
  onStartRecording: (index: number) => void;
  onUpdateMapping: (
    index: number,
    mapping: MouseGestureMappingConfig,
  ) => boolean;
  onRecordPointerDown: (
    event: ReactPointerEvent<HTMLElement>,
    index: number,
  ) => void;
  onRecordPointerMove: (
    event: ReactPointerEvent<HTMLElement>,
    index: number,
  ) => void;
  onRecordPointerUp: (
    event: ReactPointerEvent<HTMLElement>,
    index: number,
    mapping: MouseGestureMappingConfig,
  ) => void;
}

export interface KeybindingsSectionProps {
  keybindingPreset: KeybindingPreset;
  keybindingMappings: KeybindingMappingConfig[];
  keybindingErrors: Record<number, string>;
  platform: Platform;
  recordingKeybindingIndex: number | null;
  onResetMappings: () => void;
  onStartRecording: (index: number) => void;
  onUpdateMapping: (index: number, mapping: KeybindingMappingConfig) => boolean;
  onUpdatePreset: (preset: KeybindingPreset) => void;
}
