import { isSupportedDocumentPath } from "./documentFormat";
import { pathBasename } from "./pathDisplay";
import type { DesktopOpenRequest } from "./types";

export type DesktopOpenAction =
  | { kind: "warning"; message: string }
  | { kind: "compareDocuments"; leftPath: string; rightPath: string }
  | { kind: "openDocument"; path: string }
  | { kind: "openDirectory"; path: string };

export function desktopOpenDisplayName(path: string): string {
  return pathBasename(path) || path;
}

export function planDesktopOpenRequest(
  request: DesktopOpenRequest,
): DesktopOpenAction[] {
  const actions: DesktopOpenAction[] = [];
  const warnings: DesktopOpenAction[] = (request.diagnostics ?? []).map(
    (message) => ({ kind: "warning", message }),
  );
  const supportedDocumentPaths = request.paths.filter((path) =>
    isSupportedDocumentPath(path),
  );

  if (request.paths.length === 2 && supportedDocumentPaths.length === 2) {
    actions.push({
      kind: "compareDocuments",
      leftPath: supportedDocumentPaths[0],
      rightPath: supportedDocumentPaths[1],
    });
    return [...actions, ...warnings];
  }

  for (const path of request.paths) {
    if (isSupportedDocumentPath(path)) {
      actions.push({ kind: "openDocument", path });
    } else {
      actions.push({ kind: "openDirectory", path });
    }
  }

  return [...actions, ...warnings];
}
