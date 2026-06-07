import { documentFormatForPath } from "../../../core/documentFormat";
import type { DocumentDiffPreview, DocumentPayload } from "../../../core/types";
import type { DiffSide } from "./contextMenuTypes";

export function diffPreviewDocumentPath(
  preview: DocumentDiffPreview,
  side: DiffSide,
): string | null {
  const explicitPath = side === "left" ? preview.leftPath : preview.rightPath;
  if (explicitPath) {
    return explicitPath;
  }
  if (side === "left") {
    return null;
  }
  if (!preview.relativePath) {
    return null;
  }
  if (
    preview.relativePath.startsWith("/") ||
    /^[A-Za-z]:[\\/]/u.test(preview.relativePath)
  ) {
    return preview.relativePath;
  }
  if (!preview.repositoryRoot) {
    return null;
  }
  const separator =
    preview.repositoryRoot.includes("\\") &&
    !preview.repositoryRoot.includes("/")
      ? "\\"
      : "/";
  return `${preview.repositoryRoot.replace(/[\\/]+$/u, "")}${separator}${preview.relativePath.replace(/^[\\/]+/u, "")}`;
}

export function diffPreviewDocumentPayload(path: string): DocumentPayload {
  return {
    path,
    basePath: path.replace(/[\\/][^\\/]*$/u, "") || path,
    format: documentFormatForPath(path),
    source: "",
    updatedAt: "",
  };
}
