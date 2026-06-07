import type { DocumentPayload, Heading } from "../../core/types";

export function sectionSourceForHeading({
  documentPayload,
  headingId,
  headings,
}: {
  documentPayload: DocumentPayload;
  headingId: string;
  headings: Heading[];
}): string | null {
  const headingIndex = headings.findIndex(
    (heading) => heading.id === headingId,
  );
  const heading = headings[headingIndex];
  const startLine = heading?.sourceLocation?.line;
  if (!heading || !startLine || startLine < 1) {
    return null;
  }
  if (!isCurrentDocumentSource(heading, documentPayload.path)) {
    return null;
  }

  const nextHeading = headings
    .slice(headingIndex + 1)
    .find(
      (candidate) =>
        candidate.level <= heading.level &&
        candidate.sourceLocation?.line &&
        candidate.sourceLocation.line > startLine &&
        isCurrentDocumentSource(candidate, documentPayload.path),
    );
  const lines = documentPayload.source.split(/\r?\n/u);
  const endLineExclusive =
    nextHeading?.sourceLocation?.line ?? lines.length + 1;
  const section = lines.slice(startLine - 1, endLineExclusive - 1).join("\n");
  return section.trim() ? section : null;
}

function isCurrentDocumentSource(heading: Heading, documentPath: string) {
  const sourcePath = heading.sourceLocation?.sourcePath;
  return !sourcePath || sourcePath === documentPath;
}
