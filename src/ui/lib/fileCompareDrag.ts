export const fileCompareDragType = "application/x-svard-document-path";

let currentFileCompareDragPath: string | null = null;
let clearFileCompareDragTimer: ReturnType<typeof setTimeout> | null = null;
let lastFileCompareDragClearAt = 0;
const recentFileCompareDragWindowMs = 750;

export function prepareFileCompareDragData(path: string) {
  currentFileCompareDragPath = path;
  scheduleClearFileCompareDragData(2_000);
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
  lastFileCompareDragClearAt = Date.now();
}

export function scheduleClearFileCompareDragData(delayMs = 250) {
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

export function isRecentFileCompareDragSession() {
  return (
    currentFileCompareDragPath !== null ||
    Date.now() - lastFileCompareDragClearAt < recentFileCompareDragWindowMs
  );
}
