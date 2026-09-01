import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DocumentPayload, RenderResult } from "../../src/core/types";
import { useActiveHeadingTracking } from "../../src/ui/hooks/useActiveHeadingTracking";
import { useAppDocumentInspectorState } from "../../src/ui/hooks/useAppDocumentInspectorState";
import { markSafeHtml } from "../../src/ui/lib/safeHtml";
import { createReactRootHarness } from "./helpers/reactHarness";

function collectPerfEvents() {
  const events: Array<Record<string, unknown>> = [];
  vi.spyOn(console, "info").mockImplementation(
    (label: unknown, payload: unknown) => {
      if (label === "[perf]" && payload && typeof payload === "object") {
        events.push(payload as Record<string, unknown>);
      }
    },
  );
  return events;
}

const renderResult: RenderResult = {
  html: '<h2 id="private-heading">Private heading</h2>',
  headings: [{ id: "private-heading", level: 2, text: "Private heading" }],
  sourceBlocks: [],
  diagnostics: [],
  diagramSlots: [],
  mermaidDiagrams: [],
  plantUmlDiagrams: [],
  graphvizDiagrams: [],
  krokiDiagrams: [],
};

const documentPayload: DocumentPayload = {
  path: "/workspace/docs/private-source.md",
  basePath: "/workspace",
  format: "markdown",
  source: "[private target](/workspace/docs/private-target.md)",
  updatedAt: "2026-08-30T00:00:00.000Z",
};

describe("post-commit render phase trace", () => {
  afterEach(() => {
    localStorage.removeItem("SVARD_PERF_TRACE");
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("records initial active-heading geometry without heading identity", () => {
    localStorage.setItem("SVARD_PERF_TRACE", "1");
    const events = collectPerfEvents();
    vi.stubGlobal("CSS", { escape: (value: string) => value });
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 120,
      height: 20,
      left: 0,
      right: 100,
      top: 100,
      width: 100,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });
    const harness = createReactRootHarness();

    function Probe() {
      const articleRef = useRef<HTMLElement | null>(null);
      const viewerRef = useRef<HTMLElement | null>(null);
      useActiveHeadingTracking({
        articleRef,
        renderResult,
        setActiveHeadingId: vi.fn(),
        viewerRef,
      });
      return (
        <section ref={viewerRef}>
          <article ref={articleRef}>
            <h2 id="private-heading">Private heading</h2>
          </article>
        </section>
      );
    }

    harness.render(<Probe />);

    const event = events.find(
      (candidate) =>
        candidate.event === "render.activeHeading.measure" &&
        candidate.trigger === "initial",
    );
    expect(event).toEqual(
      expect.objectContaining({
        headingCount: 1,
        measurementCount: 1,
        status: "changed",
      }),
    );
    expect(typeof event?.durationMs).toBe("number");
    expect(JSON.stringify(event)).not.toContain("private-heading");

    harness.cleanup();
  });

  it("records link collection and model costs without link data", () => {
    localStorage.setItem("SVARD_PERF_TRACE", "1");
    const events = collectPerfEvents();
    const harness = createReactRootHarness();
    const openDocumentPaths = new Set([
      documentPayload.path,
      "/workspace/docs/private-target.md",
    ]);
    const documentHtml = markSafeHtml(
      '<p><a href="/workspace/docs/private-target.md">Private target</a></p>',
    );

    function Probe() {
      const articleRef = useRef<HTMLElement | null>(null);
      useAppDocumentInspectorState({
        activeDocumentPayload: documentPayload,
        articleRef,
        documentHtml,
        openDocumentPaths,
        preferencesOpen: false,
        renderResult: null,
        rootDirectory: "/workspace",
      });
      return <article ref={articleRef} />;
    }

    harness.render(<Probe />);

    const collectEvent = events.find(
      (candidate) =>
        candidate.event === "render.linkInspector.collect" &&
        candidate.status === "ready",
    );
    const buildEvent = [...events]
      .reverse()
      .find((candidate) => candidate.event === "render.linkInspector.build");
    expect(collectEvent).toEqual(
      expect.objectContaining({ linkCount: 1, status: "ready" }),
    );
    expect(buildEvent).toEqual(
      expect.objectContaining({
        outgoingCount: 1,
        backlinkCount: 0,
        status: "ready",
      }),
    );
    expect(typeof collectEvent?.durationMs).toBe("number");
    expect(typeof buildEvent?.durationMs).toBe("number");
    expect(JSON.stringify([collectEvent, buildEvent])).not.toContain(
      "private-target",
    );
    expect(JSON.stringify([collectEvent, buildEvent])).not.toContain(
      "/workspace",
    );

    harness.cleanup();
  });
});
