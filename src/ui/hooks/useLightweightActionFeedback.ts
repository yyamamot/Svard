import { useCallback, useEffect, useRef, useState } from "react";
import { defaultLightweightActionFeedbackTimeout } from "../lib/notice";
import type { LightweightActionFeedback } from "../types";

export function useLightweightActionFeedback() {
  const [lightweightActionFeedback, setLightweightActionFeedback] =
    useState<LightweightActionFeedback | null>(null);
  const feedbackIdRef = useRef(0);

  const showLightweightActionFeedback = useCallback(function (
    message: string,
    autoDismissMs = defaultLightweightActionFeedbackTimeout,
  ) {
    setLightweightActionFeedback({
      id: (feedbackIdRef.current += 1),
      message,
      autoDismissMs,
    });
  }, []);

  useEffect(() => {
    if (!lightweightActionFeedback) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setLightweightActionFeedback((current) =>
        current?.id === lightweightActionFeedback.id ? null : current,
      );
    }, lightweightActionFeedback.autoDismissMs);

    return () => window.clearTimeout(timeoutId);
  }, [lightweightActionFeedback]);

  return {
    lightweightActionFeedback,
    showLightweightActionFeedback,
  };
}
