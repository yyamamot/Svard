import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import { UI_REVIEW_SCHEMA_VERSION } from "./constants.mjs";
import { markerCompletenessForScenario } from "./markers.mjs";
import { buildAssertions } from "../assertions/registry.mjs";
import { applyScenario } from "../scenarios/registry.mjs";

export { UI_REVIEW_SCHEMA_VERSION };

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

export async function runDocumentRenderCacheBenchmarkScenario(page, baseURL) {
  await page.goto(buildDocumentRenderCacheBenchmarkUrl(baseURL), {
    waitUntil: "networkidle",
  });
  await applyScenario({
    scenario: DOCUMENT_RENDER_CACHE_BENCHMARK_SCENARIO,
    page,
  });
  await page.waitForFunction(
    () => {
      const status = window.__SVARD_DOCUMENT_RENDER_CACHE_BENCHMARK__?.status;
      return status === "ok" || status === "failed";
    },
    undefined,
    { timeout: 20_000 },
  );
  return page.evaluate(
    () => window.__SVARD_DOCUMENT_RENDER_CACHE_BENCHMARK__ ?? null,
  );
}

export function parseArgs(argv) {
  const args = { scenario: "viewer-basic", id: "local-ui-change" };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--scenario") {
      args.scenario = argv[index + 1] ?? args.scenario;
      index += 1;
    } else if (value === "--id") {
      args.id = argv[index + 1] ?? args.id;
      index += 1;
    }
  }

  return args;
}

export async function createArtifactRoot(prefix = "ui-review") {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const artifactRoot = path.resolve(
    ".artifacts",
    "ui-review",
    `${prefix}-${stamp}`,
  );
  await fs.mkdir(path.join(artifactRoot, "screenshots"), { recursive: true });
  return artifactRoot;
}

export async function captureScenario({
  scenario,
  id,
  artifactRoot,
  baseURL = "http://127.0.0.1:4173",
  gotoWaitUntil = null,
}) {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
  });
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  if (scenario === WORKSPACE_BOOT_BENCHMARK_SCENARIO) {
    await installWorkspaceBootBenchmarkCollector(page);
  } else if (scenario === DOCUMENT_RENDER_CACHE_BENCHMARK_SCENARIO) {
    await installDocumentRenderCacheBenchmarkCollector(page);
  }
  const consoleMessages = [];
  const pageErrors = [];

  page.on("console", (message) => {
    if (
      (scenario === WORKSPACE_BOOT_BENCHMARK_SCENARIO ||
        scenario === DOCUMENT_RENDER_CACHE_BENCHMARK_SCENARIO) &&
      message.text().startsWith("[perf]")
    ) {
      return;
    }
    consoleMessages.push({ type: message.type(), text: message.text() });
  });
  page.on("pageerror", (error) => {
    pageErrors.push({ message: error.message });
  });

  const scenariosWithBootConfig = new Set([
    "viewer-start-page",
    "viewer-restore-additional-windows-opt-in",
  ]);
  const scenarioUrl =
    scenario === WORKSPACE_BOOT_BENCHMARK_SCENARIO
      ? buildWorkspaceBootBenchmarkUrl(baseURL, "stress")
      : scenario === DOCUMENT_RENDER_CACHE_BENCHMARK_SCENARIO
        ? buildDocumentRenderCacheBenchmarkUrl(baseURL)
        : scenariosWithBootConfig.has(scenario)
          ? `${baseURL}?scenario=${encodeURIComponent(scenario)}`
          : baseURL;
  const startupObservationScenarios = new Set([
    "viewer-diagram-placeholder-startup",
    WORKSPACE_BOOT_BENCHMARK_SCENARIO,
  ]);
  const captureStartedAt = Date.now();
  await page.goto(scenarioUrl, {
    waitUntil:
      gotoWaitUntil ??
      (startupObservationScenarios.has(scenario)
        ? "domcontentloaded"
        : "networkidle"),
  });
  const afterGotoAt = Date.now();

  async function performRightButtonGesture(
    directions,
    selector = '[data-review-id="document-viewer"]',
  ) {
    const box = await page.locator(selector).boundingBox();
    if (!box) {
      throw new Error(`${selector} is not visible`);
    }
    const { x: startX, y: startY } = await page.evaluate(
      ({ rect, gestureDirections, rootSelector }) => {
        const movesLeft = gestureDirections.includes("Left");
        const movesRight = gestureDirections.includes("Right");
        const movesUp = gestureDirections.includes("Up");
        const movesDown = gestureDirections.includes("Down");
        const preferredX =
          movesLeft && !movesRight
            ? rect.x + rect.width - 140
            : movesRight && !movesLeft
              ? rect.x + 140
              : rect.x + rect.width / 2;
        const preferredY =
          movesUp && !movesDown
            ? rect.y + rect.height - 90
            : movesDown && !movesUp
              ? rect.y + 90
              : rect.y + rect.height - 72;
        const candidates = [
          { x: preferredX, y: preferredY },
          { x: rect.x + 96, y: rect.y + rect.height - 96 },
          { x: rect.x + rect.width - 96, y: rect.y + rect.height - 96 },
          { x: rect.x + 96, y: rect.y + 96 },
          { x: rect.x + rect.width - 96, y: rect.y + 96 },
          { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
        ];
        const blockedSelector =
          'input, textarea, select, button, a[href], [role="button"], [contenteditable="true"], [data-copy-source-button]';

        for (const candidate of candidates) {
          const element = document.elementFromPoint(candidate.x, candidate.y);
          if (
            element instanceof HTMLElement &&
            element.closest(rootSelector) &&
            !element.closest(blockedSelector)
          ) {
            return candidate;
          }
        }
        return { x: preferredX, y: preferredY };
      },
      { rect: box, gestureDirections: directions, rootSelector: selector },
    );
    let x = startX;
    let y = startY;
    await page.mouse.move(x, y);
    await page.mouse.down({ button: "right" });
    for (const direction of directions) {
      if (direction === "Left") {
        x -= 90;
      } else if (direction === "Right") {
        x += 90;
      } else if (direction === "Up") {
        y -= 90;
      } else if (direction === "Down") {
        y += 90;
      }
      await page.mouse.move(x, y, { steps: 6 });
    }
    await page.mouse.up({ button: "right" });
  }

  async function performMouseNavigationButton(button) {
    const selector = '[data-review-id="document-viewer"]';
    await page.locator(selector).dispatchEvent("mousedown", {
      button,
      buttons: button === 3 ? 8 : 16,
      bubbles: true,
      cancelable: true,
    });
  }

  let sidebarResizeOutcome = null;
  let openFilesSplitResizeOutcome = null;
  let themeContrastOutcome = null;

  async function collectThemeContrast(expectedTheme) {
    async function readStyles(label) {
      return page.evaluate((entryLabel) => {
        const read = (selector) => {
          const element = document.querySelector(selector);
          if (!(element instanceof Element)) {
            return null;
          }
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return {
            selector,
            color: style.color,
            backgroundColor: style.backgroundColor,
            borderColor: style.borderColor,
            width: rect.width,
            height: rect.height,
            visible: rect.width > 0 && rect.height > 0,
          };
        };
        return {
          label: entryLabel,
          shellClass: document.querySelector(".app-shell")?.className ?? "",
          documentBody: read('[data-review-id="document-body"]'),
          heading: read('[data-review-id="document-body"] h1'),
          table: read('[data-review-id="document-body"] table'),
          tableHeader: read('[data-review-id="document-body"] th'),
          code: read('[data-review-id="document-body"] pre'),
          mermaid: read('[data-review-id="mermaid-render"] svg'),
          plantuml: read('[data-review-id="plantuml-render"] svg'),
          graphviz: read('[data-review-id="graphviz-render"] svg'),
          diagramCanvas: read('[data-review-id="diagram-inline-image"]'),
          activeOpenFile: read('[data-review-id="open-file-item"].active'),
          activeTreeFile: read('[data-review-id="tree-file"].active'),
        };
      }, label);
    }

    const samples = [];
    await page.locator("text=render-fixtures.adoc").click();
    await page.locator("text=Render Fixtures").waitFor();
    await page.getByRole("heading", { name: "Table" }).waitFor();
    samples.push(await readStyles("asciidoc-render-fixtures"));

    await page.locator("text=markdown-sample.md").click();
    await page.getByRole("heading", { name: "Markdown Sample" }).waitFor();
    await page.getByRole("heading", { name: "Code Fence" }).waitFor();
    samples.push(await readStyles("markdown-table-code"));

    await page.locator('[data-review-id="tree-collapse-all"]').click();
    await page
      .locator('[data-review-id="tree-folder-toggle"]')
      .filter({ hasText: "docs" })
      .click();
    await page
      .locator('[data-review-id="tree-folder-toggle"]')
      .filter({ hasText: "diagrams" })
      .click();
    await page
      .locator('[data-review-id="tree-file"]')
      .filter({ hasText: "diagrams-mixed-long-ja.adoc" })
      .click();
    await page.locator("text=Mixed Diagram Japanese Sample").waitFor();
    await page
      .locator('[data-review-id="mermaid-render"] svg')
      .first()
      .waitFor();
    await page.locator('[data-review-id="plantuml-render"] svg').waitFor();
    await page.locator('[data-review-id="graphviz-render"] svg').waitFor();
    samples.push(await readStyles("diagram-samples"));

    return {
      expectedTheme,
      samples,
      hasExpectedThemeClass: samples.every((sample) =>
        sample.shellClass.includes(`theme-${expectedTheme}`),
      ),
      hasReadableDocumentSurfaces: samples.every(
        (sample) =>
          sample.documentBody?.visible &&
          sample.documentBody.color !== sample.documentBody.backgroundColor,
      ),
      hasTableCoverage: samples.some(
        (sample) => sample.table?.visible && sample.tableHeader?.visible,
      ),
      hasCodeCoverage: samples.some((sample) => sample.code?.visible),
      hasDiagramCoverage: samples.some(
        (sample) =>
          sample.mermaid?.visible &&
          sample.plantuml?.visible &&
          sample.graphviz?.visible &&
          sample.diagramCanvas?.visible,
      ),
      hasSidebarSelectionCoverage: samples.some(
        (sample) =>
          sample.activeOpenFile?.visible &&
          sample.activeOpenFile.color !== sample.activeOpenFile.backgroundColor,
      ),
    };
  }

  await applyScenario({
    scenario,
    page,
    performRightButtonGesture,
    performMouseNavigationButton,
    collectThemeContrast,
    setSidebarResizeOutcome: (value) => {
      sidebarResizeOutcome = value;
    },
    setOpenFilesSplitResizeOutcome: (value) => {
      openFilesSplitResizeOutcome = value;
    },
    setThemeContrastOutcome: (value) => {
      themeContrastOutcome = value;
    },
  });
  const afterScenarioAt = Date.now();

  const screenshotPath = path.join(
    artifactRoot,
    "screenshots",
    `${scenario}.png`,
  );
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const afterScreenshotAt = Date.now();

  const geometry = await page.evaluate(() => {
    const textAllowlist = new Set([
      "inline-notice",
      "search-result",
      "search-empty",
      "diagram-inline-diagnostic",
      "kroki-render",
      "preferences-nav-item",
      "right-sidebar-tab-contents",
      "right-sidebar-tab-search",
    ]);
    const elements = [...document.querySelectorAll("[data-review-id]")];
    return elements.map((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      const reviewId = element.getAttribute("data-review-id") ?? "";
      const text = element.textContent?.trim() ?? "";
      return {
        reviewId,
        text: textAllowlist.has(reviewId) ? text.slice(0, 160) : "",
        textLength: text.length,
        computedStyle: {
          color: style.color,
          backgroundColor: style.backgroundColor,
          borderColor: style.borderColor,
        },
        rect: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          bottom: rect.bottom,
          right: rect.right,
        },
        visible: rect.width > 0 && rect.height > 0,
      };
    });
  });

  const bodyText = await page.locator("body").innerText();
  const svgAspectRatios = await page.evaluate(() => {
    function readViewBox(svg) {
      const viewBox = svg.getAttribute("viewBox");
      if (!viewBox) return null;
      const parts = viewBox
        .trim()
        .split(/\s+/)
        .map((part) => Number.parseFloat(part));
      if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
        return null;
      }
      return { width: parts[2], height: parts[3] };
    }

    return [
      ...document.querySelectorAll(
        '[data-review-id="kroki-render"] svg, [data-review-id="kroki-test-svg"] svg',
      ),
    ].map((svg) => {
      const rect = svg.getBoundingClientRect();
      const viewBox = readViewBox(svg);
      const displayedRatio = rect.height > 0 ? rect.width / rect.height : null;
      const viewBoxRatio =
        viewBox && viewBox.height > 0 ? viewBox.width / viewBox.height : null;
      return {
        parentReviewId:
          svg.closest("[data-review-id]")?.getAttribute("data-review-id") ?? "",
        preserveAspectRatio: svg.getAttribute("preserveAspectRatio") ?? "",
        displayedRatio,
        viewBoxRatio,
        delta:
          displayedRatio !== null && viewBoxRatio !== null
            ? Math.abs(displayedRatio - viewBoxRatio)
            : null,
        rect: {
          width: rect.width,
          height: rect.height,
        },
        viewBox,
      };
    });
  });
  const contextMenuText =
    (await page
      .locator('[data-review-id="context-menu"]')
      .textContent()
      .catch(() => "")) ?? "";
  const geometryReviewIds = new Set(
    geometry.map((element) => element.reviewId),
  );
  const markerCompleteness = markerCompletenessForScenario(scenario, geometry);
  const commandAutomation = await page.evaluate(() => {
    const commands = window.__SVARD_COMMANDS__;
    return {
      availableCommands:
        commands?.listCommands().map((command) => command.id) ?? [],
      focusedContext: commands?.getFocusedContext() ?? "unavailable",
      lastCommand: commands?.getLastCommand() ?? null,
      lastMouseGesture: commands?.getLastMouseGesture() ?? null,
      lastMouseNavigation: commands?.getLastMouseNavigation?.() ?? null,
      disabledCommands: (commands?.listCommands() ?? [])
        .filter((command) => !commands?.getCommandState(command.id).enabled)
        .map((command) => command.id),
    };
  });
  const editorOpenRequests = await page.evaluate(
    () => window.__SVARD_EDITOR_OPEN_REQUESTS__ ?? [],
  );
  const documentUsesViewerWidth = await page.evaluate(() => {
    const viewer = document.querySelector('[data-review-id="document-viewer"]');
    const body = document.querySelector('[data-review-id="document-body"]');
    if (!viewer || !body) {
      return false;
    }
    const viewerRect = viewer.getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();
    return bodyRect.width >= viewerRect.width * 0.96;
  });
  const diagramFit = await page.evaluate(() => {
    const viewer = document.querySelector('[data-review-id="document-viewer"]');
    const canvas = document.querySelector(
      '[data-review-id="diagram-inline-image"]',
    );
    const svg = canvas?.querySelector("svg");
    if (
      !(viewer instanceof HTMLElement) ||
      !(canvas instanceof HTMLElement) ||
      !(svg instanceof SVGElement)
    ) {
      return null;
    }
    const viewerRect = viewer.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();
    return {
      canvasRatio: canvasRect.width / viewerRect.width,
      svgRatio: svgRect.width / canvasRect.width,
      svgWidth: svgRect.width,
      svgHeight: svgRect.height,
      viewerHeight: viewerRect.height,
    };
  });
  const ganttDiagramFit = await page.evaluate(() => {
    const viewer = document.querySelector('[data-review-id="document-viewer"]');
    const mermaidBlocks = [
      ...document.querySelectorAll('[data-review-id="mermaid-render"]'),
    ];
    const gantt = mermaidBlocks.find((block) =>
      block.textContent?.includes("Project Timeline"),
    );
    const canvas = gantt?.querySelector(
      '[data-review-id="diagram-inline-image"]',
    );
    const svg = canvas?.querySelector("svg");
    if (
      !(viewer instanceof HTMLElement) ||
      !(canvas instanceof HTMLElement) ||
      !(svg instanceof SVGElement)
    ) {
      return null;
    }
    const viewerRect = viewer.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();
    return {
      canvasRatio: canvasRect.width / viewerRect.width,
      svgRatio: svgRect.width / canvasRect.width,
      svgWidth: svgRect.width,
      svgHeight: svgRect.height,
      viewerHeight: viewerRect.height,
    };
  });
  const scrollIndependence = await page.evaluate(async () => {
    const viewer = document.querySelector('[data-review-id="document-viewer"]');
    const left =
      document.querySelector(
        '[data-review-id="left-sidebar"] .sidebar-content',
      ) ?? document.querySelector('[data-review-id="left-sidebar"]');
    const right =
      document.querySelector(
        '[data-review-id="right-sidebar"] .sidebar-content',
      ) ?? document.querySelector('[data-review-id="right-sidebar"]');
    if (!(viewer instanceof HTMLElement)) {
      return { center: false, sidebarsStable: false, left: true, right: true };
    }

    const initial = {
      viewer: viewer.scrollTop,
      left: left instanceof HTMLElement ? left.scrollTop : 0,
      right: right instanceof HTMLElement ? right.scrollTop : 0,
    };
    viewer.scrollTop = Math.min(320, viewer.scrollHeight - viewer.clientHeight);
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    const afterViewerScroll = {
      viewer: viewer.scrollTop,
      left: left instanceof HTMLElement ? left.scrollTop : 0,
      right: right instanceof HTMLElement ? right.scrollTop : 0,
    };
    const viewerMoved =
      viewer.scrollHeight <= viewer.clientHeight ||
      afterViewerScroll.viewer > initial.viewer;
    const sidebarsStable =
      afterViewerScroll.left === initial.left &&
      afterViewerScroll.right === initial.right;

    const viewerBeforeSidebar = viewer.scrollTop;
    let leftIndependent = true;
    if (
      left instanceof HTMLElement &&
      left.scrollHeight > left.clientHeight + 1
    ) {
      left.scrollTop = Math.min(160, left.scrollHeight - left.clientHeight);
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      leftIndependent = viewer.scrollTop === viewerBeforeSidebar;
    }

    let rightIndependent = true;
    if (
      right instanceof HTMLElement &&
      right.scrollHeight > right.clientHeight + 1
    ) {
      right.scrollTop = Math.min(160, right.scrollHeight - right.clientHeight);
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      rightIndependent = viewer.scrollTop === viewerBeforeSidebar;
    }

    return {
      center: viewerMoved,
      sidebarsStable,
      left: leftIndependent,
      right: rightIndependent,
    };
  });
  const searchManualScrollStable = await page.evaluate(async () => {
    if (
      !document.querySelector('[data-review-id="search-hit"].active') ||
      !document.querySelector('[data-review-id="search-result-item"].active')
    ) {
      return null;
    }
    const viewer = document.querySelector('[data-review-id="document-viewer"]');
    if (!(viewer instanceof HTMLElement)) {
      return false;
    }
    const targetTop = Math.max(0, viewer.scrollTop - 96);
    viewer.scrollTop = targetTop;
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    return viewer.scrollTop === targetTop;
  });
  const sidebarResize = await page.evaluate(() => {
    const left = document.querySelector('[data-review-id="left-sidebar"]');
    const right = document.querySelector('[data-review-id="right-sidebar"]');
    const viewer = document.querySelector('[data-review-id="document-viewer"]');
    const leftHandle = document.querySelector(
      '[data-review-id="left-sidebar-resizer"]',
    );
    const rightHandle = document.querySelector(
      '[data-review-id="right-sidebar-resizer"]',
    );
    const leftRect = left?.getBoundingClientRect();
    const rightRect = right?.getBoundingClientRect();
    const viewerRect = viewer?.getBoundingClientRect();
    return {
      hasLeftHandle: leftHandle instanceof HTMLElement,
      hasRightHandle: rightHandle instanceof HTMLElement,
      leftWidth: leftRect?.width ?? 0,
      rightWidth: rightRect?.width ?? 0,
      viewerWidth: viewerRect?.width ?? 0,
    };
  });
  const workspaceBootBenchmark = await page.evaluate(
    () => window.__SVARD_WORKSPACE_BOOT_BENCHMARK__ ?? null,
  );
  const workspaceBootObservation = await page.evaluate(
    () => window.__SVARD_WORKSPACE_BOOT_OBSERVATION__ ?? null,
  );
  const documentRenderCacheBenchmark = await page.evaluate(
    () => window.__SVARD_DOCUMENT_RENDER_CACHE_BENCHMARK__ ?? null,
  );
  const assertions = await buildAssertions({
    scenario,
    page,
    bodyText,
    commandAutomation,
    consoleMessages,
    contextMenuText,
    diagramFit,
    documentUsesViewerWidth,
    editorOpenRequests,
    ganttDiagramFit,
    geometryReviewIds,
    markerCompleteness,
    openFilesSplitResizeOutcome,
    renderCacheExpectation:
      scenario === DOCUMENT_RENDER_CACHE_BENCHMARK_SCENARIO && id === "IMP-410"
        ? "required"
        : "optional",
    scrollIndependence,
    searchManualScrollStable,
    sidebarResize,
    sidebarResizeOutcome,
    svgAspectRatios,
    themeContrastOutcome,
    workspaceBootBenchmark,
    workspaceBootObservation,
    documentRenderCacheBenchmark,
  });
  const plantUmlMetrics = await page.evaluate(
    () => window.__svardPlantUmlMetrics ?? null,
  );
  const graphvizMetrics = await page.evaluate(
    () => window.__svardGraphvizMetrics ?? null,
  );
  const diagramScrollStability = await page.evaluate(
    () => window.__SVARD_DIAGRAM_SCROLL_STABILITY__ ?? null,
  );
  const postDiffMarkerSummary = await page.evaluate(
    () => window.__SVARD_POST_DIFF_MARKER_SUMMARY__ ?? null,
  );
  const benchmarkPhases = await page.evaluate(
    () => window.__SVARD_BENCHMARK_PHASES__ ?? [],
  );
  const assertionFailures = Object.entries(assertions)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);
  const report = {
    schemaVersion: UI_REVIEW_SCHEMA_VERSION,
    runId: path.basename(artifactRoot),
    featureId: id,
    scenarioId: scenario,
    outcome:
      pageErrors.length === 0 && assertionFailures.length === 0
        ? "passed"
        : "failed",
    screenshotPath,
    artifactRoot,
    consoleMessages,
    pageErrors,
    commandAutomation,
    editorOpenRequests,
    sidebarResizeOutcome,
    openFilesSplitResizeOutcome,
    themeContrastOutcome,
    plantUmlMetrics,
    graphvizMetrics,
    diagramScrollStability,
    postDiffMarkerSummary,
    svgAspectRatios,
    markerCompleteness,
    benchmarkPhases,
    documentRenderCacheBenchmark,
    captureMetrics: {
      gotoMs: afterGotoAt - captureStartedAt,
      scenarioMs: afterScenarioAt - afterGotoAt,
      screenshotMs: afterScreenshotAt - afterScenarioAt,
      totalMs: Date.now() - captureStartedAt,
    },
    assertionFailures,
    assertions,
  };

  await fs.writeFile(
    path.join(artifactRoot, "ui-review-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  await fs.writeFile(
    path.join(artifactRoot, "ui-geometry.json"),
    `${JSON.stringify(
      {
        schemaVersion: UI_REVIEW_SCHEMA_VERSION,
        runId: path.basename(artifactRoot),
        scenarioId: scenario,
        markerCompleteness,
        svgAspectRatios,
        elements: geometry,
      },
      null,
      2,
    )}\n`,
  );
  await fs.writeFile(
    path.join(artifactRoot, "runtime.jsonl"),
    [
      {
        schemaVersion: UI_REVIEW_SCHEMA_VERSION,
        event: "scenario-rendered",
        scenario,
        featureId: id,
        documentBasename:
          scenario === WORKSPACE_BOOT_BENCHMARK_SCENARIO ||
          scenario === DOCUMENT_RENDER_CACHE_BENCHMARK_SCENARIO
            ? null
            : bodyText.includes("Render Fixtures")
              ? "render-fixtures.adoc"
              : bodyText.includes("AsciiDoc Comprehensive Visual Sample")
                ? "asciidoc-comprehensive-visual.adoc"
                : bodyText.includes("Markdown Sample")
                  ? "markdown-sample.md"
                  : bodyText.includes("Markdown Diagram Sample")
                    ? "markdown-diagrams.md"
                    : bodyText.includes(
                          "Markdown Footnotes And Admonitions Sample",
                        )
                      ? "markdown-footnotes-admonitions.md"
                      : bodyText.includes("Markdown 日本語確認")
                        ? "markdown-japanese.md"
                        : bodyText.includes("Large Table Row Addition")
                          ? "git-large-table-row-addition.md"
                          : bodyText.includes("Git Markdown Table Cell Fixture")
                            ? "git-table-cells.md"
                            : bodyText.includes(
                                  "Git Markdown Table Untracked Fixture",
                                )
                              ? "git-table-untracked.md"
                              : bodyText.includes(
                                    "Git AsciiDoc Table Diff Fixture",
                                  )
                                ? "git-asciidoc-table.adoc"
                                : bodyText.includes(
                                      "Git AsciiDoc Complex Table Diff Fixture",
                                    )
                                  ? "git-asciidoc-table-complex.adoc"
                                  : bodyText.includes(
                                        "PlantUML Concurrency Stress",
                                      )
                                    ? "plantuml-concurrency.adoc"
                                    : bodyText.includes(
                                          "Mixed Diagram Japanese Sample",
                                        )
                                      ? "diagrams-mixed-long-ja.adoc"
                                      : bodyText.includes(
                                            "Git Rendered List Reorder Fixture",
                                          )
                                        ? "git-rendered-list-reorder.md"
                                        : null,
        status: report.outcome,
        plantUmlMetrics,
        diagramScrollStability,
        postDiffMarkerSummary,
        lastMouseGesture: commandAutomation.lastMouseGesture,
        diagnosticCount: await page.locator(".diagnostic").count(),
        themeContrast:
          themeContrastOutcome === null
            ? null
            : {
                expectedTheme: themeContrastOutcome.expectedTheme,
                hasTableCoverage: themeContrastOutcome.hasTableCoverage,
                hasCodeCoverage: themeContrastOutcome.hasCodeCoverage,
                hasDiagramCoverage: themeContrastOutcome.hasDiagramCoverage,
                hasSidebarSelectionCoverage:
                  themeContrastOutcome.hasSidebarSelectionCoverage,
              },
        diagramRenderStatus: {
          mermaid:
            (await page.locator('[data-review-id="mermaid-render"]').count()) >
            0,
          plantuml:
            (await page.locator('[data-review-id="plantuml-render"]').count()) >
            0,
          graphviz:
            (await page.locator('[data-review-id="graphviz-render"]').count()) >
            0,
        },
      },
    ]
      .map((entry) => JSON.stringify(entry))
      .join("\n") + "\n",
  );
  await fs.writeFile(
    path.join(artifactRoot, "harness.jsonl"),
    `${JSON.stringify({
      schemaVersion: UI_REVIEW_SCHEMA_VERSION,
      event: "capture-complete",
      artifactRunId: path.basename(artifactRoot),
      scenario,
      visibleControlCount: geometry.filter((element) => element.visible).length,
      copyActionCount: await page.locator('[data-review-id*="copy"]').count(),
      availableCommands: commandAutomation.availableCommands,
      focusedContext: commandAutomation.focusedContext,
      lastCommand: commandAutomation.lastCommand,
      lastMouseGesture: commandAutomation.lastMouseGesture,
      disabledCommands: commandAutomation.disabledCommands,
      assertionFailures,
      markerCompleteness,
      postDiffMarkerSummary,
    })}\n`,
  );
  await fs.writeFile(
    path.join(artifactRoot, "llm-ui-self-review.json"),
    `${JSON.stringify(
      {
        schemaVersion: UI_REVIEW_SCHEMA_VERSION,
        outcome: report.outcome,
        findings: [],
      },
      null,
      2,
    )}\n`,
  );

  await browser.close();
  return report;
}

export { runVlmReview } from "../vlm-review.mjs";
