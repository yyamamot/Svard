import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFileTreeState } from "../../src/ui/hooks/useFileTreeState";
import { fileTreeRevealPaths } from "../../src/ui/lib/fileTreeReveal";
import type { DirectoryEntry } from "../../src/core/types";

type Options = Parameters<typeof useFileTreeState>[0];

const entry = (
  path: string,
  kind: DirectoryEntry["kind"] = "directory",
): DirectoryEntry => ({ path, kind, name: path.split("/").at(-1)! });
const listings: Record<string, DirectoryEntry[]> = {
  "/work": [entry("/work/a")],
  "/work/a": [entry("/work/a/b")],
  "/work/a/b": [entry("/work/a/b/current.md", "file")],
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("current file reveal state", () => {
  let root: Root;
  let container: HTMLDivElement;
  let api: ReturnType<typeof useFileTreeState>;
  let props: {
    activePath?: string;
    contextKey?: string;
    revealDisabled?: boolean;
  };
  let host: {
    listDirectory: ReturnType<
      typeof vi.fn<(path: string) => Promise<DirectoryEntry[]>>
    >;
    watchDirectory: ReturnType<typeof vi.fn<Options["host"]["watchDirectory"]>>;
  };
  let persist: ReturnType<typeof vi.fn<Options["persistWorkspace"]>>;
  let notice: ReturnType<typeof vi.fn<Options["showInlineNotice"]>>;
  let unmounted: boolean;
  function Harness() {
    api = useFileTreeState({
      host,
      persistWorkspace: persist,
      showInlineNotice: notice,
      ...props,
    });
    return null;
  }
  async function render(next = {}) {
    props = { ...props, ...next };
    await act(async () => {
      root.render(<Harness />);
    });
  }
  beforeEach(async () => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    root = createRoot(container);
    unmounted = false;
    props = { activePath: "/work/a/b/current.md", contextKey: "left" };
    host = {
      listDirectory: vi.fn(async (path: string) => listings[path] ?? []),
      watchDirectory: vi.fn<Options["host"]["watchDirectory"]>(async () => ({
        dispose() {},
      })),
    };
    persist = vi.fn<Options["persistWorkspace"]>(async () => undefined);
    notice = vi.fn<Options["showInlineNotice"]>();
    await render();
    await act(async () => {
      api.setRootDirectory("/work");
      api.setExpandedDirectories(new Set(["/work/other"]));
    });
  });
  afterEach(() => {
    if (!unmounted) act(() => root.unmount());
    container.remove();
  });

  it("loads ancestors in order, verifies the file, and preserves unrelated expansion", async () => {
    expect(host.listDirectory).not.toHaveBeenCalled();
    await act(async () => {
      await api.revealCurrentFile();
    });
    expect(host.listDirectory.mock.calls.map(([path]) => path)).toEqual([
      "/work",
      "/work/a",
      "/work/a/b",
    ]);
    expect([...api.expandedDirectories]).toEqual([
      "/work/other",
      "/work/a",
      "/work/a/b",
    ]);
    expect(api.childrenByDirectory).toEqual(listings);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(api.revealRequest).toMatchObject({ path: props.activePath });
    await render({ activePath: "/work/other.adoc" });
    expect(api.revealRequest).toBeNull();
    expect(host.listDirectory).toHaveBeenCalledTimes(3);
  });

  it.each([
    undefined,
    "/work-other/file.md",
    "/elsewhere/file.md",
    "/work/a.png",
    "/work/../file.md",
  ])("disables invalid target %s", async (activePath) => {
    await render({ activePath });
    expect(api.canRevealCurrentFile).toBe(false);
    await act(async () => {
      await api.revealCurrentFile();
    });
    expect(host.listDirectory).not.toHaveBeenCalled();
  });

  it("disables reveal for non-document contexts", async () => {
    await render({ revealDisabled: true });
    expect(api.canRevealCurrentFile).toBe(false);
    await act(async () => {
      await api.revealCurrentFile();
    });
    expect(host.listDirectory).not.toHaveBeenCalled();
  });

  it.each(["missing", "failed"])(
    "reports %s without partial expansion or private error details",
    async (failure) => {
      host.listDirectory.mockImplementation(async (path) => {
        if (path === "/work/a/b") {
          if (failure === "failed") throw new Error("PRIVATE_PATH_SECRET");
          return [];
        }
        return listings[path] ?? [];
      });
      await act(async () => {
        await api.revealCurrentFile();
      });
      expect(api.childrenByDirectory).toEqual({});
      expect([...api.expandedDirectories]).toEqual(["/work/other"]);
      expect(api.revealRequest).toBeNull();
      expect(persist).not.toHaveBeenCalled();
      expect(notice).toHaveBeenCalledWith(
        "Unable to reveal the current file in the file tree.",
        { tone: "warning" },
      );
    },
  );

  it.each(["document", "workspace", "pane", "cancel", "unmount"])(
    "invalidates pending reveal on %s, including switch away and back",
    async (change) => {
      const pending = deferred<DirectoryEntry[]>();
      host.listDirectory.mockReturnValueOnce(pending.promise);
      let operation!: Promise<void>;
      act(() => {
        operation = api.revealCurrentFile();
      });
      if (change === "workspace") {
        await act(async () => {
          api.setRootDirectory("/other");
        });
        await act(async () => {
          api.setRootDirectory("/work");
        });
      } else if (change === "document") {
        await render({ activePath: "/work/other.md" });
        await render({ activePath: "/work/a/b/current.md" });
      } else if (change === "pane") {
        await render({ contextKey: "right" });
        await render({ contextKey: "left" });
      } else if (change === "cancel") {
        act(() => api.cancelReveal());
      } else {
        act(() => root.unmount());
        unmounted = true;
      }
      await act(async () => {
        pending.resolve(listings["/work"]);
        await operation;
      });
      expect(host.listDirectory).toHaveBeenCalledTimes(1);
      expect(persist).not.toHaveBeenCalled();
      expect(notice).not.toHaveBeenCalled();
      expect(api.childrenByDirectory).toEqual({});
    },
  );

  it("waits for each ancestor and merges live expansion with the latest persistence callback", async () => {
    const pending = deferred<DirectoryEntry[]>();
    host.listDirectory.mockReturnValueOnce(pending.promise);
    let operation!: Promise<void>;
    act(() => {
      operation = api.revealCurrentFile();
    });
    expect(host.listDirectory.mock.calls).toEqual([["/work"]]);
    const oldPersist = persist;
    persist = vi.fn<Options["persistWorkspace"]>(async () => undefined);
    await render();
    await act(async () => {
      api.setExpandedDirectories(new Set(["/work/newly-opened"]));
    });
    await act(async () => {
      pending.resolve(listings["/work"]);
      await operation;
    });
    expect([...api.expandedDirectories]).toEqual([
      "/work/newly-opened",
      "/work/a",
      "/work/a/b",
    ]);
    expect(oldPersist).not.toHaveBeenCalled();
    expect(persist).toHaveBeenCalledOnce();
  });

  it("reveals a Windows drive-root document using native listing paths", async () => {
    await render({ activePath: "C:\\guide.adoc" });
    await act(async () => {
      api.setRootDirectory("C:\\");
      api.setExpandedDirectories(new Set());
    });
    host.listDirectory.mockResolvedValue([entry("C:\\guide.adoc", "file")]);
    await act(async () => {
      await api.revealCurrentFile();
    });
    expect(host.listDirectory).toHaveBeenCalledWith("C:\\");
    expect(api.revealRequest?.path).toBe("C:\\guide.adoc");
    expect([...api.expandedDirectories]).toEqual([]);
  });

  it("acknowledges only the matching request and preserves a newer reveal", async () => {
    await act(async () => {
      await api.revealCurrentFile();
    });
    const firstId = api.revealRequest!.id;
    await act(async () => {
      await api.revealCurrentFile();
    });
    const secondId = api.revealRequest!.id;
    act(() => api.acknowledgeReveal(firstId));
    expect(api.revealRequest?.id).toBe(secondId);
    act(() => api.acknowledgeReveal(secondId));
    expect(api.revealRequest).toBeNull();
  });

  it("only applies the newest explicit request", async () => {
    const pending = deferred<DirectoryEntry[]>();
    host.listDirectory.mockReturnValueOnce(pending.promise);
    let old!: Promise<void>;
    act(() => {
      old = api.revealCurrentFile();
    });
    await act(async () => {
      await api.revealCurrentFile();
    });
    const request = api.revealRequest;
    await act(async () => {
      pending.resolve([]);
      await old;
    });
    expect(api.revealRequest).toEqual(request);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(notice).not.toHaveBeenCalled();
  });
});

describe("reveal containment", () => {
  it.each([
    ["/", "/a/file.md", ["/a", "/a/file.md"]],
    ["C:\\", "C:\\a\\file.adoc", ["C:/a", "C:/a/file.adoc"]],
    ["C:\\work\\", "C:\\work\\file.md", ["C:/work/file.md"]],
    [
      "\\\\server\\share",
      "\\\\server\\share\\file.md",
      ["//server/share/file.md"],
    ],
    ["C:\\work", "C:\\work-other\\file.md", null],
    ["/work", "/work", null],
  ])("checks %s and %s", (workspace, path, expected) => {
    expect(fileTreeRevealPaths(workspace as string, path as string)).toEqual(
      expected,
    );
  });
});
