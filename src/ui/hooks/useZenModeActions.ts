import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { AppConfig } from "../../core/types";

interface UseZenModeActionsOptions {
  zenModeActive: boolean;
  zenModeConfig: AppConfig["zenMode"];
  setZenModeActive: Dispatch<SetStateAction<boolean>>;
  showLightweightActionFeedback: (message: string) => void;
}

export function useZenModeActions({
  zenModeActive,
  zenModeConfig,
  setZenModeActive,
  showLightweightActionFeedback,
}: UseZenModeActionsOptions) {
  const enterZenMode = useCallback(async () => {
    setZenModeActive(true);
    if (zenModeConfig.fullScreen && !document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        // Zen mode is still useful without OS fullscreen; avoid covering the reader.
      }
    }
    showLightweightActionFeedback("Zen mode");
  }, [setZenModeActive, showLightweightActionFeedback, zenModeConfig]);

  const exitZenMode = useCallback(async () => {
    setZenModeActive(false);
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // Leaving Zen mode should not be blocked by the platform fullscreen API.
      }
    }
    showLightweightActionFeedback("Exited Zen mode");
  }, [setZenModeActive, showLightweightActionFeedback]);

  const toggleZenMode = useCallback(async () => {
    if (zenModeActive) {
      await exitZenMode();
    } else {
      await enterZenMode();
    }
  }, [enterZenMode, exitZenMode, zenModeActive]);

  return {
    enterZenMode,
    exitZenMode,
    toggleZenMode,
  };
}
