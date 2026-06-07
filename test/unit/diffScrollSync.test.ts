import { describe, expect, it } from "vitest";

import {
  collectPaneAnchors,
  resolveAnchoredScrollTop,
} from "../../src/ui/lib/diffScrollSync";

function pane({
  scrollTop,
  clientHeight = 120,
  scrollHeight = 500,
  anchors,
}: {
  scrollTop: number;
  clientHeight?: number;
  scrollHeight?: number;
  anchors: Array<{
    syncIndex: string;
    changeIndex?: string;
    top: number;
    height?: number;
  }>;
}) {
  const container = document.createElement("div");
  Object.defineProperty(container, "scrollTop", {
    configurable: true,
    get: () => scrollTop,
    set: (value) => {
      scrollTop = value;
    },
  });
  Object.defineProperty(container, "clientHeight", {
    configurable: true,
    value: clientHeight,
  });
  Object.defineProperty(container, "scrollHeight", {
    configurable: true,
    value: scrollHeight,
  });
  container.getBoundingClientRect = () =>
    ({ top: 0, bottom: clientHeight, height: clientHeight }) as DOMRect;

  for (const anchor of anchors) {
    const element = document.createElement("article");
    element.dataset.syncIndex = anchor.syncIndex;
    if (anchor.changeIndex !== undefined) {
      element.dataset.changeIndex = anchor.changeIndex;
    }
    const height = anchor.height ?? 20;
    element.getBoundingClientRect = () =>
      ({
        top: anchor.top,
        bottom: anchor.top + height,
        height,
      }) as DOMRect;
    container.append(element);
  }
  return container;
}

describe("diff scroll sync", () => {
  it("collects sync and change anchors relative to the pane", () => {
    const container = pane({
      scrollTop: 0,
      anchors: [{ syncIndex: "2", changeIndex: "1", top: 30, height: 24 }],
    });

    expect(collectPaneAnchors(container)).toEqual([
      { syncIndex: "2", changeIndex: "1", top: 30, height: 24 },
    ]);
  });

  it("aligns the target anchor to the source viewport offset", () => {
    const source = pane({
      scrollTop: 40,
      anchors: [{ syncIndex: "3", changeIndex: "0", top: 12 }],
    });
    const target = pane({
      scrollTop: 80,
      anchors: [{ syncIndex: "3", changeIndex: "0", top: 72 }],
    });

    expect(
      resolveAnchoredScrollTop(source, target, { fallbackScrollTop: 40 }),
    ).toBe(140);
  });

  it("prefers visible changed anchors closest to the viewport top", () => {
    const source = pane({
      scrollTop: 0,
      anchors: [
        { syncIndex: "0", top: 2 },
        { syncIndex: "1", changeIndex: "0", top: 76 },
        { syncIndex: "2", changeIndex: "1", top: 24 },
      ],
    });
    const target = pane({
      scrollTop: 10,
      anchors: [
        { syncIndex: "1", changeIndex: "0", top: 130 },
        { syncIndex: "2", changeIndex: "1", top: 90 },
      ],
    });

    expect(
      resolveAnchoredScrollTop(source, target, { fallbackScrollTop: 0 }),
    ).toBe(76);
  });

  it("uses visible unchanged anchors when changed anchors are offscreen", () => {
    const source = pane({
      scrollTop: 800,
      scrollHeight: 1200,
      anchors: [
        { syncIndex: "1", changeIndex: "0", top: -640 },
        { syncIndex: "24", top: 28 },
      ],
    });
    const target = pane({
      scrollTop: 760,
      scrollHeight: 1200,
      anchors: [
        { syncIndex: "1", changeIndex: "0", top: -600 },
        { syncIndex: "24", top: 68 },
      ],
    });

    expect(
      resolveAnchoredScrollTop(source, target, { fallbackScrollTop: 800 }),
    ).toBe(800);
  });

  it("keeps one-sided placeholders aligned by sync index", () => {
    const source = pane({
      scrollTop: 200,
      anchors: [{ syncIndex: "5", changeIndex: "2", top: 10, height: 180 }],
    });
    const target = pane({
      scrollTop: 30,
      anchors: [{ syncIndex: "5", top: 55, height: 30 }],
    });

    expect(
      resolveAnchoredScrollTop(source, target, { fallbackScrollTop: 200 }),
    ).toBe(75);
  });

  it("falls back when the matching target anchor is missing", () => {
    const source = pane({
      scrollTop: 0,
      anchors: [{ syncIndex: "7", changeIndex: "0", top: 12 }],
    });
    const target = pane({
      scrollTop: 0,
      anchors: [{ syncIndex: "8", changeIndex: "0", top: 40 }],
    });

    expect(
      resolveAnchoredScrollTop(source, target, { fallbackScrollTop: 123 }),
    ).toBe(123);
  });
});
