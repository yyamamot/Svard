import { resolveChangeTargetInPane } from "../gitDiffPreview/renderedChangeAnchor";
import type { DiffStreamTarget } from "./types";

export function scrollStreamTargetIntoView(
  panel: HTMLElement | null,
  target: DiffStreamTarget,
) {
  const section = diffStreamSection(panel, target.fileIndex);
  const targetElement = diffStreamTargetElement(section, target) ?? section;
  if (typeof targetElement?.scrollIntoView === "function") {
    targetElement.scrollIntoView({ block: "center" });
  }
}

export function diffStreamSection(panel: HTMLElement | null, fileIndex: number) {
  return panel?.querySelector<HTMLElement>(
    `[data-review-id="diff-stream-file-section"][data-stream-index="${fileIndex}"]`,
  );
}

export function diffStreamTargetElement(
  section: HTMLElement | null | undefined,
  target: DiffStreamTarget,
) {
  return (
    diffStreamRenderedTarget(section, target) ??
    diffStreamBlockTarget(section, target.changeIndex)
  );
}

function diffStreamRenderedTarget(
  section: HTMLElement | null | undefined,
  target: DiffStreamTarget,
) {
  const pane = section?.querySelector<HTMLElement>(
    `[data-review-id="diff-stream-${target.primarySide}-pane"]`,
  );
  return resolveChangeTargetInPane(pane, target.changeIndex);
}

function diffStreamBlockTarget(
  section: HTMLElement | null | undefined,
  changeIndex: number,
) {
  return (
    section?.querySelector<HTMLElement>(
      `[data-review-id="diff-stream-rendered-block"][data-change-index="${changeIndex}"].right-side`,
    ) ??
    section?.querySelector<HTMLElement>(
      `[data-review-id="diff-stream-rendered-block"][data-change-index="${changeIndex}"]`,
    )
  );
}
