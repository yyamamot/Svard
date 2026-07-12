import type { DocumentDiffPreview } from "../../core/types";
import { sectionLabelForRange } from "./locationReference";
import {
  groupSourceSelectionSlices,
  sourceSlicesForRange,
  type SourceMappedSelectionUnit,
} from "./selectionSourceSlice";

export function diffReferenceForTarget({
  target,
  preview,
  leftPath,
  rightPath,
}: {
  target: HTMLElement;
  preview: DocumentDiffPreview;
  leftPath: string | null;
  rightPath: string | null;
}) {
  const current = target.closest<HTMLElement>(
    ".git-rendered-block[data-sync-index]",
  );
  const syncIndex = current?.getAttribute("data-sync-index");
  const surface = current?.closest<HTMLElement>(
    ".git-diff-body-with-ruler,.git-rendered-diff-body",
  );
  if (
    !current ||
    !current.hasAttribute("data-change-index") ||
    !syncIndex ||
    !surface ||
    !/^\d+$/u.test(syncIndex)
  ) {
    return undefined;
  }
  const left = surface.querySelector<HTMLElement>(
    `.git-rendered-block.left-side[data-sync-index="${syncIndex}"]`,
  );
  const right = surface.querySelector<HTMLElement>(
    `.git-rendered-block.right-side[data-sync-index="${syncIndex}"]`,
  );
  const file = rightPath ?? leftPath;
  if (!file) return undefined;
  const before = sourceFragment(left, preview.leftText, leftPath ?? file);
  const after = sourceFragment(right, preview.rightText, rightPath ?? file);
  const leftPresent = Boolean(left && !left.classList.contains("blank"));
  const rightPresent = Boolean(right && !right.classList.contains("blank"));
  if ((leftPresent && !before) || (rightPresent && !after)) return undefined;
  if (!before && !after) return undefined;
  const change = before && after ? "modified" : after ? "added" : "removed";
  return {
    value: [
      `File: ${file}`,
      `Change: ${change}`,
      "",
      `Before (${preview.leftLabel}):`,
      before ?? "(none)",
      "",
      `After (${preview.rightLabel}):`,
      after ?? "(none)",
    ].join("\n"),
  };
}

export function originalDiffTextReferenceForSelection({
  target,
  preview,
  path,
  side,
}: {
  target: HTMLElement;
  preview: DocumentDiffPreview;
  path: string | null;
  side: "left" | "right";
}) {
  const selection = window.getSelection();
  const source = side === "left" ? preview.leftText : preview.rightText;
  if (!selection?.rangeCount || selection.isCollapsed || !source || !path)
    return undefined;
  const range = selection.getRangeAt(0);
  const pane = target.closest<HTMLElement>(
    ".git-rendered-pane,.git-diff-body-with-ruler,.git-rendered-diff-body",
  );
  const units = sourceUnitsForRange(range, pane, path, source);
  if (!units) return undefined;
  const slices = sourceSlicesForRange(range, units);
  if (!slices) return undefined;
  const fragment = groupSourceSelectionSlices(slices)[0];
  if (!fragment) return undefined;
  const section = sectionLabelForRange({
    article: pane,
    range,
  });
  return {
    value: `File: ${path}:${lineRange(fragment.startLine, fragment.endLine)}\nRevision: ${side === "left" ? preview.leftLabel : preview.rightLabel} (${side})${section ? `\nSection: ${section}` : ""}\nOriginal text:\n${fragment.text}`,
  };
}

function sourceFragment(
  block: HTMLElement | null,
  source: string | null | undefined,
  path: string | null,
  section?: string,
) {
  if (!source || !path) return undefined;
  const range = sourceRange(block, path);
  if (!range) return undefined;
  const text = source
    .split("\n")
    .slice(range.start - 1, range.end)
    .join("\n");
  return `File: ${path}:${range.start}-${range.end}${section ? `\nSection: ${section}` : ""}\nOriginal text:\n${text}`;
}

function sourceRange(block: HTMLElement | null, path: string | null) {
  if (!block || block.classList.contains("blank") || !path) return undefined;
  return sourceRangeForElement(block, path);
}

function sourceRangeForElement(element: HTMLElement, path: string) {
  const mapped = element.matches(
    "[data-source-selection-start][data-source-selection-end]",
  )
    ? element
    : element.querySelector<HTMLElement>(
        "[data-source-selection-start][data-source-selection-end]",
      );
  const start = Number(mapped?.getAttribute("data-source-selection-start"));
  const end = Number(mapped?.getAttribute("data-source-selection-end"));
  const sourcePath = mapped?.getAttribute("data-source-selection-source-path");
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 1 ||
    end < start
  )
    return undefined;
  if (sourcePath && normalizePath(sourcePath) !== normalizePath(path))
    return undefined;
  return { start, end };
}

function sourceUnitsForRange(
  range: Range,
  pane: HTMLElement | null,
  path: string,
  source: string,
) {
  if (!pane) return undefined;
  const candidates = sourceUnitCandidates(pane);
  const start = selectionUnitElement(range.startContainer);
  const end = selectionUnitElement(range.endContainer);
  const startIndex = start ? candidates.indexOf(start) : -1;
  const endIndex = end ? candidates.indexOf(end) : -1;
  if (startIndex < 0 || endIndex < startIndex) return undefined;
  const selected = candidates.slice(startIndex, endIndex + 1);
  const ranges = selected.map((element) =>
    sourceRangeForElement(element, path),
  );
  if (ranges.some((item) => !item)) return undefined;
  const resolved = ranges as Array<{ start: number; end: number }>;
  if (
    selected.some(isUnsupportedSourceUnit) ||
    resolved.some(
      (item, index) => index > 0 && item.start <= resolved[index - 1].end,
    )
  ) {
    return undefined;
  }
  return selected.map(
    (element, index) =>
      ({
        element,
        kind: element.matches(".source-block-frame,pre")
          ? "code"
          : sourceUnitKind(element),
        source,
        sourcePath: path,
        startLine: resolved[index].start,
        endLine: resolved[index].end,
      }) satisfies SourceMappedSelectionUnit,
  );
}

function sourceUnitKind(
  element: HTMLElement,
): SourceMappedSelectionUnit["kind"] {
  if (/^H[1-6]$/u.test(element.tagName)) return "heading";
  if (element.matches("ul,ol")) return "list";
  if (element.matches("table")) return "table";
  if (element.matches(".diagram-slot,.diagram-inline")) return "diagram";
  return "paragraph";
}

function lineRange(start: number, end: number) {
  return start === end ? `${start}` : `${start}-${end}`;
}

function sourceUnitCandidates(pane: HTMLElement) {
  const all = Array.from(
    pane.querySelectorAll<HTMLElement>(
      "h1,h2,h3,h4,h5,h6,p,.source-block-frame,pre[data-source-selection-start],ul,ol,table,.diagram-slot,.diagram-inline,.diagram-inline-image,.diagram-inline-diagnostic,blockquote,dl,.dlist,.admonitionblock,.admonition,.markdown-alert,.imageblock,img",
    ),
  );
  return all.filter(
    (element) =>
      !all.some((other) => other !== element && other.contains(element)),
  );
}

function selectionUnitElement(node: Node) {
  const element =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as HTMLElement)
      : node.parentElement;
  const unit = element?.closest<HTMLElement>(
    "h1,h2,h3,h4,h5,h6,p,.source-block-frame,pre[data-source-selection-start],ul,ol,table,.diagram-slot,.diagram-inline,.diagram-inline-image,.diagram-inline-diagnostic,blockquote,dl,.dlist,.admonitionblock,.admonition,.markdown-alert,.imageblock,img",
  );
  return unit?.closest<HTMLElement>(".source-block-frame") ?? unit ?? null;
}

function isUnsupportedSourceUnit(element: HTMLElement) {
  if (
    element.closest(
      ".source-block-collapsed,.admonitionblock,.admonition,.markdown-alert,.imageblock,.diagram-inline-image",
    )
  ) {
    return true;
  }
  if (element.matches("ul,ol")) {
    return Boolean(element.querySelector("ul,ol,dl,[type='checkbox']"));
  }
  return false;
}

function normalizePath(path: string) {
  return path.replace(/\\/g, "/");
}
