import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultConfig } from "../../src/core/defaultConfig";
import { useFileTreeRevealAction } from "../../src/ui/hooks/useFileTreeRevealAction";

type Options = Parameters<typeof useFileTreeRevealAction>[0];
describe("File Tree reveal shell action", () => {
  let container: HTMLDivElement;
  let root: Root;
  let reveal: () => Promise<void>;
  function Harness({ options }: { options: Options }) {
    reveal = useFileTreeRevealAction(options);
    return null;
  }
  const options = (): Options => ({
    config: {
      ...defaultConfig,
      sidebarVisible: false,
      workspace: { ...defaultConfig.workspace, sidebarTab: "bookmarks" },
    },
    contextKey: "first",
    enabled: true,
    onShowFileTree: vi.fn(),
    onReveal: vi.fn(async () => undefined),
    onCancelReveal: vi.fn(),
    onSaveConfig: vi.fn(async () => undefined),
    showInlineNotice: vi.fn(),
  });
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
  async function render(value: Options) {
    await act(async () => root.render(<Harness options={value} />));
  }
  it("shows Files and Tree before revealing without modifying document state", async () => {
    const value = options();
    await render(value);
    await act(async () => reveal());
    expect(value.onShowFileTree).toHaveBeenCalledOnce();
    expect(value.onCancelReveal).toHaveBeenCalledOnce();
    expect(value.onSaveConfig).toHaveBeenCalledWith({
      ...value.config,
      sidebarVisible: true,
      workspace: { ...value.config!.workspace, sidebarTab: "files" },
    });
    expect(value.onReveal).toHaveBeenCalledOnce();
  });
  it("does not rewrite config when Files is already visible", async () => {
    const value = options();
    value.config = {
      ...defaultConfig,
      sidebarVisible: true,
      workspace: { ...defaultConfig.workspace, sidebarTab: "files" },
    };
    await render(value);
    await act(async () => reveal());
    expect(value.onSaveConfig).not.toHaveBeenCalled();
    expect(value.onReveal).toHaveBeenCalledOnce();
  });
  it.each(["context", "disabled", "unmount"])(
    "drops setup completing after %s changes",
    async (change) => {
      let finish!: () => void;
      const value = options();
      value.onSaveConfig = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      );
      await render(value);
      let pending!: Promise<void>;
      act(() => {
        pending = reveal();
      });
      if (change === "context") {
        await render({ ...value, contextKey: "second" });
        await render(value);
      } else if (change === "disabled") {
        await render({ ...value, enabled: false });
      } else {
        await act(async () => root.render(null));
      }
      await act(async () => {
        finish();
        await pending;
      });
      expect(value.onReveal).not.toHaveBeenCalled();
      expect(value.showInlineNotice).not.toHaveBeenCalled();
    },
  );
  it("reports setup failure without exposing the private error", async () => {
    const value = options();
    value.onSaveConfig = vi.fn(async () => {
      throw new Error("private filesystem detail");
    });
    await render(value);
    await act(async () => reveal());
    expect(value.onReveal).not.toHaveBeenCalled();
    expect(value.showInlineNotice).toHaveBeenCalledWith(
      "Could not reveal the current file in the file tree.",
      { tone: "warning" },
    );
  });
  it("cancels older loading before shell setup and only starts the newest reveal", async () => {
    const completions: Array<() => void> = [];
    const value = options();
    value.onShowFileTree = vi.fn(
      () => new Promise<void>((resolve) => completions.push(resolve)),
    );
    await render(value);
    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = reveal();
      second = reveal();
    });
    expect(value.onCancelReveal).toHaveBeenCalledTimes(2);
    await act(async () => {
      completions[1]();
      await second;
    });
    await act(async () => {
      completions[0]();
      await first;
    });
    expect(value.onReveal).toHaveBeenCalledOnce();
    expect(value.onSaveConfig).toHaveBeenCalledOnce();
  });
});
