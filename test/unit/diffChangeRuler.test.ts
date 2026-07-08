import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  changeRulerMarkerTopPercent,
  changeRulerTargetAnchorTop,
  clampRulerPercent,
  isRulerMarkerActive,
  renderedPanesForChangeRulerTarget,
} from "../../src/ui/components/gitDiffPreview/changeRuler";
import { resolveRenderedChangeAnchor } from "../../src/ui/components/gitDiffPreview/renderedChangeAnchor";
import type { RenderedDiffNavigationTarget } from "../../src/ui/lib/gitRenderedDiff";

describe("diff change ruler helpers", () => {
  it("clamps marker positions to a safe 0-100 percent range", () => {
    expect(
      changeRulerMarkerTopPercent({ scrollHeight: 1000, targetTop: 250 }),
    ).toBe(25);
    expect(
      changeRulerMarkerTopPercent({ scrollHeight: 1000, targetTop: -20 }),
    ).toBe(0);
    expect(
      changeRulerMarkerTopPercent({ scrollHeight: 1000, targetTop: 1200 }),
    ).toBe(100);
  });

  it("treats invalid marker inputs as the top of the ruler", () => {
    expect(
      changeRulerMarkerTopPercent({ scrollHeight: 0, targetTop: 50 }),
    ).toBe(0);
    expect(clampRulerPercent(Number.NaN)).toBe(0);
  });

  it("uses the target visual center as the ruler anchor", () => {
    const container = document.createElement("div");
    const target = document.createElement("div");
    container.scrollTop = 120;
    container.getBoundingClientRect = () =>
      ({
        top: 20,
        bottom: 420,
        left: 0,
        right: 100,
        width: 100,
        height: 400,
        x: 0,
        y: 20,
        toJSON: () => ({}),
      }) as DOMRect;
    target.getBoundingClientRect = () =>
      ({
        top: 260,
        bottom: 340,
        left: 0,
        right: 100,
        width: 100,
        height: 80,
        x: 0,
        y: 260,
        toJSON: () => ({}),
      }) as DOMRect;

    expect(changeRulerTargetAnchorTop({ container, target })).toBe(400);
  });

  it("keeps ruler marker colors semantic while active only changes weight", () => {
    const css = readFileSync(
      join(process.cwd(), "src/ui/styles/diff-preview/shell.css"),
      "utf8",
    );
    const markerRule =
      /\.git-diff-change-ruler-marker\s*\{(?<body>[^}]+)\}/.exec(css)?.groups
        ?.body ?? "";
    const activeRule =
      /\.git-diff-change-ruler-marker\.active\s*\{(?<body>[^}]+)\}/.exec(css)
        ?.groups?.body ?? "";

    expect(markerRule).toContain("min-height: 4px");
    expect(markerRule).toContain("left: 3px");
    expect(markerRule).toContain("right: 1px");
    expect(markerRule).toContain("border-radius: 2px");
    expect(markerRule).toContain("opacity: 0.38");
    expect(activeRule).toContain("min-height: 6px");
    expect(activeRule).toContain("left: 1px");
    expect(activeRule).toContain("right: 0");
    expect(activeRule).toContain("opacity: 1");
    expect(activeRule).toContain("z-index: 1");
    expect(activeRule).not.toContain("background:");
  });

  it("uses only the requested rendered pane for side-aware rulers", () => {
    const left = document.createElement("div");
    const right = document.createElement("div");
    const target = {
      primarySide: "right",
    } as RenderedDiffNavigationTarget;

    expect(
      renderedPanesForChangeRulerTarget({
        left,
        right,
        renderedSide: "left",
        target,
      }),
    ).toEqual([left]);
    expect(
      renderedPanesForChangeRulerTarget({
        left,
        right,
        renderedSide: "right",
        target,
      }),
    ).toEqual([right]);
  });

  it("does not resolve side-aware ruler anchors for the opposite one-sided pane", () => {
    const left = document.createElement("div") as HTMLDivElement;
    const right = document.createElement("div") as HTMLDivElement;
    const rightTarget = document.createElement("div");
    rightTarget.dataset.changeIndex = "0";
    rightTarget.getBoundingClientRect = () =>
      ({
        bottom: 50,
        height: 20,
        left: 0,
        right: 100,
        top: 30,
        width: 100,
      }) as DOMRect;
    right.getBoundingClientRect = () =>
      ({
        bottom: 200,
        height: 200,
        left: 0,
        right: 100,
        top: 0,
        width: 100,
      }) as DOMRect;
    right.append(rightTarget);

    const target = {
      primarySide: "right",
      side: "right",
    } as RenderedDiffNavigationTarget;

    expect(
      resolveRenderedChangeAnchor({
        changeIndex: 0,
        leftPane: left,
        navigationTarget: target,
        renderedSide: "left",
        rightPane: right,
      }),
    ).toBeNull();
    expect(
      resolveRenderedChangeAnchor({
        changeIndex: 0,
        leftPane: left,
        navigationTarget: target,
        renderedSide: "right",
        rightPane: right,
      }),
    )?.toMatchObject({ changeIndex: 0, markerPane: right });
  });

  it("uses right-pane precedence for the single rendered ruler", () => {
    const left = document.createElement("div");
    const right = document.createElement("div");

    expect(
      renderedPanesForChangeRulerTarget({
        left,
        right,
        target: { primarySide: "left" } as RenderedDiffNavigationTarget,
      }),
    ).toEqual([right, left]);
    expect(
      renderedPanesForChangeRulerTarget({
        left,
        right,
        target: { primarySide: "right" } as RenderedDiffNavigationTarget,
      }),
    ).toEqual([right, left]);
  });

  it("activates both side-aware ruler markers for both-side targets", () => {
    const target = {
      side: "both",
    } as RenderedDiffNavigationTarget;

    expect(
      isRulerMarkerActive({
        activeChangeIndex: 2,
        markerIndex: 2,
        renderedSide: "left",
        target,
      }),
    ).toBe(true);
    expect(
      isRulerMarkerActive({
        activeChangeIndex: 2,
        markerIndex: 2,
        renderedSide: "right",
        target,
      }),
    ).toBe(true);
  });

  it("activates only the matching side for one-sided rendered targets", () => {
    const leftTarget = {
      side: "left",
    } as RenderedDiffNavigationTarget;
    const rightTarget = {
      side: "right",
    } as RenderedDiffNavigationTarget;

    expect(
      isRulerMarkerActive({
        activeChangeIndex: 1,
        markerIndex: 1,
        renderedSide: "left",
        target: leftTarget,
      }),
    ).toBe(true);
    expect(
      isRulerMarkerActive({
        activeChangeIndex: 1,
        markerIndex: 1,
        renderedSide: "right",
        target: leftTarget,
      }),
    ).toBe(false);
    expect(
      isRulerMarkerActive({
        activeChangeIndex: 1,
        markerIndex: 1,
        renderedSide: "right",
        target: rightTarget,
      }),
    ).toBe(true);
    expect(
      isRulerMarkerActive({
        activeChangeIndex: 1,
        markerIndex: 1,
        renderedSide: "left",
        target: rightTarget,
      }),
    ).toBe(false);
  });

  it("keeps single-ruler active behavior independent of target side", () => {
    expect(
      isRulerMarkerActive({
        activeChangeIndex: 3,
        markerIndex: 3,
        target: { side: "left" } as RenderedDiffNavigationTarget,
      }),
    ).toBe(true);
    expect(
      isRulerMarkerActive({
        activeChangeIndex: 3,
        markerIndex: 4,
        target: { side: "both" } as RenderedDiffNavigationTarget,
      }),
    ).toBe(false);
  });
});
