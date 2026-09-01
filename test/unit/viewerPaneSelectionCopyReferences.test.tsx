import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultConfig } from "../../src/core/defaultConfig";
import type {
  DocumentPayload,
  DocumentSelectionSnapshot,
  RenderResult,
} from "../../src/core/types";
import { ViewerPane } from "../../src/ui/components/ViewerPane";
import { emptySafeHtml, markSafeHtml } from "../../src/ui/lib/safeHtml";
import type { ViewerPaneSnapshot } from "../../src/ui/types";

const rangeBoundsDescriptor = Object.getOwnPropertyDescriptor(
  Range.prototype,
  "getBoundingClientRect",
);
const rangeRectsDescriptor = Object.getOwnPropertyDescriptor(
  Range.prototype,
  "getClientRects",
);
const clipboardDescriptor = Object.getOwnPropertyDescriptor(
  navigator,
  "clipboard",
);

const rect = {
  left: 10,
  top: 10,
  right: 110,
  bottom: 30,
  width: 100,
  height: 20,
  x: 10,
  y: 10,
  toJSON: () => ({}),
} as DOMRect;

const snapshot: ViewerPaneSnapshot = {
  id: "left",
  documentPayload: null,
  renderResult: null,
  documentHtml: emptySafeHtml,
  query: "",
  searchIndex: 0,
  searchHits: [],
  activeHeadingId: null,
  navigationBackStack: [],
  navigationForwardStack: [],
};

describe("ViewerPane selection copy references", () => {
  let container: HTMLDivElement;
  let root: Root;
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    Object.defineProperty(Range.prototype, "getBoundingClientRect", {
      configurable: true,
      value: () => rect,
    });
    Object.defineProperty(Range.prototype, "getClientRects", {
      configurable: true,
      value: () => [rect],
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
      rect,
    );
    writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  });

  afterEach(() => {
    window.getSelection()?.removeAllRanges();
    act(() => root.unmount());
    container.remove();
    restoreDescriptor(
      Range.prototype,
      "getBoundingClientRect",
      rangeBoundsDescriptor,
    );
    restoreDescriptor(Range.prototype, "getClientRects", rangeRectsDescriptor);
    restoreDescriptor(navigator, "clipboard", clipboardDescriptor);
    vi.restoreAllMocks();
  });

  it("copies rendered Text and include-aware Original Text without changing Ask", async () => {
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
      html: "",
      headings: [],
      sourceBlocks: [],
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
      diagnostics: [],
      diagramSlots: [],
      mermaidDiagrams: [],
      plantUmlDiagrams: [],
      graphvizDiagrams: [],
      krokiDiagrams: [],
    };
    const onAddAgentSelection = vi.fn(
      (_selection: DocumentSelectionSnapshot) => undefined,
    );
    await act(async () => {
      root.render(
        <ViewerPane
          config={defaultConfig}
          error={null}
          inlineNotice={null}
          lightweightActionFeedback={null}
          isLoading={false}
          mouseGestureTrail={[]}
          paneId="left"
          snapshot={snapshot}
          splitEnabled={false}
          focusedPaneId="left"
          documentPayload={documentPayload}
          renderResult={renderResult}
          documentHtml={markSafeHtml(
            '<p data-source-selection-block-id="paragraph-1">Root.</p><p data-source-selection-block-id="paragraph-2">Included.</p>',
          )}
          postDiffGitMarkers={null}
          query=""
          searchHits={[]}
          searchIndex={0}
          onArticleClick={vi.fn()}
          onArticleLinkCapture={vi.fn()}
          onArticleContextMenu={vi.fn()}
          onArticleDoubleClick={vi.fn()}
          onArticleBlur={vi.fn()}
          onArticleFocus={vi.fn()}
          onArticlePointerLeave={vi.fn()}
          onArticlePointerMove={vi.fn()}
          onClearContentCursor={vi.fn()}
          onDismissInlineNotice={vi.fn()}
          onDispatchCommand={vi.fn()}
          onFocusPane={vi.fn()}
          onActivateSearchHit={vi.fn()}
          onMouseGestureContextMenu={vi.fn()}
          onConsumePendingMouseGestureContextMenu={() => null}
          onMouseGesturePointerCancel={vi.fn()}
          onMouseGesturePointerDown={vi.fn()}
          onMouseGesturePointerMove={vi.fn()}
          onMouseGesturePointerUp={vi.fn()}
          onOpenDirectory={vi.fn()}
          onOpenDocument={vi.fn()}
          onPickDirectory={vi.fn()}
          onPickDocument={vi.fn()}
          onClearRecentDocuments={vi.fn()}
          onClearRecentDirectories={vi.fn()}
          onAddAgentSelection={onAddAgentSelection}
        />,
      );
    });

    const paragraphs = container.querySelectorAll("article p");
    const range = document.createRange();
    range.setStart(paragraphs[0], 0);
    range.setEnd(paragraphs[1], paragraphs[1].childNodes.length);
    const renderedText = range.toString();
    await act(async () => {
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
    });
    window.getSelection()?.removeAllRanges();

    await click(buttonByLabel(container, "More selection actions"));
    expect(container.textContent).toContain("Copy Original Text Reference");
    await click(buttonByText(container, "Copy Text Reference"));
    expect(writeText).toHaveBeenLastCalledWith(
      `File: /workspace/docs/main.adoc:1\nText:\n${renderedText}`,
    );
    expect(writeText.mock.calls.at(-1)?.[0]).not.toContain("Selected content:");

    await click(buttonByLabel(container, "More selection actions"));
    await click(buttonByText(container, "Copy Original Text Reference"));
    expect(writeText).toHaveBeenLastCalledWith(
      "File: /workspace/docs/main.adoc:1\nOriginal text:\nRoot.\n\nFile: /workspace/docs/part.adoc:1\nOriginal text:\nIncluded.",
    );

    const askButton = container.querySelector<HTMLButtonElement>(
      ".selection-mini-toolbar-primary",
    );
    if (!askButton) throw new Error("Missing Ask AI button");
    await click(askButton);
    expect(onAddAgentSelection).toHaveBeenCalledOnce();
    expect(onAddAgentSelection.mock.calls[0]?.[0].blocks).toHaveLength(2);
  });
});

async function click(button: HTMLButtonElement) {
  await act(async () => {
    button.click();
    await Promise.resolve();
  });
}

function buttonByLabel(container: HTMLElement, label: string) {
  const button = container.querySelector<HTMLButtonElement>(
    `button[aria-label="${label}"]`,
  );
  if (!button) throw new Error(`Missing button: ${label}`);
  return button;
}

function buttonByText(container: HTMLElement, text: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.trim() === text,
  );
  if (!button) throw new Error(`Missing button: ${text}`);
  return button;
}

function restoreDescriptor(
  target: object,
  key: PropertyKey,
  descriptor: PropertyDescriptor | undefined,
) {
  if (descriptor) {
    Object.defineProperty(target, key, descriptor);
  } else {
    Reflect.deleteProperty(target, key);
  }
}
