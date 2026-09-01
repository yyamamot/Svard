import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  DocumentPayload,
  DocumentSelectionSnapshot,
  RenderResult,
} from "../../src/core/types";
import { createArticleContextMenuHandler } from "../../src/ui/hooks/documentLinks/contextMenu";
import type { ContextMenuItem } from "../../src/ui/types";

const emptyRenderResult: Omit<RenderResult, "sourceSelectionBlocks"> = {
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

afterEach(() => {
  window.getSelection()?.removeAllRanges();
  document.body.replaceChildren();
  Reflect.deleteProperty(document, "elementFromPoint");
  Reflect.deleteProperty(document, "elementsFromPoint");
  vi.restoreAllMocks();
});

describe("article context menu copy references", () => {
  it("keeps rendered Text clipboard content separate from the Agent snapshot", async () => {
    const documentPayload: DocumentPayload = {
      path: "/workspace/docs/steps.md",
      basePath: "/workspace/docs",
      format: "markdown",
      source: "```text\n$ run\n```\n",
      updatedAt: "2026-08-31T00:00:00.000Z",
    };
    const renderResult: RenderResult = {
      ...emptyRenderResult,
      sourceSelectionBlocks: [
        { id: "code-1", kind: "code", startLine: 1, endLine: 3 },
      ],
    };
    const article = document.createElement("article");
    article.innerHTML =
      '<div class="source-block-frame" data-source-selection-block-id="code-1"><pre data-source-selection-block-id="code-1">$ run</pre></div>';
    document.body.append(article);
    const pre = article.querySelector("pre")!;
    const renderedText = selectAtPoint(pre.firstChild!, 0, pre.firstChild!, 5);
    const onAddAgentSelection = vi.fn(
      (_snapshot: DocumentSelectionSnapshot) => undefined,
    );
    const { copyText, items } = await openSelectionMenu({
      article,
      documentPayload,
      renderResult,
      target: pre,
      onAddAgentSelection,
    });

    await items()
      .find((item) => item.id === "copy-text-reference")
      ?.onSelect();

    expect(copyText).toHaveBeenCalledWith(
      "Text reference",
      `File: /workspace/docs/steps.md:1\nText:\n${renderedText}`,
    );
    expect(copyText.mock.calls[0]?.[1]).not.toContain("Selected content:");
    expect(copyText.mock.calls[0]?.[1]).not.toContain("```");

    items()
      .find((item) => item.id === "ask-agent-about-selection")
      ?.onSelect();
    expect(onAddAgentSelection).toHaveBeenCalledOnce();
    expect(onAddAgentSelection.mock.calls[0]?.[0].blocks).toEqual([
      expect.objectContaining({ type: "code", text: "$ run" }),
    ]);
  });

  it("uses the multi-block include resolver for Original Text Reference", async () => {
    const documentPayload: DocumentPayload = {
      path: "/workspace/docs/main.adoc",
      basePath: "/workspace/docs",
      format: "asciidoc",
      source: "Root.\n",
      updatedAt: "2026-08-31T00:00:00.000Z",
      includeFiles: [
        { path: "/workspace/docs/part.adoc", source: "Included.\n" },
      ],
    };
    const renderResult: RenderResult = {
      ...emptyRenderResult,
      sourceSelectionBlocks: [
        {
          id: "paragraph-1",
          kind: "paragraph",
          startLine: 1,
          endLine: 1,
        },
        {
          id: "paragraph-2",
          kind: "paragraph",
          startLine: 1,
          endLine: 1,
          sourceLocation: {
            sourcePath: "/workspace/docs/part.adoc",
            line: 1,
          },
        },
      ],
    };
    const article = document.createElement("article");
    article.innerHTML =
      '<p data-source-selection-block-id="paragraph-1">Root.</p><p data-source-selection-block-id="paragraph-2">Included.</p>';
    document.body.append(article);
    const paragraphs = article.querySelectorAll("p");
    selectAtPoint(
      paragraphs[0],
      0,
      paragraphs[1],
      paragraphs[1].childNodes.length,
    );
    const { copyText, items } = await openSelectionMenu({
      article,
      documentPayload,
      renderResult,
      target: paragraphs[1],
    });

    expect(items().map((item) => item.label)).toContain(
      "Copy Original Text Reference",
    );
    await items()
      .find((item) => item.id === "copy-original-text-reference")
      ?.onSelect();
    expect(copyText).toHaveBeenCalledWith(
      "Original text reference",
      "File: /workspace/docs/main.adoc:1\nOriginal text:\nRoot.\n\nFile: /workspace/docs/part.adoc:1\nOriginal text:\nIncluded.",
    );
  });
});

function selectAtPoint(
  start: Node,
  startOffset: number,
  end: Node,
  endOffset: number,
) {
  const range = document.createRange();
  range.setStart(start, startOffset);
  range.setEnd(end, endOffset);
  Object.defineProperty(range, "getClientRects", {
    configurable: true,
    value: () => [{ left: 0, right: 20, top: 0, bottom: 20 }],
  });
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  return selection.toString();
}

async function openSelectionMenu({
  article,
  documentPayload,
  renderResult,
  target,
  onAddAgentSelection,
}: {
  article: HTMLElement;
  documentPayload: DocumentPayload;
  renderResult: RenderResult;
  target: HTMLElement;
  onAddAgentSelection?: (snapshot: DocumentSelectionSnapshot) => void;
}) {
  let menuItems: ContextMenuItem[] = [];
  const copyText = vi.fn(
    async (_label: string, _content?: string) => undefined,
  );
  Object.defineProperty(document, "elementFromPoint", {
    configurable: true,
    value: vi.fn(() => target),
  });
  Object.defineProperty(document, "elementsFromPoint", {
    configurable: true,
    value: vi.fn(() => [target]),
  });
  const handler = createArticleContextMenuHandler({
    articleRef: { current: article },
    documentPayload,
    renderResult,
    openContextMenu: (_event, items) => {
      menuItems = items;
      return true;
    },
    openLinkElement: vi.fn(async () => undefined),
    openDocumentInNewWindow: vi.fn(async () => undefined),
    openPathInEditor: vi.fn(async () => undefined),
    openDiagramPreview: vi.fn(),
    openImagePreview: vi.fn(),
    saveDiagramSvg: vi.fn(async () => undefined),
    resolveDocumentLink: vi.fn(async () => ({
      status: "blocked" as const,
      message: "unused",
    })),
    showInlineNotice: vi.fn(),
    onCompareGitRef: vi.fn(),
    onShowGitDiff: vi.fn(),
    copyText,
    copyImage: vi.fn(async () => undefined),
    onBeginCaptureArea: vi.fn(),
    onAddAgentSelection,
  });

  await handler({ target, clientX: 10, clientY: 10 } as never);
  return { copyText, items: () => menuItems };
}
