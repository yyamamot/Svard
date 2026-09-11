import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultConfig } from "../../src/core/defaultConfig";
import type { DocumentPayload, HostAdapter } from "../../src/core/types";
import { useDocumentLifecycle } from "../../src/ui/hooks/useDocumentLifecycle";
import { useOpenFileActions } from "../../src/ui/hooks/useOpenFileActions";
import { useDocumentReadingPosition } from "../../src/ui/hooks/useDocumentReadingPosition";
import {
  createReadingPositionController,
  type ReadingPositionController,
} from "../../src/ui/lib/readingPositionController";
import { bindReadingPosition } from "../../src/ui/lib/bindReadingPosition";
import { createReactRootHarness } from "./helpers/reactHarness";
import { readingSurface } from "./helpers/readingSurface";

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

function pendingDocument() {
  let resolve!: (value: DocumentPayload) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<DocumentPayload>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function navigationProbe(open: HostAdapter["openDocument"]) {
  const controller = createReadingPositionController();
  const { surface } = readingSurface();
  const detach = bindReadingPosition(controller, "left", surface);
  surface.viewer.scrollTop = 1377;
  const setDocumentPayload = vi.fn();
  const setIsLoading = vi.fn();
  const showInlineNotice = vi.fn();
  const harness = createReactRootHarness();
  let lifecycle!: ReturnType<typeof useDocumentLifecycle>;
  let actions!: ReturnType<typeof useOpenFileActions>;
  const shared = {
    readingPosition: controller,
    config: defaultConfig,
    documentPayload: surface.payload,
    focusedPaneId: "left" as const,
    focusPane: vi.fn(),
    snapshotForPath: () => null,
    persistWorkspace: vi.fn(async () => {}),
    recordNavigation: vi.fn(),
    searchQueryForPath: () => "",
    setDocumentPayload,
    setIsLoading,
    setError: vi.fn(),
    setQuery: vi.fn(),
    setRenderResult: vi.fn(),
    setTabs: vi.fn(),
    tabs: [surface.payload],
    showInlineNotice,
  };
  function Probe() {
    lifecycle = useDocumentLifecycle({
      ...shared,
      activeHeadingId: null,
      articleRef: { current: surface.article },
      viewerRef: { current: surface.viewer },
      canWatchDocuments: false,
      canDrainPendingOpenRequests: false,
      host: {
        openDocument: open,
        watchOpenRequests: async () => ({ dispose() {} }),
      } as unknown as HostAdapter,
      dismissInlineNotice: vi.fn(),
      setChildrenByDirectory: vi.fn(),
      setDirectoryErrors: vi.fn(),
      setExpandedDirectories: vi.fn(),
      setPendingSmartScrollAnchor: vi.fn(),
      bumpDocumentRenderRevision: vi.fn(),
      setOpenFileReloadStates: vi.fn(),
      setRootDirectory: vi.fn(),
      setWorkspaceEnvironment: vi.fn(),
    });
    actions = useOpenFileActions({
      ...shared,
      openDocument: lifecycle.openDocument,
      lastClosedTabs: [],
      openFileReloadStates: {},
      orderedTabs: [surface.payload],
      replaceClosedDocumentInPaneSnapshots: vi.fn(),
      resetSplitToDocument: vi.fn(),
      resetSplitToEmpty: vi.fn(),
      setActiveHeadingId: vi.fn(),
      setDocumentHtml: vi.fn(),
      setFocusedPaneId: vi.fn(),
      setLastClosedTabs: vi.fn(),
      setNavigationBackStack: vi.fn(),
      setNavigationForwardStack: vi.fn(),
      setPendingNavigationLocation: vi.fn(),
      setSearchHits: vi.fn(),
      setSearchIndex: vi.fn(),
      setSplitEnabled: vi.fn(),
      setTabMoreOpen: vi.fn(),
      showLightweightActionFeedback: vi.fn(),
    });
    return null;
  }
  harness.render(<Probe />);
  return {
    surface,
    controller,
    lifecycle,
    actions,
    setDocumentPayload,
    setIsLoading,
    showInlineNotice,
    cleanup: () => {
      harness.cleanup();
      detach();
      controller.dispose();
    },
  };
}

describe("document reading navigation integration", () => {
  it("ignores a stale open failure while the latest document is still loading", async () => {
    const b = pendingDocument();
    const c = pendingDocument();
    const probe = navigationProbe(
      vi.fn().mockReturnValueOnce(b.promise).mockReturnValueOnce(c.promise),
    );
    const openB = probe.lifecycle.openDocument("/workspace/b.md");
    const openC = probe.lifecycle.openDocument("/workspace/c.md");
    await act(async () => {
      b.reject(new Error("Stale failure"));
      await openB;
    });
    expect(probe.showInlineNotice).not.toHaveBeenCalled();
    expect(probe.setDocumentPayload).not.toHaveBeenCalled();
    expect(probe.setIsLoading).toHaveBeenLastCalledWith(true);
    await act(async () => {
      c.resolve({ ...probe.surface.payload, path: "/workspace/c.md" });
      await openC;
    });
    expect(probe.setIsLoading).toHaveBeenLastCalledWith(false);
    probe.cleanup();
  });

  it("does not apply an older open result after A to B to C", async () => {
    const b = pendingDocument();
    const c = pendingDocument();
    const probe = navigationProbe(
      vi.fn().mockReturnValueOnce(b.promise).mockReturnValueOnce(c.promise),
    );
    const openB = probe.lifecycle.openDocument("/workspace/b.md");
    const openC = probe.lifecycle.openDocument("/workspace/c.md");
    const payloadC = { ...probe.surface.payload, path: "/workspace/c.md" };
    await act(async () => {
      c.resolve(payloadC);
      await openC;
    });
    await act(async () => {
      b.resolve({ ...payloadC, path: "/workspace/b.md" });
      await openB;
    });
    expect(probe.setDocumentPayload).toHaveBeenCalledExactlyOnceWith(payloadC);
    expect(probe.controller.pendingFor("left")?.path).toBe(payloadC.path);
    probe.cleanup();
  });

  it("cached A selection invalidates an in-flight B open and keeps A's current position", async () => {
    const b = pendingDocument();
    const probe = navigationProbe(vi.fn().mockReturnValue(b.promise));
    const openB = probe.lifecycle.openDocument("/workspace/b.md");
    await act(async () => {
      await probe.actions.activateTab(probe.surface.payload.path);
    });
    await act(async () => {
      b.resolve({ ...probe.surface.payload, path: "/workspace/b.md" });
      await openB;
    });
    expect(probe.setDocumentPayload).toHaveBeenCalledExactlyOnceWith(
      probe.surface.payload,
    );
    expect(probe.surface.viewer.scrollTop).toBe(1377);
    expect(probe.setIsLoading).toHaveBeenLastCalledWith(false);
    probe.cleanup();
  });

  it("retains the displayed document and scroll when opening fails", async () => {
    const probe = navigationProbe(
      vi.fn().mockRejectedValue(new Error("Missing file")),
    );
    await act(async () => {
      await probe.lifecycle.openDocument("/workspace/missing.md");
    });
    expect(probe.setDocumentPayload).not.toHaveBeenCalled();
    expect(probe.surface.viewer.scrollTop).toBe(1377);
    expect(probe.controller.isRestoring()).toBe(false);
    expect(probe.showInlineNotice).toHaveBeenCalledWith(
      "Open failed: Missing file",
      { tone: "error" },
    );
    probe.cleanup();
  });

  it.each(["wheel", "touchstart", "pointerdown", "click", "keydown"])(
    "stops correction on %s, while programmatic scroll does not cancel it",
    (eventType) => {
      const harness = createReactRootHarness();
      let controller!: ReadingPositionController;
      function Probe() {
        controller = useDocumentReadingPosition();
        return null;
      }
      harness.render(<Probe />);
      const { surface } = readingSurface();
      const detach = bindReadingPosition(controller, "left", surface);
      surface.viewer.scrollTop = 1377;
      act(() => {
        controller.preserve("left");
      });
      act(() => {
        surface.viewer.dispatchEvent(new Event("scroll", { bubbles: true }));
      });
      expect(controller.isRestoring()).toBe(true);
      act(() => {
        surface.viewer.dispatchEvent(
          eventType === "keydown"
            ? new KeyboardEvent("keydown", { key: "PageDown", bubbles: true })
            : new Event(eventType, { bubbles: true }),
        );
      });
      expect(controller.isRestoring()).toBe(false);
      detach();
      harness.cleanup();
    },
  );
});
