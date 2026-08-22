import type { SourceLocation } from "../types";

export function sourceLocationForToken(
  token: { map: [number, number] | null },
  lineOffset = 0,
) {
  if (!token.map) {
    return undefined;
  }

  return { line: token.map[0] + lineOffset + 1, column: 1 };
}

export function slugifyHeading(
  text: string,
  used: Map<string, number>,
): string {
  const normalized =
    text
      .normalize("NFKC")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\p{Letter}\p{Number}_-]+/gu, "")
      .replace(/^-+|-+$/g, "") || "heading";
  const base = normalized.startsWith("svard-")
    ? `heading-${normalized}`
    : normalized;
  const count = used.get(base) ?? 0;
  used.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}

export function fallbackSourceLocation(): SourceLocation {
  return { line: 1, column: 1 };
}
