import { describe, expect, it } from "vitest";

import { defaultConfig } from "../../src/core/defaultConfig";
import {
  shouldHideDiffPreviewChromeForZenMode,
  shouldHideTopbarForZenMode,
  shouldShowZenModeExitControl,
} from "../../src/ui/lib/zenMode";

describe("Zen mode display policy", () => {
  it("hides the topbar only when Zen mode applies and hideTopbar is enabled", () => {
    expect(shouldHideTopbarForZenMode(true, defaultConfig.zenMode)).toBe(true);
    expect(shouldHideTopbarForZenMode(false, defaultConfig.zenMode)).toBe(
      false,
    );
    expect(
      shouldHideTopbarForZenMode(true, {
        ...defaultConfig.zenMode,
        hideTopbar: false,
      }),
    ).toBe(false);
  });

  it("hides Diff Preview chrome only when Zen mode applies to Diff Preview", () => {
    expect(
      shouldHideDiffPreviewChromeForZenMode(true, {
        ...defaultConfig.zenMode,
        applyToDiffPreview: true,
      }),
    ).toBe(true);
    expect(
      shouldHideDiffPreviewChromeForZenMode(true, defaultConfig.zenMode),
    ).toBe(false);
    expect(
      shouldHideDiffPreviewChromeForZenMode(false, {
        ...defaultConfig.zenMode,
        applyToDiffPreview: true,
      }),
    ).toBe(false);
    expect(
      shouldHideDiffPreviewChromeForZenMode(true, {
        ...defaultConfig.zenMode,
        applyToDiffPreview: true,
        hideTopbar: false,
      }),
    ).toBe(false);
  });

  it("shows the floating exit control only for unobstructed hidden-topbar Zen mode", () => {
    expect(
      shouldShowZenModeExitControl({
        blockingOverlay: false,
        diffPreviewOpen: false,
        topbarHidden: true,
        zenModeApplies: true,
      }),
    ).toBe(true);
    expect(
      shouldShowZenModeExitControl({
        blockingOverlay: true,
        diffPreviewOpen: false,
        topbarHidden: true,
        zenModeApplies: true,
      }),
    ).toBe(false);
    expect(
      shouldShowZenModeExitControl({
        blockingOverlay: false,
        diffPreviewOpen: true,
        topbarHidden: true,
        zenModeApplies: true,
      }),
    ).toBe(false);
    expect(
      shouldShowZenModeExitControl({
        blockingOverlay: false,
        diffPreviewOpen: false,
        topbarHidden: false,
        zenModeApplies: true,
      }),
    ).toBe(false);
    expect(
      shouldShowZenModeExitControl({
        blockingOverlay: false,
        diffPreviewOpen: false,
        topbarHidden: true,
        zenModeApplies: false,
      }),
    ).toBe(false);
  });
});
