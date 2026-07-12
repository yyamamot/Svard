import type {
  DocumentPayload,
  RenderResult,
  SourceSelectionBlock,
} from "../../core/types";
import { sectionLabelForRange } from "./locationReference";
import {
  groupSourceSelectionSlices,
  sourceSlicesForRange,
  type SourceMappedSelectionUnit,
} from "./selectionSourceSlice";

export function originalTextReferenceForSelection({
  article,
  document,
  renderResult,
}: {
  article: HTMLElement | null;
  document: DocumentPayload;
  renderResult:
    | (Pick<RenderResult, "sourceTextBlocks"> &
        Partial<
          Pick<
            RenderResult,
            "sourceBlocks" | "sourceSelectionBlocks" | "headings"
          >
        >)
    | null
    | undefined;
}) {
  const selection = window.getSelection();
  if (!article || !selection?.rangeCount || selection.isCollapsed) {
    return undefined;
  }
  const range = selection.getRangeAt(0);
  const section = sectionLabelForRange({
    article,
    range,
    headings: renderResult?.headings,
  });
  const expanded = sourceSelectionReferenceForRange(
    range,
    article,
    document,
    renderResult,
    section,
  );
  if (expanded) return { value: expanded.value };
  const units = sourceUnitsForSelection(range, article, document, renderResult);
  if (!units) return undefined;
  const reference = referenceForMappedUnits(range, units, section);
  return reference ? { value: reference.value } : undefined;
}

export function sourceReferenceForSelection({
  article,
  document,
  renderResult,
}: Parameters<typeof originalTextReferenceForSelection>[0]) {
  const selection = window.getSelection();
  if (!article || !selection?.rangeCount || selection.isCollapsed)
    return undefined;
  const range = selection.getRangeAt(0);
  const mapped = sourceSelectionStartForRange(
    range,
    article,
    document,
    renderResult,
  );
  if (mapped) return `${mapped.sourcePath}:${mapped.startLine}`;
  const units = sourceUnitsForSelection(range, article, document, renderResult);
  const first = units?.[0];
  return first ? `${first.sourcePath}:${first.startLine}` : undefined;
}

function sourceSelectionStartForRange(
  range: Range,
  article: HTMLElement,
  document: DocumentPayload,
  renderResult:
    | Partial<Pick<RenderResult, "sourceSelectionBlocks">>
    | null
    | undefined,
) {
  const blocks = renderResult?.sourceSelectionBlocks;
  if (!blocks?.length) return undefined;
  const candidates = selectionCandidates(article);
  const start = selectionBlockElement(range.startContainer);
  const end = selectionBlockElement(range.endContainer);
  const startIndex = start ? candidates.indexOf(start) : -1;
  const endIndex = end ? candidates.indexOf(end) : -1;
  if (startIndex < 0 || endIndex < startIndex) return undefined;
  const selected = candidates
    .slice(startIndex, endIndex + 1)
    .map((element) => selectionBlockForElement(element, candidates, blocks));
  if (selected.some((block) => !block)) return undefined;
  const first = selected[0]!;
  return {
    sourcePath: first.sourceLocation?.sourcePath ?? document.path,
    startLine: first.startLine,
  };
}

function sourceSelectionReferenceForRange(
  range: Range,
  article: HTMLElement,
  document: DocumentPayload,
  renderResult:
    | Partial<Pick<RenderResult, "sourceSelectionBlocks">>
    | null
    | undefined,
  section?: string,
) {
  const blocks = renderResult?.sourceSelectionBlocks;
  if (!blocks?.length) return undefined;
  const candidates = selectionCandidates(article);
  const start = selectionBlockElement(range.startContainer);
  const end = selectionBlockElement(range.endContainer);
  const startIndex = start ? candidates.indexOf(start) : -1;
  const endIndex = end ? candidates.indexOf(end) : -1;
  if (startIndex < 0 || endIndex < startIndex) return undefined;
  const elements = candidates.slice(startIndex, endIndex + 1);
  const selected = elements.map((element) =>
    selectionBlockForElement(element, candidates, blocks),
  );
  if (selected.some((block) => !block)) return undefined;
  const units = (selected as SourceSelectionBlock[]).map((block, index) => {
    const path = block.sourceLocation?.sourcePath ?? document.path;
    const source = sourceForBlock(document, path);
    if (!source) return undefined;
    return {
      element: elements[index],
      kind: block.kind,
      source,
      sourcePath: path,
      startLine: block.startLine,
      endLine: block.endLine,
    } satisfies SourceMappedSelectionUnit;
  });
  if (units.some((unit) => !unit)) return undefined;
  return referenceForMappedUnits(
    range,
    units as SourceMappedSelectionUnit[],
    section,
  );
}

function referenceForMappedUnits(
  range: Range,
  units: SourceMappedSelectionUnit[],
  section?: string,
) {
  const slices = sourceSlicesForRange(range, units);
  if (!slices) return undefined;
  const fragments = groupSourceSelectionSlices(slices);
  return {
    value: fragments
      .map(
        (fragment) =>
          `File: ${fragment.sourcePath}:${lineRange(fragment.startLine, fragment.endLine)}${section ? `\nSection: ${section}` : ""}\nOriginal text:\n${fragment.text}`,
      )
      .join("\n\n"),
    sourceReference: `${fragments[0].sourcePath}:${fragments[0].startLine}`,
  };
}

function lineRange(startLine: number, endLine: number) {
  return startLine === endLine ? `${startLine}` : `${startLine}-${endLine}`;
}

function selectionCandidates(article: HTMLElement) {
  const all = Array.from(
    article.querySelectorAll<HTMLElement>(
      "h1,h2,h3,h4,h5,h6,p,.source-block-frame,pre[data-source-selection-block-id],ul,ol,table,.diagram-slot,.diagram-inline,.diagram-inline-image,.diagram-inline-diagnostic,blockquote,dl,.dlist,.admonitionblock,.admonition,.markdown-alert,.imageblock,img",
    ),
  );
  return all.filter(
    (element) =>
      !all.some((other) => other !== element && other.contains(element)),
  );
}

function selectionBlockElement(node: Node) {
  const element =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as HTMLElement)
      : node.parentElement;
  const unit = element?.closest<HTMLElement>(
    "h1,h2,h3,h4,h5,h6,p,.source-block-frame,pre[data-source-selection-block-id],ul,ol,table,.diagram-slot,.diagram-inline,.diagram-inline-image,.diagram-inline-diagnostic,blockquote,dl,.dlist,.admonitionblock,.admonition,.markdown-alert,.imageblock,img",
  );
  return unit?.closest<HTMLElement>(".source-block-frame") ?? unit ?? null;
}

function selectionBlockForElement(
  element: HTMLElement,
  candidates: HTMLElement[],
  blocks: SourceSelectionBlock[],
) {
  if (element.closest(".source-block-collapsed,.admonitionblock,.admonition"))
    return undefined;
  const id = element.getAttribute("data-source-selection-block-id");
  if (id) return blocks.find((block) => block.id === id);
  if (
    !element.matches(
      ".diagram-slot,.diagram-inline,.diagram-inline-image,.diagram-inline-diagnostic",
    )
  )
    return undefined;
  const diagrams = candidates.filter((candidate) =>
    candidate.matches(
      ".diagram-slot,.diagram-inline,.diagram-inline-image,.diagram-inline-diagnostic",
    ),
  );
  const index = diagrams.indexOf(element);
  return index < 0
    ? undefined
    : blocks.filter((block) => block.kind === "diagram")[index];
}

function sourceUnitsForSelection(
  range: Range,
  article: HTMLElement,
  document: DocumentPayload,
  renderResult:
    | (Pick<RenderResult, "sourceTextBlocks"> &
        Partial<Pick<RenderResult, "sourceBlocks" | "headings">>)
    | null
    | undefined,
) {
  const candidates = Array.from(
    article.querySelectorAll<HTMLElement>(
      "p,.source-block-frame pre,h1,h2,h3,h4,h5,h6,li,table,.diagram-inline-image,.diagram-inline-diagnostic,.admonitionblock,.admonition",
    ),
  );
  const start = sourceSelectionElement(range.startContainer);
  const end = sourceSelectionElement(range.endContainer);
  const startIndex = start ? candidates.indexOf(start) : -1;
  const endIndex = end ? candidates.indexOf(end) : -1;
  if (startIndex < 0 || endIndex < startIndex) return undefined;

  const units = candidates
    .slice(startIndex, endIndex + 1)
    .map((element) => sourceUnitForElement(element, document, renderResult));
  if (units.some((unit) => !unit)) return undefined;
  const resolved = units as SourceMappedSelectionUnit[];
  const sourcePath = normalizePath(resolved[0].sourcePath);
  if (
    resolved.some(
      (unit, index) =>
        normalizePath(unit.sourcePath) !== sourcePath ||
        (index > 0 && unit.startLine <= resolved[index - 1].endLine),
    )
  ) {
    return undefined;
  }
  return resolved;
}

function sourceUnitForElement(
  element: HTMLElement,
  document: DocumentPayload,
  renderResult:
    | (Pick<RenderResult, "sourceTextBlocks"> &
        Partial<Pick<RenderResult, "sourceBlocks">>)
    | null
    | undefined,
): SourceMappedSelectionUnit | undefined {
  if (element.matches("p")) {
    const id = element.getAttribute("data-source-text-block-id");
    const block = renderResult?.sourceTextBlocks?.find(
      (item) => item.id === id,
    );
    if (!block) return undefined;
    const sourcePath = block.sourceLocation?.sourcePath ?? document.path;
    if (!sourceForBlock(document, sourcePath)) return undefined;
    return {
      element,
      kind: "paragraph",
      source: sourceForBlock(document, sourcePath)!,
      sourcePath,
      startLine: block.startLine,
      endLine: block.endLine,
    };
  }
  if (
    !element.matches(".source-block-frame pre") ||
    element.closest(".source-block-collapsed")
  ) {
    return undefined;
  }
  const id = element.getAttribute("data-source-block-id");
  const block = renderResult?.sourceBlocks?.find((item) => item.id === id);
  const startLine = block?.sourceLocation?.line;
  if (!block || !startLine) return undefined;
  const sourcePath = block.sourceLocation?.sourcePath ?? document.path;
  const source = sourceForBlock(document, sourcePath);
  if (!source) return undefined;
  const endIndex = codeBlockEndIndex(
    source.split("\n"),
    startLine - 1,
    document.format,
  );
  if (endIndex === undefined) return undefined;
  return {
    element,
    kind: "code",
    source,
    sourcePath,
    startLine,
    endLine: endIndex + 1,
  };
}

function sourceSelectionElement(node: Node) {
  const element =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as HTMLElement)
      : node.parentElement;
  return element?.closest<HTMLElement>("p,.source-block-frame pre") ?? null;
}

function codeBlockEndIndex(
  lines: string[],
  start: number,
  format: DocumentPayload["format"],
) {
  if (format === "markdown") {
    const opener = /^(\s*)(`{3,}|~{3,})/.exec(lines[start] ?? "");
    if (!opener) return undefined;
    const marker = opener[2][0];
    const length = opener[2].length;
    for (let index = start + 1; index < lines.length; index += 1) {
      if (new RegExp(`^\\s*${marker}{${length},}\\s*$`).test(lines[index]))
        return index;
    }
    return undefined;
  }
  let openingDelimiter: number | undefined;
  for (let index = start; index < lines.length; index += 1) {
    if (!/^----\s*$/.test(lines[index])) continue;
    if (openingDelimiter === undefined) {
      openingDelimiter = index;
      continue;
    }
    return index;
  }
  return undefined;
}

function sourceForBlock(document: DocumentPayload, sourcePath?: string) {
  if (
    !sourcePath ||
    normalizePath(sourcePath) === normalizePath(document.path)
  ) {
    return document.source;
  }
  return document.includeFiles?.find(
    (file) => normalizePath(file.path) === normalizePath(sourcePath),
  )?.source;
}

function normalizePath(path: string) {
  return path.replace(/\\/g, "/");
}

/** @deprecated Internal compatibility helper for paragraph-source tests. */
export function sourceTextBlockForSelection(
  args: Parameters<typeof originalTextReferenceForSelection>[0],
) {
  return originalTextReferenceForSelection(args)?.value.replace(
    /^File: .*(?:\nSection: .*)?\nOriginal text:\n/u,
    "",
  );
}
