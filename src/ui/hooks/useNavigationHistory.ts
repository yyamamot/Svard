import { useEffect, useRef } from "react";
import { fileName } from "../lib/path";
import { restoreSmartScrollAnchor } from "../lib/smartScrollRestore";
import type {
  NavigationLocation,
  RecentlyVisitedLocation,
  SmartScrollAnchor,
} from "../types";
import type { DocumentPayload } from "../../core/types";
import type { SafeHtml } from "../lib/safeHtml";

export type ActivateTabForHistory = (
  path: string,
  options?: { recordNavigation?: boolean },
) => Promise<void> | void;

interface UseNavigationHistoryOptions {
  activeHeadingId: string | null;
  activateTabRef: React.MutableRefObject<ActivateTabForHistory | null>;
  articleRef: React.RefObject<HTMLElement | null>;
  documentHtml: SafeHtml;
  documentPayload: DocumentPayload | null;
  documentRenderRevision: number;
  navigationBackStack: NavigationLocation[];
  navigationForwardStack: NavigationLocation[];
  pendingNavigationLocation: NavigationLocation | null;
  pendingSmartScrollAnchor: SmartScrollAnchor | null;
  setActiveHeadingId: (headingId: string | null) => void;
  setNavigationBackStack: React.Dispatch<
    React.SetStateAction<NavigationLocation[]>
  >;
  setNavigationForwardStack: React.Dispatch<
    React.SetStateAction<NavigationLocation[]>
  >;
  setRecentlyVisitedLocations: React.Dispatch<
    React.SetStateAction<RecentlyVisitedLocation[]>
  >;
  setPendingNavigationLocation: (location: NavigationLocation | null) => void;
  setPendingSmartScrollAnchor: (anchor: SmartScrollAnchor | null) => void;
  viewerRef: React.RefObject<HTMLElement | null>;
}

export function useNavigationHistory({
  activeHeadingId,
  activateTabRef,
  articleRef,
  documentHtml,
  documentPayload,
  documentRenderRevision,
  navigationBackStack,
  navigationForwardStack,
  pendingNavigationLocation,
  pendingSmartScrollAnchor,
  setActiveHeadingId,
  setNavigationBackStack,
  setNavigationForwardStack,
  setRecentlyVisitedLocations,
  setPendingNavigationLocation,
  setPendingSmartScrollAnchor,
  viewerRef,
}: UseNavigationHistoryOptions) {
  const lastDocumentVisitPathRef = useRef<string | null>(null);

  function currentNavigationLocation(): NavigationLocation | null {
    if (!documentPayload) {
      return null;
    }
    return {
      path: documentPayload.path,
      headingId: activeHeadingId ?? undefined,
      scrollTop: viewerRef.current?.scrollTop,
      label: activeHeadingId ?? fileName(documentPayload.path),
    };
  }

  function restoreNavigationScroll(location: NavigationLocation): boolean {
    if (location.headingId) {
      const target = articleRef.current?.querySelector(
        `#${CSS.escape(location.headingId)}`,
      );
      if (target) {
        target.scrollIntoView({ block: "start", behavior: "smooth" });
        setActiveHeadingId(location.headingId);
        return true;
      }
    }

    if (typeof location.scrollTop === "number") {
      viewerRef.current?.scrollTo({
        top: location.scrollTop,
        behavior: "smooth",
      });
      return true;
    }

    return false;
  }

  useEffect(() => {
    if (
      !pendingSmartScrollAnchor ||
      pendingSmartScrollAnchor.path !== documentPayload?.path ||
      !documentHtml
    ) {
      return;
    }

    requestAnimationFrame(() => {
      if (
        articleRef.current?.dataset.renderRevision !==
        String(documentRenderRevision)
      ) {
        return;
      }
      restoreSmartScrollAnchor({
        anchor: pendingSmartScrollAnchor,
        article: articleRef.current,
        setActiveHeadingId,
        viewer: viewerRef.current,
      });
      setPendingSmartScrollAnchor(null);
    });
  }, [
    documentHtml,
    documentPayload?.path,
    documentRenderRevision,
    pendingSmartScrollAnchor,
  ]);

  useEffect(() => {
    if (
      !pendingNavigationLocation ||
      pendingNavigationLocation.path !== documentPayload?.path ||
      !documentHtml
    ) {
      return;
    }

    requestAnimationFrame(() => {
      restoreNavigationScroll(pendingNavigationLocation);
      setPendingNavigationLocation(null);
    });
  }, [documentHtml, documentPayload?.path, pendingNavigationLocation]);

  useEffect(() => {
    if (!documentPayload) {
      lastDocumentVisitPathRef.current = null;
      return;
    }
    if (pendingNavigationLocation?.path === documentPayload.path) {
      return;
    }
    if (lastDocumentVisitPathRef.current === documentPayload.path) {
      return;
    }
    lastDocumentVisitPathRef.current = documentPayload.path;
    recordRecentlyVisited({
      path: documentPayload.path,
      label: fileName(documentPayload.path),
      scrollTop: viewerRef.current?.scrollTop,
    });
  }, [documentPayload?.path, pendingNavigationLocation?.path]);

  function recordNavigation(nextLocation: NavigationLocation) {
    const current = currentNavigationLocation();
    if (!current || sameNavigationLocation(current, nextLocation)) {
      return;
    }
    recordRecentlyVisited(nextLocation);
    setNavigationBackStack((items) => [...items, current].slice(-50));
    setNavigationForwardStack([]);
  }

  async function restoreNavigationLocation(location: NavigationLocation) {
    if (location.path !== documentPayload?.path) {
      setPendingNavigationLocation(location);
      await activateTabRef.current?.(location.path, {
        recordNavigation: false,
      });
      return;
    }

    restoreNavigationScroll(location);
  }

  async function navigateHistory(direction: "back" | "forward") {
    const sourceStack =
      direction === "back" ? navigationBackStack : navigationForwardStack;
    const target = sourceStack.at(-1);
    const current = currentNavigationLocation();
    if (!target || !current) {
      return;
    }

    if (direction === "back") {
      setNavigationBackStack((items) => items.slice(0, -1));
      setNavigationForwardStack((items) => [...items, current].slice(-50));
    } else {
      setNavigationForwardStack((items) => items.slice(0, -1));
      setNavigationBackStack((items) => [...items, current].slice(-50));
    }

    recordRecentlyVisited(target);
    await restoreNavigationLocation(target);
  }

  async function openRecentlyVisitedLocation(location: NavigationLocation) {
    recordNavigation(location);
    await restoreNavigationLocation(location);
  }

  function recordRecentlyVisited(location: NavigationLocation) {
    setRecentlyVisitedLocations((items) => {
      const next: RecentlyVisitedLocation = {
        ...location,
        visitedAt: new Date().toISOString(),
      };
      return [
        next,
        ...items.filter((item) => !sameVisitedLocation(item, next)),
      ].slice(0, 20);
    });
  }

  return {
    navigateHistory,
    openRecentlyVisitedLocation,
    recordNavigation,
  };
}

function sameNavigationLocation(
  left: NavigationLocation | null,
  right: NavigationLocation | null,
): boolean {
  return Boolean(
    left &&
    right &&
    left.path === right.path &&
    (left.headingId ?? "") === (right.headingId ?? ""),
  );
}

function sameVisitedLocation(
  left: NavigationLocation,
  right: NavigationLocation,
): boolean {
  return (
    left.path === right.path &&
    (left.headingId ?? "") === (right.headingId ?? "") &&
    (left.label ?? "") === (right.label ?? "")
  );
}
