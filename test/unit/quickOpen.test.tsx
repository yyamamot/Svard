import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  QuickOpen,
  type QuickOpenCandidate,
} from "../../src/ui/components/QuickOpen";

const fileCandidate: QuickOpenCandidate = {
  type: "file",
  path: "/workspace/docs/guide.md",
  label: "guide.md",
  source: "Open file",
  kind: "file",
};

describe("QuickOpen close controls", () => {
  let container: HTMLDivElement;
  let root: Root;
  let onChange: ReturnType<typeof vi.fn<(value: string) => void>>;
  let onClose: ReturnType<typeof vi.fn<() => void>>;
  let onOpen: ReturnType<typeof vi.fn<(candidate: QuickOpenCandidate) => void>>;

  beforeEach(async () => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onChange = vi.fn<(value: string) => void>();
    onClose = vi.fn<() => void>();
    onOpen = vi.fn<(candidate: QuickOpenCandidate) => void>();
    await renderQuickOpen();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function renderQuickOpen() {
    const inputRef = createRef<HTMLInputElement>();
    await act(async () => {
      root.render(
        <QuickOpen
          candidates={[fileCandidate]}
          inputRef={inputRef}
          onChange={onChange}
          onClose={onClose}
          onOpen={onOpen}
          query=""
        />,
      );
    });
  }

  function quickOpenElement(selector: string) {
    const element = container.querySelector<HTMLElement>(selector);
    if (!element) {
      throw new Error(`missing element: ${selector}`);
    }
    return element;
  }

  it("closes from the explicit close button", () => {
    act(() => {
      quickOpenElement('[data-review-id="quick-open-close"]').click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes from the backdrop but not from the panel body", () => {
    act(() => {
      quickOpenElement('[data-review-id="quick-open"]').click();
    });

    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      quickOpenElement(".quick-open-backdrop").click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps result clicks as candidate opens instead of backdrop close", () => {
    act(() => {
      quickOpenElement('[data-review-id="quick-open-result"]').click();
    });

    expect(onOpen).toHaveBeenCalledWith(fileCandidate);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps Escape close and Enter open keyboard behavior", () => {
    const input = quickOpenElement(
      '[data-review-id="quick-open-input"]',
    ) as HTMLInputElement;

    act(() => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
      );
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    act(() => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }),
      );
    });
    expect(onOpen).toHaveBeenCalledWith(fileCandidate);
  });
});
