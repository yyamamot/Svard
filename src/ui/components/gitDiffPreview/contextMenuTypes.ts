import type { MouseEvent } from "react";
import type {
  DocumentDiffPreview,
  DocumentLinkResolution,
} from "../../../core/types";
import type { CopyText } from "../../hooks/documentLinks/types";
import type { CaptureAreaVariant } from "../../lib/captureArea";
import type { ContextMenuItem, DiagramPreviewState } from "../../types";

export type DiffSide = "left" | "right";
export type DiffSurface = "rendered" | "source" | "table";

export interface DiffPreviewContextMenuOptions {
  allowLocationReference?: boolean;
  preview: DocumentDiffPreview;
  copyText: CopyText;
  openContextMenu: (
    event: MouseEvent<HTMLElement>,
    items: ContextMenuItem[],
    sourceReviewId?: string,
  ) => boolean;
  openDocument: (path: string) => Promise<void>;
  openPathInEditor: (path: string) => Promise<void>;
  resolveDocumentLink: (
    href: string,
    documentPath: string,
  ) => Promise<DocumentLinkResolution>;
  confirmExternalLink: (url: string) => Promise<boolean>;
  openExternalUrl: (url: string) => Promise<void>;
  onOpenDiagramPreview: (preview: DiagramPreviewState) => void;
  onBeginCaptureArea?: (
    container: HTMLElement,
    variant?: CaptureAreaVariant,
  ) => void;
  showInlineNotice: (
    message: string,
    options?: { tone?: "info" | "success" | "warning" | "error" },
  ) => void;
}
