import { classifyCodexContextPath } from "../../core/codexContextPath";
import { fixtureDocuments } from "../../core/fixtures";
import type {
  CodexContextFile,
  CodexContextFileLoadInput,
  CodexContextSearchInput,
  CodexContextSearchItem,
  HostAdapter,
} from "../../core/types";

type MockCodexContextFacade = Pick<
  HostAdapter,
  | "loadCodexContextFile"
  | "pickCodexContextFiles"
  | "resolveDroppedCodexContextPath"
  | "searchCodexContextFiles"
>;

interface MockCodexFileOverride {
  source: string;
  updatedAt?: string;
}

const syntheticCodeFiles: Record<string, string> = {
  "/workspace/src/config.ts": [
    "export interface LocalRenderConfig {",
    "  remoteFallback: boolean;",
    "}",
    "",
    "export const defaultConfig: LocalRenderConfig = {",
    "  remoteFallback: false,",
    "};",
  ].join("\n"),
};

let nextMockContextId = 1;

function mockOverrides(): Record<string, MockCodexFileOverride> {
  if (typeof window === "undefined") {
    return {};
  }
  return (
    (
      window as unknown as {
        __SVARD_CODEX_CONTEXT_FILES__?: Record<string, MockCodexFileOverride>;
      }
    ).__SVARD_CODEX_CONTEXT_FILES__ ?? {}
  );
}

function mockSource(path: string): MockCodexFileOverride | null {
  const override = mockOverrides()[path];
  if (override) {
    return override;
  }
  const source = syntheticCodeFiles[path] ?? fixtureDocuments[path];
  return source === undefined ? null : { source };
}

function displayLabel(path: string, workspaceRoot?: string | null): string {
  const normalizedRoot = workspaceRoot?.replace(/[\\/]+$/u, "");
  if (
    normalizedRoot &&
    (path === normalizedRoot || path.startsWith(`${normalizedRoot}/`))
  ) {
    return path.slice(normalizedRoot.length).replace(/^[/\\]+/u, "");
  }
  return path.replaceAll("\\", "/").split("/").at(-1) ?? path;
}

function nextContextId(): string {
  const contextId = `mock-context-${nextMockContextId}`;
  nextMockContextId += 1;
  return contextId;
}

function workspaceRootForSelectedPath(
  path: string,
  workspaceRoot?: string | null,
): string | null {
  if (!workspaceRoot) {
    return null;
  }
  const normalizedRoot = workspaceRoot.replace(/[\\/]+$/u, "");
  return path === normalizedRoot || path.startsWith(`${normalizedRoot}/`)
    ? workspaceRoot
    : null;
}

async function loadCodexContextFile(
  input: CodexContextFileLoadInput,
): Promise<CodexContextFile> {
  const classification = classifyCodexContextPath(input.path);
  if (!classification) {
    throw new Error("This file type cannot be shared with Codex.");
  }
  const file = mockSource(input.path);
  if (!file) {
    throw new Error("The selected file is not available.");
  }
  if (file.source.includes("\0")) {
    throw new Error("Binary files cannot be shared with Codex.");
  }
  const byteLength = new TextEncoder().encode(file.source).byteLength;
  if (byteLength > 256 * 1024) {
    throw new Error("The selected file exceeds the 256 KiB limit.");
  }
  return {
    contextId: input.contextId,
    path: input.path,
    displayLabel: displayLabel(input.path, input.workspaceRoot),
    ...classification,
    source: file.source,
    byteLength,
    updatedAt:
      file.updatedAt ?? new Date("2026-07-24T00:00:00.000Z").toISOString(),
  };
}

async function pickCodexContextFiles(
  workspaceRoot?: string | null,
): Promise<CodexContextFile[]> {
  let paths = ["/workspace/docs/git-modified.md"];
  if (typeof window !== "undefined") {
    const target = window as unknown as {
      __SVARD_PICK_CODEX_CONTEXT_FILES__?: string[];
    };
    if (target.__SVARD_PICK_CODEX_CONTEXT_FILES__) {
      paths = target.__SVARD_PICK_CODEX_CONTEXT_FILES__;
      target.__SVARD_PICK_CODEX_CONTEXT_FILES__ = undefined;
    }
  }
  return Promise.all(
    paths.map((path) =>
      loadCodexContextFile({
        path,
        workspaceRoot: workspaceRootForSelectedPath(path, workspaceRoot),
        contextId: nextContextId(),
      }),
    ),
  );
}

async function searchCodexContextFiles(
  input: CodexContextSearchInput,
): Promise<CodexContextSearchItem[]> {
  const query = input.query.trim().toLocaleLowerCase();
  const root = input.workspaceRoot.replace(/[\\/]+$/u, "");
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 100);
  const paths = [
    ...new Set([
      ...Object.keys(fixtureDocuments),
      ...Object.keys(syntheticCodeFiles),
      ...Object.keys(mockOverrides()),
    ]),
  ];

  const results: CodexContextSearchItem[] = [];
  for (const path of paths.sort()) {
    if (path !== root && !path.startsWith(`${root}/`)) {
      continue;
    }
    const classification = classifyCodexContextPath(path);
    const file = mockSource(path);
    const label = displayLabel(path, root);
    if (
      !classification ||
      !file ||
      (query && !label.toLocaleLowerCase().includes(query))
    ) {
      continue;
    }
    results.push({
      path,
      displayLabel: label,
      ...classification,
      byteLength: new TextEncoder().encode(file.source).byteLength,
    });
    if (results.length === limit) {
      break;
    }
  }
  return results;
}

async function resolveDroppedCodexContextPath(path: string): Promise<string> {
  if (!classifyCodexContextPath(path)) {
    throw new Error("This file type cannot be shared with Codex.");
  }
  return path;
}

export function createMockCodexContextFacade(): MockCodexContextFacade {
  return {
    loadCodexContextFile,
    pickCodexContextFiles,
    resolveDroppedCodexContextPath,
    searchCodexContextFiles,
  };
}
