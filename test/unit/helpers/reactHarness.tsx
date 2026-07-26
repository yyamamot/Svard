import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

export interface ReactRootHarness {
  container: HTMLDivElement;
  render: (node: ReactNode) => void;
  cleanup: () => void;
  buttonByText: (text: string) => HTMLButtonElement;
  byReviewId: <T extends HTMLElement = HTMLElement>(reviewId: string) => T;
  inputByReviewId: (reviewId: string) => HTMLInputElement;
  click: (element: HTMLElement | null | undefined) => Promise<void>;
  pointerDown: (element: HTMLElement | null | undefined) => Promise<void>;
  setInputValue: (
    element: HTMLInputElement | null | undefined,
    value: string,
  ) => Promise<void>;
  setTextAreaValue: (
    element: HTMLTextAreaElement | null | undefined,
    value: string,
  ) => Promise<void>;
  pressKey: (key: string, init?: KeyboardEventInit) => Promise<void>;
}

export function createReactRootHarness(): ReactRootHarness {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);

  return {
    container,
    render: (node) => {
      act(() => root.render(node));
    },
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
    buttonByText: (text) => {
      const button = [...container.querySelectorAll("button")].find(
        (element) => element.textContent?.trim() === text,
      );
      if (!button) {
        throw new Error(`Button not found: ${text}`);
      }
      return button as HTMLButtonElement;
    },
    byReviewId: <T extends HTMLElement = HTMLElement>(reviewId: string) => {
      const element = container.querySelector<HTMLElement>(
        `[data-review-id="${reviewId}"]`,
      );
      if (!element) {
        throw new Error(`Element not found: ${reviewId}`);
      }
      return element as T;
    },
    inputByReviewId: (reviewId) => {
      const element = container.querySelector<HTMLInputElement>(
        `[data-review-id="${reviewId}"]`,
      );
      if (!element) {
        throw new Error(`Input not found: ${reviewId}`);
      }
      return element;
    },
    click: async (element) => {
      await act(async () => {
        element?.click();
      });
    },
    pointerDown: async (element) => {
      await act(async () => {
        element?.dispatchEvent(
          new PointerEvent("pointerdown", { bubbles: true }),
        );
      });
    },
    setInputValue: async (element, value) => {
      await act(async () => {
        element?.focus();
        const valueSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )?.set;
        valueSetter?.call(element, value);
        element?.dispatchEvent(new Event("input", { bubbles: true }));
      });
    },
    setTextAreaValue: async (element, value) => {
      await act(async () => {
        element?.focus();
        const valueSetter = Object.getOwnPropertyDescriptor(
          HTMLTextAreaElement.prototype,
          "value",
        )?.set;
        valueSetter?.call(element, value);
        element?.dispatchEvent(new Event("input", { bubbles: true }));
      });
    },
    pressKey: async (key, init = {}) => {
      await act(async () => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", {
            key,
            bubbles: true,
            cancelable: true,
            ...init,
          }),
        );
      });
    },
  };
}
