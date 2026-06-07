import { GitBranch, GitCommitHorizontal, Tag, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GitRefItem, GitRefKind, GitRefList } from "../../core/types";
import { fileName } from "../lib/path";

interface GitRefPickerProps {
  kind: GitRefKind;
  path: string;
  refs: GitRefList;
  loading: boolean;
  loadingMore: boolean;
  query: string;
  onClose: () => void;
  onLoadMore: () => Promise<void>;
  onQueryChange: (query: string) => Promise<void>;
  onSelect: (ref: GitRefItem) => void;
}

function kindTitle(kind: GitRefKind) {
  if (kind === "branch") {
    return "Compare with Branch";
  }
  if (kind === "tag") {
    return "Compare with Tag";
  }
  return "Compare with Commit";
}

function kindIcon(kind: GitRefKind) {
  if (kind === "branch") {
    return <GitBranch size={16} />;
  }
  if (kind === "tag") {
    return <Tag size={16} />;
  }
  return <GitCommitHorizontal size={16} />;
}

function emptyMessage(kind: GitRefKind, refs: GitRefList, query: string) {
  if (refs.status !== "ok") {
    return refs.message ?? "Git references are not available for this file.";
  }
  if (query.trim()) {
    return "No matching Git reference.";
  }
  return kind === "commit"
    ? "No recent commits found for this repository."
    : `No ${kind}s found for this repository.`;
}

function syntheticCommit(query: string): GitRefItem | null {
  const trimmed = query.trim();
  if (!/^[0-9a-f]{4,40}$/i.test(trimmed)) {
    return null;
  }
  return {
    kind: "commit",
    name: trimmed,
    revision: trimmed,
    shortRevision: trimmed.slice(0, 7),
    summary: "Resolve commit hash",
  };
}

export function GitRefPicker({
  kind,
  path,
  refs,
  loading,
  loadingMore,
  query,
  onClose,
  onLoadMore,
  onQueryChange,
  onSelect,
}: GitRefPickerProps) {
  const [draftQuery, setDraftQuery] = useState(query);
  const [loadMoreArmed, setLoadMoreArmed] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    setDraftQuery(query);
  }, [query]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (draftQuery !== query) {
        void onQueryChange(draftQuery);
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [draftQuery, onQueryChange, query]);
  useEffect(() => {
    const root = listRef.current;
    const sentinel = sentinelRef.current;
    if (
      !root ||
      !sentinel ||
      !loadMoreArmed ||
      !refs.hasMore ||
      loading ||
      loadingMore
    ) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void onLoadMore();
        }
      },
      { root, threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMoreArmed, loading, loadingMore, onLoadMore, refs.hasMore]);
  const filteredRefs = useMemo(() => {
    const normalizedQuery = draftQuery.trim().toLowerCase();
    const matches = refs.items.filter((ref) => {
      if (!normalizedQuery) {
        return true;
      }
      return [
        ref.name,
        ref.revision,
        ref.shortRevision,
        ref.summary ?? "",
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
    });
    const synthetic =
      kind === "commit" && !matches.length ? syntheticCommit(draftQuery) : null;
    return synthetic ? [synthetic, ...matches] : matches;
  }, [draftQuery, kind, refs.items]);
  const canSelect = refs.status === "ok";
  const hasMore = canSelect && Boolean(refs.hasMore);

  return (
    <div className="modal-backdrop git-ref-picker-backdrop">
      <section
        className="git-ref-picker"
        data-review-id="git-ref-picker"
        role="dialog"
        aria-modal="true"
        aria-label={kindTitle(kind)}
      >
        <header className="git-ref-picker-header">
          <div>
            <p>{fileName(path)}</p>
            <h2>{kindTitle(kind)}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close Git reference picker"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>
        <div className="git-ref-picker-body">
          <input
            autoFocus
            className="git-ref-picker-input"
            data-review-id="git-ref-picker-input"
            value={draftQuery}
            placeholder={
              kind === "commit"
                ? "Search commits or paste a hash"
                : `Search ${kind}s`
            }
            onChange={(event) => {
              setLoadMoreArmed(false);
              setDraftQuery(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                onClose();
              }
              if (event.key === "Enter" && canSelect && filteredRefs[0]) {
                event.preventDefault();
                onSelect(filteredRefs[0]);
              }
            }}
          />
          {loading ? (
            <p className="git-ref-picker-empty">Loading Git references...</p>
          ) : canSelect && filteredRefs.length > 0 ? (
            <div
              className="git-ref-picker-list"
              data-review-id="git-ref-picker-list"
              ref={listRef}
              onScroll={(event) => {
                if (event.currentTarget.scrollTop > 0) {
                  setLoadMoreArmed(true);
                }
              }}
            >
              {filteredRefs.map((ref) => (
                <button
                  type="button"
                  key={`${ref.kind}:${ref.name}:${ref.revision}`}
                  className="git-ref-picker-row"
                  data-review-id="git-ref-picker-item"
                  onClick={() => onSelect(ref)}
                >
                  <span className="git-ref-picker-icon" aria-hidden="true">
                    {kindIcon(ref.kind)}
                  </span>
                  <span className="git-ref-picker-label">
                    <strong>{ref.name}</strong>
                    {ref.summary ? <small>{ref.summary}</small> : null}
                  </span>
                  <code>{ref.shortRevision}</code>
                </button>
              ))}
              <div ref={sentinelRef} className="git-ref-picker-sentinel" />
              {hasMore ? (
                <button
                  type="button"
                  className="git-ref-picker-load-more"
                  data-review-id="git-ref-picker-load-more"
                  disabled={loadingMore}
                  onClick={() => void onLoadMore()}
                >
                  {loadingMore ? "Loading older refs..." : "Load older refs"}
                </button>
              ) : null}
            </div>
          ) : (
            <p className="git-ref-picker-empty">
              {emptyMessage(kind, refs, draftQuery)}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
