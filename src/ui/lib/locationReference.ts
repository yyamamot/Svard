import type { DocumentPayload, Heading, RenderResult } from "../../core/types";

export interface LocationReferenceRevision {
  label: string;
  side: "left" | "right";
}

export interface LocationReferenceTarget {
  article: HTMLElement | null;
  document: DocumentPayload;
  element?: HTMLElement | null;
  heading?: Heading | null;
  text?: string;
  sourceReference?: string | null;
  targetLabel?: string | null;
  section?: string;
  renderResult?: Pick<RenderResult, "headings"> | null;
  revision?: LocationReferenceRevision | null;
}

interface SourceLocationReference {
  path: string;
  line: number;
  column?: number;
}

export function buildLocationReference({
  article,
  document,
  element,
  heading: explicitHeading,
  text,
  sourceReference,
  targetLabel,
  section: explicitSection,
  renderResult,
  revision,
}: LocationReferenceTarget): string | undefined {
  const source = sourceLocationForElement(element, sourceReference);
  const hasLocation = Boolean(text || source || targetLabel);
  if (!hasLocation) {
    return undefined;
  }

  const lines = [
    `File: ${source ? formatSourceLocation(source) : document.path}`,
  ];
  if (revision) {
    lines.push(`Revision: ${revision.label} (${revision.side})`);
  }
  const section = explicitSection ?? (explicitHeading
    ? sectionLabel(explicitHeading, renderResult?.headings)
    : sectionLabelForElement(article, element, renderResult?.headings));
  if (section) {
    lines.push(`Section: ${section}`);
  }
  if (text ?? targetLabel) {
    lines.push("Text:", text ?? targetLabel!);
  }
  return lines.join("\n");
}

export function locationReferenceForSelection({
  article,
  document,
  renderResult,
  selection,
  sourceReference: explicitSourceReference,
  revision,
}: {
  article: HTMLElement | null;
  document: DocumentPayload;
  renderResult?: Pick<RenderResult, "headings"> | null;
  selection: string;
  sourceReference?: string;
  revision?: LocationReferenceRevision | null;
}): string | undefined {
  const range = window.getSelection()?.rangeCount
    ? window.getSelection()?.getRangeAt(0)
    : null;
  const sourceElement = range ? sharedSourceElement(range, article) : null;
  const anchorElement = range
    ? elementForNode(range.commonAncestorContainer)
    : null;
  return buildLocationReference({
    article,
    document,
    element: anchorElement,
    text: selection,
    sourceReference:
      explicitSourceReference ??
      sourceElement?.getAttribute("data-source-reference") ??
      undefined,
    renderResult,
    revision,
    section: range
      ? sectionLabelForRange({
          article,
          range,
          headings: renderResult?.headings,
        })
      : undefined,
  });
}

export function locationReferenceForElement({
  article,
  document,
  element,
  renderResult,
  targetLabel,
  revision,
}: Omit<LocationReferenceTarget, "heading" | "selection" | "sourceReference">):
  | string
  | undefined {
  return buildLocationReference({
    article,
    document,
    element,
    sourceReference:
      element
        ?.closest<HTMLElement>("[data-source-reference]")
        ?.getAttribute("data-source-reference") ?? undefined,
    renderResult,
    text: textForElement(element, targetLabel),
    revision,
  });
}

export function locationReferenceForHeading({
  document,
  heading,
  renderResult,
}: {
  document: DocumentPayload;
  heading: Heading;
  renderResult?: Pick<RenderResult, "headings"> | null;
}): string {
  return buildLocationReference({
    article: null,
    document,
    heading,
    sourceReference: sourceReferenceForHeading(document, heading),
    renderResult,
    text: heading.text,
  })!;
}

export function sectionLabelForRange({
  article,
  range,
  headings,
}: {
  article: HTMLElement | null;
  range: Range;
  headings?: Heading[];
}): string | undefined {
  const start = headingElementFor(article, elementForNode(range.startContainer));
  const end = headingElementFor(article, elementForNode(range.endContainer));
  if (!start || start !== end) return undefined;
  return sectionLabelForHeadingElement(article, start, headings);
}

export function sectionLabelForElement(
  article: HTMLElement | null,
  element: HTMLElement | null | undefined,
  headings?: Heading[],
): string | undefined {
  const heading = headingElementFor(article, element);
  return heading ? sectionLabelForHeadingElement(article, heading, headings) : undefined;
}

export function isLocationReferenceTarget(element: HTMLElement): boolean {
  return Boolean(element.closest("[data-source-reference],h1,h2,h3,h4,h5,h6"));
}

export function locationReferenceTargetLabel(
  element: HTMLElement,
): string | null {
  if (element.closest(".source-block-frame")) {
    return "Source block";
  }
  if (element.closest("table")) {
    return "Table";
  }
  if (
    element.closest(
      ".diagram-inline-image,.diagram-inline-diagnostic,[data-review-id='diagram-inline-image']",
    )
  ) {
    return "Diagram";
  }
  return null;
}

function sourceReferenceForHeading(
  document: DocumentPayload,
  heading: Heading,
) {
  if (!heading.sourceLocation?.line) {
    return document.path;
  }
  return `${heading.sourceLocation.sourcePath ?? document.path}:${heading.sourceLocation.line}${heading.sourceLocation.column ? `:${heading.sourceLocation.column}` : ""}`;
}

function sourceLocationForElement(
  element: HTMLElement | null | undefined,
  sourceReference: string | null | undefined,
): SourceLocationReference | null {
  const reference = sourceReference ?? undefined;
  if (!reference) {
    return null;
  }
  const trimmed = reference.replace(/#.*$/u, "");
  const match = /^(.*?):(\d+)(?::(\d+))?$/u.exec(trimmed);
  if (!match) {
    return null;
  }
  const line = Number(match[2]);
  const column = Number(
    element
      ?.closest<HTMLElement>("[data-source-column]")
      ?.getAttribute("data-source-column") ?? match[3],
  );
  return {
    path: match[1],
    line,
    ...(Number.isFinite(column) && column > 0 ? { column } : {}),
  };
}

function nearestHeading(
  article: HTMLElement | null,
  element: HTMLElement | null | undefined,
  headings?: Heading[],
): Heading | null {
  if (!article || !element) {
    return null;
  }
  const candidates = Array.from(
    article.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6"),
  );
  const closest = candidates
    .filter(
      (candidate) =>
        candidate.contains(element) ||
        Boolean(
          candidate.compareDocumentPosition(element) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        ),
    )
    .at(-1);
  if (!closest?.id) {
    return null;
  }
  return (
    headings?.find((heading) => heading.id === closest.id) ?? {
      id: closest.id,
      level: Number(closest.tagName.slice(1)),
      text: closest.textContent?.trim() ?? closest.id,
    }
  );
}

function headingElementFor(
  article: HTMLElement | null,
  element: HTMLElement | null | undefined,
) {
  if (!article || !element) return null;
  return (
    Array.from(article.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6"))
      .filter(
        (candidate) =>
          candidate.contains(element) ||
          Boolean(
            candidate.compareDocumentPosition(element) &
              Node.DOCUMENT_POSITION_FOLLOWING,
          ),
      )
      .at(-1) ?? null
  );
}

function sectionLabelForHeadingElement(
  article: HTMLElement | null,
  element: HTMLElement,
  headings?: Heading[],
) {
  const rendered = headings?.find((heading) => heading.id === element.id);
  if (rendered) return sectionLabel(rendered, headings);
  const elements = article
    ? Array.from(article.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6"))
    : [];
  const index = elements.indexOf(element);
  if (index < 0) return undefined;
  const domHeadings = elements.map((candidate, candidateIndex) => ({
    id: candidate.id || `dom-heading-${candidateIndex}`,
    level: Number(candidate.tagName.slice(1)),
    text: candidate.textContent?.trim() || `Section ${candidateIndex + 1}`,
  }));
  return sectionLabel(domHeadings[index], domHeadings);
}

function sectionLabel(heading: Heading, headings?: Heading[]) {
  const headingList = headings ?? [];
  if (headingList.length === 0) {
    return heading.text;
  }
  const index = headingList.findIndex((item) => item.id === heading.id);
  if (index < 0) {
    return heading.text;
  }
  const stack: Heading[] = [];
  for (const candidate of headingList.slice(0, index + 1)) {
    while (true) {
      const parent = stack.at(-1);
      if (!parent || parent.level < candidate.level) {
        break;
      }
      stack.pop();
    }
    stack.push(candidate);
  }
  return stack.map((item) => item.text).join(" > ");
}

function sharedSourceElement(range: Range, article: HTMLElement | null) {
  const start = elementForNode(range.startContainer)?.closest<HTMLElement>(
    "[data-source-reference]",
  );
  const end = elementForNode(range.endContainer)?.closest<HTMLElement>(
    "[data-source-reference]",
  );
  if (!start || start !== end || !article?.contains(start)) {
    return null;
  }
  return start;
}

function elementForNode(node: Node): HTMLElement | null {
  return node instanceof HTMLElement ? node : node.parentElement;
}

function formatSourceLocation(source: SourceLocationReference) {
  return `${source.path}:${source.line}`;
}

function textForElement(element: HTMLElement | null | undefined, fallback?: string | null) {
  const source = element?.closest<HTMLElement>(".source-block-frame")?.querySelector("pre");
  if (source?.textContent?.trim()) {
    return source.textContent.trim();
  }
  const heading = element?.closest<HTMLElement>("h1,h2,h3,h4,h5,h6");
  if (heading?.textContent?.trim()) {
    return heading.textContent.trim();
  }
  const table = element?.closest<HTMLTableElement>("table");
  if (table?.textContent?.trim()) {
    return table.textContent.trim();
  }
  return fallback ?? undefined;
}
