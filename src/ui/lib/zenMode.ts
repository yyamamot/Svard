import type { AppConfig } from "../../core/types";

export function shouldHideTopbarForZenMode(
  zenModeApplies: boolean,
  zenModeConfig: AppConfig["zenMode"],
) {
  return zenModeApplies && zenModeConfig.hideTopbar;
}

export function shouldHideDiffPreviewChromeForZenMode(
  zenModeApplies: boolean,
  zenModeConfig: AppConfig["zenMode"],
) {
  return (
    zenModeApplies &&
    zenModeConfig.applyToDiffPreview &&
    zenModeConfig.hideTopbar
  );
}

export function shouldShowZenModeExitControl({
  blockingOverlay,
  diffPreviewOpen,
  topbarHidden,
  zenModeApplies,
}: {
  blockingOverlay: boolean;
  diffPreviewOpen: boolean;
  topbarHidden: boolean;
  zenModeApplies: boolean;
}) {
  return zenModeApplies && topbarHidden && !blockingOverlay && !diffPreviewOpen;
}
