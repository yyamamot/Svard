import type { MouseEvent, RefObject } from "react";
import type {
  AppConfig,
  DocumentDiffPreview,
  DocumentDiffStreamPreview,
  DocumentLinkResolution,
  DocumentPayload,
  KrokiRequest,
  KrokiResult,
  LocalImageResolveContext,
  LocalImageResult,
} from "../../../core/types";
import type { CopyText } from "../../hooks/documentLinks/types";
import type { ContentCursorCommandHandler } from "../../lib/contentCursor";
import type { DocumentDiffStreamCommandBridge } from "../../lib/documentDiffStreamCommands";
import type { DocumentReviewSessionControls } from "../../lib/documentReviewSession";
import type {
  ContextMenuItem,
  DiagramPreviewState,
  MouseGestureAutomation,
} from "../../types";
import type {
  GitRenderedDiffSummary,
  RenderedDiffNavigationTarget,
} from "../../lib/gitRenderedDiff";
import type { GesturePoint } from "../../../core/mouseGestures";

export type SectionLoadState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ready";
      preview: DocumentDiffPreview;
      summary: GitRenderedDiffSummary;
    }
  | { status: "blocked"; message: string };

export type DiffStreamViewMode = "full" | "changes";

export type DiffStreamLoadReason =
  | "visible"
  | "navigation"
  | "manual-toggle"
  | "refresh";

export interface DiffStreamMouseGestureSession {
  hasDragIntent: boolean;
  points: GesturePoint[];
}

export type DiffStreamTarget = Pick<
  RenderedDiffNavigationTarget,
  "primarySide" | "targetKind"
> & {
  changeIndex: number;
  fileIndex: number;
  key: string;
};

export interface DocumentDiffStreamPanelProps {
  config: AppConfig | null;
  preview: DocumentDiffStreamPreview;
  documentReviewSession?: DocumentReviewSessionControls;
  confirmedRemoteDiagramKeys?: ReadonlySet<string>;
  krokiFallbackDiagramKeys?: ReadonlySet<string>;
  getGitDiffPreview: (path: string) => Promise<DocumentDiffPreview>;
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
  onOpenDiagramPreview: (preview: DiagramPreviewState | null) => void;
  showInlineNotice: (
    message: string,
    options?: { tone?: "info" | "success" | "warning" | "error" },
  ) => void;
  loadDocumentContext?: (
    documentPath: string,
  ) => Promise<Pick<
    DocumentPayload,
    "includeFiles" | "resourceContext" | "asciidocContext"
  > | null>;
  renderDiagram?: (request: KrokiRequest) => Promise<KrokiResult>;
  resolveLocalImage?: (
    source: string,
    documentPath: string,
    context: LocalImageResolveContext | null | undefined,
  ) => Promise<LocalImageResult>;
  setLastMouseGesture?: (gesture: MouseGestureAutomation | null) => void;
  contentCursorCommandRef?: RefObject<ContentCursorCommandHandler | null>;
  streamCommandRef?: RefObject<DocumentDiffStreamCommandBridge | null>;
  onClose: () => void;
  onRefresh?: () => void;
}
