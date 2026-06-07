import { describe, expect, it } from "vitest";
import {
  activeSearchRulerIndex,
  collectSearchRulerMarkers,
} from "../../src/ui/lib/searchRuler";

function rect(top: number, height: number): DOMRect {
  return {
    top,
    bottom: top + height,
    height,
    left: 0,
    right: 0,
    width: 0,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

describe("searchRuler", () => {
  it("returns no markers without an article or hits", () => {
    expect(collectSearchRulerMarkers(null, 2)).toEqual([]);

    const article = document.createElement("article");
    expect(collectSearchRulerMarkers(article, 0)).toEqual([]);
  });

  it("maps search hit DOM positions to bounded percentages by index", () => {
    const article = document.createElement("article");
    Object.defineProperty(article, "scrollHeight", {
      configurable: true,
      value: 200,
    });
    article.getBoundingClientRect = () => rect(100, 200);

    const lateHit = document.createElement("mark");
    lateHit.className = "search-hit";
    lateHit.dataset.searchHitIndex = "1";
    lateHit.getBoundingClientRect = () => rect(480, 20);

    const earlyHit = document.createElement("mark");
    earlyHit.className = "search-hit";
    earlyHit.dataset.searchHitIndex = "0";
    earlyHit.getBoundingClientRect = () => rect(130, 20);

    article.append(lateHit, earlyHit);

    expect(collectSearchRulerMarkers(article, 2)).toEqual([
      { index: 0, topPercent: 20 },
      { index: 1, topPercent: 100 },
    ]);
  });

  it("ignores invalid hit indexes", () => {
    const article = document.createElement("article");
    Object.defineProperty(article, "scrollHeight", {
      configurable: true,
      value: 100,
    });
    article.getBoundingClientRect = () => rect(0, 100);

    const invalidHit = document.createElement("mark");
    invalidHit.className = "search-hit";
    invalidHit.dataset.searchHitIndex = "9";
    article.append(invalidHit);

    expect(collectSearchRulerMarkers(article, 2)).toEqual([]);
  });

  it("wraps the active index within hit count", () => {
    expect(activeSearchRulerIndex(5, 4)).toBe(1);
    expect(activeSearchRulerIndex(-1, 4)).toBe(3);
    expect(activeSearchRulerIndex(0, 0)).toBeNull();
  });
});
