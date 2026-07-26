export const fileCompareDragType = "application/x-svard-document-path";
export const codexContextPointerDragStartEvent =
  "svard:codex-context-pointer-drag-start";

export interface CodexContextPointerDragStartDetail {
  clientX: number;
  clientY: number;
  path: string;
}

let currentFileCompareDragPath: string | null = null;
let clearFileCompareDragTimer: ReturnType<typeof setTimeout> | null = null;
let lastFileCompareDragClearAt = 0;
let codexContextPointerDragActive = false;
let pendingCodexPointerCapture: {
  pointerId: number;
  target: Element;
} | null = null;
const recentFileCompareDragWindowMs = 750;

export function prepareFileCompareDragData(path: string) {
  currentFileCompareDragPath = path;
  scheduleClearFileCompareDragData(2_000);
}

export function prepareCodexContextPointerCapture(
  target: Element,
  pointerId: number,
) {
  if (
    typeof document === "undefined" ||
    !document.querySelector(
      '[data-review-id="codex-panel"], [data-review-id="agent-panel"]',
    )
  ) {
    return;
  }
  pendingCodexPointerCapture = { pointerId, target };
}

export function activateCodexContextPointerCapture(position?: {
  clientX: number;
  clientY: number;
}) {
  if (!pendingCodexPointerCapture || !currentFileCompareDragPath) {
    return false;
  }
  if (clearFileCompareDragTimer) {
    clearTimeout(clearFileCompareDragTimer);
    clearFileCompareDragTimer = null;
  }
  try {
    (
      pendingCodexPointerCapture.target as Element & {
        setPointerCapture(pointerId: number): void;
      }
    ).setPointerCapture(pendingCodexPointerCapture.pointerId);
  } catch {
    // Pointer capture is a best-effort fallback for native WebViews.
  }
  codexContextPointerDragActive = true;
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<CodexContextPointerDragStartDetail>(
        codexContextPointerDragStartEvent,
        {
          detail: {
            clientX: position?.clientX ?? 0,
            clientY: position?.clientY ?? 0,
            path: currentFileCompareDragPath,
          },
        },
      ),
    );
  }
  return true;
}

export function writeFileCompareDragData(
  dataTransfer: DataTransfer,
  path: string,
) {
  if (clearFileCompareDragTimer) {
    clearTimeout(clearFileCompareDragTimer);
    clearFileCompareDragTimer = null;
  }
  currentFileCompareDragPath = path;
  try {
    dataTransfer.setData(fileCompareDragType, path);
    dataTransfer.setData("text/plain", path);
  } catch {
    // Some WebViews do not preserve custom app data for internal drags.
  }
  dataTransfer.effectAllowed = "copy";
}

export function readFileCompareDragData(
  dataTransfer: DataTransfer,
): string | null {
  try {
    const transferPath =
      dataTransfer.getData(fileCompareDragType) ||
      dataTransfer.getData("text/plain");
    if (transferPath) {
      return transferPath;
    }
  } catch {
    // Fall back to the in-app drag session below.
  }
  return readCurrentFileCompareDragData();
}

export function clearFileCompareDragData() {
  if (clearFileCompareDragTimer) {
    clearTimeout(clearFileCompareDragTimer);
    clearFileCompareDragTimer = null;
  }
  currentFileCompareDragPath = null;
  codexContextPointerDragActive = false;
  pendingCodexPointerCapture = null;
  lastFileCompareDragClearAt = Date.now();
}

export function scheduleClearFileCompareDragData(delayMs = 250) {
  if (pendingCodexPointerCapture) {
    return;
  }
  if (clearFileCompareDragTimer) {
    clearTimeout(clearFileCompareDragTimer);
  }
  clearFileCompareDragTimer = setTimeout(() => {
    clearFileCompareDragData();
  }, delayMs);
}

export function readCurrentFileCompareDragData(): string | null {
  return currentFileCompareDragPath;
}

export function isCodexContextPointerDragActive() {
  return codexContextPointerDragActive;
}

export function isRecentFileCompareDragSession() {
  return (
    currentFileCompareDragPath !== null ||
    Date.now() - lastFileCompareDragClearAt < recentFileCompareDragWindowMs
  );
}
