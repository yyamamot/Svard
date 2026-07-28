import type {
  DocumentChangeSnapshot,
  DocumentDiffPreview,
  DocumentSelectionSnapshot,
  SelectionDiagnostic,
} from "../../core/types";
import type {
  RenderedBlockDiffKind,
  RenderedDiffNavigationTarget,
  RenderedDiffPresentation,
} from "./gitRenderedDiff";
import { extractRenderedDiffSelection } from "./diffDocumentSelection";

const renderedChangeTargetSelector = [
  ".git-rendered-block.change-target[data-change-index]",
  ".git-rendered-list-item-change[data-change-index]",
  ".git-rendered-structured-child-change[data-change-index]",
  ".git-rendered-table-row-change[data-change-index]",
].join(",");

export interface ExtractRenderedDiffCurrentChangeInput {
  comparisonLabel?: string | null;
  presentation: RenderedDiffPresentation;
  preview: DocumentDiffPreview;
  root: HTMLElement;
  target: RenderedDiffNavigationTarget;
}

export async function extractRenderedDiffCurrentChange({
  comparisonLabel,
  presentation,
  preview,
  root,
  target,
}: ExtractRenderedDiffCurrentChangeInput): Promise<DocumentChangeSnapshot> {
  const changeKind = currentChangeKind(target);
  const snapshotId = currentChangeSnapshotId(preview, presentation, target);
  const expectedSides =
    changeKind === "added"
      ? (["right"] as const)
      : changeKind === "removed"
        ? (["left"] as const)
        : (["left", "right"] as const);
  const snapshots = new Map<"left" | "right", DocumentSelectionSnapshot>();
  const diagnostics: SelectionDiagnostic[] = [];

  try {
    for (const side of expectedSides) {
      const pane = renderedPane(root, preview, side);
      const element = pane?.querySelector<HTMLElement>(
        `[data-change-index="${target.index}"]`,
      );
      const range = element ? rangeForCurrentChange(element) : null;
      if (!pane || !range) {
        diagnostics.push(exactTargetDiagnostic());
        continue;
      }
      const snapshot = await extractRenderedDiffSelection({
        comparisonLabel,
        pane,
        preview,
        range,
        side,
      });
      snapshots.set(side, snapshot);
      diagnostics.push(...snapshot.diagnostics);
    }
  } finally {
    window.getSelection()?.removeAllRanges();
  }

  const before = snapshots.get("left");
  const after = snapshots.get("right");
  if (
    expectedSides.some((side) => !snapshots.has(side)) ||
    [...snapshots.values()].some(
      (snapshot) =>
        snapshot.blocks.length === 0 ||
        snapshot.diagnostics.some(
          (diagnostic) => diagnostic.severity === "blocking",
        ),
    )
  ) {
    if (!diagnostics.some((diagnostic) => diagnostic.severity === "blocking")) {
      diagnostics.push(exactTargetDiagnostic());
    }
  }

  return {
    snapshotId,
    contextType: "change",
    documentPath:
      preview.relativePath ??
      after?.documentPath ??
      before?.documentPath ??
      "rendered document",
    comparisonLabel:
      comparisonLabel ?? `${preview.leftLabel} → ${preview.rightLabel}`,
    changeKind,
    before,
    after,
    diagnostics,
  };
}

export function renderedDiffChangeIndexAtTarget(
  target: HTMLElement,
  root: HTMLElement,
): number | null {
  const changeTarget = target.closest<HTMLElement>(
    renderedChangeTargetSelector,
  );
  if (!changeTarget || !root.contains(changeTarget)) return null;
  const index = Number.parseInt(changeTarget.dataset.changeIndex ?? "", 10);
  return Number.isInteger(index) ? index : null;
}

function renderedPane(
  root: HTMLElement,
  preview: DocumentDiffPreview,
  side: "left" | "right",
) {
  const revisionLabel =
    side === "left" ? preview.leftLabel : preview.rightLabel;
  return Array.from(
    root.querySelectorAll<HTMLElement>(".git-rendered-pane"),
  ).find(
    (candidate) =>
      candidate.dataset.captureSide === side &&
      candidate.dataset.captureRevisionLabel === revisionLabel,
  );
}

function rangeForCurrentChange(element: HTMLElement): Range | null {
  const range = document.createRange();
  if (element.matches(".git-rendered-block")) {
    const contents = Array.from(
      element.querySelectorAll<HTMLElement>(".git-rendered-block-content"),
    );
    const first = contents[0];
    const last = contents[contents.length - 1];
    if (!first || !last) return null;
    range.setStartBefore(first);
    range.setEndAfter(last);
    return range;
  }
  range.selectNodeContents(element);
  return range.collapsed ? null : range;
}

function currentChangeKind(
  target: RenderedDiffNavigationTarget,
): Exclude<RenderedBlockDiffKind, "unchanged"> {
  if (
    target.targetKind === "list-item" &&
    target.childChangeIndex !== undefined
  ) {
    return (
      target.block.childChanges?.[target.childChangeIndex]?.kind ?? "changed"
    );
  }
  if (
    target.targetKind === "structured-child" &&
    target.structuredChildIndex !== undefined
  ) {
    const change = target.block.structuredChanges?.find((candidate) =>
      target.primarySide === "left"
        ? candidate.leftIndex === target.structuredChildIndex
        : candidate.rightIndex === target.structuredChildIndex,
    );
    return change?.kind ?? "changed";
  }
  if (target.targetKind === "table-row" && target.tableRowIndex !== undefined) {
    const changes = (target.block.tableChanges ?? []).filter((candidate) =>
      target.primarySide === "left"
        ? candidate.leftRowIndex === target.tableRowIndex
        : candidate.rightRowIndex === target.tableRowIndex,
    );
    return changes.some((candidate) => candidate.kind === "changed")
      ? "changed"
      : (changes[0]?.kind ?? "changed");
  }
  return target.block.kind === "unchanged" ? "changed" : target.block.kind;
}

function currentChangeSnapshotId(
  preview: DocumentDiffPreview,
  presentation: RenderedDiffPresentation,
  target: RenderedDiffNavigationTarget,
) {
  const entry = presentation.entries.find(
    (candidate) => candidate.id === target.entryId,
  );
  const blocks = entry
    ? entry.kind === "group"
      ? entry.blocks
      : [entry.block]
    : [target.block];
  const contentIdentity = blocks
    .map(
      (block) =>
        `${block.id}\0${block.left?.text ?? ""}\0${block.right?.text ?? ""}`,
    )
    .join("\0");
  const identity = [
    preview.relativePath ?? "",
    preview.leftLabel,
    preview.rightLabel,
    target.entryId,
    target.targetKind,
    target.childChangeIndex ?? "",
    target.itemIndex ?? "",
    target.structuredChildIndex ?? "",
    target.tableRowIndex ?? "",
    contentIdentity,
  ].join("\0");
  return `current-change-${opaqueHash(identity)}`;
}

function opaqueHash(value: string) {
  let hash = 0x811c9dc5;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function exactTargetDiagnostic(): SelectionDiagnostic {
  return {
    severity: "blocking",
    code: "sourceAmbiguous",
    message: "The current rendered change could not be attached exactly.",
  };
}
