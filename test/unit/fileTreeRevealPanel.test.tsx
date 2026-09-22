import { act, useState, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FileTreePanel } from "../../src/ui/components/FileTreePanel";

const file = {
  kind: "file" as const,
  name: "current[1].md",
  path: "/workspace/current[1].md",
};
const other = {
  kind: "file" as const,
  name: "other.adoc",
  path: "/workspace/other.adoc",
};
const props: ComponentProps<typeof FileTreePanel> = {
  rootDirectory: "/workspace",
  rootEntries: [file, other],
  childrenByDirectory: { "/workspace": [file, other] },
  expandedDirectories: new Set(),
  loadingDirectories: new Set(),
  directoryErrors: {},
  activePath: file.path,
  gitStatusByPath: {},
  gitChanges: null,
  canRevealCurrentFile: true,
  onOpenFile: vi.fn(),
  onOpenGitDiff: vi.fn(),
  onToggleDirectory: vi.fn(),
  onPickDocument: vi.fn(),
  onPickDirectory: vi.fn(),
  onRefresh: vi.fn(),
  onCollapse: vi.fn(),
};

function rect(top: number, bottom: number): DOMRect {
  return {
    top,
    bottom,
    left: 0,
    right: 200,
    x: 0,
    y: top,
    width: 200,
    height: bottom - top,
    toJSON: () => ({}),
  };
}

describe("FileTreePanel explicit reveal", () => {
  let outer: HTMLDivElement;
  let container: HTMLDivElement;
  let root: Root;
  let rowTop: number;
  let focus: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    outer = document.createElement("div");
    container = document.createElement("div");
    container.className = "sidebar-tab-panel";
    outer.append(container);
    document.body.append(outer);
    root = createRoot(container);
    outer.scrollTop = 60;
    container.scrollTop = 100;
    rowTop = 280;
    Object.defineProperty(container, "clientHeight", { value: 100 });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        return this === container ? rect(100, 200) : rect(rowTop, rowTop + 28);
      },
    );
    focus = vi.spyOn(HTMLElement.prototype, "focus");
  });

  afterEach(() => {
    act(() => root.unmount());
    outer.remove();
    vi.restoreAllMocks();
  });

  function render(
    overrides: Partial<ComponentProps<typeof FileTreePanel>> = {},
  ) {
    act(() => root.render(<FileTreePanel {...props} {...overrides} />));
  }

  it("scrolls only the Files scroller to the nearest lower edge and focuses the open button", () => {
    render({ revealRequest: { id: 1, path: file.path } });
    expect(container.scrollTop).toBe(208);
    expect(outer.scrollTop).toBe(60);
    expect(document.activeElement?.getAttribute("aria-current")).toBe("page");
    expect(document.activeElement?.getAttribute("aria-label")).toBe(file.name);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("uses the upper edge when above and leaves an already-visible row in place", () => {
    rowTop = 50;
    render({ revealRequest: { id: 1, path: file.path } });
    expect(container.scrollTop).toBe(50);
    rowTop = 130;
    render({ revealRequest: { id: 2, path: file.path } });
    expect(container.scrollTop).toBe(50);
    expect(focus).toHaveBeenCalledTimes(2);
  });

  it("does not follow active changes or repeat a consumed request, but accepts a new request", () => {
    render();
    render({ activePath: other.path });
    expect(container.scrollTop).toBe(100);
    expect(focus).not.toHaveBeenCalled();
    render({ revealRequest: { id: 1, path: file.path } });
    container.scrollTop = 0;
    focus.mockClear();
    render({
      revealRequest: { id: 1, path: file.path },
      gitStatusByPath: { [file.path]: "modified" },
    });
    expect(container.scrollTop).toBe(0);
    expect(focus).not.toHaveBeenCalled();
    render({ revealRequest: { id: 2, path: file.path } });
    expect(container.scrollTop).toBe(108);
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it("waits for the requested row to render in Tree mode", () => {
    const revealRequest = { id: 1, path: file.path };
    render({ revealRequest, filesViewMode: "documents-path" });
    expect(focus).not.toHaveBeenCalled();
    render({ revealRequest, childrenByDirectory: { "/workspace": [other] } });
    expect(focus).not.toHaveBeenCalled();
    render({ revealRequest });
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it("acknowledges a completed request so remounting the panel cannot replay it", () => {
    const onConsumed = vi.fn();
    function Owner({ visible }: { visible: boolean }) {
      const [request, setRequest] = useState<{
        id: number;
        path: string;
      } | null>({
        id: 7,
        path: file.path,
      });
      return visible ? (
        <FileTreePanel
          {...props}
          revealRequest={request}
          onRevealConsumed={(id) => {
            onConsumed(id);
            setRequest((current) => (current?.id === id ? null : current));
          }}
        />
      ) : null;
    }
    act(() => root.render(<Owner visible />));
    expect(onConsumed).toHaveBeenCalledExactlyOnceWith(7);
    expect(focus).toHaveBeenCalledTimes(1);
    act(() => root.render(<Owner visible={false} />));
    container.scrollTop = 0;
    act(() => root.render(<Owner visible />));
    expect(container.scrollTop).toBe(0);
    expect(focus).toHaveBeenCalledTimes(1);
    expect(onConsumed).toHaveBeenCalledTimes(1);
  });

  it("does not focus stale or disabled targets", () => {
    render({ revealRequest: { id: 1, path: other.path } });
    render({
      revealRequest: { id: 2, path: file.path },
      canRevealCurrentFile: false,
    });
    expect(focus).not.toHaveBeenCalled();
    expect(container.scrollTop).toBe(100);
  });

  it("exposes a named Tree-only reveal control before Refresh and honors its disabled state", () => {
    const onRevealCurrentFile = vi.fn();
    render({ onRevealCurrentFile });
    const reveal = container.querySelector<HTMLButtonElement>(
      '[data-review-id="tree-reveal-current"]',
    )!;
    expect(reveal.getAttribute("aria-label")).toBe(
      "Reveal Current File in File Tree",
    );
    expect(reveal.title).toBe("Reveal Current File in File Tree");
    expect(reveal.nextElementSibling?.getAttribute("data-review-id")).toBe(
      "tree-refresh",
    );
    act(() => reveal.click());
    expect(onRevealCurrentFile).toHaveBeenCalledTimes(1);
    render({ onRevealCurrentFile, canRevealCurrentFile: false });
    expect(reveal.disabled).toBe(true);
    act(() => reveal.click());
    expect(onRevealCurrentFile).toHaveBeenCalledTimes(1);
    render({ filesViewMode: "documents-path" });
    expect(
      container.querySelector('[data-review-id="tree-reveal-current"]'),
    ).toBeNull();
  });
});
