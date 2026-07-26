import { useRef, useState } from "react";
import type {
  AppConfig,
  DocumentDiffPreview,
  DocumentPayload,
  RenderResult,
  WorkspaceEnvironment,
} from "../../core/types";
import type { CaptureAreaRequest } from "../lib/captureArea";
import { MAIN_WINDOW_SESSION_ID } from "../lib/config";
import type { LinkPreviewState } from "../lib/linkPreview";
import { emptySafeHtml } from "../lib/safeHtml";
import type {
  DiagramPreviewState,
  MouseGestureAutomation,
  NavigationLocation,
  RecentlyVisitedLocation,
  RightSidebarTab,
  SearchHitSummary,
  SmartScrollAnchor,
} from "../types";
import type { ActivateTabForHistory } from "./useNavigationHistory";

export function useAppLocalState() {
  const [codexPanelOpen, setCodexPanelOpen] = useState(false);
  const viewerRef = useRef<HTMLElement | null>(null);
  const articleRef = useRef<HTMLElement | null>(null);
  const activateTabForHistoryRef = useRef<ActivateTabForHistory | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const openFilesFilterInputRef = useRef<HTMLInputElement | null>(null);
  const quickOpenInputRef = useRef<HTMLInputElement | null>(null);
  const closeTabRef = useRef<((path: string) => void) | null>(null);
  const [documentPayload, setDocumentPayload] =
    useState<DocumentPayload | null>(null);
  const [navigationBackStack, setNavigationBackStack] = useState<
    NavigationLocation[]
  >([]);
  const [navigationForwardStack, setNavigationForwardStack] = useState<
    NavigationLocation[]
  >([]);
  const [recentlyVisitedLocations, setRecentlyVisitedLocations] = useState<
    RecentlyVisitedLocation[]
  >([]);
  const [renderResult, setRenderResult] = useState<RenderResult | null>(null);
  const [documentRenderRevision, setDocumentRenderRevision] = useState(0);
  const [documentHtml, setDocumentHtml] = useState(emptySafeHtml);
  const [documentHtmlRevision, setDocumentHtmlRevision] = useState(0);
  const [confirmedRemoteDiagramKeys, setConfirmedRemoteDiagramKeys] = useState<
    ReadonlySet<string>
  >(new Set());
  const [krokiFallbackDiagramKeys, setKrokiFallbackDiagramKeys] = useState<
    ReadonlySet<string>
  >(new Set());
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [query, setQuery] = useState("");
  const [searchIndex, setSearchIndex] = useState(0);
  const [searchHits, setSearchHits] = useState<SearchHitSummary[]>([]);
  const [rightSidebarTab, setRightSidebarTab] =
    useState<RightSidebarTab>("contents");
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const [pendingSmartScrollAnchor, setPendingSmartScrollAnchor] =
    useState<SmartScrollAnchor | null>(null);
  const [tabQueries, setTabQueries] = useState<Record<string, string>>({});
  const [zenModeActive, setZenModeActive] = useState(false);
  const [fileComparePickerOpen, setFileComparePickerOpen] = useState(false);
  const [diagramPreview, setDiagramPreview] =
    useState<DiagramPreviewState | null>(null);
  const [documentDiffPreview, setDocumentDiffPreview] =
    useState<DocumentDiffPreview | null>(null);
  const [workspaceEnvironment, setWorkspaceEnvironment] =
    useState<WorkspaceEnvironment | null>(null);
  const [linkHoverDestination, setLinkHoverDestination] = useState<
    string | null
  >(null);
  const [linkPreview, setLinkPreview] = useState<LinkPreviewState | null>(null);
  const copyTextRef = useRef<(label: string, value: string) => void>(() => {});
  const [windowSessionId, setWindowSessionId] = useState(
    MAIN_WINDOW_SESSION_ID,
  );
  const [captureAreaRequest, setCaptureAreaRequest] =
    useState<CaptureAreaRequest | null>(null);
  const [openFilesFilter, setOpenFilesFilter] = useState("");
  const [lastMouseGesture, setLastMouseGesture] =
    useState<MouseGestureAutomation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [workspaceBootComplete, setWorkspaceBootComplete] = useState(false);
  const workspaceTreeGenerationRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const refreshSourceControlFromFileTreeRef = useRef<
    (event: { reason: string; changedPath: string | null }) => void
  >(() => undefined);
  const [workspaceFileChangeRevision, setWorkspaceFileChangeRevision] =
    useState(0);

  return {
    activeHeadingId,
    activateTabForHistoryRef,
    articleRef,
    captureAreaRequest,
    closeTabRef,
    codexPanelOpen,
    config,
    confirmedRemoteDiagramKeys,
    copyTextRef,
    diagramPreview,
    documentDiffPreview,
    documentHtml,
    documentHtmlRevision,
    documentPayload,
    documentRenderRevision,
    error,
    fileComparePickerOpen,
    isLoading,
    krokiFallbackDiagramKeys,
    lastMouseGesture,
    linkHoverDestination,
    linkPreview,
    navigationBackStack,
    navigationForwardStack,
    openFilesFilter,
    openFilesFilterInputRef,
    pendingSmartScrollAnchor,
    query,
    quickOpenInputRef,
    recentlyVisitedLocations,
    refreshSourceControlFromFileTreeRef,
    renderResult,
    rightSidebarTab,
    searchHits,
    searchIndex,
    searchInputRef,
    setActiveHeadingId,
    setCaptureAreaRequest,
    setCodexPanelOpen,
    setConfig,
    setConfirmedRemoteDiagramKeys,
    setDiagramPreview,
    setDocumentDiffPreview,
    setDocumentHtml,
    setDocumentHtmlRevision,
    setDocumentPayload,
    setDocumentRenderRevision,
    setError,
    setFileComparePickerOpen,
    setIsLoading,
    setKrokiFallbackDiagramKeys,
    setLastMouseGesture,
    setLinkHoverDestination,
    setLinkPreview,
    setNavigationBackStack,
    setNavigationForwardStack,
    setOpenFilesFilter,
    setPendingSmartScrollAnchor,
    setQuery,
    setRecentlyVisitedLocations,
    setRenderResult,
    setRightSidebarTab,
    setSearchHits,
    setSearchIndex,
    setTabQueries,
    setWindowSessionId,
    setWorkspaceBootComplete,
    setWorkspaceEnvironment,
    setWorkspaceFileChangeRevision,
    setZenModeActive,
    tabQueries,
    viewerRef,
    windowSessionId,
    workspaceBootComplete,
    workspaceEnvironment,
    workspaceFileChangeRevision,
    workspaceTreeGenerationRef,
    zenModeActive,
  };
}
