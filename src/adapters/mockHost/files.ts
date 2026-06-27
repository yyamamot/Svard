import { defaultConfig } from "../../core/defaultConfig";
import { buildFileDocumentDiffPreview } from "../../core/documentDiff";
import {
  documentFormatForPath,
  isSupportedDocumentPath,
} from "../../core/documentFormat";
import { isSafeExternalUrlToOpen } from "../../ui/lib/path";
import {
  fixtureDocuments,
  fixtureEntriesByDirectory,
  fixtureIncludeGraphForPath,
  fixtureIncludeFilesForPath,
  fixturePath,
} from "../../core/fixtures";
import { pathBasename } from "../../core/pathDisplay";
import {
  isMockDirectory,
  isMockPathInsideRoot,
  mockDirectoryAncestors,
  normalizeMockPath,
  resolveMockDocumentLinkPath,
  resolveMockLocalImagePath,
} from "../mockPathHelpers";
import {
  currentConfig,
  recordMockEditorOpenRequest,
  setCurrentConfig,
} from "./state";
import type {
  AppConfig,
  AsciiDocRenderContext,
  DocumentResourceContext,
  DirectoryEntry,
  DocumentLinkResolution,
  DocumentLinkResolutionInput,
  DocumentOrderCatalog,
  DocumentPayload,
  GitDiffPreview,
  LocalImageResolveContext,
  LocalImageResult,
  WorkspacePathResolution,
  WorkspacePathResolutionInput,
  WorkspaceEnvironment,
} from "../../core/types";

export async function pickDocument(): Promise<string | null> {
  if (typeof window !== "undefined") {
    const target = window as unknown as {
      __SVARD_PICK_DOCUMENT__?: string | null;
      __SVARD_PICK_DOCUMENTS__?: Array<string | null>;
    };
    if (
      Array.isArray(target.__SVARD_PICK_DOCUMENTS__) &&
      target.__SVARD_PICK_DOCUMENTS__.length > 0
    ) {
      return target.__SVARD_PICK_DOCUMENTS__.shift() ?? null;
    }
    if (typeof target.__SVARD_PICK_DOCUMENT__ === "string") {
      const path = target.__SVARD_PICK_DOCUMENT__;
      target.__SVARD_PICK_DOCUMENT__ = undefined;
      return path;
    }
    const storedPick = window.localStorage.getItem("svard.mockPickDocument");
    if (storedPick) {
      window.localStorage.removeItem("svard.mockPickDocument");
      return storedPick;
    }
  }
  return fixturePath;
}

export async function pickDirectory(): Promise<string | null> {
  if (typeof window !== "undefined") {
    const target = window as unknown as {
      __SVARD_PICK_DIRECTORY__?: string | null;
    };
    if (typeof target.__SVARD_PICK_DIRECTORY__ === "string") {
      const path = target.__SVARD_PICK_DIRECTORY__;
      target.__SVARD_PICK_DIRECTORY__ = undefined;
      return path;
    }
    const storedPick = window.localStorage.getItem("svard.mockPickDirectory");
    if (storedPick) {
      window.localStorage.removeItem("svard.mockPickDirectory");
      return storedPick;
    }
  }
  return "/workspace/docs";
}

export async function openDocument(path: string): Promise<DocumentPayload> {
  if (typeof window !== "undefined") {
    const target = window as unknown as {
      __SVARD_OPEN_DOCUMENT_ERRORS__?: Record<string, string>;
      __SVARD_DOCUMENT_OVERRIDES__?: Record<
        string,
        { source: string; updatedAt?: string }
      >;
    };
    const error = target.__SVARD_OPEN_DOCUMENT_ERRORS__?.[path];
    if (error) {
      throw new Error(error);
    }
    const override = target.__SVARD_DOCUMENT_OVERRIDES__?.[path];
    if (override) {
      const format = documentFormatForPath(path);
      return {
        path,
        basePath: path.split("/").slice(0, -1).join("/") || "/workspace/docs",
        format,
        source: override.source,
        includeFiles: fixtureIncludeFilesForPath(path),
        includeGraph: fixtureIncludeGraphForPath(path),
        resourceContext: mockResourceContext(path),
        asciidocContext:
          format === "asciidoc"
            ? mockAsciiDocContext(path, override.source)
            : undefined,
        updatedAt:
          override.updatedAt ??
          new Date("2026-05-12T00:01:00.000Z").toISOString(),
      };
    }
  }

  const source = fixtureDocuments[path] ?? fixtureDocuments[fixturePath];

  return {
    path,
    basePath: path.split("/").slice(0, -1).join("/") || "/workspace/docs",
    format: documentFormatForPath(path),
    source,
    includeFiles: fixtureIncludeFilesForPath(path),
    includeGraph: fixtureIncludeGraphForPath(path),
    resourceContext: mockResourceContext(path),
    asciidocContext:
      documentFormatForPath(path) === "asciidoc"
        ? mockAsciiDocContext(path, source)
        : undefined,
    updatedAt: new Date("2026-05-12T00:00:00.000Z").toISOString(),
  };
}

export async function listDirectory(path: string): Promise<DirectoryEntry[]> {
  if (typeof window !== "undefined") {
    const overrides = (
      window as unknown as {
        __SVARD_DIRECTORY_ENTRIES__?: Record<string, DirectoryEntry[]>;
      }
    ).__SVARD_DIRECTORY_ENTRIES__;
    if (overrides?.[path]) {
      return structuredClone(overrides[path]);
    }
  }
  return fixtureEntriesByDirectory[path] ?? [];
}

export async function loadDocumentOrder(
  rootDirectory: string,
): Promise<DocumentOrderCatalog> {
  if (typeof window !== "undefined") {
    const overrides = (
      window as unknown as {
        __SVARD_DOCUMENT_ORDER__?: Record<string, DocumentOrderCatalog>;
      }
    ).__SVARD_DOCUMENT_ORDER__;
    if (overrides?.[rootDirectory]) {
      return structuredClone(overrides[rootDirectory]);
    }
  }
  if (rootDirectory === "/workspace") {
    return {
      orders: [
        {
          source: "mkdocs",
          nodes: [
            {
              kind: "document",
              title: "Git Diff Modified Fixture",
              path: "/workspace/docs/git-modified.md",
              displayPath: "docs/git-modified.md",
              depth: 0,
              status: "resolved",
            },
          ],
        },
      ],
    };
  }
  return { orders: [] };
}

export async function resolveDroppedDocumentPath(
  path: string,
): Promise<string> {
  if (!isSupportedDocumentPath(path)) {
    throw new Error("File compare is available for markup documents only.");
  }
  if (!fixtureDocuments[path]) {
    throw new Error("Dropped file is not available in the mock workspace.");
  }
  return path;
}

export async function authorizeDirectory(_path: string): Promise<void> {
  return;
}

export async function resolveWorkspacePaths(
  input: WorkspacePathResolutionInput,
): Promise<WorkspacePathResolution> {
  const rawWorkspacePath =
    input.documentPath ??
    input.basePath ??
    input.lastDirectory ??
    input.recentDirectories[0] ??
    "";
  const documentPath = input.documentPath
    ? normalizeMockPath(input.documentPath)
    : null;
  const candidateRoots = [input.lastDirectory ?? "", ...input.recentDirectories]
    .filter(Boolean)
    .map(normalizeMockPath)
    .filter(isMockDirectory);
  const matchingRoots = documentPath
    ? candidateRoots.filter((path) => isMockPathInsideRoot(documentPath, path))
    : [];
  const initialDirectory =
    matchingRoots.sort((left, right) => right.length - left.length)[0] ??
    candidateRoots[0] ??
    (input.basePath && isMockDirectory(normalizeMockPath(input.basePath))
      ? normalizeMockPath(input.basePath)
      : null) ??
    null;
  const expandedDirectories = initialDirectory
    ? [
        ...new Set([
          ...input.expandedDirectories
            .map(normalizeMockPath)
            .filter(
              (path) =>
                isMockDirectory(path) &&
                isMockPathInsideRoot(path, initialDirectory),
            ),
          ...(documentPath
            ? mockDirectoryAncestors(documentPath, initialDirectory)
            : []),
        ]),
      ]
    : [];
  return {
    initialDirectory,
    expandedDirectories,
    environment: mockWorkspaceEnvironment(rawWorkspacePath),
  };
}

function mockWorkspaceEnvironment(path: string): WorkspaceEnvironment {
  const lowerPath = path.toLowerCase();
  if (
    lowerPath.startsWith("\\\\wsl.localhost\\") ||
    lowerPath.startsWith("\\\\wsl$\\")
  ) {
    return {
      locationKind: "wsl-unc",
      performanceMode: "wsl-mitigated",
    };
  }
  if (lowerPath.startsWith("\\\\")) {
    return {
      locationKind: "network-unc",
      performanceMode: "normal",
    };
  }
  return {
    locationKind: path ? "local" : "unknown",
    performanceMode: "normal",
  };
}

export async function resolveDocumentLink(
  input: DocumentLinkResolutionInput,
): Promise<DocumentLinkResolution> {
  const href = input.href.trim();
  if (input.kind === "wikilink") {
    return resolveMockObsidianWikilink(input);
  }
  if (href.startsWith("#")) {
    return { status: "anchor", href };
  }
  if (/^https?:\/\//iu.test(href)) {
    return { status: "external", href };
  }
  if (/^\s*(?:javascript|vbscript|data|asset|file):/iu.test(href)) {
    return { status: "blocked", message: "Document link is not allowed." };
  }
  const hashIndex = href.indexOf("#");
  const pathPart = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const hash = hashIndex >= 0 ? href.slice(hashIndex + 1) : null;
  if (!isSupportedDocumentPath(pathPart)) {
    return {
      status: "blocked",
      message: "Document link is not a supported markup document.",
    };
  }
  const path = resolveMockDocumentLinkPath(href, input.documentPath);
  if (!fixtureDocuments[path]) {
    return { status: "blocked", message: "Document link is not available." };
  }
  return { status: "resolved", path, hash };
}

export async function clearDocumentLinkCache(_path: string): Promise<void> {
  // Mock host resolves fixture wikilinks from static in-memory data, so there is
  // no persistent note index to clear.
}

function resolveMockObsidianWikilink(
  input: DocumentLinkResolutionInput,
): DocumentLinkResolution {
  const target = (input.target ?? input.href).trim();
  const hashIndex = target.indexOf("#");
  const noteTarget = hashIndex >= 0 ? target.slice(0, hashIndex) : target;
  const hash = hashIndex >= 0 ? target.slice(hashIndex + 1) : null;
  const noteKey = normalizeMockObsidianNoteKey(noteTarget);
  if (
    !noteKey ||
    !input.documentPath.startsWith("/workspace/obsidian-vault/")
  ) {
    return {
      status: "blocked",
      message: "Obsidian vault is not available.",
      metrics: {
        kind: "wikilink",
        status: "blocked",
        durationMs: 0,
        performanceMode: "normal",
        reason: "non-vault",
      },
    };
  }
  const matches = Object.keys(fixtureDocuments).filter((path) => {
    if (
      !path.startsWith("/workspace/obsidian-vault/") ||
      !path.endsWith(".md")
    ) {
      return false;
    }
    const relative = path
      .slice("/workspace/obsidian-vault/".length)
      .replace(/\.md$/u, "");
    const basename = relative.split("/").at(-1) ?? relative;
    return relative === noteKey || basename === noteKey;
  });
  if (matches.length !== 1) {
    return {
      status: "blocked",
      message: "Obsidian wikilink is not available.",
      metrics: {
        kind: "wikilink",
        status: "blocked",
        cacheStatus: "mock",
        noteCount: Object.keys(fixtureDocuments).filter(
          (path) =>
            path.startsWith("/workspace/obsidian-vault/") &&
            path.endsWith(".md"),
        ).length,
        scannedDirs: 0,
        durationMs: 0,
        performanceMode: "normal",
        reason: matches.length === 0 ? "missing" : "duplicate",
      },
    };
  }
  return {
    status: "resolved",
    path: matches[0],
    hash,
    metrics: {
      kind: "wikilink",
      status: "resolved",
      cacheStatus: noteKey.includes("/") ? "direct" : "mock",
      noteCount: Object.keys(fixtureDocuments).filter(
        (path) =>
          path.startsWith("/workspace/obsidian-vault/") && path.endsWith(".md"),
      ).length,
      scannedDirs: 0,
      durationMs: 0,
      performanceMode: "normal",
    },
  };
}

function normalizeMockObsidianNoteKey(target: string): string | null {
  const normalized = normalizeMockPath(target.replaceAll("\\", "/")).replace(
    /^\//u,
    "",
  );
  if (
    !normalized ||
    normalized.split("/").some((part) => part === ".." || part === ".") ||
    (normalized.includes(".") && !normalized.endsWith(".md"))
  ) {
    return null;
  }
  return normalized.replace(/\.md$/u, "");
}

export async function resolveLocalImage(
  source: string,
  documentPath: string,
  context?: LocalImageResolveContext | null,
): Promise<LocalImageResult> {
  const path = resolveMockLocalImagePathWithContext(
    source,
    documentPath,
    context,
  );
  if (
    path === "/workspace/docs/assets/svard-sample.svg" ||
    path === "/workspace/docs/assets/diff-oversized-image.svg" ||
    path === "/workspace/images/test.svg" ||
    path === "/workspace/images/article/root.svg" ||
    path === "/workspace/images/project-context.svg" ||
    path === "/workspace/modules/module-a/images/diagram.drawio.svg"
  ) {
    const fixtureSource = fixtureDocuments[path];
    return {
      status: "resolved",
      mediaType: "image/svg+xml",
      encoding: "utf8",
      content:
        fixtureSource ??
        (path === "/workspace/docs/assets/diff-oversized-image.svg"
          ? '<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="520" viewBox="0 0 1800 520"><rect width="1800" height="520" fill="#e7f0ef"/><text x="48" y="92" font-size="48">Oversized local SVG</text><line x1="48" y1="260" x2="1752" y2="260" stroke="#2f806f" stroke-width="12"/></svg>'
          : '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="320" viewBox="0 0 720 320"><text x="20" y="40">Svard local image</text></svg>'),
    };
  }
  if (path === "/workspace/docs/assets/diff-local-image.png") {
    return {
      status: "resolved",
      mediaType: "image/png",
      encoding: "base64",
      content:
        "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAWUlEQVR4nO3PAQ3AMAwAsVJ/aZ+gIFcPGZC6b84vAAAAAAAAAAAAAAAAAAAAAIAb9gW9z4z9twMAAAAAAAAAAAAAAAAAAAAAAIC7AOIEAAGdF9g2AAAAAElFTkSuQmCC",
    };
  }
  return {
    status: "blocked",
    placeholderText: `Local image: ${pathBasename(source)}`,
  };
}

function mockAsciiDocContext(
  documentPath: string,
  source: string,
): AsciiDocRenderContext {
  const documentDir = documentPath.split("/").slice(0, -1).join("/") || "/";
  const modulePages = documentPath.match(
    /^(.+\/modules\/[^/]+)\/pages\/[^/]+$/u,
  );
  const baseDir = modulePages ? modulePages[1] : "/workspace";
  const attributes: Record<string, string> = {};
  for (const line of source.split("\n")) {
    const match = /^:([^:!][^:]*):\s*(.*)$/u.exec(line.trim());
    if (match) {
      attributes[match[1].trim()] = match[2].trim();
    }
  }
  return {
    baseDir,
    workspaceRoot: baseDir,
    documentDir,
    attributes,
    resourceRoots: Array.from(new Set([baseDir, documentDir])),
  };
}

function mockResourceContext(documentPath: string): DocumentResourceContext {
  const documentDir = documentPath.split("/").slice(0, -1).join("/") || "/";
  const modulePages = documentPath.match(
    /^(.+\/modules\/[^/]+)\/pages\/[^/]+$/u,
  );
  const workspaceRoot = modulePages ? modulePages[1] : "/workspace";
  return {
    workspaceRoot,
    documentDir,
    resourceRoots: Array.from(new Set([workspaceRoot, documentDir])),
  };
}

function resolveMockLocalImagePathWithContext(
  source: string,
  documentPath: string,
  context?: LocalImageResolveContext | null,
) {
  const documentRelative = resolveMockLocalImagePath(source, documentPath);
  if (fixtureDocuments[documentRelative]) {
    return documentRelative;
  }
  if (isRootRelativeMockAsset(source) && context?.workspaceRoot) {
    const relativeSource = source.replace(/^\/+/u, "");
    for (const root of [
      context.workspaceRoot,
      ...(context.resourceRoots ?? []),
    ]) {
      const rootRelative = normalizeMockPath(`${root}/${relativeSource}`);
      if (
        fixtureDocuments[rootRelative] ||
        isKnownMockImagePath(rootRelative)
      ) {
        return rootRelative;
      }
    }
  }
  if (
    context &&
    "baseDir" in context &&
    context.baseDir &&
    !source.startsWith("/")
  ) {
    const baseRelative = normalizeMockPath(`${context.baseDir}/${source}`);
    if (fixtureDocuments[baseRelative]) {
      return baseRelative;
    }
    const imagesdir = context.attributes?.imagesdir;
    if (imagesdir) {
      const imagesdirRelative = normalizeMockPath(
        `${context.baseDir}/${imagesdir}/${source}`,
      );
      if (fixtureDocuments[imagesdirRelative]) {
        return imagesdirRelative;
      }
    }
  }
  return documentRelative;
}

function isRootRelativeMockAsset(source: string) {
  return /^\/(?:images|assets|img|static)(?:\/|$)/u.test(source.trim());
}

function isKnownMockImagePath(path: string) {
  return [
    "/workspace/images/test.svg",
    "/workspace/images/article/root.svg",
    "/workspace/images/project-context.svg",
    "/workspace/modules/module-a/images/diagram.drawio.svg",
  ].includes(path);
}

export async function loadConfig(): Promise<AppConfig> {
  const scenario =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("scenario")
      : null;
  if (scenario === "viewer-start-page") {
    return {
      ...structuredClone(defaultConfig),
      workspace: {
        ...structuredClone(defaultConfig.workspace),
        recentDocuments: [
          {
            path: fixturePath,
            name: "mvp-guide.adoc",
            format: "asciidoc",
            lastOpenedAt: "2026-05-14T00:00:00.000Z",
          },
        ],
        recentDirectories: [
          {
            path: "/workspace/docs",
            name: "docs",
            lastOpenedAt: "2026-05-14T00:00:00.000Z",
          },
        ],
        bookmarks: [
          {
            path: "/workspace/docs/markdown-sample.md",
            kind: "file",
            name: "markdown-sample.md",
          },
        ],
      },
    };
  }
  if (scenario === "viewer-restore-additional-windows-opt-in") {
    return {
      ...structuredClone(defaultConfig),
      sidebarVisible: true,
      rightSidebarVisible: true,
      experimental: {
        ...structuredClone(defaultConfig.experimental),
        restoreAdditionalWindowsOnStartup: true,
      },
      workspace: {
        ...structuredClone(defaultConfig.workspace),
        lastDirectory: "/workspace",
        bookmarks: [
          {
            path: "/workspace/docs/render-fixtures.adoc",
            kind: "file",
            name: "Render Fixtures",
          },
        ],
        windowSessions: {
          main: {
            ...structuredClone(defaultConfig.workspace),
            lastDirectory: "/workspace",
            activePath: fixturePath,
            openTabs: [fixturePath],
            recentTabs: [fixturePath],
            pinnedTabs: [],
            scrollPositions: {},
            activeHeadingByPath: {},
            splitSession: null,
            expandedDirectories: ["/workspace/docs"],
            sidebarTab: "files",
          },
          "viewer-restore-1": {
            ...structuredClone(defaultConfig.workspace),
            lastDirectory: "/workspace",
            activePath: "/workspace/docs/render-fixtures.adoc",
            openTabs: [
              "/workspace/docs/render-fixtures.adoc",
              "/workspace/docs/preferences.adoc",
            ],
            pinnedTabs: ["/workspace/docs/render-fixtures.adoc"],
            recentTabs: [
              "/workspace/docs/render-fixtures.adoc",
              "/workspace/docs/preferences.adoc",
            ],
            scrollPositions: {
              "/workspace/docs/render-fixtures.adoc": 240,
            },
            activeHeadingByPath: {
              "/workspace/docs/render-fixtures.adoc": "links",
            },
            splitSession: null,
            expandedDirectories: ["/workspace/docs"],
            sidebarTab: "bookmarks",
          },
          empty: {
            ...structuredClone(defaultConfig.workspace),
            lastDirectory: null,
            activePath: null,
            openTabs: [],
            recentTabs: [],
            pinnedTabs: [],
            scrollPositions: {},
            activeHeadingByPath: {},
            splitSession: null,
            expandedDirectories: [],
            sidebarTab: "files",
          },
        },
        restorableWindowSessionIds: ["viewer-restore-1", "empty"],
      },
    };
  }
  return {
    ...structuredClone(currentConfig),
    workspace: {
      ...structuredClone(currentConfig.workspace),
      lastDirectory: "/workspace",
    },
  };
}

export async function saveConfig(config: AppConfig): Promise<void> {
  setCurrentConfig(config);
}

export async function openExternalUrl(url: string): Promise<void> {
  if (!isSafeExternalUrlToOpen(url)) {
    throw new Error("Unsafe external URL blocked");
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export async function openPathInEditor(path: string): Promise<void> {
  recordMockEditorOpenRequest(path);
}

export async function compareDocuments(
  leftPath: string,
  rightPath: string,
): Promise<GitDiffPreview> {
  if (!fixtureDocuments[leftPath] || !fixtureDocuments[rightPath]) {
    throw new Error("Both documents must exist before comparing files.");
  }
  const [leftDocument, rightDocument] = await Promise.all([
    openDocument(leftPath),
    openDocument(rightPath),
  ]);
  return buildFileDocumentDiffPreview({
    leftPath: leftDocument.path,
    leftText: leftDocument.source,
    rightPath: rightDocument.path,
    rightText: rightDocument.source,
  });
}
