import type { CommandDispatchResult, CommandId } from "../core/commands";
import type {
  DocumentPayload,
  RenderResult,
  WorkspaceSearchResult,
} from "../core/types";
import type { ReactNode } from "react";
import type { SafeHtml } from "./lib/safeHtml";
import type { PostDiffGitMarkerContext } from "./lib/gitRenderedDiff";

export type PaneId = "left" | "right";

export interface SearchHitSummary {
  index: number;
  heading: string;
  snippet: string;
}

export type SearchScope = "document" | "workspace";

export interface WorkspaceSearchState {
  status: "idle" | "loading" | "ready" | "error";
  result: WorkspaceSearchResult | null;
  message: string | null;
}

export interface NavigationLocation {
  path: string;
  headingId?: string;
  scrollTop?: number;
  label?: string;
}

export interface SmartScrollAnchor {
  path: string;
  headingId?: string;
  sourceLine?: number;
  sourceReference?: string;
  scrollTop: number;
  viewportOffset: number;
}

export interface RecentlyVisitedLocation extends NavigationLocation {
  visitedAt: string;
}

export type InlineNoticeTone = "info" | "success" | "warning" | "error";

export interface InlineNotice {
  id: number;
  message: string;
  tone: InlineNoticeTone;
  autoDismissMs: number;
}

export interface InlineNoticeOptions {
  tone?: InlineNoticeTone;
  autoDismissMs?: number;
}

export interface LightweightActionFeedback {
  id: number;
  message: string;
  autoDismissMs: number;
}

export interface ViewerPostDiffGitMarkerContext extends PostDiffGitMarkerContext {
  documentPath: string;
  documentUpdatedAt?: string | null;
}

export type OpenFileReloadStatus = "reloading" | "reloaded" | "error";

export interface OpenFileReloadState {
  status: OpenFileReloadStatus;
  message?: string;
  updatedAt: string;
}

export interface ViewerPaneSnapshot {
  id: PaneId;
  documentPayload: DocumentPayload | null;
  renderResult: RenderResult | null;
  documentHtml: SafeHtml;
  query: string;
  searchIndex: number;
  searchHits: SearchHitSummary[];
  activeHeadingId: string | null;
  navigationBackStack: NavigationLocation[];
  navigationForwardStack: NavigationLocation[];
}

export type WorkspaceTab =
  | {
      kind: "document";
      id: string;
      path: string;
      document: DocumentPayload;
    }
  | {
      kind: "preferences";
      id: "app://preferences";
    };

export interface MouseGestureAutomation {
  pattern: string;
  commandId?: CommandId;
  status: CommandDispatchResult["status"] | "none";
}

export interface MouseNavigationAutomation {
  button: 3 | 4;
  commandId: CommandId;
  status: CommandDispatchResult["status"];
}

export type RightSidebarTab = "contents" | "search" | "diagrams";

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  enabled?: boolean;
  danger?: boolean;
  separatorBefore?: boolean;
  title?: string;
  onSelect: () => void | Promise<void>;
}

export interface ContextMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
  sourceReviewId?: string;
}

export type DiagramPreviewState =
  | {
      kind?: "diagram" | "image-svg";
      title: string;
      svg: string;
      width?: number;
      height?: number;
      sourceReference?: string;
    }
  | {
      kind: "image-raster";
      title: string;
      imageSrc: string;
      width?: number;
      height?: number;
      sourceReference?: string;
    };
