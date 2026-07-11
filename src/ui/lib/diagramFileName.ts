export function diagramSvgFileName({
  documentPath,
  diagramType,
  sourceReference,
}: {
  documentPath: string | null | undefined;
  diagramType: string | null | undefined;
  sourceReference: string | null | undefined;
}): string {
  const stem = (documentPath?.split(/[\\/]/u).at(-1) ?? "diagram")
    .replace(/\.[^.]+$/u, "")
    .replace(/[^A-Za-z0-9._-]+/gu, "-");
  const type = (diagramType ?? "diagram").replace(/[^A-Za-z0-9._-]+/gu, "-");
  const line = sourceReference?.match(/:(\d+)(?:#.*)?$/u)?.[1];
  return [stem, type, line].filter(Boolean).join("-") + ".svg";
}
