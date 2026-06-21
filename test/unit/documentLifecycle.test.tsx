import { act, useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultConfig } from "../../src/core/defaultConfig";
import type {
  AppConfig,
  DirectoryEntry,
  DocumentPayload,
  HostAdapter,
  RenderResult,
  WatchHandle,
  WorkspaceEnvironment,
} from "../../src/core/types";
import { useDocumentLifecycle } from "../../src/ui/hooks/useDocumentLifecycle";
import type { InlineNoticeOptions, PaneId } from "../../src/ui/types";

const currentDocument: DocumentPayload = {
  path: "/workspace/docs/current.md",
  basePath: "/workspace/docs",
  format: "markdown",
  source: "# Current",
  updatedAt: "2026-05-17T00:00:00.000Z",
};

const currentRenderResult: RenderResult = {
  html: "<h1>Current</h1>",
  headings: [],
  sourceBlocks: [],
  diagnostics: [],
  diagramSlots: [],
  mermaidDiagrams: [],
  plantUmlDiagrams: [],
  graphvizDiagrams: [],
  krokiDiagrams: [],
};

describe("useDocumentLifecycle open failures", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("keeps the current document visible when opening a stale tree entry fails", async () => {
    const showInlineNotice = vi.fn(
      (_message: string, _options?: InlineNoticeOptions) => undefined,
    );
    const host = {
      openDocument: vi.fn(async () => {
        throw new Error("Open document failed");
      }),
      watchDocument: vi.fn(
        async (): Promise<WatchHandle> => ({ dispose() {} }),
      ),
      takePendingOpenRequests: vi.fn(async () => []),
      watchOpenRequests: vi.fn(
        async (): Promise<WatchHandle> => ({ dispose() {} }),
      ),
    } as Partial<HostAdapter> as HostAdapter;
    let api:
      | {
          openDocument(path: string): Promise<void>;
          documentPayload: DocumentPayload | null;
          error: string | null;
          renderResult: RenderResult | null;
        }
      | undefined;

    function Harness() {
      const articleRef = useRef<HTMLElement | null>(null);
      const viewerRef = useRef<HTMLElement | null>(null);
      const [documentPayload, setDocumentPayload] =
        useState<DocumentPayload | null>(currentDocument);
      const [error, setError] = useState<string | null>(null);
      const [renderResult, setRenderResult] = useState<RenderResult | null>(
        currentRenderResult,
      );
      const [tabs, setTabs] = useState<DocumentPayload[]>([currentDocument]);
      const [isLoading, setIsLoading] = useState(false);
      const [query, setQuery] = useState("");
      const [, setChildrenByDirectory] = useState<
        Record<string, DirectoryEntry[]>
      >({});
      const [, setDirectoryErrors] = useState<Record<string, string>>({});
      const [, setExpandedDirectories] = useState<Set<string>>(new Set());
      const [, setOpenFileReloadStates] = useState({});
      const [, setRootDirectory] = useState("");
      const [, setWorkspaceEnvironment] = useState<WorkspaceEnvironment | null>(
        null,
      );
      const lifecycle = useDocumentLifecycle({
        activeHeadingId: null,
        articleRef,
        config: defaultConfig,
        dismissInlineNotice: vi.fn(),
        documentPayload,
        focusedPaneId: "left",
        host,
        persistWorkspace: vi.fn(
          async (_partial: Partial<AppConfig["workspace"]>) => undefined,
        ),
        recordNavigation: vi.fn(),
        searchQueryForPath: (_path: string, fallbackQuery?: string) =>
          fallbackQuery ?? "",
        setChildrenByDirectory,
        setDirectoryErrors,
        setDocumentPayload,
        setError,
        setExpandedDirectories,
        setIsLoading,
        setPendingSmartScrollAnchor: vi.fn(),
        setOpenFileReloadStates,
        setQuery,
        setRenderResult,
        bumpDocumentRenderRevision: vi.fn(),
        setRootDirectory,
        setTabs,
        setWorkspaceEnvironment,
        showInlineNotice,
        canDrainPendingOpenRequests: true,
        snapshotForPath: (_path: string): PaneId | null => null,
        focusPane: vi.fn(),
        tabs,
        viewerRef,
      });

      useEffect(() => {
        void isLoading;
        void query;
        api = {
          openDocument: lifecycle.openDocument,
          documentPayload,
          error,
          renderResult,
        };
      });
      return null;
    }

    await act(async () => {
      root.render(<Harness />);
    });
    await act(async () => {
      await api?.openDocument("/workspace/docs/deleted.md");
    });

    expect(host.openDocument).toHaveBeenCalledWith(
      "/workspace/docs/deleted.md",
    );
    expect(api?.documentPayload).toEqual(currentDocument);
    expect(api?.renderResult).toEqual(currentRenderResult);
    expect(api?.error).toBeNull();
    expect(showInlineNotice).toHaveBeenCalledWith(
      "Open failed: Open document failed",
      { tone: "error" },
    );
  });

  it("clears render state when opening a different document", async () => {
    const nextDocument: DocumentPayload = {
      path: "/workspace/docs/next.md",
      basePath: "/workspace/docs",
      format: "markdown",
      source: "# Next",
      updatedAt: "2026-05-17T00:04:00.000Z",
    };
    const host = {
      openDocument: vi.fn(async () => nextDocument),
      watchDocument: vi.fn(
        async (): Promise<WatchHandle> => ({ dispose() {} }),
      ),
      takePendingOpenRequests: vi.fn(async () => []),
      watchOpenRequests: vi.fn(
        async (): Promise<WatchHandle> => ({ dispose() {} }),
      ),
    } as Partial<HostAdapter> as HostAdapter;
    const setRenderResult = vi.fn();
    let api:
      | {
          openDocument(path: string): Promise<void>;
        }
      | undefined;

    function Harness() {
      const articleRef = useRef<HTMLElement | null>(null);
      const viewerRef = useRef<HTMLElement | null>(null);
      const [payload, setDocumentPayload] = useState<DocumentPayload | null>(
        currentDocument,
      );
      const [tabs, setTabs] = useState<DocumentPayload[]>([currentDocument]);
      const [, setError] = useState<string | null>(null);
      const [, setIsLoading] = useState(false);
      const [, setQuery] = useState("");
      const [, setChildrenByDirectory] = useState<
        Record<string, DirectoryEntry[]>
      >({});
      const [, setDirectoryErrors] = useState<Record<string, string>>({});
      const [, setExpandedDirectories] = useState<Set<string>>(new Set());
      const [, setOpenFileReloadStates] = useState({});
      const [, setRootDirectory] = useState("");
      const [, setWorkspaceEnvironment] = useState<WorkspaceEnvironment | null>(
        null,
      );
      const lifecycle = useDocumentLifecycle({
        activeHeadingId: null,
        articleRef,
        config: defaultConfig,
        dismissInlineNotice: vi.fn(),
        documentPayload: payload,
        focusedPaneId: "left",
        host,
        persistWorkspace: vi.fn(
          async (_partial: Partial<AppConfig["workspace"]>) => undefined,
        ),
        recordNavigation: vi.fn(),
        searchQueryForPath: (_path: string, fallbackQuery?: string) =>
          fallbackQuery ?? "",
        setChildrenByDirectory,
        setDirectoryErrors,
        setDocumentPayload,
        setError,
        setExpandedDirectories,
        setIsLoading,
        setPendingSmartScrollAnchor: vi.fn(),
        setOpenFileReloadStates,
        setQuery,
        setRenderResult,
        bumpDocumentRenderRevision: vi.fn(),
        setRootDirectory,
        setTabs,
        setWorkspaceEnvironment,
        showInlineNotice: vi.fn(),
        canDrainPendingOpenRequests: true,
        snapshotForPath: (_path: string): PaneId | null => null,
        focusPane: vi.fn(),
        tabs,
        viewerRef,
      });

      useEffect(() => {
        api = { openDocument: lifecycle.openDocument };
      });
      return null;
    }

    await act(async () => {
      root.render(<Harness />);
    });
    await act(async () => {
      await api?.openDocument(nextDocument.path);
    });

    expect(setRenderResult).toHaveBeenCalledWith(null);
  });

  it("captures a smart scroll anchor before manual reload", async () => {
    const reloadedDocument: DocumentPayload = {
      ...currentDocument,
      source: "# Current\n\nUpdated",
      updatedAt: "2026-05-17T00:02:00.000Z",
    };
    const setPendingSmartScrollAnchor = vi.fn();
    const setRenderResult = vi.fn();
    const bumpDocumentRenderRevision = vi.fn();
    const host = {
      clearDocumentLinkCache: vi.fn(async () => undefined),
      openDocument: vi.fn(async () => reloadedDocument),
      watchDocument: vi.fn(
        async (): Promise<WatchHandle> => ({ dispose() {} }),
      ),
      takePendingOpenRequests: vi.fn(async () => []),
      watchOpenRequests: vi.fn(
        async (): Promise<WatchHandle> => ({ dispose() {} }),
      ),
    } as Partial<HostAdapter> as HostAdapter;
    let api:
      | {
          openDocument(
            path: string,
            options?: { clearDocumentLinkCache?: boolean },
          ): Promise<void>;
        }
      | undefined;

    function Harness() {
      const articleRef = useRef<HTMLElement | null>(
        document.createElement("article"),
      );
      const viewerRef = useRef<HTMLElement | null>(
        document.createElement("section"),
      );
      const [payload, setDocumentPayload] = useState<DocumentPayload | null>(
        currentDocument,
      );
      const [tabs, setTabs] = useState<DocumentPayload[]>([currentDocument]);
      const [, setError] = useState<string | null>(null);
      const [, setIsLoading] = useState(false);
      const [, setQuery] = useState("");
      const [, setChildrenByDirectory] = useState<
        Record<string, DirectoryEntry[]>
      >({});
      const [, setDirectoryErrors] = useState<Record<string, string>>({});
      const [, setExpandedDirectories] = useState<Set<string>>(new Set());
      const [, setOpenFileReloadStates] = useState({});
      const [, setRootDirectory] = useState("");
      const [, setWorkspaceEnvironment] = useState<WorkspaceEnvironment | null>(
        null,
      );
      if (viewerRef.current) {
        viewerRef.current.scrollTop = 321;
      }
      const lifecycle = useDocumentLifecycle({
        activeHeadingId: "current",
        articleRef,
        config: defaultConfig,
        dismissInlineNotice: vi.fn(),
        documentPayload: payload,
        focusedPaneId: "left",
        host,
        persistWorkspace: vi.fn(
          async (_partial: Partial<AppConfig["workspace"]>) => undefined,
        ),
        recordNavigation: vi.fn(),
        searchQueryForPath: (_path: string, fallbackQuery?: string) =>
          fallbackQuery ?? "",
        setChildrenByDirectory,
        setDirectoryErrors,
        setDocumentPayload,
        setError,
        setExpandedDirectories,
        setIsLoading,
        setPendingSmartScrollAnchor,
        setOpenFileReloadStates,
        setQuery,
        setRenderResult,
        bumpDocumentRenderRevision,
        setRootDirectory,
        setTabs,
        setWorkspaceEnvironment,
        showInlineNotice: vi.fn(),
        canDrainPendingOpenRequests: true,
        snapshotForPath: (_path: string): PaneId | null => null,
        focusPane: vi.fn(),
        tabs,
        viewerRef,
      });

      useEffect(() => {
        api = { openDocument: lifecycle.openDocument };
      });
      return null;
    }

    await act(async () => {
      root.render(<Harness />);
    });
    await act(async () => {
      await api?.openDocument(currentDocument.path, {
        clearDocumentLinkCache: true,
      });
    });

    expect(setPendingSmartScrollAnchor).toHaveBeenCalledWith(
      expect.objectContaining({
        headingId: "current",
        path: currentDocument.path,
        scrollTop: 321,
      }),
    );
    expect(bumpDocumentRenderRevision).toHaveBeenCalledTimes(1);
    expect(setRenderResult).not.toHaveBeenCalledWith(null);
  });

  it("clears document link cache before reloading a watched document", async () => {
    const reloadedDocument: DocumentPayload = {
      ...currentDocument,
      source: "# Current\n\nOpen [[Guide]].",
      updatedAt: "2026-05-17T00:01:00.000Z",
    };
    let onWatchedDocumentChange: (() => void) | undefined;
    const showInlineNotice = vi.fn(
      (_message: string, _options?: InlineNoticeOptions) => undefined,
    );
    const clearDocumentLinkCache = vi.fn(async () => undefined);
    const bumpDocumentRenderRevision = vi.fn();
    const host = {
      clearDocumentLinkCache,
      openDocument: vi.fn(async () => reloadedDocument),
      watchDocument: vi.fn(async (_path: string, onChange: () => void) => {
        onWatchedDocumentChange = onChange;
        return { dispose() {} };
      }),
      takePendingOpenRequests: vi.fn(async () => []),
      watchOpenRequests: vi.fn(
        async (): Promise<WatchHandle> => ({ dispose() {} }),
      ),
    } as Partial<HostAdapter> as HostAdapter;
    let documentPayload: DocumentPayload | null = currentDocument;

    function Harness() {
      const articleRef = useRef<HTMLElement | null>(null);
      const viewerRef = useRef<HTMLElement | null>(null);
      const [payload, setDocumentPayload] = useState<DocumentPayload | null>(
        currentDocument,
      );
      const [tabs, setTabs] = useState<DocumentPayload[]>([currentDocument]);
      const [, setError] = useState<string | null>(null);
      const [, setRenderResult] = useState<RenderResult | null>(
        currentRenderResult,
      );
      const [, setIsLoading] = useState(false);
      const [, setQuery] = useState("");
      const [, setChildrenByDirectory] = useState<
        Record<string, DirectoryEntry[]>
      >({});
      const [, setDirectoryErrors] = useState<Record<string, string>>({});
      const [, setExpandedDirectories] = useState<Set<string>>(new Set());
      const [, setOpenFileReloadStates] = useState({});
      const [, setRootDirectory] = useState("");
      const [, setWorkspaceEnvironment] = useState<WorkspaceEnvironment | null>(
        null,
      );
      useDocumentLifecycle({
        activeHeadingId: null,
        articleRef,
        config: defaultConfig,
        dismissInlineNotice: vi.fn(),
        documentPayload: payload,
        focusedPaneId: "left",
        host,
        persistWorkspace: vi.fn(
          async (_partial: Partial<AppConfig["workspace"]>) => undefined,
        ),
        recordNavigation: vi.fn(),
        searchQueryForPath: (_path: string, fallbackQuery?: string) =>
          fallbackQuery ?? "",
        setChildrenByDirectory,
        setDirectoryErrors,
        setDocumentPayload,
        setError,
        setExpandedDirectories,
        setIsLoading,
        setPendingSmartScrollAnchor: vi.fn(),
        setOpenFileReloadStates,
        setQuery,
        setRenderResult,
        bumpDocumentRenderRevision,
        setRootDirectory,
        setTabs,
        setWorkspaceEnvironment,
        showInlineNotice,
        canDrainPendingOpenRequests: true,
        snapshotForPath: (_path: string): PaneId | null => null,
        focusPane: vi.fn(),
        tabs,
        viewerRef,
      });

      useEffect(() => {
        documentPayload = payload;
      });
      return null;
    }

    await act(async () => {
      root.render(<Harness />);
    });
    await act(async () => {
      onWatchedDocumentChange?.();
    });

    expect(clearDocumentLinkCache).toHaveBeenCalledWith(currentDocument.path);
    expect(host.openDocument).toHaveBeenCalledWith(currentDocument.path);
    expect(clearDocumentLinkCache.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(host.openDocument).mock.invocationCallOrder[0],
    );
    expect(documentPayload).toEqual(reloadedDocument);
    expect(bumpDocumentRenderRevision).toHaveBeenCalledTimes(1);
    expect(showInlineNotice).toHaveBeenCalledWith("current.md reloaded", {
      tone: "success",
    });
  });

  it("captures a smart scroll anchor before active watcher reload only", async () => {
    const reloadedDocument: DocumentPayload = {
      ...currentDocument,
      updatedAt: "2026-05-17T00:03:00.000Z",
    };
    const inactiveDocument: DocumentPayload = {
      path: "/workspace/docs/inactive.md",
      basePath: "/workspace/docs",
      format: "markdown",
      source: "# Inactive",
      updatedAt: "2026-05-17T00:00:00.000Z",
    };
    const watchers = new Map<string, () => void>();
    const setPendingSmartScrollAnchor = vi.fn();
    const bumpDocumentRenderRevision = vi.fn();
    const host = {
      clearDocumentLinkCache: vi.fn(async () => undefined),
      openDocument: vi.fn(async (path: string) =>
        path === currentDocument.path ? reloadedDocument : inactiveDocument,
      ),
      watchDocument: vi.fn(async (path: string, onChange: () => void) => {
        watchers.set(path, onChange);
        return { dispose() {} };
      }),
      takePendingOpenRequests: vi.fn(async () => []),
      watchOpenRequests: vi.fn(
        async (): Promise<WatchHandle> => ({ dispose() {} }),
      ),
    } as Partial<HostAdapter> as HostAdapter;

    function Harness() {
      const articleRef = useRef<HTMLElement | null>(
        document.createElement("article"),
      );
      const viewerRef = useRef<HTMLElement | null>(
        document.createElement("section"),
      );
      const [payload, setDocumentPayload] = useState<DocumentPayload | null>(
        currentDocument,
      );
      const [tabs, setTabs] = useState<DocumentPayload[]>([
        currentDocument,
        inactiveDocument,
      ]);
      const [, setError] = useState<string | null>(null);
      const [, setRenderResult] = useState<RenderResult | null>(
        currentRenderResult,
      );
      const [, setIsLoading] = useState(false);
      const [, setQuery] = useState("");
      const [, setChildrenByDirectory] = useState<
        Record<string, DirectoryEntry[]>
      >({});
      const [, setDirectoryErrors] = useState<Record<string, string>>({});
      const [, setExpandedDirectories] = useState<Set<string>>(new Set());
      const [, setOpenFileReloadStates] = useState({});
      const [, setRootDirectory] = useState("");
      const [, setWorkspaceEnvironment] = useState<WorkspaceEnvironment | null>(
        null,
      );
      if (viewerRef.current) {
        viewerRef.current.scrollTop = 111;
      }
      useDocumentLifecycle({
        activeHeadingId: "current",
        articleRef,
        config: defaultConfig,
        dismissInlineNotice: vi.fn(),
        documentPayload: payload,
        focusedPaneId: "left",
        host,
        persistWorkspace: vi.fn(
          async (_partial: Partial<AppConfig["workspace"]>) => undefined,
        ),
        recordNavigation: vi.fn(),
        searchQueryForPath: (_path: string, fallbackQuery?: string) =>
          fallbackQuery ?? "",
        setChildrenByDirectory,
        setDirectoryErrors,
        setDocumentPayload,
        setError,
        setExpandedDirectories,
        setIsLoading,
        setPendingSmartScrollAnchor,
        setOpenFileReloadStates,
        setQuery,
        setRenderResult,
        bumpDocumentRenderRevision,
        setRootDirectory,
        setTabs,
        setWorkspaceEnvironment,
        showInlineNotice: vi.fn(),
        canDrainPendingOpenRequests: true,
        snapshotForPath: (_path: string): PaneId | null => null,
        focusPane: vi.fn(),
        tabs,
        viewerRef,
      });
      return null;
    }

    await act(async () => {
      root.render(<Harness />);
    });
    await act(async () => {
      watchers.get(inactiveDocument.path)?.();
    });
    expect(setPendingSmartScrollAnchor).not.toHaveBeenCalled();
    expect(bumpDocumentRenderRevision).not.toHaveBeenCalled();

    await act(async () => {
      watchers.get(currentDocument.path)?.();
    });
    expect(setPendingSmartScrollAnchor).toHaveBeenCalledWith(
      expect.objectContaining({
        path: currentDocument.path,
        scrollTop: 111,
      }),
    );
    expect(bumpDocumentRenderRevision).toHaveBeenCalledTimes(1);
  });
});
