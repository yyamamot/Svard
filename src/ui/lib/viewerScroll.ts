import type { RefObject } from "react";

export function scrollViewer(
  viewerRef: RefObject<HTMLElement | null>,
  kind: "lineDown" | "lineUp" | "pageDown" | "pageUp",
) {
  const target = viewerRef.current;
  if (!target) {
    return;
  }
  const line = 72;
  const page = Math.max(120, target.clientHeight * 0.8);
  const top =
    kind === "lineDown"
      ? line
      : kind === "lineUp"
        ? -line
        : kind === "pageDown"
          ? page
          : -page;
  target.scrollBy({ top, behavior: "smooth" });
}
