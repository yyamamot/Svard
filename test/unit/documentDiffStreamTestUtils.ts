import { act } from "react";
import { vi } from "vitest";
import type { DocumentDiffPreview } from "../../src/core/types";
import type { DocumentDiffStreamPanelProps } from "../../src/ui/components/documentDiffStream/types";
import type { GitRenderedDiffSummary } from "../../src/ui/lib/gitRenderedDiff";

export async function flushPreviewLoad() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

export async function flushRulerMeasure() {
  await act(async () => {
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
  });
}

export function buttonByText(text: string) {
  const button = Array.from(
    document.querySelectorAll<HTMLButtonElement>("button"),
  ).find((candidate) => candidate.textContent === text);
  if (!button) {
    throw new Error(`Missing button: ${text}`);
  }
  return button;
}

type RequiredDiffStreamTestProps = Pick<
  DocumentDiffStreamPanelProps,
  | "copyText"
  | "openContextMenu"
  | "openDocument"
  | "openPathInEditor"
  | "resolveDocumentLink"
  | "confirmExternalLink"
  | "openExternalUrl"
  | "onOpenDiagramPreview"
  | "showInlineNotice"
>;

export function requiredDiffStreamProps(): RequiredDiffStreamTestProps {
  return {
    copyText: vi.fn().mockResolvedValue(undefined),
    openContextMenu: vi.fn(() => true),
    openDocument: vi.fn().mockResolvedValue(undefined),
    openPathInEditor: vi.fn().mockResolvedValue(undefined),
    resolveDocumentLink: vi.fn().mockResolvedValue({
      status: "blocked",
      message: "Missing",
    }),
    confirmExternalLink: vi.fn().mockResolvedValue(true),
    openExternalUrl: vi.fn().mockResolvedValue(undefined),
    onOpenDiagramPreview: vi.fn(),
    showInlineNotice: vi.fn(),
  };
}

export function documentStreamItem(path: string) {
  return {
    kind: "document" as const,
    path,
    documentPath: `/workspace/${path}`,
    status: "modified" as const,
  };
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

export function installMockIntersectionObserver() {
  const original = globalThis.IntersectionObserver;
  const observed = new Set<Element>();
  let callback: IntersectionObserverCallback | null = null;
  globalThis.IntersectionObserver = class {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds = [];

    constructor(observerCallback: IntersectionObserverCallback) {
      callback = observerCallback;
    }

    observe(element: Element) {
      observed.add(element);
    }

    unobserve(element: Element) {
      observed.delete(element);
    }

    disconnect() {
      observed.clear();
    }

    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
  return {
    trigger: (...paths: string[]) => {
      const pathSet = new Set(paths.map((path) => `/workspace/${path}`));
      const entries = Array.from(observed)
        .filter(
          (element) =>
            element instanceof HTMLElement &&
            element.dataset.streamKey &&
            pathSet.has(element.dataset.streamKey),
        )
        .map(
          (target) =>
            ({
              isIntersecting: true,
              target,
            }) as IntersectionObserverEntry,
        );
      callback?.(entries, {} as IntersectionObserver);
    },
    restore: () => {
      globalThis.IntersectionObserver = original;
    },
  };
}

export function diffPreview(path: string): DocumentDiffPreview {
  return {
    source: "git",
    relativePath: "docs/guide.md",
    leftPath: path,
    rightPath: path,
    status: "modified",
    leftLabel: "HEAD",
    rightLabel: "Working Tree",
    hunks: [
      {
        oldStart: 1,
        oldLines: 1,
        newStart: 1,
        newLines: 1,
        lines: [
          { kind: "removed", oldLine: 1, newLine: null, text: "# Old Guide" },
          { kind: "removed", oldLine: 3, newLine: null, text: "Old text" },
          { kind: "added", oldLine: null, newLine: 1, text: "# New Guide" },
          { kind: "added", oldLine: null, newLine: 3, text: "New text" },
        ],
      },
    ],
    leftText: "# Old Guide\n\nOld text",
    rightText: "# New Guide\n\nNew text",
  };
}

export function renderedDiffSummary(count = 1): GitRenderedDiffSummary {
  return {
    blocks: Array.from({ length: count }, (_, index) => ({
      id: `paragraph-${index}`,
      kind: "changed" as const,
      blockKind: "paragraph" as const,
      left: {
        id: `paragraph-${index}-left`,
        kind: "paragraph" as const,
        tagName: "p",
        text: `Old text ${index}`,
        html: `<p>Old text ${index}</p>`,
      },
      right: {
        id: `paragraph-${index}-right`,
        kind: "paragraph" as const,
        tagName: "p",
        text: `New text ${index}`,
        html: `<p>New text ${index}</p>`,
      },
    })),
  };
}

export function renderedDiffSummaryWithFineTargets(): GitRenderedDiffSummary {
  return {
    blocks: [
      {
        id: "paragraph-0",
        kind: "changed" as const,
        blockKind: "paragraph" as const,
        left: {
          id: "paragraph-0-left",
          kind: "paragraph" as const,
          tagName: "p",
          text: "Old paragraph",
          html: "<p>Old paragraph</p>",
        },
        right: {
          id: "paragraph-0-right",
          kind: "paragraph" as const,
          tagName: "p",
          text: "New paragraph",
          html: "<p>New paragraph</p>",
        },
      },
      {
        id: "list-0",
        kind: "changed" as const,
        blockKind: "list" as const,
        left: {
          id: "list-0-left",
          kind: "list" as const,
          tagName: "ul",
          text: "Old list item",
          html: "<ul><li>Old list item</li></ul>",
        },
        right: {
          id: "list-0-right",
          kind: "list" as const,
          tagName: "ul",
          text: "New list item",
          html: "<ul><li>New list item</li></ul>",
        },
        childChanges: [
          {
            kind: "changed" as const,
            side: "both" as const,
            confidence: "high" as const,
            leftIndex: 0,
            rightIndex: 0,
          },
        ],
      },
      {
        id: "table-0",
        kind: "changed" as const,
        blockKind: "table" as const,
        left: {
          id: "table-0-left",
          kind: "table" as const,
          tagName: "table",
          text: "Old table value",
          html: "<table><tbody><tr><td>Old table value</td></tr></tbody></table>",
        },
        right: {
          id: "table-0-right",
          kind: "table" as const,
          tagName: "table",
          text: "New table value",
          html: "<table><tbody><tr><td>New table value</td></tr></tbody></table>",
        },
        tableChanges: [
          {
            kind: "changed" as const,
            side: "both" as const,
            confidence: "high" as const,
            leftRowIndex: 0,
            rightRowIndex: 0,
            leftCellIndex: 0,
            rightCellIndex: 0,
          },
        ],
      },
    ],
  };
}
