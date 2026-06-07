import type { InlineNoticeTone } from "../types";

export function defaultInlineNoticeTimeout(tone: InlineNoticeTone) {
  if (tone === "error") {
    return 10000;
  }
  if (tone === "warning") {
    return 7000;
  }
  return 3500;
}

export const defaultLightweightActionFeedbackTimeout = 1100;
