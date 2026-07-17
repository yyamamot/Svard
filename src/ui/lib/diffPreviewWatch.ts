import type { DocumentDiffPreview } from "../../core/types";

export type DiffPreviewWatchStatus =
  | "fresh"
  | "stale"
  | "refreshing"
  | "blocked";

export type DiffPreviewWatchReason =
  | "metadata-event"
  | "file-watch"
  | "visibility-restore";

export interface DiffPreviewWatchState {
  status: DiffPreviewWatchStatus;
  reason?: DiffPreviewWatchReason;
  message?: string;
}

export const freshDiffPreviewWatchState: DiffPreviewWatchState = {
  status: "fresh",
};

export function watchedGitDiffPreviewPath(
  preview: DocumentDiffPreview | null,
): string | null {
  if (!preview || preview.source === "file") {
    return null;
  }
  if (preview.rightLabel !== "Working Tree") {
    return null;
  }
  return preview.rightPath ?? preview.leftPath ?? null;
}

export function diffPreviewIdentityKey(preview: DocumentDiffPreview): string {
  return [
    preview.source ?? "git",
    preview.relativePath ?? "",
    preview.leftPath ?? "",
    preview.rightPath ?? "",
    preview.leftLabel,
    preview.rightLabel,
  ].join("\0");
}

export function diffPreviewWatchLabel(
  state: DiffPreviewWatchState | undefined,
): string | null {
  if (!state || state.status === "fresh") {
    return null;
  }
  if (state.status === "stale") {
    return "Stale";
  }
  if (state.status === "refreshing") {
    return "Refreshing";
  }
  return "Preview refresh blocked";
}

export function diffPreviewWatchMessage(
  state: DiffPreviewWatchState | undefined,
): string | null {
  if (!state || state.status === "fresh") {
    return null;
  }
  if (state.message) {
    return state.message;
  }
  if (state.status === "blocked") {
    return "Preview refresh blocked";
  }
  return "Preview changed on disk";
}
