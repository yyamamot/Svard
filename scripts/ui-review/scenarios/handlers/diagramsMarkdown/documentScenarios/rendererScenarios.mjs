export async function applyRendererScenario(context) {
  const scenario = context.scenario;
  const page = context.page;
  if (scenario === "viewer-kroki-local") {
    await page.locator('[data-review-id="file-tree"]').waitFor();
    await page
      .locator('[data-review-id="tree-file"]')
      .filter({ hasText: "asciidoc-comprehensive-visual.adoc" })
      .click();
    await page
      .locator('[data-review-id="active-document-title"]')
      .filter({ hasText: "asciidoc-comprehensive-visual.adoc" })
      .waitFor();
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("preferences.open");
    });
    await page.locator('[data-review-id="preferences-dialog"]').waitFor();
    await page
      .locator('[data-review-id="preferences-nav-item"]')
      .filter({ hasText: "Kroki" })
      .click();
    await page
      .locator('[data-review-id="kroki-mode-control"]')
      .selectOption("remote");
    await page
      .locator('[data-review-id="preferences-dialog"] button:has-text("Close")')
      .click();
    await page.locator("text=Mock Kroki SVG").waitFor();
  } else if (scenario === "viewer-kroki-confirmation") {
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("preferences.open");
    });
    await page.locator('[data-review-id="preferences-dialog"]').waitFor();
    await page
      .locator('[data-review-id="preferences-nav-item"]')
      .filter({ hasText: "Kroki" })
      .click();
    await page
      .locator('[data-review-id="kroki-mode-control"]')
      .selectOption("public");
    await page
      .locator('[data-review-id="preferences-nav-item"]')
      .filter({ hasText: "Diagrams" })
      .click();
    await page
      .locator('[data-review-id="plantuml-renderer-control"]')
      .locator("label")
      .filter({ hasText: "Kroki" })
      .click();
    await page
      .locator('[data-review-id="preferences-dialog"] button:has-text("Close")')
      .click();
    await page
      .locator('[data-review-id="diagram-inline-diagnostic"]')
      .first()
      .waitFor();
    await page.locator('[data-review-id="kroki-confirm"]').first().click();
    await page.locator('[data-review-id="inline-notice"]').waitFor();
  } else if (scenario === "viewer-kroki-c4-scale") {
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("preferences.open");
    });
    await page.locator('[data-review-id="preferences-dialog"]').waitFor();
    await page
      .locator('[data-review-id="preferences-nav-item"]')
      .filter({ hasText: "Kroki" })
      .click();
    await page
      .locator('[data-review-id="kroki-mode-control"]')
      .selectOption("remote");
    await page
      .locator('[data-review-id="preferences-dialog"] button:has-text("Close")')
      .click();
    await page.locator("text=kroki-c4-scale.adoc").click();
    await page
      .getByRole("heading", { name: "Kroki C4 Scale Sample" })
      .waitFor();
    await page.locator('[data-review-id="kroki-render"] svg').waitFor();
  } else if (scenario === "viewer-plantuml-local") {
    await page.locator('[data-review-id="plantuml-render"]').waitFor();
    await page
      .locator('[data-review-id="plantuml-render"]')
      .locator("svg")
      .waitFor();
  } else if (scenario === "viewer-plantuml-marker-compat") {
    await page.locator("text=plantuml-marker-compat.adoc").click();
    await page.locator("text=PlantUML Marker Compatibility").waitFor();
    await page
      .locator('[data-review-id="plantuml-render"]')
      .locator("svg")
      .waitFor();
    await page.locator("text=plantuml-marker-compat.md").click();
    await page
      .getByRole("heading", { name: "Markdown Markerless Fence" })
      .waitFor();
    await page
      .locator('[data-review-id="plantuml-render"]')
      .locator("svg")
      .waitFor();
  } else if (scenario === "viewer-plantuml-concurrency") {
    await page.locator("text=plantuml-concurrency.adoc").click();
    await page
      .getByRole("heading", { name: "PlantUML Concurrency Stress" })
      .waitFor();
    await page
      .locator('[data-review-id="plantuml-render"] svg')
      .nth(99)
      .waitFor({ timeout: 120000 });
  } else if (scenario === "viewer-plantuml-large-diagnostic") {
    await page.locator("text=plantuml-large.adoc").click();
    await page.locator("text=Large PlantUML Diagnostic").waitFor();
    await page.locator("text=Diagram too large").waitFor();
  } else if (scenario === "viewer-graphviz-local") {
    await page.locator('[data-review-id="graphviz-render"]').waitFor();
    await page
      .locator('[data-review-id="graphviz-render"]')
      .locator("svg")
      .waitFor();
  } else if (scenario === "viewer-graphviz-diagnostic") {
    await page.locator("text=graphviz-diagnostic.adoc").click();
    await page.locator("text=Graphviz Diagnostic").waitFor();
    await page
      .locator('[data-review-id="diagram-inline-diagnostic"]')
      .first()
      .waitFor();
  } else if (scenario === "viewer-plantuml-japanese") {
    await page.locator("text=plantuml-japanese.adoc").click();
    await page.locator("text=Japanese PlantUML").waitFor();
    await page
      .locator('[data-review-id="plantuml-render"]')
      .locator("svg")
      .waitFor();
  } else if (scenario === "viewer-plantuml-japanese-combined") {
    await page.locator('[data-review-id="file-tree"]').waitFor();
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
      .filter({ hasText: "plantuml-japanese-combined.adoc" })
      .click();
    await page.locator("text=PlantUML Japanese Combined Sample").waitFor();
    await page
      .locator('[data-review-id="plantuml-render"]')
      .locator("svg")
      .first()
      .waitFor();
  } else if (scenario === "viewer-plantuml-japanese-long-text") {
    await page.locator("text=plantuml-japanese-long-text.adoc").click();
    await page.locator("text=Long Japanese PlantUML").waitFor();
    await page
      .locator('[data-review-id="plantuml-render"]')
      .locator("svg")
      .waitFor();
  } else if (scenario === "viewer-plantuml-multiline") {
    await page.locator("text=plantuml-multiline.adoc").click();
    await page.locator("text=Multiline PlantUML").waitFor();
    await page
      .locator('[data-review-id="plantuml-render"]')
      .locator("svg")
      .waitFor();
  } else if (scenario === "viewer-asciidoc-diagram-attributes") {
    await page.locator("text=asciidoc-diagram-attributes.adoc").click();
    await page.locator("text=AsciiDoc Diagram Attributes").waitFor();
    await page.locator('[data-review-id="mermaid-render"] svg').waitFor();
    await page.locator('[data-review-id="plantuml-render"] svg').waitFor();
    await page.locator('[data-review-id="graphviz-render"] svg').waitFor();
    await page
      .locator('[data-review-id="diagram-inline-diagnostic"]')
      .first()
      .waitFor();
    await page.locator("text=source block stays source").waitFor();
  } else if (scenario === "viewer-diagram-samples") {
    const startedAt = Date.now();
    const phases = [];
    let perfBaseline = null;
    const recordPhase = async (
      name,
      started,
      details = undefined,
      status = "ok",
      durationOverrideMs = undefined,
    ) => {
      const durationMs =
        typeof durationOverrideMs === "number" &&
        Number.isFinite(durationOverrideMs)
          ? durationOverrideMs
          : Date.now() - started;
      phases.push({ name, durationMs, status, details });
      await page.evaluate((nextPhases) => {
        window.__SVARD_BENCHMARK_PHASES__ = nextPhases;
      }, phases);
    };
    await installPerfEventCollector(page);
    const clickStartedAt = await openDiagramFixture(page, {
      beforeFileClick: async () => {
        perfBaseline = await readPerfEventBaseline(page);
      },
      fileName: "diagrams-mixed-long-ja.adoc",
      recordPhase,
    });
    await page
      .locator('[data-review-id="active-document-title"]')
      .filter({ hasText: "diagrams-mixed-long-ja.adoc" })
      .waitFor();
    await recordPhase("active-title-visible", clickStartedAt);
    await page.locator('[data-review-id="document-body"]').waitFor();
    await recordPhase("document-body-visible", clickStartedAt);
    await page.locator("text=Mixed Diagram Japanese Sample").waitFor();
    await recordPhase("document-heading-visible", clickStartedAt);
    await recordPhase("heading-visible", clickStartedAt);
    await recordDocumentOpenPerfPhases(
      page,
      recordPhase,
      clickStartedAt,
      perfBaseline,
    );
    await recordDiagramPlaceholderPhase(page, recordPhase, clickStartedAt);
    const mermaidStartedAt = Date.now();
    await page.locator('[data-review-id="mermaid-render"]').waitFor();
    await recordPhase("mermaid-visible", mermaidStartedAt);
    const plantUmlStartedAt = Date.now();
    await page
      .locator('[data-review-id="plantuml-render"]')
      .locator("svg")
      .waitFor();
    await recordPhase("plantuml-visible", plantUmlStartedAt);
    const graphvizStartedAt = Date.now();
    await page
      .locator('[data-review-id="graphviz-render"]')
      .locator("svg")
      .waitFor();
    await recordPhase("graphviz-visible", graphvizStartedAt);
    await recordPhase("all-diagrams-visible", startedAt);
  } else if (scenario === "viewer-diagram-samples-after-open") {
    const phases = [];
    const recordPhase = async (
      name,
      started,
      details = undefined,
      status = "ok",
      durationOverrideMs = undefined,
    ) => {
      const durationMs =
        typeof durationOverrideMs === "number" &&
        Number.isFinite(durationOverrideMs)
          ? durationOverrideMs
          : Date.now() - started;
      phases.push({ name, durationMs, status, details });
      await page.evaluate((nextPhases) => {
        window.__SVARD_BENCHMARK_PHASES__ = nextPhases;
      }, phases);
    };
    await installPerfEventCollector(page);
    let perfBaseline = null;
    const clickStartedAt = await openDiagramFixture(page, {
      beforeFileClick: async () => {
        perfBaseline = await readPerfEventBaseline(page);
      },
      fileName: "diagrams-mixed-long-ja.adoc",
    });
    await page.locator("text=Mixed Diagram Japanese Sample").waitFor();
    await recordPhase("heading-visible", clickStartedAt);
    await recordDiagramPlaceholderPhase(page, recordPhase, clickStartedAt);
    const diagramsVisibleStartedAt = Date.now();
    const mermaidStartedAt = Date.now();
    await page.locator('[data-review-id="mermaid-render"]').waitFor();
    await recordPhase("mermaid-visible", mermaidStartedAt);
    const plantUmlStartedAt = Date.now();
    await page
      .locator('[data-review-id="plantuml-render"]')
      .locator("svg")
      .waitFor();
    await recordPhase("plantuml-visible", plantUmlStartedAt);
    const graphvizStartedAt = Date.now();
    await page
      .locator('[data-review-id="graphviz-render"]')
      .locator("svg")
      .waitFor();
    await recordPhase("graphviz-visible", graphvizStartedAt);
    await recordAfterOpenDiagramPerfPhases(
      page,
      recordPhase,
      clickStartedAt,
      perfBaseline,
    );
    await recordPhase(
      "all-diagrams-visible-after-heading",
      diagramsVisibleStartedAt,
    );
    await recordPhase("all-diagrams-visible", clickStartedAt);
  } else if (scenario === "viewer-diagram-samples-scroll-stability") {
    await installPerfEventCollector(page);
    await openDiagramFixture(page, "diagrams-mixed-long-ja.adoc");
    await page.locator("text=Mixed Diagram Japanese Sample").waitFor();
    await page.locator('[data-review-id="mermaid-render"] svg').waitFor();
    await page.locator('[data-review-id="plantuml-render"] svg').waitFor();
    await page.locator('[data-review-id="graphviz-render"] svg').waitFor();
    await waitForRenderIdle(page);
    const baseline = await readPerfEventBaseline(page);
    await page.locator('[data-review-id="document-viewer"]').hover();
    for (const deltaY of [420, 520, -260, 620, -340]) {
      await page.mouse.wheel(0, deltaY);
      await page.waitForTimeout(80);
    }
    await page.evaluate(() => {
      const viewer = document.querySelector(
        '[data-review-id="document-viewer"]',
      );
      if (viewer instanceof HTMLElement) {
        viewer.scrollTop = Math.min(
          viewer.scrollHeight,
          viewer.scrollTop + 360,
        );
        viewer.dispatchEvent(new Event("scroll", { bubbles: true }));
      }
    });
    await waitForRenderIdle(page);
    await page.evaluate((baselineSnapshot) => {
      const events = window.__SVARD_PERF_EVENTS__ ?? [];
      const scrollEvents = events.slice(baselineSnapshot.eventCount);
      const countEvent = (eventName) =>
        scrollEvents.filter((event) => event?.event === eventName).length;
      const viewerRenderEvents = scrollEvents.filter(
        (event) => event?.event === "viewer.render",
      );
      const unstableViewerRenderCount = viewerRenderEvents.filter(
        (event) => event.htmlChanged !== false || event.resultChanged !== false,
      ).length;
      window.__SVARD_DIAGRAM_SCROLL_STABILITY__ = {
        documentBasename: "diagrams-mixed-long-ja.adoc",
        baselineCounts: baselineSnapshot.counts,
        scrollCounts: {
          renderEffectStart: countEvent("render.effect.start"),
          applyInlineDiagramsToHtml: countEvent(
            "render.applyInlineDiagramsToHtml",
          ),
          articleInnerHtmlCommit: countEvent("render.articleInnerHtmlCommit"),
          viewerRender: viewerRenderEvents.length,
          unstableViewerRender: unstableViewerRenderCount,
        },
        passed:
          countEvent("render.effect.start") === 0 &&
          countEvent("render.applyInlineDiagramsToHtml") === 0 &&
          countEvent("render.articleInnerHtmlCommit") === 0 &&
          unstableViewerRenderCount === 0,
      };
    }, baseline);
  } else if (scenario === "viewer-diagram-placeholder-startup") {
    await page.evaluate(() => localStorage.setItem("SVARD_PERF_TRACE", "1"));
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("preferences.open");
    });
    await page.locator('[data-review-id="preferences-dialog"]').waitFor();
    await page
      .locator('[data-review-id="preferences-nav-item"]')
      .filter({ hasText: "Experimental" })
      .click();
    await page
      .locator('[data-review-id="experimental-diagram-placeholder-rendering-control"]')
      .click();
    await page
      .locator('[data-review-id="preferences-dialog"] button:has-text("Close")')
      .click();
    await openDiagramFixture(page, "diagrams-mixed-long-ja.adoc");
    await Promise.all([
      page.locator("text=Mixed Diagram Japanese Sample").waitFor(),
      page
        .locator('[data-review-id="diagram-placeholder"]')
        .first()
        .waitFor({ timeout: 5000 }),
    ]);
    const beforeHydration = await readPlaceholderStartupMetrics(page);
    await page.locator('[data-review-id="mermaid-render"] svg').waitFor();
    await page.locator('[data-review-id="plantuml-render"] svg').waitFor();
    await page.locator('[data-review-id="graphviz-render"] svg').waitFor();
    const afterHydration = await readPlaceholderStartupMetrics(page);
    await page.evaluate(
      ({ before, after }) => {
        window.__SVARD_DIAGRAM_PLACEHOLDER_STARTUP__ = {
          placeholderSeen: before.placeholderCount > 0,
          hydratedDiagramCount: after.hydratedDiagramCount,
          scrollTopStable: before.viewerScrollTop === after.viewerScrollTop,
          scrollHeightDelta: Math.abs(
            after.viewerScrollHeight - before.viewerScrollHeight,
          ),
        };
      },
      { before: beforeHydration, after: afterHydration },
    );
  } else if (scenario === "viewer-mermaid-japanese-flow") {
    await openDiagramFixture(page, "mermaid-japanese-flow.adoc");
    await page
      .getByRole("heading", { name: "Mermaid Japanese Flow Sample" })
      .waitFor();
    await page
      .locator('[data-review-id="mermaid-render"] svg text')
      .filter({ hasText: "文書を開く" })
      .first()
      .waitFor();
    await page
      .locator('[data-review-id="mermaid-render"] svg text')
      .filter({ hasText: "ローカルで完結" })
      .first()
      .waitFor();
  } else {
    return false;
  }
  return true;
}

async function openDiagramFixture(page, input) {
  const fileName = typeof input === "string" ? input : input.fileName;
  const recordPhase = typeof input === "string" ? null : input.recordPhase;
  const beforeFileClick = typeof input === "string" ? null : input.beforeFileClick;
  let phaseStartedAt = Date.now();
  await page.locator('[data-review-id="file-tree"]').waitFor();
  await recordPhase?.("file-tree-ready", phaseStartedAt);
  phaseStartedAt = Date.now();
  await page.locator('[data-review-id="tree-collapse-all"]').click();
  await recordPhase?.("tree-collapse", phaseStartedAt);
  phaseStartedAt = Date.now();
  await page
    .locator('[data-review-id="tree-folder-toggle"]')
    .filter({ hasText: "docs" })
    .click();
  await page
    .locator('[data-review-id="tree-folder-toggle"]')
    .filter({ hasText: "diagrams" })
    .waitFor();
  await recordPhase?.("docs-folder-expanded", phaseStartedAt);
  phaseStartedAt = Date.now();
  await page
    .locator('[data-review-id="tree-folder-toggle"]')
    .filter({ hasText: "diagrams" })
    .click();
  const targetFile = page
    .locator('[data-review-id="tree-file"]')
    .filter({ hasText: fileName });
  await targetFile.waitFor();
  await recordPhase?.("diagrams-folder-expanded", phaseStartedAt);
  phaseStartedAt = Date.now();
  await beforeFileClick?.();
  await targetFile.click();
  await recordPhase?.("file-click-dispatched", phaseStartedAt);
  return phaseStartedAt;
}

async function recordDocumentOpenPerfPhases(
  page,
  recordPhase,
  started,
  baseline,
) {
  const details = await readDocumentOpenPerfSummary(page, baseline, started);
  const timelinePhases = [
    ["render-effect-start-seen", details.renderEffectStartAtMs],
    ["render-worker-response-seen", details.renderWorkerResponseAtMs],
    ["render-prepare-html-done-seen", details.renderPrepareHtmlDoneAtMs],
    ["render-html-state-queued-seen", details.renderHtmlStateQueuedAtMs],
    ["article-ref-ready-seen", details.articleRefReadyAtMs],
    ["layout-effect-start-seen", details.layoutEffectStartAtMs],
    ["layout-effect-done-seen", details.layoutEffectDoneAtMs],
    [
      "post-commit-animation-frame-seen",
      details.postCommitAnimationFrameAtMs,
    ],
  ];
  for (const [name, offsetMs] of timelinePhases) {
    if (typeof offsetMs === "number" && Number.isFinite(offsetMs)) {
      await recordPhase(name, started, { status: "seen" }, "ok", offsetMs);
    } else {
      await recordPhase(name, started, { status: "not-seen" }, "skipped");
    }
  }
  await recordPhase(
    "article-html-commit-seen",
    started,
    details,
    "ok",
    details.articleHtmlCommitAtMs,
  );
}

async function recordDiagramPlaceholderPhase(page, recordPhase, started) {
  const placeholderCount = await page
    .locator('[data-review-id="diagram-placeholder"]')
    .count();
  await recordPhase("placeholder-visible", started, {
    count: placeholderCount,
    status: placeholderCount > 0 ? "visible" : "not-visible",
  });
}

async function recordAfterOpenDiagramPerfPhases(
  page,
  recordPhase,
  started,
  baseline,
) {
  const details = await readAfterOpenDiagramPerfSummary(page, baseline, started);
  const timelinePhases = [
    ["render-diagrams-async-done-seen", details.diagramsAsyncDoneAtMs],
    ["diagram-html-apply-done-seen", details.diagramHtmlApplyDoneAtMs],
    ["diagram-dom-commit-seen", details.diagramDomCommitAtMs],
    ["diagram-post-commit-frame-seen", details.diagramPostCommitFrameAtMs],
  ];
  for (const [name, offsetMs] of timelinePhases) {
    if (typeof offsetMs === "number" && Number.isFinite(offsetMs)) {
      await recordPhase(name, started, { status: "seen" }, "ok", offsetMs);
    } else {
      await recordPhase(name, started, { status: "not-seen" }, "skipped");
    }
  }
  await recordPhase(
    "diagram-render-after-open-events",
    started,
    details,
    "ok",
    details.slowestDurationMs,
  );
}

async function installPerfEventCollector(page) {
  await page.evaluate(() => {
    localStorage.setItem("SVARD_PERF_TRACE", "1");
    window.__SVARD_PERF_EVENTS__ = [];
    if (window.__SVARD_PERF_CONSOLE_WRAPPED__ === true) {
      return;
    }
    window.__SVARD_PERF_CONSOLE_WRAPPED__ = true;
    const originalInfo = console.info.bind(console);
    console.info = (...args) => {
      if (args[0] === "[perf]" && args[1] && typeof args[1] === "object") {
        window.__SVARD_PERF_EVENTS__?.push({
          ...args[1],
          collectedAtMs: Date.now(),
        });
      }
      originalInfo(...args);
    };
  });
}

async function waitForRenderIdle(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(resolve);
        });
      }),
  );
  await page.waitForTimeout(120);
}

async function readPerfEventBaseline(page) {
  return page.evaluate(() => {
    const events = window.__SVARD_PERF_EVENTS__ ?? [];
    const countEvent = (eventName) =>
      events.filter((event) => event?.event === eventName).length;
    return {
      eventCount: events.length,
      counts: {
        renderEffectStart: countEvent("render.effect.start"),
        applyInlineDiagramsToHtml: countEvent(
          "render.applyInlineDiagramsToHtml",
        ),
        articleInnerHtmlCommit: countEvent("render.articleInnerHtmlCommit"),
        viewerRender: countEvent("viewer.render"),
      },
    };
  });
}

async function readDocumentOpenPerfSummary(page, baseline, clickStartedAt) {
  return page.evaluate(({ baselineSnapshot, clickStartedAtMs }) => {
    const allEvents = window.__SVARD_PERF_EVENTS__ ?? [];
    const events = allEvents.slice(baselineSnapshot?.eventCount ?? 0);
    const allowedEvents = events.filter((event) => {
      const eventName = event?.event;
      return (
        typeof eventName === "string" &&
        (eventName.startsWith("openDocument.dispatch.") ||
          eventName.startsWith("render.") ||
          eventName === "viewer.render")
      );
    });
    const countEvent = (predicate) =>
      allowedEvents.filter((event) => predicate(event?.event)).length;
    const firstEventOffset = (eventName) => {
      const matched = allowedEvents.find((event) => event?.event === eventName);
      if (
        !matched ||
        typeof matched.collectedAtMs !== "number" ||
        !Number.isFinite(matched.collectedAtMs)
      ) {
        return undefined;
      }
      return Math.max(0, Math.round(matched.collectedAtMs - clickStartedAtMs));
    };
    const durations = allowedEvents
      .map((event) => event?.durationMs)
      .filter(
        (duration) => typeof duration === "number" && Number.isFinite(duration),
      );
    return {
      articleCommitCount: countEvent(
        (eventName) => eventName === "render.articleInnerHtmlCommit",
      ),
      articleHtmlCommitAtMs: firstEventOffset("render.articleInnerHtmlCommit"),
      articleRefReadyAtMs: firstEventOffset("render.articleRefReady"),
      articleRefReadyCount: countEvent(
        (eventName) => eventName === "render.articleRefReady",
      ),
      eventCount: allowedEvents.length,
      layoutEffectDoneAtMs: firstEventOffset("render.layoutEffect.done"),
      layoutEffectDoneCount: countEvent(
        (eventName) => eventName === "render.layoutEffect.done",
      ),
      layoutEffectStartAtMs: firstEventOffset("render.layoutEffect.start"),
      layoutEffectStartCount: countEvent(
        (eventName) => eventName === "render.layoutEffect.start",
      ),
      openDispatchEventCount: countEvent((eventName) =>
        eventName?.startsWith("openDocument.dispatch."),
      ),
      postCommitAnimationFrameAtMs: firstEventOffset(
        "render.postCommitAnimationFrame",
      ),
      postCommitAnimationFrameCount: countEvent(
        (eventName) => eventName === "render.postCommitAnimationFrame",
      ),
      renderEventCount: countEvent((eventName) => eventName?.startsWith("render.")),
      renderEffectStartAtMs: firstEventOffset("render.effect.start"),
      renderHtmlStateQueuedAtMs: firstEventOffset(
        "render.afterHtmlStateSetQueued",
      ),
      renderPrepareHtmlDoneAtMs: firstEventOffset("render.prepareDocumentHtml"),
      renderWorkerResponseAtMs: firstEventOffset("render.workerPool.response"),
      slowestDurationMs: durations.length > 0 ? Math.max(...durations) : 0,
      status:
        countEvent((eventName) => eventName === "render.articleInnerHtmlCommit") > 0
          ? "seen"
          : "not-seen",
      viewerRenderCount: countEvent((eventName) => eventName === "viewer.render"),
    };
  }, { baselineSnapshot: baseline, clickStartedAtMs: clickStartedAt });
}

async function readAfterOpenDiagramPerfSummary(page, baseline, clickStartedAt) {
  return page.evaluate(({ baselineSnapshot, clickStartedAtMs }) => {
    const allEvents = window.__SVARD_PERF_EVENTS__ ?? [];
    const events = allEvents.slice(baselineSnapshot?.eventCount ?? 0);
    const allowedEvents = events.filter((event) => {
      const eventName = event?.event;
      return typeof eventName === "string" && eventName.startsWith("render.");
    });
    const countEvent = (predicate) =>
      allowedEvents.filter((event) => predicate(event?.event)).length;
    const firstEventOffset = (eventName) => {
      const matched = allowedEvents.find((event) => event?.event === eventName);
      if (
        !matched ||
        typeof matched.collectedAtMs !== "number" ||
        !Number.isFinite(matched.collectedAtMs)
      ) {
        return undefined;
      }
      return Math.max(0, Math.round(matched.collectedAtMs - clickStartedAtMs));
    };
    const durations = allowedEvents
      .map((event) => event?.durationMs)
      .filter(
        (duration) => typeof duration === "number" && Number.isFinite(duration),
      );
    return {
      articleCommitCount: countEvent(
        (eventName) => eventName === "render.articleInnerHtmlCommit",
      ),
      diagramDomCommitAtMs: firstEventOffset("render.articleInnerHtmlCommit"),
      diagramHtmlApplyDoneAtMs: firstEventOffset(
        "render.applyInlineDiagramsToHtml",
      ),
      diagramPostCommitFrameAtMs: firstEventOffset(
        "render.postCommitAnimationFrame",
      ),
      diagramsAsyncDoneAtMs: firstEventOffset("render.diagramsAsyncDone"),
      eventCount: allowedEvents.length,
      htmlApplyCount: countEvent(
        (eventName) => eventName === "render.applyInlineDiagramsToHtml",
      ),
      postCommitFrameCount: countEvent(
        (eventName) => eventName === "render.postCommitAnimationFrame",
      ),
      renderDiagramsAsyncDoneCount: countEvent(
        (eventName) => eventName === "render.diagramsAsyncDone",
      ),
      renderEventCount: countEvent((eventName) => eventName?.startsWith("render.")),
      slowestDurationMs: durations.length > 0 ? Math.max(...durations) : 0,
      status:
        countEvent((eventName) => eventName === "render.diagramsAsyncDone") > 0
          ? "seen"
          : "not-seen",
    };
  }, { baselineSnapshot: baseline, clickStartedAtMs: clickStartedAt });
}

async function readPlaceholderStartupMetrics(page) {
  return page.evaluate(() => {
    const viewer = document.querySelector('[data-review-id="document-viewer"]');
    return {
      placeholderCount: document.querySelectorAll(
        '[data-review-id="diagram-placeholder"]',
      ).length,
      hydratedDiagramCount: document.querySelectorAll(
        '[data-review-id="mermaid-render"] svg, [data-review-id="plantuml-render"] svg, [data-review-id="graphviz-render"] svg, [data-review-id="kroki-render"] svg, [data-review-id="kroki-render"] img',
      ).length,
      viewerScrollTop: viewer instanceof HTMLElement ? viewer.scrollTop : 0,
      viewerScrollHeight:
        viewer instanceof HTMLElement ? viewer.scrollHeight : 0,
    };
  });
}
