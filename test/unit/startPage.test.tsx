import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StartPage } from "../../src/ui/components/StartPage";

describe("StartPage path display", () => {
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

  it("uses basenames for Windows recent directory fallback labels", async () => {
    await act(async () => {
      root.render(
        <StartPage
          recentDocuments={[]}
          recentDirectories={[
            {
              path: "C:\\Users\\me\\project",
              lastOpenedAt: "2026-05-18T00:00:00.000Z",
            },
          ]}
          bookmarks={[]}
          onOpenDocument={vi.fn()}
          onOpenDirectory={vi.fn()}
          onPickDocument={vi.fn()}
          onPickDirectory={vi.fn()}
          onClearRecentDocuments={vi.fn()}
          onClearRecentDirectories={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain("project");
    expect(container.textContent).not.toContain("C:\\Users");
  });
});
