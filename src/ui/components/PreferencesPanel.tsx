import { useEffect, useMemo, useRef, useState } from "react";
import type {
  FocusEvent as ReactFocusEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { publicKrokiEndpoint } from "../../core/defaultConfig";
import {
  defaultKeybindingMappings,
  detectPlatform,
  isModifierOnlyKey,
  normalizeKeyboardEvent,
  normalizeKeybindingMappings,
  validateKeybindingMappings,
} from "../../core/keybindings";
import type { KeybindingPreset } from "../../core/keybindings";
import {
  defaultMouseGestureConfig,
  duplicateMouseGesturePatterns,
  normalizeMouseGesture,
  normalizeMouseGestureMappings,
} from "../../core/mouseGestures";
import type {
  AppConfig,
  HostAdapter,
  KeybindingMappingConfig,
  KrokiResult,
  MouseGestureMappingConfig,
} from "../../core/types";
import { CacheSection } from "./preferences/CacheSection";
import { AgentProvidersSection } from "./preferences/AgentProvidersSection";
import { DiagramsSection } from "./preferences/DiagramsSection";
import { ExperimentalSection } from "./preferences/ExperimentalSection";
import { GeneralSection } from "./preferences/GeneralSection";
import { KeybindingsSection } from "./preferences/KeybindingsSection";
import { KrokiSection } from "./preferences/KrokiSection";
import { MouseGesturesSection } from "./preferences/MouseGesturesSection";
import { NetworkSection } from "./preferences/NetworkSection";
import { RemoteProvidersSection } from "./preferences/RemoteProvidersSection";
import { SecuritySection } from "./preferences/SecuritySection";
import { ZenModeSection } from "./preferences/ZenModeSection";
import type {
  ExternalPlantUmlTestState,
  KrokiTestState,
  PreferencesSectionId,
} from "./preferences/types";

const preferenceSections: Array<{ id: PreferencesSectionId; title: string }> = [
  { id: "general", title: "General" },
  { id: "zenMode", title: "Zen Mode" },
  { id: "diagrams", title: "Diagrams" },
  { id: "kroki", title: "Kroki" },
  { id: "network", title: "Network" },
  { id: "agentProviders", title: "AI Providers" },
  { id: "remoteProviders", title: "PR / MR Providers" },
  { id: "security", title: "Security" },
  { id: "cache", title: "Cache" },
  { id: "mouseGestures", title: "Mouse Gestures" },
  { id: "keybindings", title: "Keybindings" },
  { id: "experimental", title: "Experimental" },
];

export function PreferencesPanel({
  config,
  onChange,
  onClearKrokiCache,
  onClearPlantUmlSvgCache,
  onTestKroki,
  host,
  onClose,
  mode = "modal",
}: {
  config: AppConfig;
  onChange: (config: AppConfig) => void;
  onClearKrokiCache: () => void | Promise<void>;
  onClearPlantUmlSvgCache: () => void | Promise<void>;
  onTestKroki: (config: AppConfig) => Promise<KrokiResult>;
  host: HostAdapter;
  onClose: () => void;
  mode?: "modal" | "page";
}) {
  const [activeSection, setActiveSection] =
    useState<PreferencesSectionId>("general");
  const [recordingKeybindingIndex, setRecordingKeybindingIndex] = useState<
    number | null
  >(null);
  const [keybindingErrors, setKeybindingErrors] = useState<
    Record<number, string>
  >({});
  const [recordingGestureIndex, setRecordingGestureIndex] = useState<
    number | null
  >(null);
  const [recordingPattern, setRecordingPattern] = useState("");
  const [gestureErrors, setGestureErrors] = useState<Record<number, string>>(
    {},
  );
  const [krokiTest, setKrokiTest] = useState<KrokiTestState>({
    status: "idle",
  });
  const [externalPlantUmlTest, setExternalPlantUmlTest] =
    useState<ExternalPlantUmlTestState>({
      status: "idle",
    });
  const recordingPointsRef = useRef<Array<{ x: number; y: number }>>([]);

  const activeSectionTitle =
    preferenceSections.find((section) => section.id === activeSection)?.title ??
    "General";
  const platform = useMemo(() => detectPlatform(), []);
  const keybindingPreset = config.keybindings?.preset ?? "native";
  const keybindingMappings = normalizeKeybindingMappings(
    keybindingPreset,
    config.keybindings?.mappings,
  );
  const zoomValue = Math.min(140, Math.max(80, config.zoom));

  function cancelRecordings() {
    setRecordingKeybindingIndex(null);
    setRecordingGestureIndex(null);
    setRecordingPattern("");
    recordingPointsRef.current = [];
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (recordingKeybindingIndex === null) {
        if (event.key === "Escape") {
          cancelRecordings();
        }
        return;
      }

      event.stopImmediatePropagation();
      event.stopPropagation();
      if (event.key === "Escape") {
        event.preventDefault();
        cancelRecordings();
        return;
      }
      if (event.key === "Tab") {
        cancelRecordings();
        return;
      }
      event.preventDefault();
      if (isModifierOnlyKey(event.key)) {
        return;
      }
      const mapping = keybindingMappings[recordingKeybindingIndex];
      if (!mapping) {
        cancelRecordings();
        return;
      }
      updateKeybindingMapping(recordingKeybindingIndex, {
        ...mapping,
        keys: normalizeKeyboardEvent(event),
      });
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  });

  useEffect(() => {
    setKrokiTest({ status: "idle" });
  }, [
    config.kroki.mode,
    config.kroki.endpointUrl,
    config.kroki.outputFormat,
    config.kroki.timeoutMs,
  ]);

  useEffect(() => {
    setExternalPlantUmlTest({ status: "idle" });
  }, [
    config.diagram.plantumlExternalFallback,
    config.diagram.plantumlExternalBinaryPath,
    config.diagram.plantumlExternalTimeoutMs,
    config.diagram.plantumlExternalDotPath,
  ]);

  function updateKeybindingMappings(
    mappings: KeybindingMappingConfig[],
    nextErrors: Record<number, string> = {},
  ) {
    onChange({
      ...config,
      keybindings: {
        preset: keybindingPreset,
        mappings: normalizeKeybindingMappings(keybindingPreset, mappings),
      },
    });
    setKeybindingErrors(nextErrors);
  }

  function updateKeybindingMapping(
    index: number,
    mapping: KeybindingMappingConfig,
  ): boolean {
    const nextMappings = keybindingMappings.map((current, currentIndex) =>
      currentIndex === index ? mapping : current,
    );
    const nextErrors = validateKeybindingMappings(nextMappings, platform);
    if (nextErrors[index]) {
      setKeybindingErrors({ ...keybindingErrors, [index]: nextErrors[index] });
      cancelRecordings();
      return false;
    }

    updateKeybindingMappings(nextMappings, nextErrors);
    cancelRecordings();
    return true;
  }

  function updateKeybindingPreset(preset: KeybindingPreset) {
    cancelRecordings();
    setKeybindingErrors({});
    onChange({
      ...config,
      keybindings: {
        preset,
        mappings: defaultKeybindingMappings(preset),
      },
    });
  }

  function startKeybindingRecording(index: number) {
    if (recordingKeybindingIndex === index) {
      cancelRecordings();
      return;
    }
    setRecordingGestureIndex(null);
    setRecordingPattern("");
    recordingPointsRef.current = [];
    const nextErrors = { ...keybindingErrors };
    delete nextErrors[index];
    setKeybindingErrors(nextErrors);
    setRecordingKeybindingIndex(index);
  }

  function updateMouseGestureMappings(
    mappings: MouseGestureMappingConfig[],
    nextErrors: Record<number, string> = {},
  ) {
    onChange({
      ...config,
      mouseGestures: {
        ...(config.mouseGestures ?? defaultMouseGestureConfig),
        mappings: normalizeMouseGestureMappings(mappings),
      },
    });
    setGestureErrors(nextErrors);
  }

  function updateMouseGestureMapping(
    index: number,
    mapping: MouseGestureMappingConfig,
  ): boolean {
    const mouseGestures = config.mouseGestures ?? defaultMouseGestureConfig;
    const mappings = normalizeMouseGestureMappings(mouseGestures.mappings);
    const nextMappings = mappings.map((current, currentIndex) =>
      currentIndex === index ? mapping : current,
    );
    const duplicates = duplicateMouseGesturePatterns(nextMappings);
    if (mapping.pattern && duplicates.has(mapping.pattern)) {
      setGestureErrors({
        ...gestureErrors,
        [index]: "This gesture is already assigned.",
      });
      return false;
    }

    const nextErrors = { ...gestureErrors };
    delete nextErrors[index];
    updateMouseGestureMappings(nextMappings, nextErrors);
    return true;
  }

  function startGestureRecording(index: number) {
    if (recordingGestureIndex === index) {
      cancelRecordings();
      return;
    }
    setRecordingKeybindingIndex(null);
    setRecordingGestureIndex(index);
    setRecordingPattern("");
    recordingPointsRef.current = [];
    const nextErrors = { ...gestureErrors };
    delete nextErrors[index];
    setGestureErrors(nextErrors);
  }

  function updateDiagramRenderer(
    renderer: "plantumlRenderer" | "graphvizRenderer",
    value: AppConfig["diagram"]["plantumlRenderer"],
  ) {
    onChange({ ...config, diagram: { ...config.diagram, [renderer]: value } });
  }

  function updateDiagramTimeout(
    field:
      | "plantumlTimeoutMs"
      | "plantumlExternalTimeoutMs"
      | "graphvizTimeoutMs",
    value: number,
  ) {
    onChange({ ...config, diagram: { ...config.diagram, [field]: value } });
  }

  function updateExternalPlantUmlFallback(
    plantumlExternalFallback: AppConfig["diagram"]["plantumlExternalFallback"],
  ) {
    onChange({
      ...config,
      diagram: { ...config.diagram, plantumlExternalFallback },
    });
  }

  function updateExternalPlantUmlPath(
    field: "plantumlExternalBinaryPath" | "plantumlExternalDotPath",
    value: string | null,
  ) {
    onChange({ ...config, diagram: { ...config.diagram, [field]: value } });
  }

  function updateKrokiMode(mode: AppConfig["kroki"]["mode"]) {
    onChange({
      ...config,
      kroki: {
        ...config.kroki,
        mode,
        endpointUrl:
          mode === "public"
            ? publicKrokiEndpoint
            : config.kroki.endpointUrl === publicKrokiEndpoint
              ? null
              : config.kroki.endpointUrl,
        requireRemoteConfirmation:
          mode === "public" ? true : config.kroki.requireRemoteConfirmation,
      },
    });
  }

  async function runKrokiTest() {
    setKrokiTest({ status: "running" });
    try {
      const result = await onTestKroki(config);
      setKrokiTest({
        status: result.status === "rendered" ? "success" : "error",
        result,
        message: result.message,
      });
    } catch (error) {
      setKrokiTest({
        status: "error",
        message: error instanceof Error ? error.message : "Kroki test failed.",
      });
    }
  }

  async function runExternalPlantUmlTest() {
    setExternalPlantUmlTest({ status: "running" });
    try {
      const result = await host.testExternalPlantUml({
        binaryPath: config.diagram.plantumlExternalBinaryPath,
        dotPath: config.diagram.plantumlExternalDotPath,
        timeoutMs: config.diagram.plantumlExternalTimeoutMs,
      });
      setExternalPlantUmlTest({
        status: result.status === "rendered" ? "success" : "error",
        result,
        message: result.diagnostics.find(Boolean),
      });
    } catch (error) {
      setExternalPlantUmlTest({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "External PlantUML test failed.",
      });
    }
  }

  function handleGestureRecordPointerDown(
    event: ReactPointerEvent<HTMLElement>,
    index: number,
  ) {
    if (recordingGestureIndex !== index || event.button !== 2) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    recordingPointsRef.current = [{ x: event.clientX, y: event.clientY }];
    setRecordingPattern("");
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleGestureRecordPointerMove(
    event: ReactPointerEvent<HTMLElement>,
    index: number,
  ) {
    if (
      recordingGestureIndex !== index ||
      recordingPointsRef.current.length === 0
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    recordingPointsRef.current = [
      ...recordingPointsRef.current,
      { x: event.clientX, y: event.clientY },
    ];
    setRecordingPattern(
      normalizeMouseGesture(
        recordingPointsRef.current,
        (config.mouseGestures ?? defaultMouseGestureConfig).minDistancePx,
      ).join(" "),
    );
  }

  function handleGestureRecordPointerUp(
    event: ReactPointerEvent<HTMLElement>,
    index: number,
    mapping: MouseGestureMappingConfig,
  ) {
    if (recordingGestureIndex !== index) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const pattern = normalizeMouseGesture(
      recordingPointsRef.current,
      (config.mouseGestures ?? defaultMouseGestureConfig).minDistancePx,
    ).join(" ");
    if (!pattern) {
      setGestureErrors({
        ...gestureErrors,
        [index]: "Draw a gesture before releasing the button.",
      });
      return;
    }
    if (updateMouseGestureMapping(index, { ...mapping, pattern })) {
      cancelRecordings();
    }
  }

  function handlePreferencesPointerDownCapture(
    event: ReactPointerEvent<HTMLElement>,
  ) {
    if (recordingKeybindingIndex === null && recordingGestureIndex === null) {
      return;
    }
    const target = event.target as HTMLElement;
    const activeKeybindingRow = target.closest("[data-keybinding-row-index]");
    if (
      recordingKeybindingIndex !== null &&
      activeKeybindingRow?.getAttribute("data-keybinding-row-index") ===
        String(recordingKeybindingIndex) &&
      target.closest('[data-review-id="keybinding-record"]')
    ) {
      return;
    }
    const activeGestureRow = target.closest("[data-mouse-gesture-row-index]");
    if (
      recordingGestureIndex !== null &&
      activeGestureRow?.getAttribute("data-mouse-gesture-row-index") ===
        String(recordingGestureIndex) &&
      target.closest(
        '[data-review-id="mouse-gesture-record"], [data-review-id="mouse-gesture-record-pad"]',
      )
    ) {
      return;
    }
    cancelRecordings();
  }

  function handlePreferencesBlur(event: ReactFocusEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      cancelRecordings();
    }
  }

  function selectSection(section: PreferencesSectionId) {
    cancelRecordings();
    setActiveSection(section);
  }

  function renderActiveSection() {
    const krokiModeHelpText =
      config.kroki.mode === "disabled"
        ? "Kroki is not used."
        : config.kroki.mode === "remote"
          ? "Use a trusted self-managed Kroki endpoint. Confirmation is controlled below."
          : "Uses https://kroki.io. Sending still requires confirmation.";

    switch (activeSection) {
      case "general":
        return (
          <GeneralSection
            config={config}
            zoomValue={zoomValue}
            onUpdateTheme={(theme) => onChange({ ...config, theme })}
            onUpdateAsciiDocTheme={(asciidocTheme) =>
              onChange({
                ...config,
                reader: {
                  ...config.reader,
                  asciidocTheme,
                },
              })
            }
            onUpdateZoom={(zoom) =>
              onChange({ ...config, zoom: Math.min(140, Math.max(80, zoom)) })
            }
            onUpdateZoomWithMouseWheel={(zoomWithMouseWheel) =>
              onChange({ ...config, zoomWithMouseWheel })
            }
            onUpdatePostDiffGitMarkers={(postDiffGitMarkers) =>
              onChange({
                ...config,
                experimental: {
                  ...config.experimental,
                  postDiffGitMarkers,
                },
              })
            }
            onUpdateChangeReviewDisplay={(changeReviewDisplay) =>
              onChange({
                ...config,
                experimental: {
                  ...config.experimental,
                  changeReviewDisplay,
                },
              })
            }
          />
        );
      case "zenMode":
        return (
          <ZenModeSection
            config={config}
            onUpdateZenMode={(zenMode) =>
              onChange({
                ...config,
                zenMode,
              })
            }
          />
        );
      case "diagrams":
        return (
          <DiagramsSection
            config={config}
            onOpenKrokiSettings={() => setActiveSection("kroki")}
            onUpdateRenderer={updateDiagramRenderer}
            onUpdateFastDiagramLoading={(diagramPlaceholderRendering) =>
              onChange({
                ...config,
                experimental: {
                  ...config.experimental,
                  diagramPlaceholderRendering,
                  diagramPlaceholderRenderingConfigured: true,
                },
              })
            }
            onUpdateTimeout={updateDiagramTimeout}
            externalPlantUmlTest={externalPlantUmlTest}
            onRunExternalPlantUmlTest={() => void runExternalPlantUmlTest()}
            onUpdateExternalPlantUmlFallback={updateExternalPlantUmlFallback}
            onUpdateExternalPlantUmlPath={updateExternalPlantUmlPath}
          />
        );
      case "kroki":
        return (
          <KrokiSection
            config={config}
            krokiModeHelpText={krokiModeHelpText}
            krokiTest={krokiTest}
            onChange={onChange}
            onRunKrokiTest={() => void runKrokiTest()}
            onUpdateKrokiMode={updateKrokiMode}
          />
        );
      case "security":
        return <SecuritySection config={config} onChange={onChange} />;
      case "experimental":
        return <ExperimentalSection config={config} onChange={onChange} />;
      case "network":
        return <NetworkSection config={config} onChange={onChange} />;
      case "agentProviders":
        return (
          <AgentProvidersSection
            config={config}
            host={host}
            onChange={onChange}
          />
        );
      case "remoteProviders":
        return (
          <RemoteProvidersSection
            config={config}
            host={host}
            onChange={onChange}
          />
        );
      case "cache":
        return (
          <CacheSection
            config={config}
            onChange={onChange}
            onClearKrokiCache={onClearKrokiCache}
            onClearPlantUmlSvgCache={onClearPlantUmlSvgCache}
          />
        );
      case "mouseGestures":
        return (
          <MouseGesturesSection
            config={config}
            gestureErrors={gestureErrors}
            recordingGestureIndex={recordingGestureIndex}
            recordingPattern={recordingPattern}
            onChange={onChange}
            onResetMappings={() =>
              updateMouseGestureMappings(defaultMouseGestureConfig.mappings)
            }
            onStartRecording={startGestureRecording}
            onUpdateMapping={updateMouseGestureMapping}
            onRecordPointerDown={handleGestureRecordPointerDown}
            onRecordPointerMove={handleGestureRecordPointerMove}
            onRecordPointerUp={handleGestureRecordPointerUp}
          />
        );
      case "keybindings":
        return (
          <KeybindingsSection
            keybindingPreset={keybindingPreset}
            keybindingMappings={keybindingMappings}
            keybindingErrors={keybindingErrors}
            platform={platform}
            recordingKeybindingIndex={recordingKeybindingIndex}
            onResetMappings={() =>
              updateKeybindingMappings(
                defaultKeybindingMappings(keybindingPreset),
              )
            }
            onStartRecording={startKeybindingRecording}
            onUpdateMapping={updateKeybindingMapping}
            onUpdatePreset={updateKeybindingPreset}
          />
        );
    }
  }

  const content = (
    <section
      className={`preferences ${mode === "page" ? "preferences-page" : ""}`}
      data-review-id="preferences-dialog"
      aria-label="Preferences"
      onPointerDownCapture={handlePreferencesPointerDownCapture}
      onBlurCapture={handlePreferencesBlur}
    >
      <header className="preferences-header">
        <div>
          <p className="eyebrow">Preferences</p>
          <h2>{activeSectionTitle}</h2>
        </div>
        <button
          type="button"
          className="button subtle"
          data-review-id="preferences-close"
          onClick={() => {
            cancelRecordings();
            onClose();
          }}
        >
          Close
        </button>
      </header>
      <div className="preferences-layout">
        <nav
          className="preferences-nav"
          data-review-id="preferences-nav"
          aria-label="Preference categories"
        >
          {preferenceSections.map((section) => (
            <button
              key={section.id}
              type="button"
              className={`preferences-nav-item ${
                activeSection === section.id ? "active" : ""
              }`}
              data-review-id="preferences-nav-item"
              onClick={() => selectSection(section.id)}
            >
              {section.title}
            </button>
          ))}
        </nav>
        <div className="preferences-pane" data-review-id="preferences-pane">
          {renderActiveSection()}
        </div>
      </div>
    </section>
  );

  if (mode === "page") {
    return (
      <div className="preferences-page-shell" data-review-id="preferences-page">
        {content}
      </div>
    );
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          cancelRecordings();
          onClose();
        }
      }}
    >
      {content}
    </div>
  );
}
