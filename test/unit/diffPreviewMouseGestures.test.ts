import { describe, expect, it, vi } from "vitest";

import { dispatchDiffPreviewMouseGestureCommand } from "../../src/ui/components/gitDiffPreview/mouseGestures";

function options({
  commandId,
  changeCount = 3,
  moveChange = vi.fn(),
  scrollPane = vi.fn(() => true),
  closePreview = vi.fn(),
}: Partial<Parameters<typeof dispatchDiffPreviewMouseGestureCommand>[0]> & {
  commandId: Parameters<
    typeof dispatchDiffPreviewMouseGestureCommand
  >[0]["commandId"];
}) {
  return {
    commandId,
    changeCount,
    moveChange,
    scrollPane,
    closePreview,
  };
}

describe("diff preview mouse gestures", () => {
  it("maps navigation back gesture to previous change", () => {
    const moveChange = vi.fn();

    const result = dispatchDiffPreviewMouseGestureCommand(
      options({
        commandId: "navigation.back",
        moveChange,
      }),
    );

    expect(result).toEqual({
      commandId: "navigation.back",
      status: "handled",
    });
    expect(moveChange).toHaveBeenCalledWith(-1);
  });

  it("maps navigation forward gesture to next change", () => {
    const moveChange = vi.fn();

    const result = dispatchDiffPreviewMouseGestureCommand(
      options({
        commandId: "navigation.forward",
        moveChange,
      }),
    );

    expect(result).toEqual({
      commandId: "navigation.forward",
      status: "handled",
    });
    expect(moveChange).toHaveBeenCalledWith(1);
  });

  it("does not run unrelated viewer commands inside diff preview", () => {
    const moveChange = vi.fn();

    const result = dispatchDiffPreviewMouseGestureCommand(
      options({
        commandId: "quickOpen.focus",
        moveChange,
      }),
    );

    expect(result).toEqual({
      commandId: "quickOpen.focus",
      status: "disabled",
    });
    expect(moveChange).not.toHaveBeenCalled();
  });

  it("disables change navigation when there are no changes", () => {
    const moveChange = vi.fn();

    const result = dispatchDiffPreviewMouseGestureCommand(
      options({
        commandId: "navigation.forward",
        changeCount: 0,
        moveChange,
      }),
    );

    expect(result).toEqual({
      commandId: "navigation.forward",
      status: "disabled",
    });
    expect(moveChange).not.toHaveBeenCalled();
  });

  it("maps viewer scroll commands to diff preview pane scroll actions", () => {
    const scrollPane = vi.fn(() => true);

    expect(
      dispatchDiffPreviewMouseGestureCommand(
        options({ commandId: "viewer.top", scrollPane }),
      ),
    ).toEqual({ commandId: "viewer.top", status: "handled" });
    expect(
      dispatchDiffPreviewMouseGestureCommand(
        options({ commandId: "viewer.bottom", scrollPane }),
      ),
    ).toEqual({ commandId: "viewer.bottom", status: "handled" });
    expect(
      dispatchDiffPreviewMouseGestureCommand(
        options({ commandId: "viewer.pageUp", scrollPane }),
      ),
    ).toEqual({ commandId: "viewer.pageUp", status: "handled" });
    expect(
      dispatchDiffPreviewMouseGestureCommand(
        options({ commandId: "viewer.pageDown", scrollPane }),
      ),
    ).toEqual({ commandId: "viewer.pageDown", status: "handled" });
    expect(
      dispatchDiffPreviewMouseGestureCommand(
        options({ commandId: "viewer.scrollUp", scrollPane }),
      ),
    ).toEqual({ commandId: "viewer.scrollUp", status: "handled" });
    expect(
      dispatchDiffPreviewMouseGestureCommand(
        options({ commandId: "viewer.scrollDown", scrollPane }),
      ),
    ).toEqual({ commandId: "viewer.scrollDown", status: "handled" });

    expect(scrollPane).toHaveBeenNthCalledWith(1, "top");
    expect(scrollPane).toHaveBeenNthCalledWith(2, "bottom");
    expect(scrollPane).toHaveBeenNthCalledWith(3, "pageUp");
    expect(scrollPane).toHaveBeenNthCalledWith(4, "pageDown");
    expect(scrollPane).toHaveBeenNthCalledWith(5, "lineUp");
    expect(scrollPane).toHaveBeenNthCalledWith(6, "lineDown");
  });

  it("disables scroll gestures when no pane is scrollable", () => {
    const result = dispatchDiffPreviewMouseGestureCommand(
      options({ commandId: "viewer.bottom", scrollPane: vi.fn(() => false) }),
    );

    expect(result).toEqual({
      commandId: "viewer.bottom",
      status: "disabled",
    });
  });

  it("maps close commands to diff preview close", () => {
    const closePreview = vi.fn();

    expect(
      dispatchDiffPreviewMouseGestureCommand(
        options({ commandId: "tab.close", closePreview }),
      ),
    ).toEqual({ commandId: "tab.close", status: "handled" });
    expect(
      dispatchDiffPreviewMouseGestureCommand(
        options({ commandId: "preferences.close", closePreview }),
      ),
    ).toEqual({ commandId: "preferences.close", status: "handled" });
    expect(closePreview).toHaveBeenCalledTimes(2);
  });
});
