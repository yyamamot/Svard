import { isSupportedDocumentPath } from "../../core/documentFormat";

export function normalizeRevealPath(path: string): string {
  return path.replace(/\\/gu, "/").replace(/\/+$/u, "") || "/";
}

/** Return every descendant through the file, with segment-safe containment. */
export function fileTreeRevealPaths(
  root: string,
  path?: string,
): string[] | null {
  if (!root || !path || !isSupportedDocumentPath(path)) return null;
  const normalizedRoot = normalizeRevealPath(root);
  const normalizedPath = normalizeRevealPath(path);
  if (!/^(?:\/|[a-z]:\/)/iu.test(root.replace(/\\/gu, "/"))) return null;
  if (
    [normalizedRoot, normalizedPath].some((value) =>
      value.split("/").some((part) => part === "." || part === ".."),
    )
  )
    return null;
  const prefix = normalizedRoot === "/" ? "/" : `${normalizedRoot}/`;
  if (!normalizedPath.startsWith(prefix)) return null;
  const parts = normalizedPath.slice(prefix.length).split("/");
  if (parts.some((part) => !part)) return null;
  return parts.map((_, index) => prefix + parts.slice(0, index + 1).join("/"));
}
