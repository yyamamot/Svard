import { pathBasename } from "./pathDisplay";

export type OpenFilesFilterMode = "substring" | "glob";

export interface OpenFilesFilterTarget {
  path: string;
}

export function getOpenFilesFilterMode(value: string): OpenFilesFilterMode {
  return /[*?]/u.test(value.trim()) ? "glob" : "substring";
}

export function matchesOpenFilesFilter(
  path: string,
  filterValue: string,
): boolean {
  const query = filterValue.trim();
  if (!query) {
    return true;
  }

  const name = fileNameFromPath(path);
  const normalizedPath = path.replace(/\\/gu, "/");
  if (getOpenFilesFilterMode(query) === "glob") {
    const pattern = globLikePatternToRegExp(query);
    return (
      pattern.test(name) || pattern.test(path) || pattern.test(normalizedPath)
    );
  }

  const normalizedQuery = query.toLowerCase();
  const normalizedPathForSearch = normalizedPath.toLowerCase();
  return (
    name.toLowerCase().includes(normalizedQuery) ||
    path.toLowerCase().includes(normalizedQuery) ||
    normalizedPathForSearch.includes(normalizedQuery)
  );
}

export function filterOpenFiles<T extends OpenFilesFilterTarget>(
  targets: T[],
  filterValue: string,
): T[] {
  return targets.filter((target) =>
    matchesOpenFilesFilter(target.path, filterValue),
  );
}

function globLikePatternToRegExp(value: string): RegExp {
  let source = "";
  for (const character of value) {
    if (character === "*") {
      source += ".*";
    } else if (character === "?") {
      source += ".";
    } else {
      source += escapeRegExp(character);
    }
  }
  return new RegExp(source, "iu");
}

function escapeRegExp(value: string): string {
  return value.replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&");
}

function fileNameFromPath(path: string): string {
  return pathBasename(path);
}
