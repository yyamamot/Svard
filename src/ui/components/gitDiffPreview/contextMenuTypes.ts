import type { MouseEvent } from "react";
import type {
  DocumentDiffPreview,
  DocumentLinkResolution,
  DocumentMediaSnapshot,
  DocumentSelectionSnapshot,
} from "../../../core/types";
import type { SelectionRevealTarget } from "../../lib/diffDocumentSelection";
import type { CopyText } from "../../hooks/documentLinks/types";
import type { CaptureAreaVariant } from "../../lib/captureArea";
import type { ContextMenuItem, DiagramPreviewState } from "../../types";

export type DiffSide = "left" | "right";
export type DiffSurface = "rendered" | "source" | "table";

export interface PreparedAgentChangeAction {
  enabled: boolean;
  onSelect: () => void | Promise<void>;
  title?: string;
}

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
  onAddAgentSelection?: (
    snapshot: DocumentSelectionSnapshot,
    revealTarget: SelectionRevealTarget,
  ) => void;
  onPrepareAgentSelection?: (range: Range) => (() => void) | undefined;
  onPrepareAgentChange?: (
    target: HTMLElement,
    side: DiffSide,
  ) => PreparedAgentChangeAction | undefined;
  onAddAgentMedia?: (snapshot: DocumentMediaSnapshot, side: DiffSide) => void;
  resolveAgentMediaDiagram?: (
    target: HTMLElement,
    side: DiffSide,
  ) => { type: string; source: string } | undefined;
  showInlineNotice: (
    message: string,
    options?: { tone?: "info" | "success" | "warning" | "error" },
  ) => void;
}
