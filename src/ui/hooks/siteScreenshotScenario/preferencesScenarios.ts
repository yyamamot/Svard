import { fixtureDirectory } from "./helpers";
import type { SiteScreenshotScenarioContext } from "./types";

const preferenceScenarios = new Set([
  "kroki-fallback",
  "external-plantuml-fallback",
  "change-review-settings",
  "themes-zoom-preferences",
  "diagram-loading-cache",
  "network-settings",
  "pr-mr-providers",
  "keybindings",
  "mouse-gestures",
  "mouse-gestures-record",
  "preferences",
  "privacy-boundary",
]);

export async function runPreferencesScenarios(
  context: SiteScreenshotScenarioContext,
) {
  const {
    dismissInlineNotice,
    documentPayload,
    fixturePath,
    openDirectory,
    openPreferences,
    scenario,
    setConfig,
    setRootDirectory,
    setSidebarLayout,
    setTabs,
    setWindowTheme,
  } = context;

  if (!preferenceScenarios.has(scenario)) return false;

  const directory = fixtureDirectory(fixturePath);
  const applyPreferencesScenarioState = () => {
    dismissInlineNotice();
    if (scenario === "themes-zoom-preferences") void setWindowTheme("light");
    setRootDirectory(directory);
    setTabs((current) => {
      const active = documentPayload ?? current[0];
      return active ? [active] : current;
    });
    setSidebarLayout((current) => ({
      ...current,
      openFilesCollapsed: true,
    }));
    setConfig((current) =>
      current
        ? {
            ...current,
            theme:
              scenario === "themes-zoom-preferences" ? "light" : current.theme,
            zoom: scenario === "themes-zoom-preferences" ? 120 : current.zoom,
            sidebarVisible: false,
            rightSidebarVisible: false,
            reader: {
              ...current.reader,
              asciidocTheme:
                scenario === "themes-zoom-preferences"
                  ? "asciidoctor"
                  : current.reader.asciidocTheme,
            },
            layout: {
              ...current.layout,
              openFilesCollapsed: true,
            },
            workspace: {
              ...current.workspace,
              sidebarTab: "files",
            },
            network: {
              ...current.network,
              httpProxy: {
                ...current.network.httpProxy,
                mode:
                  scenario === "network-settings"
                    ? "custom"
                    : current.network.httpProxy.mode,
                url:
                  scenario === "network-settings"
                    ? null
                    : current.network.httpProxy.url,
              },
            },
            remoteProviders: {
              ...current.remoteProviders,
              github:
                scenario === "pr-mr-providers"
                  ? {
                      ...current.remoteProviders.github,
                      enabled: true,
                      hostUrl: "",
                      tokenStored: true,
                      lastTestStatus: {
                        status: "untested",
                        message: "Connection values are hidden.",
                      },
                    }
                  : current.remoteProviders.github,
              gitlab:
                scenario === "pr-mr-providers"
                  ? {
                      ...current.remoteProviders.gitlab,
                      enabled: false,
                      hostUrl: "",
                      tokenStored: false,
                      lastTestStatus: null,
                    }
                  : current.remoteProviders.gitlab,
            },
            kroki: {
              ...current.kroki,
              mode:
                scenario === "kroki-fallback" ? "remote" : current.kroki.mode,
              endpointUrl:
                scenario === "kroki-fallback"
                  ? null
                  : current.kroki.endpointUrl,
            },
            diagram: {
              ...current.diagram,
              plantumlExternalFallback:
                scenario === "external-plantuml-fallback"
                  ? "on-local-failure"
                  : current.diagram.plantumlExternalFallback,
              plantumlExternalBinaryPath:
                scenario === "external-plantuml-fallback"
                  ? "public-demo-tools/plantuml-graalvm"
                  : current.diagram.plantumlExternalBinaryPath,
              plantumlExternalDotPath:
                scenario === "external-plantuml-fallback"
                  ? null
                  : current.diagram.plantumlExternalDotPath,
              plantumlExternalTimeoutMs:
                scenario === "external-plantuml-fallback"
                  ? 5000
                  : current.diagram.plantumlExternalTimeoutMs,
            },
            mouseGestures: {
              ...current.mouseGestures,
              enabled:
                scenario === "mouse-gestures" ||
                scenario === "mouse-gestures-record" ||
                scenario === "preferences"
                  ? true
                  : current.mouseGestures.enabled,
            },
            experimental: {
              ...current.experimental,
              postDiffGitMarkers:
                scenario === "change-review-settings"
                  ? false
                  : current.experimental.postDiffGitMarkers,
            },
          }
        : current,
    );
  };
  const targetLabel =
    scenario === "kroki-fallback"
      ? "Kroki"
      : scenario === "external-plantuml-fallback"
        ? "Diagrams"
        : scenario === "change-review-settings" ||
            scenario === "themes-zoom-preferences"
          ? "General"
          : scenario === "diagram-loading-cache"
            ? "Diagrams"
            : scenario === "network-settings"
              ? "Network"
              : scenario === "pr-mr-providers"
                ? "PR / MR Providers"
                : scenario === "keybindings"
                  ? "Keybindings"
                  : scenario === "mouse-gestures" ||
                      scenario === "mouse-gestures-record" ||
                      scenario === "preferences"
                    ? "Mouse Gestures"
                    : "Security";
  const scrubKrokiPublicValues = () => {
    if (scenario !== "kroki-fallback") return;
    const endpointInput = document.querySelector<HTMLInputElement>(
      '[data-review-id="kroki-endpoint-control"]',
    );
    if (!endpointInput) return;
    endpointInput.value = "";
    endpointInput.defaultValue = "";
    endpointInput.setAttribute("value", "");
    endpointInput.placeholder = "Configured endpoint is hidden";

    const modeHelp = document.querySelector<HTMLElement>(
      '[data-review-id="kroki-mode-help"]',
    );
    if (modeHelp)
      modeHelp.textContent = "Use a trusted self-managed Kroki service.";

    const privacyNote = document.querySelector<HTMLElement>(
      '[data-review-id="kroki-privacy-note"]',
    );
    if (privacyNote) {
      privacyNote.textContent =
        "Remote rendering is used only after this preference is configured.";
    }
  };
  const scrubExternalPlantUmlValues = () => {
    if (scenario !== "external-plantuml-fallback") return;
    const advanced = document.querySelector<HTMLDetailsElement>(
      '[data-review-id="diagram-advanced-settings"]',
    );
    if (advanced) advanced.open = true;
    const binaryPath = document.querySelector<HTMLInputElement>(
      '[data-review-id="plantuml-external-binary-path"]',
    );
    if (binaryPath) {
      binaryPath.value = "public-demo-tools/plantuml-graalvm";
      binaryPath.defaultValue = "public-demo-tools/plantuml-graalvm";
      binaryPath.setAttribute("value", "public-demo-tools/plantuml-graalvm");
    }
    const dotPath = document.querySelector<HTMLInputElement>(
      '[data-review-id="plantuml-external-dot-path"]',
    );
    if (dotPath) {
      dotPath.value = "";
      dotPath.defaultValue = "";
      dotPath.setAttribute("value", "");
      dotPath.placeholder = "Configure Graphviz dot only when needed";
    }
  };
  const openPreferencesSection = () => {
    applyPreferencesScenarioState();
    openPreferences();
    applyPreferencesScenarioState();
    const button = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        '[data-review-id="preferences-nav-item"]',
      ),
    ).find((item) => item.textContent?.trim() === targetLabel);
    button?.click();
    window.setTimeout(scrubKrokiPublicValues, 20);
    window.setTimeout(scrubExternalPlantUmlValues, 20);
    window.setTimeout(scrubKrokiPublicValues, 120);
    window.setTimeout(scrubExternalPlantUmlValues, 120);
    window.setTimeout(() => {
      if (scenario === "network-settings") {
        const proxyInput = document.querySelector<HTMLInputElement>(
          '[data-review-id="http-proxy-url-control"]',
        );
        if (proxyInput) {
          proxyInput.value = "";
          proxyInput.defaultValue = "";
          proxyInput.setAttribute("value", "");
          proxyInput.placeholder = "Configured proxy is hidden";
          proxyInput.focus();
        }
      } else if (scenario === "pr-mr-providers") {
        document
          .querySelector<HTMLInputElement>(
            '[data-review-id="remote-provider-github-enabled"]',
          )
          ?.focus();
      } else if (scenario === "change-review-settings") {
        document
          .querySelector<HTMLInputElement>(
            '[data-review-id="general-post-diff-git-markers-control"]',
          )
          ?.focus();
      } else if (scenario === "themes-zoom-preferences") {
        document
          .querySelector<HTMLInputElement>('[data-review-id="zoom-slider"]')
          ?.focus();
      } else if (scenario === "diagram-loading-cache") {
        document
          .querySelector<HTMLInputElement>(
            '[data-review-id="experimental-diagram-placeholder-rendering-control"]',
          )
          ?.focus();
      } else if (scenario === "external-plantuml-fallback") {
        scrubExternalPlantUmlValues();
        document
          .querySelector<HTMLInputElement>(
            '[data-review-id="plantuml-external-binary-path"]',
          )
          ?.focus();
      } else if (scenario === "keybindings") {
        document
          .querySelector<HTMLInputElement>(
            '[data-review-id="keybinding-search"]',
          )
          ?.focus();
      } else if (scenario === "mouse-gestures") {
        document
          .querySelector<HTMLInputElement>(
            '[data-review-id="mouse-gestures-enabled"] input',
          )
          ?.focus();
      } else if (scenario === "mouse-gestures-record") {
        const recordButton = document.querySelector<HTMLButtonElement>(
          '[data-review-id="mouse-gesture-record"]',
        );
        recordButton?.click();
        window.setTimeout(() => {
          document
            .querySelector<HTMLElement>(
              '[data-review-id="mouse-gesture-record-pad"]',
            )
            ?.focus();
        }, 80);
      }
    }, 160);
  };

  await openDirectory(directory);
  applyPreferencesScenarioState();
  openPreferencesSection();
  window.setTimeout(openPreferencesSection, 300);
  window.setTimeout(openPreferencesSection, 900);
  window.setTimeout(openPreferencesSection, 1500);
  window.setTimeout(openPreferencesSection, 2500);
  window.setTimeout(scrubKrokiPublicValues, 3200);
  window.setTimeout(scrubExternalPlantUmlValues, 3200);
  window.setTimeout(applyPreferencesScenarioState, 3500);
  window.setTimeout(scrubKrokiPublicValues, 4200);
  window.setTimeout(scrubExternalPlantUmlValues, 4200);
  return true;
}
