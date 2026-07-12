import type { MouseEvent, RefObject } from "react";
import type {
  AppConfig,
  DocumentLinkResolution,
  DocumentPayload,
  GitRefKind,
  RenderResult,
} from "../../../core/types";
import type {
  ContextMenuItem,
  DiagramPreviewState,
  NavigationLocation,
} from "../../types";
import type { LinkPreviewState } from "../../lib/linkPreview";

export interface UseDocumentLinksOptions {
  activeHeadingId: string | null;
  articleRef: RefObject<HTMLElement | null>;
  config: AppConfig | null;
  documentPayload: DocumentPayload | null;
  openDocument: (
    path: string,
    options?: { recordNavigation?: boolean },
  ) => Promise<void>;
  openDocumentInNewWindow: (
    path: string,
    options?: { pinned?: boolean },
  ) => Promise<void>;
  loadDocumentForPreview: (path: string) => Promise<DocumentPayload>;
  openPathInEditor: (path: string) => Promise<void>;
  resolveDocumentLink: (
    href: string,
    documentPath: string,
  ) => Promise<DocumentLinkResolution>;
  onConfirmKrokiRender: (key: string) => void;
  onLinkHoverDestinationChange: (destination: string | null) => void;
  onLinkPreviewChange: (preview: LinkPreviewState | null) => void;
  onOpenDiagramPreview: (preview: DiagramPreviewState) => void;
  onOpenPreferences: () => void;
  onSelectDiagram: (id: string) => void;
  onCompareGitRef: (kind: GitRefKind, path: string) => void | Promise<void>;
  onShowGitDiff: (path: string) => void | Promise<void>;
  onTryKrokiFallback: (key: string) => void;
  confirmExternalLink: (url: string) => Promise<boolean>;
  openExternalUrl: (url: string) => Promise<void>;
  openContextMenu: (
    event: MouseEvent<HTMLElement>,
    items: ContextMenuItem[],
    sourceReviewId?: string,
  ) => boolean;
  recordNavigation: (location: NavigationLocation) => void;
  renderResult: RenderResult | null;
  setActiveHeadingId: (headingId: string | null) => void;
  showInlineNotice: (
    message: string,
    options?: { tone?: "info" | "success" | "warning" | "error" },
  ) => void;
  showLightweightActionFeedback: (message: string) => void;
  saveSvgFile?: (fileName: string, svg: string) => Promise<boolean>;
  onBeginCaptureArea: () => void;
}

export type CopyText = (label: string, content?: string) => Promise<void>;
