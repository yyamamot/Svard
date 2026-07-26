import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RenderResult } from "../../src/core/types";
import {
  extractDocumentMedia,
  extractRenderedDiffMedia,
  mediaLocationText,
  mediaTurnContentParts,
  renderedDiffDiagramForTarget,
  revealDocumentMedia,
  resolveDiagramSource,
} from "../../src/ui/lib/documentMedia";

vi.mock("../../src/ui/lib/imageClipboard", () => ({
  selectionImageToPng: vi.fn(async () => {
    return new Blob(["png"], { type: "image/png" });
  }),
}));

const emptyResult: RenderResult = {
  html: "",
  headings: [],
  sourceBlocks: [],
  diagnostics: [],
  diagramSlots: [],
  mermaidDiagrams: [],
  plantUmlDiagrams: [],
  graphvizDiagrams: [],
  krokiDiagrams: [],
};

describe("document media context", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("creates a visual image snapshot without exposing its absolute path", async () => {
    document.body.innerHTML = `
      <article>
        <h2>Architecture</h2>
        <figure><img alt="Storage flow" data-image-resolved-path="/workspace/assets/flow.png"><figcaption>Data flow</figcaption></figure>
      </article>
    `;
    const image = document.querySelector("img")!;
    const snapshot = await extractDocumentMedia({
      document: {
        path: "/workspace/docs/guide.md",
        updatedAt: "revision-1",
      },
      displayPath: "docs/guide.md",
      element: image,
      renderResult: emptyResult,
      snapshotId: "media-1",
    });

    expect(snapshot.mediaKind).toBe("image");
    expect(snapshot.displayLabel).toBe("Data flow");
    expect(snapshot.sectionLabel).toBe("Architecture");
    expect(snapshot.documentPath).toBe("docs/guide.md");
    expect(snapshot.visual?.base64).toBe("cG5n");
    expect(JSON.stringify(snapshot)).not.toContain("/workspace");
  });

  it.each([
    ["mermaid", "flowchart LR", "mermaidDiagrams"],
    ["plantuml", "@startuml", "plantUmlDiagrams"],
    ["graphviz", "digraph G {}", "graphvizDiagrams"],
    ["d2", "a -> b", "krokiDiagrams"],
  ] as const)(
    "resolves %s diagram source by diagram id",
    (type, source, key) => {
      const result: RenderResult = {
        ...emptyResult,
        diagramSlots: [
          {
            id: "diagram-1",
            diagramType: type,
            renderer: type === "d2" ? "kroki" : type,
          },
        ],
        [key]: [{ id: "diagram-1", source }],
      };
      expect(resolveDiagramSource(result, "diagram-1")).toEqual({
        type,
        source,
      });
    },
  );

  it("uses visual and source for a rendered diagram and keeps diff location natural", async () => {
    document.body.innerHTML = `
      <article>
        <h2>Flow</h2>
        <div class="diagram-inline" data-diagram-id="diagram-1">
          <svg data-diagram-id="diagram-1" data-source-line="12"></svg>
        </div>
      </article>
    `;
    const result: RenderResult = {
      ...emptyResult,
      diagramSlots: [
        {
          id: "diagram-1",
          diagramType: "mermaid",
          renderer: "mermaid",
        },
      ],
      mermaidDiagrams: [{ id: "diagram-1", source: "flowchart LR" }],
    };
    const snapshot = await extractDocumentMedia({
      document: { path: "/workspace/docs/guide.md", updatedAt: "left" },
      displayPath: "docs/guide.md",
      element: document.querySelector("svg") as unknown as HTMLElement,
      renderResult: result,
      diffContext: {
        kind: "renderedDiff",
        displayPath: "docs/guide.md",
        side: "left",
        revisionLabel: "HEAD",
        comparisonLabel: "HEAD → working tree",
      },
      snapshotId: "media-2",
    });

    expect(snapshot.defaultMode).toBe("visualAndSource");
    expect(snapshot.diagram?.source).toBe("flowchart LR");
    expect(mediaLocationText(snapshot)).toContain(
      "Before (HEAD) in HEAD → working tree",
    );
    expect(
      mediaTurnContentParts(snapshot, "visualAndSource", "attachment-1").map(
        (part) => part.type,
      ),
    ).toEqual(["text", "image", "text", "text"]);
    expect(mediaTurnContentParts(snapshot, "visual")).toHaveLength(2);
    expect(mediaTurnContentParts(snapshot, "source")).toHaveLength(3);
  });

  it("uses diagram metadata from the rendered diff presentation without re-rendering", async () => {
    document.body.innerHTML = `
      <div class="git-rendered-scroll">
        <article class="git-rendered-block">
          <div class="git-rendered-block-content">
            <div class="diagram-inline" data-diagram-id="rendered-diagram">
              <svg data-diagram-id="rendered-diagram"></svg>
            </div>
          </div>
        </article>
      </div>
    `;
    const target = document.querySelector("svg") as unknown as HTMLElement;
    const entries = [
      {
        id: "entry-1",
        kind: "block" as const,
        block: {
          id: "diff-1",
          kind: "changed" as const,
          blockKind: "diagram" as const,
          left: {
            id: "left-1",
            kind: "diagram" as const,
            tagName: "div",
            text: "",
            html: "<svg></svg>",
            diagram: { type: "mermaid", source: "flowchart LR\nA --> B" },
          },
          right: {
            id: "right-1",
            kind: "diagram" as const,
            tagName: "div",
            text: "",
            html: "<svg></svg>",
            diagram: { type: "mermaid", source: "flowchart LR\nA --> C" },
          },
        },
      },
    ];

    const diagramSource = renderedDiffDiagramForTarget(
      target,
      entries,
      "right",
    );
    expect(diagramSource).toEqual({
      type: "mermaid",
      source: "flowchart LR\nA --> C",
    });

    const snapshot = await extractRenderedDiffMedia({
      comparisonLabel: "HEAD → working tree",
      displayPath: "docs/guide.md",
      element: target,
      path: "/workspace/docs/guide.md",
      revisionLabel: "working tree",
      side: "right",
      diagramSource,
    });
    expect(snapshot.diagram).toEqual(diagramSource);
    expect(snapshot.defaultMode).toBe("visualAndSource");
  });

  it("reveals the original media by source line without exposing an internal diagram id", () => {
    document.body.innerHTML = `
      <article>
        <div class="diagram-inline" data-diagram-id="provider-internal" data-source-line="42">
          <svg></svg>
        </div>
      </article>
    `;
    const target = document.querySelector<HTMLElement>(".diagram-inline")!;
    target.scrollIntoView = vi.fn();
    const revealed = revealDocumentMedia(document, {
      snapshotId: "media-reveal",
      contextType: "media",
      documentPath: "docs/guide.md",
      documentRevision: "revision",
      displayLabel: "Architecture",
      sourceLine: 42,
      mediaKind: "diagram",
      defaultMode: "source",
      diagram: { type: "mermaid", source: "flowchart LR" },
      diagnostics: [],
    });

    expect(revealed).toBe(true);
    expect(target.scrollIntoView).toHaveBeenCalled();
    expect(target.classList.contains("agent-media-reveal")).toBe(true);
  });
});
