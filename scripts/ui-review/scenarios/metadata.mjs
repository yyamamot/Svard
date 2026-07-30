import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scenarioContractPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../docs/contracts/ui-review-scenario-contract.json",
);

/**
 * @typedef {object} UiReviewScenarioContractEntry
 * @property {string} id
 * @property {string} group
 * @property {string} handler
 * @property {string[]} requiredMarkers
 * @property {string[]} optionalCoreMarkers
 * @property {boolean} documented
 * @property {boolean=} usesPreferencesPageShell
 * @property {boolean=} checksPreferencesLayout
 */

/**
 * @typedef {object} UiReviewScenarioContract
 * @property {number} schemaVersion
 * @property {UiReviewScenarioContractEntry[]} scenarios
 */

/** @type {UiReviewScenarioContract} */
export const uiReviewScenarioContract = JSON.parse(
  fs.readFileSync(scenarioContractPath, "utf8"),
);

const contractedScenarioMetadata = Object.fromEntries(
  uiReviewScenarioContract.scenarios.map((scenario) => [
    scenario.id,
    {
      ...scenario,
      requiredMarkers: scenario.requiredMarkers ?? [],
      optionalCoreMarkers: scenario.optionalCoreMarkers ?? [],
    },
  ]),
);

const preferencesOptionalCoreMarkers = [
  "document-viewer",
  "document-body",
  "right-sidebar",
  "right-sidebar-tabs",
  "right-sidebar-tab-contents",
  "right-sidebar-tab-search",
  "toc",
];

const preferenceScenarioMetadata = {
  "viewer-preferences": {
    usesPreferencesPageShell: true,
    checksPreferencesLayout: true,
    optionalCoreMarkers: preferencesOptionalCoreMarkers,
    requiredMarkers: [
      "kroki-diagnostic",
      "kroki-test-run",
      "kroki-test-result",
      "kroki-test-svg",
    ],
  },
  "viewer-preferences-tab": {
    usesPreferencesPageShell: true,
    optionalCoreMarkers: preferencesOptionalCoreMarkers,
    requiredMarkers: [
      "preferences-page",
      "preferences-dialog",
      "preferences-nav",
      "preferences-pane",
      "preferences-tab-general",
      "zoom-control",
      "zoom-wheel-toggle",
    ],
  },
  "viewer-preferences-zoom-wheel": {
    usesPreferencesPageShell: true,
    optionalCoreMarkers: preferencesOptionalCoreMarkers,
    requiredMarkers: [
      "preferences-page",
      "preferences-nav",
      "preferences-pane",
      "preferences-tab-general",
      "zoom-control",
      "zoom-wheel-toggle",
    ],
  },
  "viewer-mouse-wheel-zoom": {
    optionalCoreMarkers: preferencesOptionalCoreMarkers,
    requiredMarkers: ["document-viewer", "document-body"],
  },
  "viewer-preferences-kroki-remote-self-managed": {
    usesPreferencesPageShell: true,
    checksPreferencesLayout: true,
    optionalCoreMarkers: preferencesOptionalCoreMarkers,
    requiredMarkers: [
      "kroki-diagnostic",
      "kroki-test-run",
      "kroki-test-result",
      "kroki-test-svg",
    ],
  },
  "viewer-preferences-remote-providers": {
    usesPreferencesPageShell: true,
    optionalCoreMarkers: preferencesOptionalCoreMarkers,
    requiredMarkers: [
      "preferences-tab-remote-providers",
      "remote-provider-github",
      "remote-provider-gitlab",
      "remote-provider-github-token-status",
      "remote-provider-github-save-token",
      "remote-provider-github-test",
    ],
  },
  "viewer-preferences-agent-providers": {
    usesPreferencesPageShell: true,
    optionalCoreMarkers: preferencesOptionalCoreMarkers,
    requiredMarkers: [
      "preferences-tab-agent-providers",
      "agent-provider-codex-status",
      "agent-provider-codex-model",
      "agent-provider-codex-reasoning",
      "agent-provider-codex-personality",
      "agent-provider-codex-permission",
    ],
  },
  "viewer-preferences-agent-models": {
    usesPreferencesPageShell: true,
    optionalCoreMarkers: preferencesOptionalCoreMarkers,
    requiredMarkers: [
      "preferences-tab-agent-providers",
      "agent-provider-codex-status",
      "agent-provider-codex-model",
      "agent-provider-codex-reasoning",
      "agent-provider-codex-personality",
      "agent-provider-codex-permission",
    ],
  },
  "viewer-preferences-agent-runtime-cache": {
    usesPreferencesPageShell: true,
    optionalCoreMarkers: preferencesOptionalCoreMarkers,
    requiredMarkers: [
      "preferences-tab-agent-providers",
      "agent-provider-codex-status",
      "agent-provider-codex-model",
      "agent-provider-codex-reasoning",
      "agent-provider-codex-personality",
      "agent-provider-codex-permission",
    ],
  },
  "viewer-preferences-agent-executable": {
    usesPreferencesPageShell: true,
    optionalCoreMarkers: preferencesOptionalCoreMarkers,
    requiredMarkers: [
      "preferences-tab-agent-providers",
      "agent-provider-codex-status",
      "agent-provider-codex-installation",
      "agent-provider-codex-installation-detail",
      "agent-provider-codex-model",
    ],
  },
  "viewer-preferences-diagrams-polish": {
    usesPreferencesPageShell: true,
    optionalCoreMarkers: preferencesOptionalCoreMarkers,
    requiredMarkers: [
      "preferences-dialog",
      "preferences-nav",
      "preferences-pane",
      "preferences-tab-diagrams",
      "diagram-renderer-settings",
      "mermaid-renderer",
      "plantuml-renderer-control",
      "graphviz-renderer-control",
      "diagram-advanced-settings",
    ],
  },
  "viewer-preferences-security-persistence": {
    usesPreferencesPageShell: true,
    checksPreferencesLayout: true,
    optionalCoreMarkers: preferencesOptionalCoreMarkers,
    requiredMarkers: [
      "preferences-page",
      "preferences-nav",
      "preferences-pane",
      "preferences-tab-security",
      "show-external-images-control",
    ],
  },
  "viewer-preferences-experimental": {
    usesPreferencesPageShell: true,
    checksPreferencesLayout: true,
    optionalCoreMarkers: preferencesOptionalCoreMarkers,
    requiredMarkers: [
      "preferences-page",
      "preferences-nav",
      "preferences-pane",
      "preferences-tab-experimental",
      "experimental-search-hit-ruler-control",
    ],
  },
  "viewer-preferences-zen-mode": {
    usesPreferencesPageShell: true,
    checksPreferencesLayout: true,
    optionalCoreMarkers: preferencesOptionalCoreMarkers,
    requiredMarkers: [
      "preferences-page",
      "preferences-nav",
      "preferences-pane",
      "preferences-tab-zen-mode",
      "zen-mode-preset-control",
      "zen-mode-advanced-settings",
    ],
  },
  "viewer-preferences-stable-size": {
    usesPreferencesPageShell: true,
    optionalCoreMarkers: preferencesOptionalCoreMarkers,
    requiredMarkers: [
      "preferences-dialog",
      "preferences-nav",
      "preferences-pane",
      "preferences-tab-keybindings",
      "keybinding-shortcut-table",
    ],
  },
  "viewer-preferences-keybindings": {
    usesPreferencesPageShell: true,
    checksPreferencesLayout: true,
    optionalCoreMarkers: preferencesOptionalCoreMarkers,
    requiredMarkers: [
      "preferences-page",
      "preferences-dialog",
      "preferences-nav",
      "preferences-pane",
      "preferences-tab-keybindings",
      "keybinding-search",
      "keybinding-shortcut-table",
    ],
  },
};

const scenarioMetadata = {
  ...contractedScenarioMetadata,
  ...preferenceScenarioMetadata,
};

export function scenarioContractFor(scenario) {
  return scenarioMetadata[scenario] ?? null;
}

export function preferenceScenarioFor(scenario) {
  return preferenceScenarioMetadata[scenario] ?? null;
}

export function isPreferencesPageScenario(scenario) {
  return scenarioContractFor(scenario)?.usesPreferencesPageShell === true;
}

export function isPreferencesLayoutScenario(scenario) {
  return preferenceScenarioFor(scenario)?.checksPreferencesLayout === true;
}

export function optionalCoreMarkersForScenario(scenario) {
  return scenarioContractFor(scenario)?.optionalCoreMarkers ?? [];
}

export function requiredMarkersForScenario(scenario) {
  return scenarioContractFor(scenario)?.requiredMarkers ?? [];
}

export const preferenceScenarioIds = Object.keys(preferenceScenarioMetadata);
export const uiReviewScenarioContractIds = Object.keys(
  contractedScenarioMetadata,
);
