import { useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, RefObject } from "react";
import type { GitFileHistory, GitFileHistoryItem } from "../../../core/types";
import { tracePerf } from "../../lib/perfTrace";

export function TimelinePanel({
  history,
  path,
  loading,
  loadingMore,
  selectedRevision,
  onLoadMore,
  onOpenChanges,
  onItemContextMenu,
}: {
  history: GitFileHistory | null;
  path: string | null;
  loading: boolean;
  loadingMore: boolean;
  selectedRevision: string | null;
  onLoadMore: () => void;
  onOpenChanges: (item: GitFileHistoryItem) => void | Promise<void>;
  onItemContextMenu: (
    event: ReactMouseEvent<HTMLElement>,
    item: GitFileHistoryItem,
  ) => void;
}) {
  const { sentinelRef, onScrollIntent } = useLoadMoreSentinel({
    enabled: Boolean(history?.hasMore) && !loading && !loadingMore,
    onLoadMore,
    surface: "fileHistory",
  });
  return (
    <section className="timeline-panel" data-review-id="timeline-panel">
      {loading ? (
        <div className="timeline-empty" data-review-id="timeline-loading">
          Loading Git history
        </div>
      ) : history?.status === "ok" ? (
        <div
          className="timeline-list"
          data-review-id="timeline-list"
          onScroll={() => onScrollIntent()}
          onTouchMove={() => onScrollIntent()}
          onWheel={(event) => onScrollIntent(event.deltaY)}
        >
          {history.items.map((item) => (
            <button
              type="button"
              key={item.revision}
              className={`timeline-row ${selectedRevision === item.revision ? "selected-for-compare" : ""}`}
              data-review-id="timeline-item"
              data-revision={item.revision}
              data-selected-compare={
                selectedRevision === item.revision ? "true" : undefined
              }
              onClick={() => onOpenChanges(item)}
              onContextMenu={(event) => onItemContextMenu(event, item)}
            >
              <div className="timeline-row-main">
                <strong>{item.summary}</strong>
                <span>
                  {item.shortHash} · {item.author} ·{" "}
                  {formatTimelineDate(item.date)}
                </span>
              </div>
            </button>
          ))}
          <LoadOlderCommitsControl
            hasMore={Boolean(history.hasMore)}
            loading={loadingMore}
            sentinelRef={sentinelRef}
            onLoadMore={onLoadMore}
          />
        </div>
      ) : (
        <div className="timeline-empty" data-review-id="timeline-empty-state">
          <strong>{timelineEmptyTitle(history?.status, path)}</strong>
          <p>{history?.message ?? "Open a markup document to view history."}</p>
        </div>
      )}
    </section>
  );
}

export function LoadOlderCommitsControl({
  hasMore,
  loading,
  sentinelRef,
  onLoadMore,
}: {
  hasMore: boolean;
  loading: boolean;
  sentinelRef: RefObject<HTMLDivElement | null>;
  onLoadMore: () => void;
}) {
  if (!hasMore) {
    return null;
  }
  return (
    <div
      className="timeline-load-more"
      data-review-id="timeline-load-more"
      ref={sentinelRef}
    >
      <button type="button" onClick={onLoadMore} disabled={loading}>
        {loading ? "Loading older commits" : "Load older commits"}
      </button>
    </div>
  );
}

export function useLoadMoreSentinel({
  enabled,
  onLoadMore,
  surface,
}: {
  enabled: boolean;
  onLoadMore: () => void;
  surface: "fileHistory" | "repoGraph";
}) {
  const [armed, setArmed] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const skippedTraceRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setArmed(false);
      skippedTraceRef.current = false;
      return;
    }
    if (!armed && !skippedTraceRef.current) {
      skippedTraceRef.current = true;
      tracePerf("sourceControl.loadMore.autoSkippedUntilUserScroll", {
        surface,
      });
    }
  }, [armed, enabled, surface]);

  useEffect(() => {
    const target = sentinelRef.current;
    if (
      !target ||
      !enabled ||
      !armed ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setArmed(false);
        onLoadMore();
      }
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [armed, enabled, onLoadMore]);

  function onScrollIntent(deltaY?: number) {
    if (!enabled) {
      return;
    }
    if (typeof deltaY === "number" && deltaY <= 0) {
      return;
    }
    setArmed(true);
  }

  return { sentinelRef, onScrollIntent };
}

export function formatTimelineDate(value: string): string {
  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return new Date(seconds * 1000).toLocaleDateString();
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString();
  }
  return value;
}

function timelineEmptyTitle(
  status: GitFileHistory["status"] | undefined,
  path: string | null,
): string {
  if (!path) {
    return "No document selected";
  }
  switch (status) {
    case "not-in-repo":
      return "Not in Git repository";
    case "untracked":
      return "Untracked file";
    case "no-history":
      return "No file history";
    case "unsupported":
      return "Unsupported document";
    case "error":
      return "Git unavailable";
    default:
      return "Graph unavailable";
  }
}
