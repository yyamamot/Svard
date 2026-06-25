import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FileTreePanel } from "../../src/ui/components/FileTreePanel";
import { chooseFileViewModeIn } from "./helpers/fileTreePanel";

describe("FileTreePanel MkDocs document order", () => {
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

  async function chooseFileViewMode(reviewId: string) {
    await chooseFileViewModeIn(container, reviewId);
  }

  it("orders Documents view by MkDocs nav when selected", async () => {
    await act(async () => {
      root.render(
        <FileTreePanel
          rootDirectory="/workspace"
          rootEntries={[
            { name: "docs", path: "/workspace/docs", kind: "directory" },
          ]}
          childrenByDirectory={{
            "/workspace": [
              { name: "docs", path: "/workspace/docs", kind: "directory" },
            ],
            "/workspace/docs": [
              {
                name: "z-last.md",
                path: "/workspace/docs/z-last.md",
                kind: "file",
              },
              {
                name: "index.md",
                path: "/workspace/docs/index.md",
                kind: "file",
              },
              {
                name: "extra.md",
                path: "/workspace/docs/extra.md",
                kind: "file",
              },
            ],
          }}
          expandedDirectories={new Set(["/workspace/docs"])}
          loadingDirectories={new Set()}
          directoryErrors={{}}
          gitStatusByPath={{}}
          gitChanges={null}
          documentOrder={{
            orders: [
              {
                source: "mkdocs",
                nodes: [
                  {
                    kind: "document",
                    title: "Home",
                    path: "/workspace/docs/index.md",
                    displayPath: "index.md",
                    depth: 0,
                    status: "resolved",
                  },
                  {
                    kind: "section",
                    title: "Guide",
                    depth: 0,
                    children: [
                      {
                        kind: "document",
                        title: "Last",
                        path: "/workspace/docs/z-last.md",
                        displayPath: "z-last.md",
                        depth: 1,
                        status: "resolved",
                      },
                      {
                        kind: "document",
                        title: "Missing",
                        path: "",
                        displayPath: "missing.md",
                        depth: 1,
                        status: "missing",
                      },
                    ],
                  },
                ],
              },
            ],
          }}
          openDocumentPaths={new Set()}
          activePath="/workspace/docs/index.md"
          onOpenFile={vi.fn()}
          onOpenGitDiff={vi.fn()}
          onToggleDirectory={vi.fn()}
          onPickDocument={vi.fn()}
          onPickDirectory={vi.fn()}
          onRefresh={vi.fn()}
          onCollapse={vi.fn()}
        />,
      );
    });

    await chooseFileViewMode("documents-view-mode-mkdocs");

    expect(
      container.querySelector('[data-review-id="documents-mkdocs-section"]')
        ?.textContent,
    ).toContain("Guide");
    expect(
      container.querySelector('[data-review-id="documents-mkdocs-not-in-nav"]')
        ?.textContent,
    ).toContain("Not in mkdocs.yml");
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          '[data-review-id="documents-mkdocs-section"] [data-review-id="documents-order-section-toggle"]',
        )
        ?.click();
      container
        .querySelector<HTMLButtonElement>(
          '[data-review-id="documents-mkdocs-not-in-nav"] [data-review-id="documents-order-section-toggle"]',
        )
        ?.click();
    });
    const rows = [
      ...container.querySelectorAll('[data-review-id="documents-view-row"]'),
    ];
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Home"),
      expect.stringContaining("Last"),
      expect.stringContaining("Missing"),
      expect.stringContaining("extra.md"),
    ]);
  });



  it("collapses MkDocs order sections and not-in-nav groups", async () => {
    await act(async () => {
      root.render(
        <FileTreePanel
          rootDirectory="/workspace"
          rootEntries={[
            { name: "docs", path: "/workspace/docs", kind: "directory" },
          ]}
          childrenByDirectory={{
            "/workspace": [
              { name: "docs", path: "/workspace/docs", kind: "directory" },
            ],
            "/workspace/docs": [
              {
                name: "extra.md",
                path: "/workspace/docs/extra.md",
                kind: "file",
              },
              {
                name: "index.md",
                path: "/workspace/docs/index.md",
                kind: "file",
              },
              {
                name: "last.md",
                path: "/workspace/docs/last.md",
                kind: "file",
              },
            ],
          }}
          expandedDirectories={new Set(["/workspace/docs"])}
          loadingDirectories={new Set()}
          directoryErrors={{}}
          gitStatusByPath={{}}
          gitChanges={null}
          documentOrder={{
            orders: [
              {
                source: "mkdocs",
                nodes: [
                  {
                    kind: "document",
                    title: "Home",
                    path: "/workspace/docs/index.md",
                    displayPath: "index.md",
                    depth: 0,
                    status: "resolved",
                  },
                  {
                    kind: "section",
                    title: "Guide",
                    depth: 0,
                    children: [
                      {
                        kind: "document",
                        title: "Last",
                        path: "/workspace/docs/last.md",
                        displayPath: "last.md",
                        depth: 1,
                        status: "resolved",
                      },
                      {
                        kind: "document",
                        title: "Missing",
                        path: "",
                        displayPath: "missing.md",
                        depth: 1,
                        status: "missing",
                      },
                    ],
                  },
                ],
              },
            ],
          }}
          openDocumentPaths={new Set()}
          activePath="/workspace/docs/index.md"
          onOpenFile={vi.fn()}
          onOpenGitDiff={vi.fn()}
          onToggleDirectory={vi.fn()}
          onPickDocument={vi.fn()}
          onPickDirectory={vi.fn()}
          onRefresh={vi.fn()}
          onCollapse={vi.fn()}
        />,
      );
    });

    await chooseFileViewMode("documents-view-mode-mkdocs");

    const guideToggle = container.querySelector<HTMLButtonElement>(
      '[data-review-id="documents-mkdocs-section"] [data-review-id="documents-order-section-toggle"]',
    );
    expect(guideToggle?.getAttribute("aria-expanded")).toBe("false");

    await act(async () => {
      guideToggle?.click();
    });
    expect(guideToggle?.getAttribute("aria-expanded")).toBe("true");
    expect(
      container.querySelector('[data-review-id="documents-mkdocs-section"]')
        ?.getAttribute("data-document-order-section-state"),
    ).toBe("expanded");

    let rows = [
      ...container.querySelectorAll('[data-review-id="documents-view-row"]'),
    ];
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Home"),
      expect.stringContaining("Last"),
      expect.stringContaining("Missing"),
    ]);

    const notInNavToggle = container.querySelector<HTMLButtonElement>(
      '[data-review-id="documents-mkdocs-not-in-nav"] [data-review-id="documents-order-section-toggle"]',
    );
    expect(notInNavToggle?.getAttribute("aria-expanded")).toBe("false");
    await act(async () => {
      notInNavToggle?.click();
    });
    rows = [
      ...container.querySelectorAll('[data-review-id="documents-view-row"]'),
    ];
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Home"),
      expect.stringContaining("Last"),
      expect.stringContaining("Missing"),
      expect.stringContaining("extra.md"),
    ]);
  });


});
