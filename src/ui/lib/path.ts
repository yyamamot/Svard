import type { MouseEvent } from "react";
import { pathBasename } from "../../core/pathDisplay";

export function fileName(path: string): string {
  return pathBasename(path);
}

export function uniquePaths(paths: string[]): string[] {
  return [...new Set(paths.filter(Boolean))];
}

export function isMiddleMouseButton(event: MouseEvent): boolean {
  return event.button === 1;
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function isGestureBlockedTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return true;
  }
  return Boolean(
    target.closest(
      'input, textarea, select, button, a[href], [role="button"], [contenteditable="true"], [data-copy-source-button]',
    ),
  );
}

export function isExternalUrl(value: string): boolean {
  return isSafeExternalUrlToOpen(value);
}

export function isSafeExternalUrlToOpen(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function splitPathAndHash(value: string): {
  path: string;
  hash: string | null;
} {
  const [path, hash] = value.split("#", 2);
  return { path, hash: hash ? decodeURIComponent(hash) : null };
}
