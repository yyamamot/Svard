import { isSupportedDocumentPath } from "./documentFormat";
import { fixtureDocuments } from "./fixtures";
import type {
  WorkspaceSearchInput,
  WorkspaceSearchResult,
  WorkspaceSearchResultItem,
} from "./types";

export const defaultWorkspaceSearchLimits = {
  maxFiles: 500,
  maxMatches: 100,
  maxBytesPerFile: 1_048_576,
} as const;

const excludedDirectoryNames = new Set([
  ".artifacts",
  ".codegraph",
  ".git",
  "dist",
  "node_modules",
  "playwright-report",
  "target",
  "test-results",
]);

export function isWorkspaceSearchExcludedPath(path: string): boolean {
  return path.split(/[\\/]/u).some((part) => excludedDirectoryNames.has(part));
}

export function workspaceSearchDisplayPath(path: string, rootPath: string) {
  const normalizedRoot = rootPath.replace(/[\\/]+$/u, "");
  const prefix = `${normalizedRoot}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

export function searchWorkspaceDocuments(
  documents: Record<string, string>,
  input: WorkspaceSearchInput,
): WorkspaceSearchResult {
  const query = input.query.trim();
  if (!query) {
    return {
      status: "empty",
      rootPath: input.rootPath,
      query: input.query,
      results: [],
      totalMatches: 0,
      searchedFiles: 0,
      skippedFiles: 0,
      capped: false,
      message: "No search query",
    };
  }

  const queryLower = query.toLowerCase();
  const rootPrefix = input.rootPath.replace(/[\\/]+$/u, "");
  const results: WorkspaceSearchResultItem[] = [];
  let searchedFiles = 0;
  let skippedFiles = 0;
  let totalMatches = 0;
  let capped = false;

  for (const path of Object.keys(documents).sort()) {
    if (searchedFiles >= input.maxFiles || results.length >= input.maxMatches) {
      capped = true;
      break;
    }
    if (
      !(path === rootPrefix || path.startsWith(`${rootPrefix}/`)) ||
      !isSupportedDocumentPath(path) ||
      isWorkspaceSearchExcludedPath(path)
    ) {
      skippedFiles += 1;
      continue;
    }
    const source = documents[path] ?? "";
    if (source.length > input.maxBytesPerFile) {
      skippedFiles += 1;
      continue;
    }
    searchedFiles += 1;

    const fileMatches = searchDocument(path, source, queryLower, query, input);
    if (fileMatches.length === 0) {
      continue;
    }
    totalMatches += fileMatches.reduce((sum, item) => sum + item.matchCount, 0);
    for (const item of fileMatches) {
      if (results.length >= input.maxMatches) {
        capped = true;
        break;
      }
      results.push({
        ...item,
        displayPath: workspaceSearchDisplayPath(path, input.rootPath),
      });
    }
  }

  return {
    status: "ok",
    rootPath: input.rootPath,
    query,
    results,
    totalMatches,
    searchedFiles,
    skippedFiles,
    capped,
    message: results.length === 0 ? "No matches" : null,
  };
}

export function searchMockWorkspace(
  input: WorkspaceSearchInput,
): WorkspaceSearchResult {
  return searchWorkspaceDocuments(fixtureDocuments, input);
}

function searchDocument(
  path: string,
  source: string,
  queryLower: string,
  query: string,
  input: WorkspaceSearchInput,
) {
  const results: Omit<WorkspaceSearchResultItem, "displayPath">[] = [];
  const lines = source.split(/\r?\n/u);
  let heading: string | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const parsedHeading = headingText(line);
    if (parsedHeading) {
      heading = parsedHeading;
    }
    const matchCount = countMatches(line.toLowerCase(), queryLower);
    if (matchCount === 0) {
      continue;
    }
    results.push({
      path,
      line: index + 1,
      heading,
      snippet: buildSnippet(line, query),
      matchCount,
      sourceReference: `${path}:${index + 1}`,
    });
    if (results.length >= input.maxMatches) {
      break;
    }
  }
  return results;
}

function countMatches(value: string, query: string) {
  if (!query) {
    return 0;
  }
  let count = 0;
  let offset = 0;
  while (offset < value.length) {
    const index = value.indexOf(query, offset);
    if (index < 0) {
      break;
    }
    count += 1;
    offset = index + query.length;
  }
  return count;
}

function buildSnippet(line: string, query: string) {
  const compact = line.replace(/\s+/gu, " ").trim();
  if (compact.length <= 120) {
    return compact;
  }
  const hitIndex = compact.toLowerCase().indexOf(query.toLowerCase());
  if (hitIndex < 0) {
    return `${compact.slice(0, 120)}...`;
  }
  const start = Math.max(0, hitIndex - 42);
  const end = Math.min(compact.length, hitIndex + query.length + 64);
  return `${start > 0 ? "..." : ""}${compact.slice(start, end)}${end < compact.length ? "..." : ""}`;
}

function headingText(line: string) {
  const markdown = line.match(/^#{1,6}\s+(.+)$/u);
  if (markdown) {
    return markdown[1]?.trim() ?? null;
  }
  const asciidoc = line.match(/^={1,6}\s+(.+)$/u);
  if (asciidoc) {
    return asciidoc[1]?.trim() ?? null;
  }
  return null;
}
