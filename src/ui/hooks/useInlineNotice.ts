import { useEffect, useRef, useState } from "react";
import { defaultInlineNoticeTimeout } from "../lib/notice";
import type { InlineNotice, InlineNoticeOptions } from "../types";

export function useInlineNotice() {
  const [inlineNotice, setInlineNotice] = useState<InlineNotice | null>(null);
  const inlineNoticeIdRef = useRef(0);

  function showInlineNotice(
    message: string,
    options: InlineNoticeOptions = {},
  ) {
    const tone = options.tone ?? "info";
    setInlineNotice({
      id: (inlineNoticeIdRef.current += 1),
      message,
      tone,
      autoDismissMs: options.autoDismissMs ?? defaultInlineNoticeTimeout(tone),
    });
  }

  function dismissInlineNotice() {
    setInlineNotice(null);
  }

  useEffect(() => {
    if (!inlineNotice || inlineNotice.autoDismissMs <= 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setInlineNotice((current) =>
        current?.id === inlineNotice.id ? null : current,
      );
    }, inlineNotice.autoDismissMs);

    return () => window.clearTimeout(timeoutId);
  }, [inlineNotice]);

  return {
    inlineNotice,
    showInlineNotice,
    dismissInlineNotice,
  };
}
