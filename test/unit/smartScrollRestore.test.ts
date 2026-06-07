import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  captureSmartScrollAnchor,
  restoreSmartScrollAnchor,
} from "../../src/ui/lib/smartScrollRestore";
import type { SmartScrollAnchor } from "../../src/ui/types";

function setRect(element: Element, top: number) {
  element.getBoundingClientRect = vi.fn(
    () =>
      ({
        bottom: top + 20,
        height: 20,
        left: 0,
        right: 100,
        top,
        width: 100,
        x: 0,
        y: top,
        toJSON: () => ({}),
      }) as DOMRect,
  );
}

function createViewer() {
  const viewer = document.createElement("section");
  viewer.scrollTop = 200;
  viewer.scrollTo = vi.fn((optionsOrX?: ScrollToOptions | number) => {
    viewer.scrollTop =
      typeof optionsOrX === "number"
        ? optionsOrX
        : Number(optionsOrX?.top ?? 0);
  }) as typeof viewer.scrollTo;
  setRect(viewer, 100);
  return viewer;
}

function baseAnchor(overrides: Partial<SmartScrollAnchor> = {}) {
  return {
    path: "/workspace/docs/current.md",
    scrollTop: 200,
    viewportOffset: 40,
    ...overrides,
  } satisfies SmartScrollAnchor;
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("smart scroll restore", () => {
  it("captures active heading, nearest source mapping, scrollTop, and viewport offset", () => {
    const viewer = createViewer();
    const article = document.createElement("article");
    const first = document.createElement("h2");
    first.dataset.sourceLine = "10";
    first.dataset.sourceReference = "/workspace/docs/current.md:10#first";
    const second = document.createElement("h2");
    second.dataset.sourceLine = "30";
    second.dataset.sourceReference = "/workspace/docs/current.md:30#second";
    setRect(first, 210);
    setRect(second, 130);
    article.append(first, second);

    expect(
      captureSmartScrollAnchor({
        activeHeadingId: "second",
        article,
        path: "/workspace/docs/current.md",
        viewer,
      }),
    ).toEqual({
      headingId: "second",
      path: "/workspace/docs/current.md",
      scrollTop: 200,
      sourceLine: 30,
      sourceReference: "/workspace/docs/current.md:30#second",
      viewportOffset: 30,
    });
  });

  it("restores by unique heading before source line fallback", () => {
    const viewer = createViewer();
    const article = document.createElement("article");
    const heading = document.createElement("h2");
    heading.id = "target";
    heading.dataset.sourceLine = "80";
    setRect(heading, 300);
    article.append(heading);
    const setActiveHeadingId = vi.fn();

    expect(
      restoreSmartScrollAnchor({
        anchor: baseAnchor({ headingId: "target", sourceLine: 10 }),
        article,
        setActiveHeadingId,
        viewer,
      }),
    ).toBe(true);

    expect(viewer.scrollTop).toBe(400);
    expect(setActiveHeadingId).toHaveBeenCalledWith("target");
  });

  it("skips duplicate heading ids and restores by exact source reference", () => {
    const viewer = createViewer();
    const article = document.createElement("article");
    const duplicateA = document.createElement("h2");
    duplicateA.id = "target";
    const duplicateB = document.createElement("h2");
    duplicateB.id = "target";
    const source = document.createElement("p");
    source.dataset.sourceLine = "42";
    source.dataset.sourceReference = "/workspace/docs/current.md:42#target";
    setRect(source, 260);
    article.append(duplicateA, duplicateB, source);

    restoreSmartScrollAnchor({
      anchor: baseAnchor({
        headingId: "target",
        sourceLine: 42,
        sourceReference: "/workspace/docs/current.md:42#target",
      }),
      article,
      viewer,
    });

    expect(viewer.scrollTop).toBe(320);
  });

  it("uses nearest source line when exact reference is missing", () => {
    const viewer = createViewer();
    const article = document.createElement("article");
    const line20 = document.createElement("p");
    line20.dataset.sourceLine = "20";
    const line44 = document.createElement("p");
    line44.dataset.sourceLine = "44";
    setRect(line20, 180);
    setRect(line44, 280);
    article.append(line20, line44);

    restoreSmartScrollAnchor({
      anchor: baseAnchor({
        sourceLine: 42,
        sourceReference: "/workspace/docs/current.md:42#deleted",
      }),
      article,
      viewer,
    });

    expect(viewer.scrollTop).toBe(340);
  });

  it("falls back to scrollTop when no heading or source mapping exists", () => {
    const viewer = createViewer();
    const article = document.createElement("article");

    restoreSmartScrollAnchor({
      anchor: baseAnchor({ headingId: "deleted", scrollTop: 512 }),
      article,
      viewer,
    });

    expect(viewer.scrollTop).toBe(512);
  });
});
