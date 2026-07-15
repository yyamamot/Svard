import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RenderResult } from "../../src/core/types";
import {
  buildPostDiffGitMarkerContext,
  deriveGitRenderedDiffSummary,
} from "../../src/ui/lib/gitRenderedDiff";
import { deriveGitTableDiffSummary } from "../../src/ui/lib/gitTableDiff";
import {
  activePath,
  listBlock,
  presentation,
  preview,
} from "./helpers/postDiffGitMarkerFixtures";

const { renderDocumentMock } = vi.hoisted(() => ({
  renderDocumentMock: vi.fn(),
}));

vi.mock("../../src/core/renderDocument", () => ({
  renderDocument: renderDocumentMock,
}));

function renderResultForSource(source: string): RenderResult {
  const status = source.includes("Old private value") ? "Old" : "New";
  return {
    html: `<h1>Guide</h1><p>${status} private value</p><table><thead><tr><th>Name</th><th>Status</th></tr></thead><tbody><tr><td>Feature</td><td>${status}</td></tr></tbody></table>`,
    headings: [],
    sourceBlocks: [],
    diagnostics: [],
    diagramSlots: [],
    mermaidDiagrams: [],
    plantUmlDiagrams: [],
    graphvizDiagrams: [],
    krokiDiagrams: [],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function expectPhaseOffsets(
  payload: Record<string, unknown>,
  phasePrefix: string,
): [startOffsetMs: number, endOffsetMs: number] {
  const startOffsetMs = payload[`${phasePrefix}StartOffsetMs`];
  const endOffsetMs = payload[`${phasePrefix}EndOffsetMs`];
  if (typeof startOffsetMs !== "number" || typeof endOffsetMs !== "number") {
    throw new Error(`Missing numeric offsets for ${phasePrefix}`);
  }
  expect(Number.isFinite(startOffsetMs)).toBe(true);
  expect(Number.isFinite(endOffsetMs)).toBe(true);
  expect(startOffsetMs).toBeGreaterThanOrEqual(0);
  expect(endOffsetMs).toBeGreaterThanOrEqual(startOffsetMs);
  return [startOffsetMs, endOffsetMs];
}

describe("Git diff phase performance instrumentation", () => {
  beforeEach(() => {
    localStorage.setItem("SVARD_PERF_TRACE", "1");
    renderDocumentMock.mockReset();
    renderDocumentMock.mockImplementation(
      async (document: { source: string }) =>
        renderResultForSource(document.source),
    );
  });

  afterEach(() => {
    localStorage.removeItem("SVARD_PERF_TRACE");
    vi.restoreAllMocks();
  });

  it("emits one privacy-safe phase event for each measured lifecycle", async () => {
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});
    const privatePreview = preview({
      repositoryRoot: "/Users/example/private-repository",
      relativePath: "private/guide.md",
      leftPath: "/Users/example/private-repository/private/guide.md",
      rightPath: "/Users/example/private-repository/private/guide.md",
      leftLabel: "secret-revision",
      rightLabel: "private-working-tree",
      leftText:
        "# Guide\n\nOld private value\n\n| Name | Status |\n| --- | --- |\n| Feature | Old |",
      rightText:
        "# Guide\n\nNew private value\n\n| Name | Status |\n| --- | --- |\n| Feature | New |",
    });

    await deriveGitRenderedDiffSummary(privatePreview, {
      perfOwner: "single-preview",
      perfEntryIndex: 0,
      loadDocumentContext: async () => null,
    });
    await deriveGitTableDiffSummary(privatePreview, {
      perfOwner: "single-preview",
    });
    buildPostDiffGitMarkerContext({
      activeDocumentPath: activePath,
      preview: preview(),
      renderedPresentation: presentation([listBlock("rendered-block:0")]),
      perfOwner: "normal-viewer-marker",
      perfMode: "initial",
    });

    const targetEvents = consoleInfo.mock.calls
      .filter(([label]) => label === "[perf]")
      .map(([, payload]) => payload as Record<string, unknown>)
      .filter((payload) =>
        [
          "diff-artifact-ready",
          "table-summary-ready",
          "marker-context-ready",
        ].includes(String(payload.event)),
      );

    expect(targetEvents.map((payload) => payload.event)).toEqual([
      "diff-artifact-ready",
      "table-summary-ready",
      "marker-context-ready",
    ]);
    expect(targetEvents[0]).toMatchObject({
      owner: "single-preview",
      perfEntryIndex: 0,
      format: "markdown",
      outcome: "ready",
      leftRenderCount: 1,
      rightRenderCount: 1,
      leftPrepareCount: 1,
      rightPrepareCount: 1,
      leftBlockParseCount: 1,
      rightBlockParseCount: 1,
    });
    expect(targetEvents[1]).toMatchObject({
      owner: "single-preview",
      format: "markdown",
      outcome: "ready",
      fallbackReason: "none",
      leftSourceScanCount: 1,
      rightSourceScanCount: 1,
      leftRenderCount: 1,
      rightRenderCount: 1,
      leftBlockParseCount: 1,
      rightBlockParseCount: 1,
    });
    expect(targetEvents[2]).toMatchObject({
      owner: "normal-viewer-marker",
      mode: "initial",
      outcome: "ready",
      leftBlockParseCount: 1,
      rightBlockParseCount: 1,
      markerCount: 1,
      renderedMarkerCount: 1,
    });
    expect(renderDocumentMock).toHaveBeenCalledTimes(4);

    for (const side of ["left", "right"] as const) {
      const renderOffsets = expectPhaseOffsets(
        targetEvents[0],
        `${side}Render`,
      );
      const prepareOffsets = expectPhaseOffsets(
        targetEvents[0],
        `${side}Prepare`,
      );
      const blockParseOffsets = expectPhaseOffsets(
        targetEvents[0],
        `${side}BlockParse`,
      );
      expect(prepareOffsets[0]).toBeGreaterThanOrEqual(renderOffsets[1]);
      expect(blockParseOffsets[0]).toBeGreaterThanOrEqual(prepareOffsets[1]);

      const tableRenderOffsets = expectPhaseOffsets(
        targetEvents[1],
        `${side}Render`,
      );
      const tableBlockParseOffsets = expectPhaseOffsets(
        targetEvents[1],
        `${side}BlockParse`,
      );
      expect(tableBlockParseOffsets[0]).toBeGreaterThanOrEqual(
        tableRenderOffsets[1],
      );

      expectPhaseOffsets(targetEvents[2], `${side}BlockParse`);
    }

    const allowedStrings = new Set([
      "diff-artifact-ready",
      "table-summary-ready",
      "marker-context-ready",
      "single-preview",
      "normal-viewer-marker",
      "markdown",
      "ready",
      "none",
      "initial",
    ]);
    for (const payload of targetEvents) {
      for (const value of Object.values(payload)) {
        if (value === null) {
          continue;
        }
        if (typeof value === "number") {
          expect(Number.isFinite(value)).toBe(true);
        } else {
          expect(allowedStrings.has(String(value))).toBe(true);
        }
      }
      const serialized = JSON.stringify(payload);
      expect(serialized).not.toContain("/Users/");
      expect(serialized).not.toContain("private-repository");
      expect(serialized).not.toContain("secret-revision");
      expect(serialized).not.toContain("Old private value");
      expect(serialized).not.toContain("New private value");
    }
  });

  it("does not emit lifecycle events while performance tracing is disabled", () => {
    localStorage.removeItem("SVARD_PERF_TRACE");
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});

    buildPostDiffGitMarkerContext({
      activeDocumentPath: activePath,
      preview: preview(),
      renderedPresentation: presentation([listBlock("rendered-block:0")]),
      perfOwner: "normal-viewer-marker",
      perfMode: "handoff",
    });

    expect(consoleInfo).not.toHaveBeenCalled();
  });

  it("uses null marker offsets when no marker parse phase runs", () => {
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});

    buildPostDiffGitMarkerContext({
      activeDocumentPath: activePath,
      preview: preview({ status: "clean", hunks: [] }),
      renderedPresentation: presentation([]),
      perfOwner: "normal-viewer-marker",
      perfMode: "initial",
    });

    const event = consoleInfo.mock.calls
      .filter(([label]) => label === "[perf]")
      .map(([, payload]) => payload as Record<string, unknown>)
      .find((payload) => payload.event === "marker-context-ready");
    expect(event).toMatchObject({
      outcome: "not-applicable",
      leftBlockParseCount: 0,
      leftBlockParseStartOffsetMs: null,
      leftBlockParseEndOffsetMs: null,
      rightBlockParseCount: 0,
      rightBlockParseStartOffsetMs: null,
      rightBlockParseEndOffsetMs: null,
    });
  });

  it("waits for both render sides before emitting a measured fallback", async () => {
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});
    const rightRender = deferred<RenderResult>();
    renderDocumentMock.mockImplementation(
      (document: { source: string }): Promise<RenderResult> =>
        document.source === "reject-left"
          ? Promise.reject(new Error("left render failed"))
          : rightRender.promise,
    );
    let summarySettled = false;

    const summaryPromise = deriveGitRenderedDiffSummary(
      preview({
        leftText: "reject-left",
        rightText: "deferred-right",
      }),
      { perfOwner: "single-preview" },
    ).then((summary) => {
      summarySettled = true;
      return summary;
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(summarySettled).toBe(false);
    expect(
      consoleInfo.mock.calls.filter(
        ([label, payload]) =>
          label === "[perf]" &&
          (payload as { event?: string }).event === "diff-artifact-ready",
      ),
    ).toHaveLength(0);

    rightRender.resolve(renderResultForSource("deferred-right"));
    const summary = await summaryPromise;
    const events = consoleInfo.mock.calls
      .filter(
        ([label, payload]) =>
          label === "[perf]" &&
          (payload as { event?: string }).event === "diff-artifact-ready",
      )
      .map(([, payload]) => payload as Record<string, unknown>);

    expect(summary).toEqual({
      blocks: [],
      fallbackMessage:
        "Rendered document diff is not available. Use Source view.",
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      owner: "single-preview",
      outcome: "fallback",
      leftRenderCount: 1,
      rightRenderCount: 1,
      leftPrepareCount: 0,
      leftPrepareStartOffsetMs: null,
      leftPrepareEndOffsetMs: null,
      rightPrepareCount: 1,
      leftBlockParseCount: 0,
      leftBlockParseStartOffsetMs: null,
      leftBlockParseEndOffsetMs: null,
      rightBlockParseCount: 1,
    });
  });

  it("keeps the unmeasured fallback independent of a deferred sibling", async () => {
    localStorage.removeItem("SVARD_PERF_TRACE");
    const rightRender = deferred<RenderResult>();
    renderDocumentMock.mockImplementation(
      (document: { source: string }): Promise<RenderResult> =>
        document.source === "reject-left"
          ? Promise.reject(new Error("left render failed"))
          : rightRender.promise,
    );

    const summary = await deriveGitRenderedDiffSummary(
      preview({
        leftText: "reject-left",
        rightText: "deferred-right",
      }),
      { perfOwner: "single-preview" },
    );

    expect(summary.fallbackMessage).toBe(
      "Rendered document diff is not available. Use Source view.",
    );
    rightRender.resolve(renderResultForSource("deferred-right"));
  });

  it("waits for both table render sides before emitting a measured fallback", async () => {
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});
    const rightRender = deferred<RenderResult>();
    renderDocumentMock.mockImplementation(
      (document: { source: string }): Promise<RenderResult> =>
        document.source === "reject-left"
          ? Promise.reject(new Error("left table render failed"))
          : rightRender.promise,
    );
    let summarySettled = false;

    const summaryPromise = deriveGitTableDiffSummary(
      preview({
        leftText: "reject-left",
        rightText: "deferred-right",
      }),
      { perfOwner: "single-preview" },
    ).then((summary) => {
      summarySettled = true;
      return summary;
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(summarySettled).toBe(false);
    expect(
      consoleInfo.mock.calls.filter(
        ([label, payload]) =>
          label === "[perf]" &&
          (payload as { event?: string }).event === "table-summary-ready",
      ),
    ).toHaveLength(0);

    rightRender.resolve(renderResultForSource("deferred-right"));
    const summary = await summaryPromise;
    const events = consoleInfo.mock.calls
      .filter(
        ([label, payload]) =>
          label === "[perf]" &&
          (payload as { event?: string }).event === "table-summary-ready",
      )
      .map(([, payload]) => payload as Record<string, unknown>);

    expect(summary).toEqual({
      renderedTables: [],
      tableMarkers: [],
      fallbackReason: "no-table",
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      owner: "single-preview",
      outcome: "fallback",
      fallbackReason: "no-table",
      leftRenderCount: 1,
      rightRenderCount: 1,
      leftBlockParseCount: 0,
      leftBlockParseStartOffsetMs: null,
      leftBlockParseEndOffsetMs: null,
      rightBlockParseCount: 1,
    });
  });
});
