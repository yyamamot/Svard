import {
  Archive,
  ArchiveRestore,
  Check,
  LoaderCircle,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import type {
  AgentSessionManagementCapabilities,
  AgentSessionSummary,
} from "../../core/types";

interface AgentSessionHistoryMenuProps {
  activeSessionId: string;
  activeTurn: boolean;
  capabilities: AgentSessionManagementCapabilities | null;
  error: string | null;
  loading: boolean;
  nextCursor: string | null;
  onClose: () => void;
  onDelete: (session: AgentSessionSummary) => Promise<void>;
  onLoadMore: () => Promise<void>;
  onRename: (session: AgentSessionSummary, title: string) => Promise<void>;
  onResume: (session: AgentSessionSummary) => Promise<void>;
  onSetArchived: (
    session: AgentSessionSummary,
    archived: boolean,
  ) => Promise<void>;
  onShowArchivedChange: (archived: boolean) => void;
  sessions: AgentSessionSummary[];
  showArchived: boolean;
}

function sessionTime(value: number): string {
  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function AgentSessionHistoryMenu({
  activeSessionId,
  activeTurn,
  capabilities,
  error,
  loading,
  nextCursor,
  onClose,
  onDelete,
  onLoadMore,
  onRename,
  onResume,
  onSetArchived,
  onShowArchivedChange,
  sessions,
  showArchived,
}: AgentSessionHistoryMenuProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deleting, setDeleting] = useState<AgentSessionSummary | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setEditingId(null);
    setDeleting(null);
  }, [showArchived]);

  async function run(
    session: AgentSessionSummary,
    action: () => Promise<void>,
  ) {
    setBusyId(session.clientSessionId);
    try {
      await action();
    } catch {
      // The host owns the user-visible error so the current editor/dialog stays open.
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section
      className="agent-session-history"
      data-review-id="agent-session-history"
      aria-label="Chat history"
    >
      <header>
        <strong>Chat history</strong>
        <button
          type="button"
          className="icon-button"
          aria-label="Close chat history"
          onClick={onClose}
        >
          <X size={14} />
        </button>
      </header>
      <div className="agent-session-history-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={!showArchived}
          onClick={() => onShowArchivedChange(false)}
        >
          Recent
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={showArchived}
          onClick={() => onShowArchivedChange(true)}
        >
          Archived
        </button>
      </div>
      {activeTurn ? (
        <p className="agent-session-history-notice">
          Finish or cancel the current response before switching chats.
        </p>
      ) : null}
      {error ? (
        <p className="agent-session-history-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="agent-session-list">
        {sessions.map((session) => {
          const active = session.clientSessionId === activeSessionId;
          const busy = busyId === session.clientSessionId;
          const unavailable = session.availability === "unavailable";
          return (
            <article
              className={`agent-session-item ${active ? "active" : ""}`}
              key={session.clientSessionId}
            >
              {editingId === session.clientSessionId ? (
                <form
                  className="agent-session-rename"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const title = editingTitle.trim();
                    if (!title) return;
                    void run(session, async () => {
                      await onRename(session, title);
                      setEditingId(null);
                    });
                  }}
                >
                  <input
                    aria-label="Chat name"
                    maxLength={120}
                    autoFocus
                    value={editingTitle}
                    onChange={(event) => setEditingTitle(event.target.value)}
                  />
                  <button
                    type="submit"
                    className="icon-button"
                    aria-label="Save chat name"
                    disabled={busy || !editingTitle.trim()}
                  >
                    {busy ? (
                      <LoaderCircle className="spin" size={13} />
                    ) : (
                      <Check size={13} />
                    )}
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Cancel renaming chat"
                    onClick={() => setEditingId(null)}
                  >
                    <X size={13} />
                  </button>
                </form>
              ) : (
                <>
                  <button
                    type="button"
                    className="agent-session-open"
                    aria-current={active ? "true" : undefined}
                    disabled={active || activeTurn || unavailable || busy}
                    onClick={() => void run(session, () => onResume(session))}
                  >
                    <strong>{session.title || "Untitled chat"}</strong>
                    <small>
                      {active ? "Current chat" : sessionTime(session.updatedAt)}
                      {unavailable ? " · Unavailable" : ""}
                    </small>
                  </button>
                  <div className="agent-session-actions">
                    {capabilities?.rename ? (
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Rename ${session.title}`}
                        disabled={activeTurn || unavailable || busy}
                        onClick={() => {
                          setEditingId(session.clientSessionId);
                          setEditingTitle(session.title);
                        }}
                      >
                        <Pencil size={13} />
                      </button>
                    ) : null}
                    {(
                      session.archived
                        ? capabilities?.restore
                        : capabilities?.archive
                    ) ? (
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`${session.archived ? "Restore" : "Archive"} ${session.title}`}
                        disabled={active || activeTurn || unavailable || busy}
                        onClick={() =>
                          void run(session, () =>
                            onSetArchived(session, !session.archived),
                          )
                        }
                      >
                        {session.archived ? (
                          <ArchiveRestore size={13} />
                        ) : (
                          <Archive size={13} />
                        )}
                      </button>
                    ) : null}
                    {capabilities?.delete ? (
                      <button
                        type="button"
                        className="icon-button danger"
                        aria-label={`Delete ${session.title}`}
                        disabled={active || activeTurn || busy}
                        onClick={() => setDeleting(session)}
                      >
                        <Trash2 size={13} />
                      </button>
                    ) : null}
                  </div>
                </>
              )}
            </article>
          );
        })}
        {!loading && sessions.length === 0 ? (
          <p className="agent-session-history-empty">
            {showArchived ? "No archived chats." : "No previous chats yet."}
          </p>
        ) : null}
        {loading ? (
          <p className="agent-session-history-loading">
            <LoaderCircle className="spin" size={14} />
            Loading chats…
          </p>
        ) : null}
        {!loading && nextCursor ? (
          <button
            type="button"
            className="button agent-session-load-more"
            onClick={() => void onLoadMore()}
          >
            Load more
          </button>
        ) : null}
      </div>
      {deleting ? (
        <div className="agent-session-delete" role="alertdialog">
          <strong>Delete this chat permanently?</strong>
          <p>
            “{deleting.title || "Untitled chat"}” will be removed from Codex
            history. This cannot be undone.
          </p>
          <div>
            <button
              type="button"
              className="button"
              onClick={() => setDeleting(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button danger"
              disabled={busyId === deleting.clientSessionId}
              onClick={() =>
                void run(deleting, async () => {
                  await onDelete(deleting);
                  setDeleting(null);
                })
              }
            >
              Delete
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
