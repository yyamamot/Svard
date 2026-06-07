import type { MouseEvent, RefObject } from "react";
import type {
  AppConfig,
  DocumentDiffPreview,
  DocumentLinkResolution,
  DocumentPayload,
  GitCommitDetails,
  GitRefItem,
  GitRefKind,
  GitRefList,
  KrokiRequest,
  KrokiResult,
  LocalImageResult,
} from "../../core/types";
import type { HostAdapter } from "../../core/types";
import { isSupportedDocumentPath } from "../../core/documentFormat";
import type { ContentCursorCommandHandler } from "../lib/contentCursor";
import type {
  ContextMenuState,
  DiagramPreviewState,
  MouseGestureAutomation,
} from "../types";
import { ContextMenu } from "./ContextMenu";
import { DiagramPreviewPanel } from "./DiagramPreviewPanel";
import { ExternalLinkConfirmationDialog } from "./ExternalLinkConfirmationDialog";
import { FileComparePickerPanel } from "./FileComparePickerPanel";
import { GitCommitDetailsPanel } from "./GitCommitDetailsPanel";
import {
  DocumentDiffPreviewPanel,
  type DiffPreviewCloseHandoff,
} from "./GitDiffPreviewPanel";
import { GitRefPicker } from "./GitRefPicker";
import { QuickOpen, type QuickOpenCandidate } from "./QuickOpen";
import { ShortcutGestureHints } from "./ShortcutGestureHints";
import type { CopyText } from "../hooks/documentLinks/types";
import type { ContextMenuItem } from "../types";

interface ExternalLinkConfirmationRequest {
  url: string;
  resolve: (confirmed: boolean) => void;
}

export interface GitRefPickerState {
  kind: GitRefKind;
  path: string;
  refs: GitRefList;
  loading: boolean;
  loadingMore: boolean;
  query: string;
}

interface AppOverlaysProps {
  chooseCompareDocument: () => Promise<string | null>;
  config: AppConfig | null;
  contextMenu: ContextMenuState | null;
  copyText: CopyText;
  documentDiffPreview: DocumentDiffPreview | null;
  diffPreviewChromeHidden: boolean;
  documentPayload: DocumentPayload | null;
  externalLinkConfirmation: ExternalLinkConfirmationRequest | null;
  fileComparePickerOpen: boolean;
  gitCommitDetails: GitCommitDetails | null;
  gitRefPicker: GitRefPickerState | null;
  host: HostAdapter;
  openContextMenu: (
    event: MouseEvent<HTMLElement>,
    items: ContextMenuItem[],
    sourceReviewId?: string,
  ) => boolean;
  quickOpenCandidates: QuickOpenCandidate[];
  quickOpenInputRef: RefObject<HTMLInputElement | null>;
  quickOpenOpen: boolean;
  quickOpenQuery: string;
  viewerShortcutHintsOpen: boolean;
  confirmedRemoteDiagramKeys: ReadonlySet<string>;
  krokiFallbackDiagramKeys: ReadonlySet<string>;
  diagramPreview: DiagramPreviewState | null;
  diffContentCursorClearRef: RefObject<(() => void) | null>;
  diffContentCursorCommandRef: RefObject<ContentCursorCommandHandler | null>;
  resolveDiffLocalImage: (
    source: string,
    documentPath: string,
    context: DocumentPayload["asciidocContext"],
  ) => Promise<LocalImageResult>;
  loadDiffDocumentContext: (
    documentPath: string,
  ) => Promise<Pick<
    DocumentPayload,
    "includeFiles" | "asciidocContext"
  > | null>;
  renderDiffDiagram: (request: KrokiRequest) => Promise<KrokiResult>;
  resolveDiffDocumentLink: (
    href: string,
    documentPath: string,
  ) => Promise<DocumentLinkResolution>;
  confirmExternalLink: (url: string) => Promise<boolean>;
  openDiffExternalUrl: (url: string) => Promise<void>;
  onCloseContextMenu: () => void;
  onCloseDocumentDiffPreview: (handoff?: DiffPreviewCloseHandoff) => void;
  onCloseFileComparePicker: () => void;
  onCloseGitCommitDetails: () => void;
  onCloseGitRefPicker: () => void;
  onCloseQuickOpen: () => void;
  onCompareDocuments: (leftPath: string, rightPath: string) => Promise<void>;
  onExternalLinkConfirmation: (confirmed: boolean) => void;
  onOpenDiagramPreview: (preview: DiagramPreviewState | null) => void;
  onOpenDocument: (path: string) => Promise<void>;
  onOpenGitCommitDetailsFile: (
    details: GitCommitDetails,
    path: string,
  ) => Promise<void>;
  onOpenGitRefDiff: (ref: GitRefItem) => Promise<void>;
  onLoadMoreGitRefs: () => Promise<void>;
  onReloadGitRefs: (query: string) => Promise<void>;
  onOpenPathInEditor: (path: string) => Promise<void>;
  onOpenQuickOpenCandidate: (candidate: QuickOpenCandidate) => Promise<void>;
  onSetLastMouseGesture: (gesture: MouseGestureAutomation | null) => void;
  onSetQuickOpenQuery: (query: string) => void;
  onSetViewerShortcutHintsOpen: (open: boolean) => void;
  showInlineNotice: (
    message: string,
    options?: { tone?: "info" | "success" | "warning" | "error" },
  ) => void;
}

export function AppOverlays({
  chooseCompareDocument,
  config,
  contextMenu,
  copyText,
  documentDiffPreview,
  diffPreviewChromeHidden,
  documentPayload,
  externalLinkConfirmation,
  fileComparePickerOpen,
  gitCommitDetails,
  gitRefPicker,
  host,
  openContextMenu,
  quickOpenCandidates,
  quickOpenInputRef,
  quickOpenOpen,
  quickOpenQuery,
  viewerShortcutHintsOpen,
  confirmedRemoteDiagramKeys,
  krokiFallbackDiagramKeys,
  diagramPreview,
  diffContentCursorClearRef,
  diffContentCursorCommandRef,
  resolveDiffLocalImage,
  loadDiffDocumentContext,
  renderDiffDiagram,
  resolveDiffDocumentLink,
  confirmExternalLink,
  openDiffExternalUrl,
  onCloseContextMenu,
  onCloseDocumentDiffPreview,
  onCloseFileComparePicker,
  onCloseGitCommitDetails,
  onCloseGitRefPicker,
  onCloseQuickOpen,
  onCompareDocuments,
  onExternalLinkConfirmation,
  onOpenDiagramPreview,
  onOpenDocument,
  onOpenGitCommitDetailsFile,
  onOpenGitRefDiff,
  onLoadMoreGitRefs,
  onReloadGitRefs,
  onOpenPathInEditor,
  onOpenQuickOpenCandidate,
  onSetLastMouseGesture,
  onSetQuickOpenQuery,
  onSetViewerShortcutHintsOpen,
  showInlineNotice,
}: AppOverlaysProps) {
  return (
    <>
      {quickOpenOpen && (
        <QuickOpen
          candidates={quickOpenCandidates}
          query={quickOpenQuery}
          inputRef={quickOpenInputRef}
          onChange={onSetQuickOpenQuery}
          onClose={onCloseQuickOpen}
          onOpen={(candidate) => void onOpenQuickOpenCandidate(candidate)}
        />
      )}

      <ShortcutGestureHints
        config={config}
        context="viewer"
        openReviewId="viewer-shortcut-gesture-hints-open"
        panelReviewId="viewer-shortcut-gesture-hints-panel"
        placement="viewer-command"
        title="Shortcuts and Gestures"
        open={viewerShortcutHintsOpen}
        showTrigger={false}
        onOpenChange={onSetViewerShortcutHintsOpen}
      />

      {contextMenu && (
        <ContextMenu menu={contextMenu} onClose={onCloseContextMenu} />
      )}

      {diagramPreview && (
        <DiagramPreviewPanel
          preview={diagramPreview}
          onClose={() => onOpenDiagramPreview(null)}
        />
      )}

      {fileComparePickerOpen && (
        <FileComparePickerPanel
          initialLeftPath={
            documentPayload && isSupportedDocumentPath(documentPayload.path)
              ? documentPayload.path
              : null
          }
          host={host}
          onChooseDocument={chooseCompareDocument}
          onClose={onCloseFileComparePicker}
          onCompare={onCompareDocuments}
        />
      )}

      {gitCommitDetails && (
        <GitCommitDetailsPanel
          details={gitCommitDetails}
          onClose={onCloseGitCommitDetails}
          onOpenFile={(path) =>
            void onOpenGitCommitDetailsFile(gitCommitDetails, path)
          }
        />
      )}

      {gitRefPicker && (
        <GitRefPicker
          kind={gitRefPicker.kind}
          path={gitRefPicker.path}
          refs={gitRefPicker.refs}
          loading={gitRefPicker.loading}
          loadingMore={gitRefPicker.loadingMore}
          query={gitRefPicker.query}
          onClose={onCloseGitRefPicker}
          onLoadMore={onLoadMoreGitRefs}
          onQueryChange={onReloadGitRefs}
          onSelect={(ref) => void onOpenGitRefDiff(ref)}
        />
      )}

      {documentDiffPreview && (
        <DocumentDiffPreviewPanel
          preview={documentDiffPreview}
          chromeHidden={diffPreviewChromeHidden}
          config={config}
          resolveLocalImage={resolveDiffLocalImage}
          loadDocumentContext={loadDiffDocumentContext}
          renderDiagram={renderDiffDiagram}
          confirmedRemoteDiagramKeys={confirmedRemoteDiagramKeys}
          krokiFallbackDiagramKeys={krokiFallbackDiagramKeys}
          contentCursorCommandRef={diffContentCursorCommandRef}
          contentCursorClearRef={diffContentCursorClearRef}
          copyText={copyText}
          openContextMenu={openContextMenu}
          openDocument={onOpenDocument}
          openPathInEditor={onOpenPathInEditor}
          resolveDocumentLink={resolveDiffDocumentLink}
          confirmExternalLink={confirmExternalLink}
          openExternalUrl={openDiffExternalUrl}
          onOpenDiagramPreview={onOpenDiagramPreview}
          showInlineNotice={showInlineNotice}
          setLastMouseGesture={onSetLastMouseGesture}
          onClose={onCloseDocumentDiffPreview}
        />
      )}

      {externalLinkConfirmation && (
        <ExternalLinkConfirmationDialog
          url={externalLinkConfirmation.url}
          onCancel={() => onExternalLinkConfirmation(false)}
          onConfirm={() => onExternalLinkConfirmation(true)}
        />
      )}
    </>
  );
}
