import type {
  DocumentDiffPreview,
  DocumentDiffStreamPreview,
  DocumentSelectionSnapshot,
} from "../../core/types";
import { documentFormatForPath } from "../../core/documentFormat";
import {
  extractDocumentSelection,
  revealDocumentSelection,
} from "./documentSelection";
import {
  diffReferenceForTarget,
  originalDiffTextReferenceForSelection,
} from "./diffReference";
import { diffPreviewDocumentPath } from "../components/gitDiffPreview/contextMenuDocument";

export interface RenderedDiffSelectionContext {
  pane: HTMLElement;
  preview: DocumentDiffPreview;
  side: "left" | "right";
  comparisonLabel?: string | null;
}

export type SelectionRevealTarget =
  | {
      kind: "document";
      documentPath: string;
    }
  | {
      kind: "diffPreview";
      preview: DocumentDiffPreview;
      view: "preview" | "rendered";
      side: "left" | "right";
      changeIndex?: number;
    }
  | {
      kind: "diffStream";
      stream: DocumentDiffStreamPreview;
      itemPath: string;
      viewMode: "full" | "changes";
      side: "left" | "right";
      changeIndex?: number;
    };

export async function extractRenderedDiffSelection({
  comparisonLabel,
  pane,
  preview,
  range,
  side,
}: RenderedDiffSelectionContext & {
  range: Range;
}): Promise<DocumentSelectionSnapshot> {
  const path = diffPreviewDocumentPath(preview, side);
  const displayPath =
    preview.relativePath ??
    path?.replace(/^.*[\\/]/u, "") ??
    "selected document";
  const revisionLabel =
    side === "left" ? preview.leftLabel : preview.rightLabel;
  const source = side === "left" ? preview.leftText : preview.rightText;
  const snapshot = await extractDocumentSelection({
    article: pane,
    document: {
      path: path ?? displayPath,
      basePath: "",
      format: documentFormatForPath(displayPath),
      source: source ?? "",
      updatedAt: `${revisionLabel}:${source?.length ?? 0}`,
    },
    range,
  });
  restoreRange(range);
  const original = originalDiffTextReferenceForSelection({
    target: range.commonAncestorContainer.parentElement ?? pane,
    preview,
    path,
    side,
  })?.value;
  const lineMatch = original?.match(/^File: .+?:(\d+)(?:-(\d+))?$/mu);
  if (lineMatch) {
    snapshot.provenance = [
      {
        sourcePath: displayPath,
        startLine: Number(lineMatch[1]),
        endLine: Number(lineMatch[2] ?? lineMatch[1]),
        exact: true,
      },
    ];
    snapshot.diagnostics = snapshot.diagnostics.filter(
      (diagnostic) => diagnostic.code !== "sourceAmbiguous",
    );
  } else {
    snapshot.provenance = [
      {
        sourcePath: displayPath,
        startLine: 1,
        endLine: 1,
        exact: false,
      },
    ];
  }
  snapshot.documentPath = displayPath;
  snapshot.documentRevision = revisionLabel;
  snapshot.diffContext = {
    kind: "renderedDiff",
    displayPath,
    side,
    revisionLabel,
    comparisonLabel:
      comparisonLabel ?? `${preview.leftLabel} → ${preview.rightLabel}`,
  };
  return snapshot;
}

export function renderedDiffOriginalReference(
  context: RenderedDiffSelectionContext,
  range: Range,
) {
  restoreRange(range);
  const value = originalDiffTextReferenceForSelection({
    target: range.commonAncestorContainer.parentElement ?? context.pane,
    preview: context.preview,
    path: diffPreviewDocumentPath(context.preview, context.side),
    side: context.side,
  })?.value;
  return value
    ? safeReferencePath(value, context.preview, context.side)
    : undefined;
}

export function renderedDiffReference(
  context: RenderedDiffSelectionContext,
  range: Range,
) {
  const target =
    range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? (range.commonAncestorContainer as HTMLElement)
      : range.commonAncestorContainer.parentElement;
  if (!target) return undefined;
  const startBlock = range.startContainer.parentElement?.closest(
    ".git-rendered-block[data-sync-index]",
  );
  const endBlock = range.endContainer.parentElement?.closest(
    ".git-rendered-block[data-sync-index]",
  );
  if (
    !startBlock ||
    startBlock !== endBlock ||
    !startBlock.hasAttribute("data-change-index")
  ) {
    return undefined;
  }
  const value = diffReferenceForTarget({
    target,
    preview: context.preview,
    leftPath: diffPreviewDocumentPath(context.preview, "left"),
    rightPath: diffPreviewDocumentPath(context.preview, "right"),
  })?.value;
  if (!value) return undefined;
  return ["left", "right"].reduce(
    (current, side) =>
      safeReferencePath(current, context.preview, side as "left" | "right"),
    value,
  );
}

export function revealRenderedDiffSelection(
  root: HTMLElement | null,
  snapshot: DocumentSelectionSnapshot,
) {
  if (!root || !snapshot.diffContext) return false;
  const pane = Array.from(
    root.querySelectorAll<HTMLElement>(".git-rendered-pane"),
  ).find(
    (candidate) =>
      candidate.dataset.captureSide === snapshot.diffContext?.side &&
      candidate.dataset.captureRevisionLabel ===
        snapshot.diffContext?.revisionLabel,
  );
  return revealDocumentSelection(pane ?? null, snapshot);
}

function restoreRange(range: Range) {
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range.cloneRange());
}

function safeReferencePath(
  value: string,
  preview: DocumentDiffPreview,
  side: "left" | "right",
) {
  const path = diffPreviewDocumentPath(preview, side);
  const displayPath =
    preview.relativePath ?? path?.replace(/^.*[\\/]/u, "") ?? null;
  return path && displayPath ? value.replaceAll(path, displayPath) : value;
}
