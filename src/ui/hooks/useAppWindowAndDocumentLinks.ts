import type { Dispatch, RefObject, SetStateAction } from "react";
import type { DocumentPayload, GitRefKind } from "../../core/types";
import type { LinkPreviewState } from "../lib/linkPreview";
import type { DiagramPreviewState } from "../types";
import { useAppWindowActions } from "./useAppWindowActions";
import { useDocumentLinks } from "./useDocumentLinks";
import type { UseDocumentLinksOptions } from "./documentLinks/types";

interface SourceControlDocumentLinkActions {
  compareWithGitRef: (kind: GitRefKind, path: string) => void | Promise<void>;
  showGitDiff: (path: string) => void | Promise<void>;
}

type AppWindowActionsOptions = Parameters<typeof useAppWindowActions>[0];

interface UseAppWindowAndDocumentLinksOptions extends AppWindowActionsOptions {
  articleRef: RefObject<HTMLElement | null>;
  confirmExternalLink: UseDocumentLinksOptions["confirmExternalLink"];
  confirmKrokiRender: (key: string) => void;
  openContextMenu: UseDocumentLinksOptions["openContextMenu"];
  openDocument: UseDocumentLinksOptions["openDocument"];
  openPathInEditor: (path: string) => Promise<void>;
  openPreferencesTab: () => void;
  recordNavigation: UseDocumentLinksOptions["recordNavigation"];
  renderResult: UseDocumentLinksOptions["renderResult"];
  setActiveHeadingId: (headingId: string | null) => void;
  setDiagramPreview: Dispatch<SetStateAction<DiagramPreviewState | null>>;
  setLinkHoverDestination: Dispatch<SetStateAction<string | null>>;
  setLinkPreview: Dispatch<SetStateAction<LinkPreviewState | null>>;
  setRightSidebarTab: (tab: "contents" | "search" | "diagrams") => void;
  setSelectedDiagramId: (id: string) => void;
  showInlineNotice: UseDocumentLinksOptions["showInlineNotice"];
  sourceControl: SourceControlDocumentLinkActions;
  tryKrokiFallback: (key: string) => void;
}

export function useAppWindowAndDocumentLinks({
  activeHeadingId,
  articleRef,
  closeTabRef,
  config,
  confirmExternalLink,
  confirmKrokiRender,
  documentPayload,
  expandedDirectories,
  focusedPaneId,
  host,
  openContextMenu,
  openDocument,
  openPathInEditor,
  openPreferencesTab,
  orderedTabs,
  paneSnapshots,
  pinnedTabs,
  recordNavigation,
  renderResult,
  rootDirectory,
  setActiveHeadingId,
  setDiagramPreview,
  setLinkHoverDestination,
  setLinkPreview,
  setRightSidebarTab,
  setSelectedDiagramId,
  showInlineNotice,
  showLightweightActionFeedback,
  sidebarLayout,
  sourceControl,
  splitEnabled,
  splitRatio,
  tryKrokiFallback,
  viewerRef,
}: UseAppWindowAndDocumentLinksOptions): {
  documentLinks: ReturnType<typeof useDocumentLinks>;
  windowActions: ReturnType<typeof useAppWindowActions>;
} {
  const windowActions = useAppWindowActions({
    activeHeadingId,
    closeTabRef,
    config,
    documentPayload,
    expandedDirectories,
    focusedPaneId,
    host,
    orderedTabs,
    paneSnapshots,
    pinnedTabs,
    rootDirectory,
    sidebarLayout,
    showLightweightActionFeedback,
    splitEnabled,
    splitRatio,
    viewerRef,
  });
  const documentLinks = useDocumentLinks({
    activeHeadingId,
    articleRef,
    config,
    documentPayload,
    loadDocumentForPreview: (path: string): Promise<DocumentPayload> =>
      host.openDocument(path),
    openDocument,
    openDocumentInNewWindow: windowActions.openDocumentInNewWindow,
    openPathInEditor,
    resolveDocumentLink: (href, documentPath) =>
      host.resolveDocumentLink({ href, documentPath }),
    onShowGitDiff: sourceControl.showGitDiff,
    onConfirmKrokiRender: confirmKrokiRender,
    onLinkHoverDestinationChange: setLinkHoverDestination,
    onLinkPreviewChange: setLinkPreview,
    onOpenDiagramPreview: setDiagramPreview,
    onOpenPreferences: openPreferencesTab,
    onSelectDiagram: (id) => {
      setSelectedDiagramId(id);
      setRightSidebarTab("diagrams");
    },
    onCompareGitRef: sourceControl.compareWithGitRef,
    onTryKrokiFallback: tryKrokiFallback,
    confirmExternalLink,
    openContextMenu,
    openExternalUrl: (url) => host.openExternalUrl(url),
    recordNavigation,
    renderResult,
    setActiveHeadingId,
    showInlineNotice,
    showLightweightActionFeedback,
    saveSvgFile: (fileName, svg) => host.saveSvgFile(fileName, svg),
  });

  return { documentLinks, windowActions };
}
