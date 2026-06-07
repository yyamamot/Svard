import { fixtureEntriesByDirectory } from "../core/fixtures";

export function normalizeMockPath(path: string): string {
  const absolute = path.startsWith("/");
  const segments: string[] = [];
  for (const segment of path.split("/")) {
    if (!segment || segment === ".") {
      continue;
    }
    if (segment === "..") {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return `${absolute ? "/" : ""}${segments.join("/")}`;
}

export function dirname(path: string): string {
  const index = path.lastIndexOf("/");
  if (index <= 0) {
    return path.startsWith("/") ? "/" : "";
  }
  return path.slice(0, index);
}

export function resolveMockLocalImagePath(
  source: string,
  documentPath: string,
) {
  if (source.startsWith("/")) {
    return normalizeMockPath(source);
  }
  return normalizeMockPath(`${dirname(documentPath)}/${source}`);
}

export function resolveMockDocumentLinkPath(
  source: string,
  documentPath: string,
) {
  const [pathPart] = source.split("#", 1);
  if (pathPart.startsWith("/")) {
    return normalizeMockPath(pathPart);
  }
  return normalizeMockPath(`${dirname(documentPath)}/${pathPart}`);
}

export function isMockDirectory(path: string): boolean {
  return Boolean(fixtureEntriesByDirectory[path]);
}

export function isMockPathInsideRoot(path: string, root: string): boolean {
  const normalizedPath = normalizeMockPath(path);
  const normalizedRoot = normalizeMockPath(root).replace(/\/$/u, "");
  return (
    normalizedPath === normalizedRoot ||
    normalizedPath.startsWith(`${normalizedRoot}/`)
  );
}

export function mockDirectoryAncestors(path: string, root: string): string[] {
  const ancestors: string[] = [];
  let current = dirname(path);
  while (current && current !== "/" && isMockPathInsideRoot(current, root)) {
    if (current !== root && isMockDirectory(current)) {
      ancestors.unshift(current);
    }
    current = dirname(current);
  }
  return ancestors;
}
