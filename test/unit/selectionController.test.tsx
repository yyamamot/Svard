import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DocumentSelectionSnapshot } from "../../src/core/types";
import type { ActiveSelectionRange } from "../../src/ui/hooks/useSelectionRangeController";
import { useSelectionSnapshotActions } from "../../src/ui/hooks/useSelectionSnapshotActions";
import { selectionTextReference } from "../../src/ui/lib/documentSelection";

interface Context {
  revision: string;
}

const snapshot: DocumentSelectionSnapshot = {
  snapshotId: "selection-1",
  documentPath: "docs/guide.md",
  documentRevision: "revision-1",
  plainText: "Selected text",
  blocks: [
    {
      type: "prose",
      role: "paragraph",
      markdown: "Selected text",
      plainText: "Selected text",
    },
  ],
  imageResources: [],
  provenance: [
    {
      sourcePath: "docs/guide.md",
      startLine: 1,
      endLine: 1,
      exact: true,
    },
  ],
  diagnostics: [],
};

function activeSelection(
  bounds: HTMLElement,
  selectionId: number,
): ActiveSelectionRange<Context> {
  const range = document.createRange();
  range.selectNodeContents(bounds);
  return {
    bounds,
    context: { revision: `revision-${selectionId}` },
    range,
    selectionId,
    left: 0,
    top: 0,
    positioned: true,
    side: "above",
  };
}

describe("shared selection snapshot actions", () => {
  let container: HTMLDivElement;
  let bounds: HTMLDivElement;
  let root: Root;
  let api: ReturnType<typeof useSelectionSnapshotActions<Context>> | undefined;
  const prepareSnapshot = vi.fn(async () => snapshot);
  const onAddSelection = vi.fn();
  const dismissSelection = vi.fn();
  const showNotice = vi.fn();

  function Harness({ selectionId }: { selectionId: number }) {
    const actions = useSelectionSnapshotActions({
      active: activeSelection(bounds, selectionId),
      canAsk: true,
      dismissSelection,
      onAddSelection,
      prepareSnapshot,
      showNotice,
    });
    useEffect(() => {
      api = actions;
    }, [actions]);
    return null;
  }

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    bounds = document.createElement("div");
    bounds.textContent = "Selected text";
    container.append(bounds);
    document.body.append(container);
    root = createRoot(container);
    prepareSnapshot.mockClear();
    onAddSelection.mockClear();
    dismissSelection.mockClear();
    showNotice.mockClear();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn(async () => undefined) },
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    api = undefined;
  });

  it("prepares one immutable snapshot for menu, copy, and Ask", async () => {
    await act(async () => {
      root.render(<Harness selectionId={1} />);
    });
    await act(async () => {
      await api?.toggleMenu();
      await api?.copy(selectionTextReference);
      await api?.ask();
    });

    expect(prepareSnapshot).toHaveBeenCalledTimes(1);
    expect(onAddSelection).toHaveBeenCalledWith(
      snapshot,
      expect.objectContaining({ selectionId: 1 }),
    );
    expect(dismissSelection).toHaveBeenCalledOnce();
  });

  it("invalidates the snapshot cache when the selection changes", async () => {
    await act(async () => {
      root.render(<Harness selectionId={1} />);
    });
    await act(async () => {
      await api?.prepare();
      root.render(<Harness selectionId={2} />);
    });
    await act(async () => {
      await api?.prepare();
    });

    expect(prepareSnapshot).toHaveBeenCalledTimes(2);
  });

  it("uses the shared Cmd+Shift+A action", async () => {
    await act(async () => {
      root.render(<Harness selectionId={1} />);
    });
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "a",
          metaKey: true,
          shiftKey: true,
        }),
      );
      await Promise.resolve();
    });

    expect(onAddSelection).toHaveBeenCalledOnce();
  });
});
