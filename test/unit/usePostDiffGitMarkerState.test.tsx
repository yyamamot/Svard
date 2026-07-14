import { act, useMemo, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { defaultConfig } from "../../src/core/defaultConfig";
import type {
  AppConfig,
  DocumentDiffPreview,
  DocumentPayload,
  GitChanges,
  RenderResult,
} from "../../src/core/types";
import { usePostDiffGitMarkerState } from "../../src/ui/hooks/usePostDiffGitMarkerState";
import type {
  RenderedBlockDiff,
  RenderedDiffPresentation,
} from "../../src/ui/lib/gitRenderedDiff";
import { createReactRootHarness } from "./helpers/reactHarness";

const activePath = "/workspace/docs/current.md";

type HookApi = ReturnType<typeof usePostDiffGitMarkerState> & {
  setConfig: (value: AppConfig | null) => void;
  setDocumentDiffPreview: (value: DocumentDiffPreview | null) => void;
  setDocumentPayload: (value: DocumentPayload | null) => void;
  setRenderResult: (value: RenderResult | null) => void;
};

function enabledConfig(): AppConfig {
  return {
    ...defaultConfig,
    experimental: {
      ...defaultConfig.experimental,
      postDiffGitMarkers: true,
    },
  };
}

function documentPayload(path = activePath): DocumentPayload {
  return {
    path,
    basePath: "/workspace",
    format: "markdown",
    source: "# Current\n\nUpdated text",
    updatedAt: "2026-06-08T00:00:00.000Z",
  };
}

function renderResult(): RenderResult {
  return {
    html: "<h1>Current</h1><p>Updated text</p>",
    headings: [],
    sourceBlocks: [],
    diagnostics: [],
    diagramSlots: [],
    mermaidDiagrams: [],
    plantUmlDiagrams: [],
    graphvizDiagrams: [],
    krokiDiagrams: [],
  };
}

function preview(
  overrides: Partial<DocumentDiffPreview> = {},
): DocumentDiffPreview {
  return {
    source: "git",
    repositoryRoot: "/workspace",
    relativePath: "docs/current.md",
    leftPath: activePath,
    rightPath: activePath,
    status: "modified",
    leftLabel: "HEAD",
    rightLabel: "Working Tree",
    leftText: "# Current\n\nOld text",
    rightText: "# Current\n\nUpdated text",
    hunks: [
      {
        oldStart: 1,
        oldLines: 3,
        newStart: 1,
        newLines: 3,
        lines: [
          { kind: "context", oldLine: 1, newLine: 1, text: "# Current" },
          { kind: "context", oldLine: 2, newLine: 2, text: "" },
          { kind: "removed", oldLine: 3, newLine: null, text: "Old text" },
          {
            kind: "added",
            oldLine: null,
            newLine: 3,
            text: "Updated text",
          },
        ],
      },
    ],
    ...overrides,
  };
}

function gitChanges(items: GitChanges["items"]): GitChanges {
  return {
    status: "ok",
    repositoryRoot: "/workspace",
    currentBranch: "main",
    headCommit: null,
    items,
    message: null,
  };
}

function block(id: string): RenderedBlockDiff {
  return {
    id,
    kind: "changed",
    blockKind: "paragraph",
    left: {
      id,
      kind: "paragraph",
      tagName: "p",
      text: "Old text",
      html: "<p>Old text</p>",
    },
    right: {
      id,
      kind: "paragraph",
      tagName: "p",
      text: "Updated text",
      html: "<p>Updated text</p>",
    },
  };
}

function presentation(blocks: RenderedBlockDiff[]): RenderedDiffPresentation {
  return {
    entries: blocks.map((item, index) => ({
      id: `entry:${index}`,
      kind: "block",
      block: item,
    })),
    navigationTargets: blocks.map((item, index) => ({
      index,
      entryId: `entry:${index}`,
      side: "both",
      primarySide: "right",
      targetKind: "block",
      block: item,
    })),
    sectionOutline: [],
    fallbackReasons: [],
    inlineDiagnostics: [],
    entryChangeIndexes: new Map(),
    entryChildChangeIndexes: new Map(),
    entryStructuredChildChangeIndexes: new Map(),
    entryTableRowChangeIndexes: new Map(),
    entryTargetSides: new Map(),
  };
}

function renderHookHarness({
  config = enabledConfig(),
  document = documentPayload(),
  getGitDiffPreview = vi.fn(async () => preview()),
  rendered = null,
}: {
  config?: AppConfig | null;
  document?: DocumentPayload | null;
  getGitDiffPreview?: (path: string) => Promise<DocumentDiffPreview>;
  rendered?: RenderResult | null;
} = {}) {
  const harness = createReactRootHarness();
  const loadDiffDocumentContext = vi.fn(async () => null);
  const resolveDiffLocalImage = vi.fn();
  const renderDiffDiagram = vi.fn();
  let api: HookApi | null = null;

  function Probe() {
    const [currentConfig, setConfig] = useState<AppConfig | null>(config);
    const [currentDocument, setDocumentPayload] =
      useState<DocumentPayload | null>(document);
    const [documentDiffPreview, setDocumentDiffPreview] =
      useState<DocumentDiffPreview | null>(null);
    const [currentRenderResult, setRenderResult] =
      useState<RenderResult | null>(rendered);
    const emptySet = useMemo(() => new Set<string>(), []);
    const hook = usePostDiffGitMarkerState({
      config: currentConfig,
      documentPayload: currentDocument,
      documentDiffPreview,
      renderResult: currentRenderResult,
      confirmedRemoteDiagramKeys: emptySet,
      krokiFallbackDiagramKeys: emptySet,
      getGitDiffPreview,
      loadDiffDocumentContext,
      resolveDiffLocalImage,
      renderDiffDiagram,
      setDocumentDiffPreview,
    });
    api = {
      ...hook,
      setConfig,
      setDocumentDiffPreview,
      setDocumentPayload,
      setRenderResult,
    };
    return null;
  }

  harness.render(<Probe />);
  if (!api) {
    throw new Error("Hook probe did not render.");
  }
  return {
    api: () => api as HookApi,
    cleanup: harness.cleanup,
    getGitDiffPreview,
    loadDiffDocumentContext,
    renderDiffDiagram,
    resolveDiffLocalImage,
  };
}

async function flushHookUpdates() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("usePostDiffGitMarkerState", () => {
  it("clears stale markers and suppresses marker work for a too-complex preview", async () => {
    const getGitDiffPreview = vi.fn(async () => preview());
    const {
      api,
      cleanup,
      loadDiffDocumentContext,
      renderDiffDiagram,
      resolveDiffLocalImage,
    } = renderHookHarness({ getGitDiffPreview });

    await act(async () => {
      api().closeDocumentDiffPreview({
        preview: preview(),
        renderedPresentation: presentation([block("rendered-block:0")]),
      });
    });
    await flushHookUpdates();
    expect(api().activePostDiffGitMarkers).not.toBeNull();
    expect(getGitDiffPreview).toHaveBeenCalledTimes(1);

    const blockedPreview = preview({
      lineDiffAvailability: "too-complex",
      lineDiffFallbackReason: "work-budget-exceeded",
      hunks: [],
    });
    await act(async () => {
      api().setDocumentDiffPreview(blockedPreview);
    });
    expect(api().activePostDiffGitMarkers).toBeNull();

    await act(async () => {
      api().closeDocumentDiffPreview({
        preview: blockedPreview,
        renderedPresentation: presentation([]),
      });
      api().setRenderResult(renderResult());
    });
    await flushHookUpdates();

    expect(getGitDiffPreview).toHaveBeenCalledTimes(1);
    expect(loadDiffDocumentContext).not.toHaveBeenCalled();
    expect(resolveDiffLocalImage).not.toHaveBeenCalled();
    expect(renderDiffDiagram).not.toHaveBeenCalled();
    expect(api().activePostDiffGitMarkers).toBeNull();

    cleanup();
  });

  it("does not retry a too-complex marker payload until the document changes", async () => {
    const getGitDiffPreview = vi.fn(async () =>
      preview({
        lineDiffAvailability: "too-complex",
        lineDiffFallbackReason: "work-budget-exceeded",
        hunks: [],
      }),
    );
    const {
      api,
      cleanup,
      loadDiffDocumentContext,
      renderDiffDiagram,
      resolveDiffLocalImage,
    } = renderHookHarness({
      getGitDiffPreview,
      rendered: renderResult(),
    });

    await flushHookUpdates();
    expect(getGitDiffPreview).toHaveBeenCalledTimes(1);

    await act(async () => {
      api().setConfig({
        ...enabledConfig(),
        theme: "dark",
      });
    });
    await flushHookUpdates();
    expect(getGitDiffPreview).toHaveBeenCalledTimes(1);

    await act(async () => {
      api().setDocumentPayload({
        ...documentPayload(),
        updatedAt: "2026-06-08T00:00:01.000Z",
      });
    });
    await flushHookUpdates();
    expect(getGitDiffPreview).toHaveBeenCalledTimes(2);
    expect(loadDiffDocumentContext).not.toHaveBeenCalled();
    expect(resolveDiffLocalImage).not.toHaveBeenCalled();
    expect(renderDiffDiagram).not.toHaveBeenCalled();

    cleanup();
  });

  it("creates the active document context from Diff Preview close handoff", async () => {
    const { api, cleanup } = renderHookHarness();

    await act(async () => {
      api().closeDocumentDiffPreview({
        preview: preview(),
        renderedPresentation: presentation([block("rendered-block:0")]),
      });
    });
    await flushHookUpdates();

    expect(api().activePostDiffGitMarkers).toMatchObject({
      documentPath: activePath,
      documentUpdatedAt: "2026-06-08T00:00:00.000Z",
      renderedCount: 1,
      totalCount: 1,
      markers: [
        {
          kind: "changed",
          anchorBlockId: "rendered-block:0",
        },
      ],
    });

    cleanup();
  });

  it("clears the current context when handoff does not match the active document", async () => {
    const { api, cleanup } = renderHookHarness();

    await act(async () => {
      api().closeDocumentDiffPreview({
        preview: preview(),
        renderedPresentation: presentation([block("rendered-block:0")]),
      });
    });
    await flushHookUpdates();
    expect(api().activePostDiffGitMarkers).not.toBeNull();

    await act(async () => {
      api().closeDocumentDiffPreview({
        preview: preview({
          leftPath: "/workspace/docs/other.md",
          rightPath: "/workspace/docs/other.md",
          relativePath: "docs/other.md",
        }),
        renderedPresentation: presentation([block("rendered-block:1")]),
      });
    });
    await flushHookUpdates();

    expect(api().activePostDiffGitMarkers).toBeNull();

    cleanup();
  });

  it("keeps markers for unrelated file tree refresh and keeps active markers while refresh is pending", async () => {
    const { api, cleanup } = renderHookHarness();
    const refreshGitChanges = vi.fn();

    await act(async () => {
      api().closeDocumentDiffPreview({
        preview: preview(),
        renderedPresentation: presentation([block("rendered-block:0")]),
      });
    });
    await flushHookUpdates();
    const context = api().activePostDiffGitMarkers;

    await act(async () => {
      api().handleWorkspaceFileChangeRefresh(
        { reason: "directory-watch", changedPath: "/workspace/docs/other.md" },
        refreshGitChanges,
      );
    });

    expect(api().activePostDiffGitMarkers).toBe(context);
    expect(refreshGitChanges).toHaveBeenLastCalledWith(
      "file-tree-directory-watch",
    );

    await act(async () => {
      api().handleWorkspaceFileChangeRefresh(
        { reason: "directory-watch", changedPath: activePath },
        refreshGitChanges,
      );
    });

    expect(api().activePostDiffGitMarkers).toBe(context);

    cleanup();
  });

  it("clears active markers only after active document refresh confirms a clean preview", async () => {
    const getGitDiffPreview = vi
      .fn()
      .mockResolvedValueOnce(preview())
      .mockResolvedValueOnce(preview({ status: "clean", hunks: [] }));
    const { api, cleanup } = renderHookHarness({ getGitDiffPreview });
    const refreshGitChanges = vi.fn();

    await act(async () => {
      api().closeDocumentDiffPreview({
        preview: preview(),
        renderedPresentation: presentation([block("rendered-block:0")]),
      });
    });
    await flushHookUpdates();
    const context = api().activePostDiffGitMarkers;
    await act(async () => {
      api().setRenderResult(renderResult());
    });

    await act(async () => {
      api().handleWorkspaceFileChangeRefresh(
        { reason: "directory-watch", changedPath: activePath },
        refreshGitChanges,
      );
      expect(api().activePostDiffGitMarkers).toBe(context);
    });
    await flushHookUpdates();

    expect(api().activePostDiffGitMarkers).toBeNull();

    cleanup();
  });

  it("clears active markers after metadata refresh confirms the committed document is clean", async () => {
    const getGitDiffPreview = vi
      .fn()
      .mockResolvedValueOnce(preview())
      .mockResolvedValueOnce(preview({ status: "clean", hunks: [] }));
    const { api, cleanup } = renderHookHarness({ getGitDiffPreview });

    await act(async () => {
      api().closeDocumentDiffPreview({
        preview: preview(),
        renderedPresentation: presentation([block("rendered-block:0")]),
      });
    });
    await flushHookUpdates();
    const context = api().activePostDiffGitMarkers;
    await act(async () => {
      api().setRenderResult(renderResult());
    });

    await act(async () => {
      api().handleGitChangesRefreshComplete("metadata-event", gitChanges([]));
      expect(api().activePostDiffGitMarkers).toBe(context);
    });
    await flushHookUpdates();

    expect(api().activePostDiffGitMarkers).toBeNull();

    cleanup();
  });

  it("keeps active markers after metadata refresh when the active document remains dirty", async () => {
    const getGitDiffPreview = vi
      .fn()
      .mockResolvedValueOnce(preview())
      .mockResolvedValueOnce(preview());
    const { api, cleanup } = renderHookHarness({ getGitDiffPreview });

    await act(async () => {
      api().closeDocumentDiffPreview({
        preview: preview(),
        renderedPresentation: presentation([block("rendered-block:0")]),
      });
    });
    await flushHookUpdates();
    const context = api().activePostDiffGitMarkers;
    await act(async () => {
      api().setRenderResult(renderResult());
    });

    await act(async () => {
      api().handleGitChangesRefreshComplete(
        "metadata-event",
        gitChanges([
          {
            path: "docs/current.md",
            status: "modified",
            documentPath: activePath,
          },
        ]),
      );
      expect(api().activePostDiffGitMarkers).toBe(context);
    });
    await flushHookUpdates();

    expect(api().activePostDiffGitMarkers).toBe(context);

    cleanup();
  });

  it("keeps active markers untouched for warm git refreshes", async () => {
    const { api, cleanup } = renderHookHarness();

    await act(async () => {
      api().closeDocumentDiffPreview({
        preview: preview(),
        renderedPresentation: presentation([block("rendered-block:0")]),
      });
    });
    await flushHookUpdates();
    const context = api().activePostDiffGitMarkers;

    await act(async () => {
      api().handleGitChangesRefreshComplete("idle-warm", gitChanges([]));
    });

    expect(api().activePostDiffGitMarkers).toBe(context);

    cleanup();
  });

  it("clears handoff markers when the current working tree preview is clean", async () => {
    const getGitDiffPreview = vi
      .fn()
      .mockResolvedValueOnce(preview())
      .mockResolvedValueOnce(preview({ status: "clean", hunks: [] }));
    const { api, cleanup } = renderHookHarness({ getGitDiffPreview });

    await act(async () => {
      api().closeDocumentDiffPreview({
        preview: preview(),
        renderedPresentation: presentation([block("rendered-block:0")]),
      });
    });
    await flushHookUpdates();
    expect(api().activePostDiffGitMarkers).not.toBeNull();

    await act(async () => {
      api().closeDocumentDiffPreview({
        preview: preview(),
        renderedPresentation: presentation([block("rendered-block:1")]),
      });
    });
    await flushHookUpdates();

    expect(api().activePostDiffGitMarkers).toBeNull();

    cleanup();
  });

  it("does not hand off history or ref previews to Change Review Mode", async () => {
    const { api, cleanup } = renderHookHarness({
      getGitDiffPreview: vi.fn(async () => preview()),
    });

    await act(async () => {
      api().closeDocumentDiffPreview({
        preview: preview({
          leftLabel: "0000000",
          rightLabel: "1111111",
        }),
        renderedPresentation: presentation([block("rendered-block:0")]),
      });
    });
    await flushHookUpdates();

    expect(api().activePostDiffGitMarkers).toBeNull();

    cleanup();
  });

  it("does not hand off file-to-file previews to Change Review Mode", async () => {
    const { api, cleanup } = renderHookHarness({
      getGitDiffPreview: vi.fn(async () => preview()),
    });

    await act(async () => {
      api().closeDocumentDiffPreview({
        preview: preview({
          source: "file",
          leftLabel: "base.md",
          rightLabel: "current.md",
          leftPath: "/workspace/docs/base.md",
          rightPath: activePath,
          relativePath: "base.md ↔ current.md",
        }),
        renderedPresentation: presentation([block("rendered-block:0")]),
      });
    });
    await flushHookUpdates();

    expect(api().activePostDiffGitMarkers).toBeNull();

    cleanup();
  });

  it("does not commit stale handoff results after switching documents", async () => {
    let resolvePreview: ((value: DocumentDiffPreview) => void) | null = null;
    const getGitDiffPreview = vi.fn(
      () =>
        new Promise<DocumentDiffPreview>((resolve) => {
          resolvePreview = resolve;
        }),
    );
    const { api, cleanup } = renderHookHarness({ getGitDiffPreview });

    await act(async () => {
      api().closeDocumentDiffPreview({
        preview: preview(),
        renderedPresentation: presentation([block("rendered-block:0")]),
      });
      api().setDocumentPayload(documentPayload("/workspace/docs/other.md"));
    });

    await act(async () => {
      resolvePreview?.(preview());
    });
    await flushHookUpdates();
    expect(api().activePostDiffGitMarkers).toBeNull();

    await act(async () => {
      api().setDocumentPayload(documentPayload(activePath));
    });
    expect(api().activePostDiffGitMarkers).toBeNull();

    cleanup();
  });

  it("does not commit a clean initial working-tree preview", async () => {
    const getGitDiffPreview = vi.fn(async () =>
      preview({ status: "clean", hunks: [] }),
    );
    const { api, cleanup } = renderHookHarness({
      getGitDiffPreview,
      rendered: renderResult(),
    });

    await flushHookUpdates();

    expect(api().activePostDiffGitMarkers).toBeNull();

    cleanup();
  });
});
