import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("render commit perf trace", () => {
  const renderHookSource = fs.readFileSync(
    path.join(process.cwd(), "src/ui/hooks/useDocumentRender.ts"),
    "utf8",
  );
  const viewerPaneSource = fs.readFileSync(
    path.join(process.cwd(), "src/ui/components/ViewerPane.tsx"),
    "utf8",
  );
  const documentHtmlSource = fs.readFileSync(
    path.join(process.cwd(), "src/ui/lib/documentHtml.ts"),
    "utf8",
  );
  const imageDecodeTraceSource = fs.readFileSync(
    path.join(process.cwd(), "src/ui/lib/renderCriticalPathTrace.ts"),
    "utf8",
  );
  const searchStateSource = fs.readFileSync(
    path.join(process.cwd(), "src/ui/hooks/useSearchState.ts"),
    "utf8",
  );
  const activeHeadingSource = fs.readFileSync(
    path.join(process.cwd(), "src/ui/hooks/useActiveHeadingTracking.ts"),
    "utf8",
  );
  const inspectorSource = fs.readFileSync(
    path.join(process.cwd(), "src/ui/hooks/useAppDocumentInspectorState.ts"),
    "utf8",
  );

  function tracePayloadSource(source: string, event: string) {
    const start = source.indexOf(`tracePerf("${event}"`);
    expect(start, `${event} trace exists`).toBeGreaterThanOrEqual(0);
    return source.slice(start, source.indexOf("});", start) + 3);
  }

  it("records state and layout commit boundaries without private body data", () => {
    expect(renderHookSource).toContain("render.stateCommit.start");
    expect(renderHookSource).toContain("render.stateCommit.queued");
    expect(viewerPaneSource).toContain("render.articleRefReady");
    expect(viewerPaneSource).toContain("render.layoutEffect.start");
    expect(viewerPaneSource).toContain("render.layoutEffect.done");
    expect(viewerPaneSource).toContain("render.postCommitAnimationFrame");
    expect(renderHookSource).toContain("workspaceBoot.documentRenderStarted");
    expect(viewerPaneSource).toContain("workspaceBoot.firstDocumentFrame");

    const stateTraceBody = renderHookSource.slice(
      renderHookSource.indexOf('tracePerf("render.stateCommit.start"'),
      renderHookSource.indexOf(
        "});",
        renderHookSource.indexOf('tracePerf("render.stateCommit.start"'),
      ) + 3,
    );
    expect(stateTraceBody).not.toContain("finalHtml");
    expect(stateTraceBody).not.toContain("source");
    expect(stateTraceBody).not.toContain("documentPayload.path");

    const safeRenderStartTrace = renderHookSource.slice(
      renderHookSource.indexOf(
        'tracePerf("workspaceBoot.documentRenderStarted"',
      ),
      renderHookSource.indexOf(
        "});",
        renderHookSource.indexOf(
          'tracePerf("workspaceBoot.documentRenderStarted"',
        ),
      ) + 3,
    );
    expect(safeRenderStartTrace).not.toContain("basename");
    expect(safeRenderStartTrace).not.toContain("format");
    expect(safeRenderStartTrace).not.toContain("path");
    expect(safeRenderStartTrace).not.toContain("source");

    const safeFirstFrameTrace = viewerPaneSource.slice(
      viewerPaneSource.indexOf('tracePerf("workspaceBoot.firstDocumentFrame"'),
      viewerPaneSource.indexOf(
        "});",
        viewerPaneSource.indexOf(
          'tracePerf("workspaceBoot.firstDocumentFrame"',
        ),
      ) + 3,
    );
    expect(safeFirstFrameTrace).not.toContain("basename");
    expect(safeFirstFrameTrace).not.toContain("format");
    expect(safeFirstFrameTrace).not.toContain("path");
    expect(safeFirstFrameTrace).not.toContain("source");
  });

  it("keeps article innerHTML commits tied to HTML and primitive document identity", () => {
    const layoutEffectBody = viewerPaneSource.slice(
      viewerPaneSource.indexOf("useLayoutEffect(() =>"),
      viewerPaneSource.indexOf(
        "]);",
        viewerPaneSource.indexOf("useLayoutEffect(() =>"),
      ) + 3,
    );

    expect(layoutEffectBody).toContain("articleRenderIdentity");
    expect(layoutEffectBody).toContain("documentFormat");
    expect(layoutEffectBody).toContain("documentPath");
    expect(layoutEffectBody).toContain("hasRenderResult");
    expect(layoutEffectBody).toContain("html");
    expect(layoutEffectBody).not.toContain(
      'tracePerf("render.articleRefReady", {\n      html',
    );
    expect(layoutEffectBody).not.toContain(
      'tracePerf("render.postCommitAnimationFrame", {\n        html',
    );
    expect(layoutEffectBody).not.toContain("source");
    expect(layoutEffectBody).not.toContain("documentPayload.path");
    expect(layoutEffectBody).not.toContain("[html, payload, result]");
  });

  it("keeps critical-path phase events aggregate and privacy-safe", () => {
    const phaseEvents = [
      [documentHtmlSource, "render.prepareDocumentHtml.imageResolver"] as const,
      [imageDecodeTraceSource, "render.imageDecode.complete"] as const,
      [viewerPaneSource, "render.commitFrame"] as const,
      [viewerPaneSource, "render.layoutStability"] as const,
      [searchStateSource, "render.search.cleanup"] as const,
      [activeHeadingSource, "render.activeHeading.measure"] as const,
      [inspectorSource, "render.linkInspector.collect"] as const,
      [inspectorSource, "render.linkInspector.build"] as const,
    ];

    for (const [source, event] of phaseEvents) {
      const payload = tracePayloadSource(source, event);
      expect(payload).toContain("durationMs");
      expect(payload).not.toMatch(
        /\b(?:basename|documentPath|path|url|html|source|content)\b/iu,
      );
    }
  });
});
