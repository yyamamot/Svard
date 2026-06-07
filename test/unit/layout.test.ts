import { describe, expect, it } from "vitest";

import {
  defaultSidebarLayout,
  normalizeSidebarLayout,
} from "../../src/core/layout";

describe("sidebar layout", () => {
  it("uses the default sidebar widths", () => {
    expect(normalizeSidebarLayout(undefined)).toEqual(defaultSidebarLayout);
  });

  it("clamps sidebar widths to supported bounds", () => {
    expect(
      normalizeSidebarLayout({
        leftSidebarWidth: 120,
        rightSidebarWidth: 900,
        openFilesHeight: 999,
      }),
    ).toEqual({
      leftSidebarWidth: 220,
      rightSidebarWidth: 520,
      openFilesHeight: 420,
      openFilesCollapsed: false,
    });
  });

  it("rounds finite persisted widths", () => {
    expect(
      normalizeSidebarLayout({
        leftSidebarWidth: 301.4,
        rightSidebarWidth: 288.6,
        openFilesHeight: 160.5,
      }),
    ).toEqual({
      leftSidebarWidth: 301,
      rightSidebarWidth: 289,
      openFilesHeight: 161,
      openFilesCollapsed: false,
    });
  });

  it("preserves the persisted Open Files collapsed state", () => {
    expect(
      normalizeSidebarLayout({
        openFilesCollapsed: true,
      }).openFilesCollapsed,
    ).toBe(true);
  });

  it("clamps the Open Files split height to its minimum", () => {
    expect(
      normalizeSidebarLayout({
        openFilesHeight: 40,
      }).openFilesHeight,
    ).toBe(96);
  });
});
