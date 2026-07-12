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

  it("records state and layout commit boundaries without private body data", () => {
    expect(renderHookSource).toContain("render.stateCommit.start");
    expect(renderHookSource).toContain("render.stateCommit.queued");
    expect(viewerPaneSource).toContain("render.articleRefReady");
    expect(viewerPaneSource).toContain("render.layoutEffect.start");
    expect(viewerPaneSource).toContain("render.layoutEffect.done");
    expect(viewerPaneSource).toContain("render.postCommitAnimationFrame");

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
    expect(layoutEffectBody).not.toContain("tracePerf(\"render.articleRefReady\", {\n      html");
    expect(layoutEffectBody).not.toContain("tracePerf(\"render.postCommitAnimationFrame\", {\n        html");
    expect(layoutEffectBody).not.toContain("source");
    expect(layoutEffectBody).not.toContain("documentPayload.path");
    expect(layoutEffectBody).not.toContain("[html, payload, result]");
  });
});
