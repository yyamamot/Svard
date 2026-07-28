import type { MouseEvent, RefObject } from "react";
import type {
  AppConfig,
  DocumentChangeSnapshot,
  DocumentDiffPreview,
  GitDiffPreviewBatchEntry,
  GitBranchDiffPreviewBatchItem,
  DocumentDiffStreamPreview,
  DocumentLinkResolution,
  DocumentMediaSnapshot,
  DocumentPayload,
  DocumentSelectionSnapshot,
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
import type { SelectionRevealTarget } from "../../lib/diffDocumentSelection";
import type { DiffAgentDockControls } from "../DiffAgentDock";

export type SectionLoadState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ready";
      preview: DocumentDiffPreview;
      summary: GitRenderedDiffSummary;
      measurementCommitStartedAt?: number;
    }
  | {
      status: "blocked";
      message: string;
      reason?: "too-complex";
      preview?: DocumentDiffPreview;
    };

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
  agentDock?: DiffAgentDockControls;
  config: AppConfig | null;
  changeMarkersHidden?: boolean;
  preview: DocumentDiffStreamPreview;
  documentReviewSession?: DocumentReviewSessionControls;
  confirmedRemoteDiagramKeys?: ReadonlySet<string>;
  krokiFallbackDiagramKeys?: ReadonlySet<string>;
  getGitDiffPreview: (path: string) => Promise<DocumentDiffPreview>;
  getGitDiffPreviews?: (
    repositoryRoot: string,
    relativePaths: string[],
  ) => Promise<GitDiffPreviewBatchEntry[]>;
  getGitBranchFileDiff?: (
    path: string,
    input: {
      baseRef: string;
      headRef?: string | null;
      path: string;
      oldPath?: string | null;
    },
  ) => Promise<DocumentDiffPreview>;
  getGitBranchFileDiffs?: (
    repositoryRoot: string,
    options: {
      baseRef: string;
      headRef?: string | null;
      items: GitBranchDiffPreviewBatchItem[];
    },
  ) => Promise<GitDiffPreviewBatchEntry[]>;
  getGitFileCommitDiff?: (
    path: string,
    revision: string,
  ) => Promise<DocumentDiffPreview>;
  getGitFileCommitDiffs?: (
    repositoryRoot: string,
    revision: string,
    relativePaths: string[],
  ) => Promise<GitDiffPreviewBatchEntry[]>;
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
  onOpenDiffPreview?: (preview: DocumentDiffPreview) => void;
  onAddAgentSelection?: (
    snapshot: DocumentSelectionSnapshot,
    revealTarget: SelectionRevealTarget,
  ) => void;
  onAddAgentMedia?: (
    snapshot: DocumentMediaSnapshot,
    revealTarget: SelectionRevealTarget,
  ) => void;
  onAddAgentChange?: (
    snapshot: DocumentChangeSnapshot,
    revealTarget: SelectionRevealTarget,
  ) => void;
  initialViewMode?: DiffStreamViewMode;
  revealChangeTarget?: {
    itemPath: string;
    changeIndex: number;
  };
  showInlineNotice: (
    message: string,
    options?: { tone?: "info" | "success" | "warning" | "error" },
  ) => void;
  showLightweightActionFeedback?: (message: string) => void;
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
