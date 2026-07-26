export const WORKSPACE_BOOT_BENCHMARK_SCENARIO =
  "viewer-workspace-boot-first-content";
export const WORKSPACE_BOOT_BENCHMARK_PROFILES = Object.freeze([
  "fast",
  "normal",
  "stress",
]);
export const DOCUMENT_RENDER_CACHE_BENCHMARK_SCENARIO =
  "viewer-render-cache-tab-revisit";
export const DOCUMENT_RENDER_CACHE_BENCHMARK_PHASES = Object.freeze([
  "cold-a",
  "cold-b",
  "revisit-a",
  "theme-a",
  "reload-a",
]);

export function buildWorkspaceBootBenchmarkUrl(baseURL, profile = "stress") {
  if (!WORKSPACE_BOOT_BENCHMARK_PROFILES.includes(profile)) {
    throw new Error(`Unknown workspace boot benchmark profile: ${profile}`);
  }
  const url = new URL(baseURL);
  url.searchParams.set("scenario", WORKSPACE_BOOT_BENCHMARK_SCENARIO);
  url.searchParams.set("bootTreeProfile", profile);
  return url.toString();
}

export async function installWorkspaceBootBenchmarkCollector(page) {
  await page.addInitScript(
    ({ allowedProfiles, scenarioId }) => {
      localStorage.setItem("SVARD_PERF_TRACE", "1");
      const profileParam = new URLSearchParams(window.location.search).get(
        "bootTreeProfile",
      );
      const profile = allowedProfiles.includes(profileParam)
        ? profileParam
        : "stress";
      const phaseKeyByEvent = {
        "workspaceBoot.initialDocumentOpened": "initialDocumentOpenedMs",
        "workspaceBoot.documentRenderStarted": "documentRenderStartedMs",
        "workspaceBoot.firstDocumentFrame": "firstDocumentFrameMs",
        "workspaceBoot.rootDirectoryReady": "rootDirectoryReadyMs",
        "workspaceBoot.expandedDirectoriesReady": "expandedDirectoriesReadyMs",
        "workspaceBoot.treeSettled": "treeSettledMs",
      };
      const phases = {
        initialDocumentOpenedMs: null,
        documentRenderStartedMs: null,
        firstDocumentFrameMs: null,
        rootDirectoryReadyMs: null,
        expandedDirectoriesReadyMs: null,
        treeSettledMs: null,
      };
      const benchmark = {
        schemaVersion: 1,
        scenarioId,
        status: "pending",
        profile,
        phases,
        entryCount: 0,
        orderViolationCount: 0,
      };
      const observation = {
        schemaVersion: 1,
        renderEffectStartCount: 0,
        articleInnerHtmlCommitCount: 0,
        firstDocumentFrameCount: 0,
        themeAtDocumentRenderStart: "unknown",
        themeAtFirstDocumentFrame: "unknown",
        loadingVisibleAtFirstDocumentFrame: null,
        documentVisibleAtFirstDocumentFrame: null,
        splitVisibleAtFirstDocumentFrame: null,
        focusedPaneAtFirstDocumentFrame: "unknown",
        splitRatioAtFirstDocumentFrame: null,
      };
      window.__SVARD_WORKSPACE_BOOT_BENCHMARK__ = benchmark;
      window.__SVARD_WORKSPACE_BOOT_OBSERVATION__ = observation;

      const completeBenchmarkIfReady = () => {
        const requiredPhases = Object.values(phases);
        if (requiredPhases.some((value) => typeof value !== "number")) {
          return;
        }
        const firstFrame = phases.firstDocumentFrameMs;
        const treePhases = [
          phases.rootDirectoryReadyMs,
          phases.expandedDirectoriesReadyMs,
          phases.treeSettledMs,
        ];
        benchmark.orderViolationCount = treePhases.some(
          (value) => firstFrame >= value,
        )
          ? 1
          : 0;
        benchmark.status = "ok";
        delete benchmark.reason;
      };
      window.setTimeout(() => {
        if (benchmark.status === "pending") {
          benchmark.status = "failed";
          benchmark.reason = "missing-phase";
        }
      }, 8000);

      const readTheme = () => {
        const shell = document.querySelector('[data-review-id="shell"]');
        if (!(shell instanceof HTMLElement)) {
          return "unknown";
        }
        if (shell.classList.contains("theme-dark")) {
          return "dark";
        }
        return shell.classList.contains("theme-light") ? "light" : "unknown";
      };
      const loadingVisible = () =>
        [...document.querySelectorAll(".state-message")].some((element) => {
          if (!(element instanceof HTMLElement)) {
            return false;
          }
          const rect = element.getBoundingClientRect();
          return (
            element.textContent?.trim() === "Loading document" &&
            rect.width > 0 &&
            rect.height > 0
          );
        });
      const documentVisible = () => {
        const body = document.querySelector('[data-review-id="document-body"]');
        const heading = body?.querySelector("h1");
        if (
          !(body instanceof HTMLElement) ||
          !(heading instanceof HTMLElement)
        ) {
          return false;
        }
        const bodyRect = body.getBoundingClientRect();
        const headingRect = heading.getBoundingClientRect();
        return (
          bodyRect.width > 0 &&
          bodyRect.height > 0 &&
          headingRect.width > 0 &&
          headingRect.height > 0
        );
      };
      const readSplitState = () => {
        const shell = document.querySelector('[data-review-id="shell"]');
        const split = document.querySelector('[data-review-id="viewer-split"]');
        const focusedPaneId = split
          ?.querySelector("[data-pane-id].focused")
          ?.getAttribute("data-pane-id");
        const splitPercent = Number.parseFloat(
          shell instanceof HTMLElement
            ? getComputedStyle(shell)
                .getPropertyValue("--split-left-width")
                .trim()
            : "",
        );
        return {
          visible:
            split instanceof HTMLElement &&
            getComputedStyle(split).display !== "none",
          focusedPane:
            focusedPaneId === "left" || focusedPaneId === "right"
              ? focusedPaneId
              : "unknown",
          ratio: Number.isFinite(splitPercent)
            ? Number((splitPercent / 100).toFixed(2))
            : null,
        };
      };
      const originalInfo = console.info.bind(console);
      console.info = (...args) => {
        const payload = args[1];
        if (args[0] !== "[perf]" || !payload || typeof payload !== "object") {
          originalInfo(...args);
          return;
        }

        const eventName = payload.event;
        if (eventName === "workspaceBoot.documentRenderStarted") {
          observation.renderEffectStartCount += 1;
          if (observation.themeAtDocumentRenderStart === "unknown") {
            observation.themeAtDocumentRenderStart = readTheme();
          }
        } else if (eventName === "render.articleInnerHtmlCommit") {
          observation.articleInnerHtmlCommitCount += 1;
        } else if (eventName === "workspaceBoot.firstDocumentFrame") {
          observation.firstDocumentFrameCount += 1;
          if (observation.themeAtFirstDocumentFrame === "unknown") {
            const splitState = readSplitState();
            observation.themeAtFirstDocumentFrame = readTheme();
            observation.loadingVisibleAtFirstDocumentFrame = loadingVisible();
            observation.documentVisibleAtFirstDocumentFrame = documentVisible();
            observation.splitVisibleAtFirstDocumentFrame = splitState.visible;
            observation.focusedPaneAtFirstDocumentFrame =
              splitState.focusedPane;
            observation.splitRatioAtFirstDocumentFrame = splitState.ratio;
          }
        }

        const phaseKey = phaseKeyByEvent[eventName];
        if (phaseKey && phases[phaseKey] === null) {
          phases[phaseKey] = Number(performance.now().toFixed(2));
        }
        if (
          eventName === "workspaceBoot.rootDirectoryReady" &&
          Number.isFinite(payload.entryCount)
        ) {
          benchmark.entryCount = Math.max(0, Math.trunc(payload.entryCount));
        }
        completeBenchmarkIfReady();
        // `[perf]` payloads can contain document metadata. Keep them out of
        // Playwright console artifacts after collecting this fixed allowlist.
      };
    },
    {
      allowedProfiles: WORKSPACE_BOOT_BENCHMARK_PROFILES,
      scenarioId: WORKSPACE_BOOT_BENCHMARK_SCENARIO,
    },
  );
}

export function buildDocumentRenderCacheBenchmarkUrl(baseURL) {
  const url = new URL(baseURL);
  url.searchParams.set("scenario", DOCUMENT_RENDER_CACHE_BENCHMARK_SCENARIO);
  return url.toString();
}

export async function installDocumentRenderCacheBenchmarkCollector(page) {
  await page.addInitScript(
    ({ allowedPhases, scenarioId }) => {
      localStorage.setItem("SVARD_PERF_TRACE", "1");
      const emptyPhase = () => ({
        durationMs: 0,
        coreProducerCount: 0,
        prepareProducerCount: 0,
        articleCommitCount: 0,
        cacheEventCount: 0,
        cacheHitCount: 0,
        cacheMissCount: 0,
        inFlightCount: 0,
        inFlightActiveCountFinal: 0,
        inFlightSnapshotCount: 0,
        coreHitCount: 0,
        preparedHitCount: 0,
        admissionEstimatedBytesMax: 0,
        residentBytesMax: 0,
        entryCountMax: 0,
        evictionCount: 0,
      });
      const benchmark = {
        schemaVersion: 2,
        scenarioId,
        status: "pending",
        phases: {},
      };
      let currentPhase = null;
      let currentStartedAt = 0;
      let currentMetrics = null;
      window.__SVARD_DOCUMENT_RENDER_CACHE_BENCHMARK__ = benchmark;

      const fail = (reason) => {
        benchmark.status = "failed";
        benchmark.reason = reason;
        currentPhase = null;
        currentMetrics = null;
      };
      window.__SVARD_DOCUMENT_RENDER_CACHE_BENCHMARK_BEGIN__ = (phase) => {
        if (
          benchmark.status !== "pending" ||
          currentPhase !== null ||
          !allowedPhases.includes(phase) ||
          benchmark.phases[phase]
        ) {
          fail("invalid-phase-transition");
          return false;
        }
        currentPhase = phase;
        currentStartedAt = performance.now();
        currentMetrics = emptyPhase();
        return true;
      };
      window.__SVARD_DOCUMENT_RENDER_CACHE_BENCHMARK_END__ = (phase) => {
        if (
          benchmark.status !== "pending" ||
          currentPhase !== phase ||
          currentMetrics === null
        ) {
          fail("invalid-phase-transition");
          return false;
        }
        currentMetrics.durationMs = Number(
          Math.max(0, performance.now() - currentStartedAt).toFixed(2),
        );
        benchmark.phases[phase] = currentMetrics;
        currentPhase = null;
        currentMetrics = null;
        if (allowedPhases.every((candidate) => benchmark.phases[candidate])) {
          benchmark.status = "ok";
          delete benchmark.reason;
        }
        return true;
      };
      window.__SVARD_DOCUMENT_RENDER_CACHE_BENCHMARK_CURRENT__ = () =>
        currentMetrics === null ? null : { ...currentMetrics };

      window.setTimeout(() => {
        if (benchmark.status === "pending") {
          fail("missing-phase");
        }
      }, 20_000);

      const originalInfo = console.info.bind(console);
      console.info = (...args) => {
        const payload = args[1];
        if (args[0] !== "[perf]" || !payload || typeof payload !== "object") {
          originalInfo(...args);
          return;
        }
        if (currentMetrics !== null) {
          const eventName = payload.event;
          if (eventName === "render.renderDocument") {
            currentMetrics.coreProducerCount += 1;
          } else if (eventName === "render.prepareDocumentHtml") {
            currentMetrics.prepareProducerCount += 1;
          } else if (eventName === "render.articleInnerHtmlCommit") {
            currentMetrics.articleCommitCount += 1;
          }
          if (String(eventName).startsWith("render.artifactCache.")) {
            currentMetrics.cacheEventCount += 1;
            if (eventName === "render.artifactCache.lookup") {
              if (payload.status === "hit") {
                currentMetrics.cacheHitCount += 1;
                if (payload.stage === "core") {
                  currentMetrics.coreHitCount += 1;
                } else if (payload.stage === "prepared") {
                  currentMetrics.preparedHitCount += 1;
                }
              } else if (payload.status === "miss") {
                currentMetrics.cacheMissCount += 1;
              } else if (payload.status === "in-flight") {
                currentMetrics.inFlightCount += 1;
              }
            }
            if (
              (eventName === "render.artifactCache.lookup" ||
                eventName === "render.artifactCache.admission") &&
              Number.isFinite(payload.count)
            ) {
              currentMetrics.inFlightActiveCountFinal = Math.max(
                0,
                Math.trunc(payload.count),
              );
              currentMetrics.inFlightSnapshotCount += 1;
            }
            if (Number.isFinite(payload.estimatedBytes)) {
              currentMetrics.admissionEstimatedBytesMax = Math.max(
                currentMetrics.admissionEstimatedBytesMax,
                Math.max(0, Math.trunc(payload.estimatedBytes)),
              );
            }
            if (Number.isFinite(payload.totalBytes)) {
              currentMetrics.residentBytesMax = Math.max(
                currentMetrics.residentBytesMax,
                Math.max(0, Math.trunc(payload.totalBytes)),
              );
            }
            if (Number.isFinite(payload.entryCount)) {
              currentMetrics.entryCountMax = Math.max(
                currentMetrics.entryCountMax,
                Math.max(0, Math.trunc(payload.entryCount)),
              );
            }
            if (
              eventName === "render.artifactCache.eviction" &&
              Number.isFinite(payload.count)
            ) {
              currentMetrics.evictionCount += Math.max(
                0,
                Math.trunc(payload.count),
              );
            }
          }
        }
        // Perf payloads may contain document metadata. The collector retains
        // only the fixed numeric allowlist above.
      };
    },
    {
      allowedPhases: DOCUMENT_RENDER_CACHE_BENCHMARK_PHASES,
      scenarioId: DOCUMENT_RENDER_CACHE_BENCHMARK_SCENARIO,
    },
  );
}
