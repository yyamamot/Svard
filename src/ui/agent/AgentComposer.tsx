import {
  ChevronDown,
  FileImage,
  FileText,
  Plus,
  Send,
  ShieldAlert,
  Square,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import {
  isDocumentChangeSnapshot,
  isDocumentMediaSnapshot,
} from "../../core/types";
import { selectionSnapshotText } from "../lib/documentSelection";
import { fileName } from "../lib/path";
import { AgentAccessMenu } from "./AgentAccessMenu";
import { changeDisplayLabel, selectionDisplayLabel } from "./agentPanelModel";
import type { AgentPanelHostProps } from "./agentPanelTypes";
import type { AgentSessionController } from "./useAgentSessionController";
import type { AgentTurnComposer } from "./useAgentTurnComposer";

export function AgentComposer({
  composer,
  hostProps,
  session,
}: {
  composer: AgentTurnComposer;
  hostProps: AgentPanelHostProps;
  session: AgentSessionController;
}) {
  const {
    activeDocument,
    host,
    onRemoveQuotedContext,
    onReturnToQuotedContext,
    placement = "mainRight",
    quotedContexts: providedQuotedContexts = [],
    workspaceRoot,
  } = hostProps;
  const {
    activeTurnId,
    actionNotice,
    addMenuOpen,
    attachments,
    composerDockRef,
    composerInputRef,
    dropActive,
    focusFiles,
    imageErrors,
    images,
    mediaModes,
    question,
    restoredQuotedContexts,
    sessionStarting,
    sessionIdRef,
    setAddMenuOpen,
    setAttachments,
    setDropActive,
    setFocusFiles,
    setImageErrors,
    setMediaModes,
    setQuestion,
    setRestoredQuotedContexts,
  } = session;
  const quotedContexts = [...providedQuotedContexts, ...restoredQuotedContexts];
  const restoredQuotedContextIds = new Set(
    restoredQuotedContexts.map((context) => context.snapshotId),
  );
  function removeQuotedContext(snapshotId: string) {
    if (restoredQuotedContextIds.has(snapshotId)) {
      setRestoredQuotedContexts((current) =>
        current.filter((context) => context.snapshotId !== snapshotId),
      );
    } else {
      onRemoveQuotedContext?.(snapshotId);
    }
  }
  const {
    handleDrop,
    handlePaste,
    internalDragPreview,
    pickFocusFiles,
    pickImages,
    probe,
    pendingTurn,
    ready,
    removeImage,
    runningAction,
    steeringModeMatches,
    cancelQueuedTurn,
    steer,
    stopAndSend,
    submit,
  } = composer;
  const hasDraft = Boolean(
    question.trim() || images.length > 0 || quotedContexts.length > 0,
  );
  return (
    <div
      className={`agent-composer-dock ${dropActive ? "drop-active" : ""}`}
      ref={composerDockRef}
      onDragEnter={(event) => {
        event.preventDefault();
        setDropActive(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setDropActive(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setDropActive(false);
        }
      }}
      onDrop={handleDrop}
    >
      {internalDragPreview && typeof document !== "undefined"
        ? createPortal(
            <div
              className={`codex-context-drag-preview ${
                internalDragPreview.inside ? "can-drop" : ""
              }`}
              data-review-id="codex-context-drag-preview"
              aria-hidden="true"
              style={{
                left: Math.max(
                  8,
                  Math.min(
                    internalDragPreview.clientX + 14,
                    window.innerWidth - 224,
                  ),
                ),
                top: Math.max(
                  8,
                  Math.min(
                    internalDragPreview.clientY + 14,
                    window.innerHeight - 56,
                  ),
                ),
              }}
            >
              <FileText size={14} />
              <span>{fileName(internalDragPreview.path)}</span>
              <small>
                {internalDragPreview.inside ? "Drop to add" : "Add to AI Chat"}
              </small>
            </div>,
            document.body,
          )
        : null}
      {dropActive ? (
        <div className="agent-image-drop-hint">
          <FileImage size={18} />
          Drop files or images here
        </div>
      ) : null}
      {focusFiles.length > 0 ? (
        <div className="agent-focus-files">
          {focusFiles.map((file) => (
            <span key={file.path} title={file.displayLabel}>
              <FileText size={13} />
              {file.displayLabel}
              <button
                type="button"
                aria-label={`Remove ${file.displayLabel}`}
                onClick={() =>
                  setFocusFiles((files) =>
                    files.filter((item) => item.path !== file.path),
                  )
                }
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      {attachments.length > 0 ? (
        <div className="agent-focus-files">
          {attachments.map((attachment) => (
            <span key={attachment.attachmentId} title={attachment.displayLabel}>
              <FileText size={13} />
              {attachment.displayLabel}
              <button
                type="button"
                aria-label={`Remove ${attachment.displayLabel}`}
                onClick={() =>
                  setAttachments((items) =>
                    items.filter(
                      (item) => item.attachmentId !== attachment.attachmentId,
                    ),
                  )
                }
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      {quotedContexts.length > 0 ? (
        <div
          className="agent-selection-attachments"
          data-review-id="agent-selection-attachments"
          aria-label="Quoted document content for this question"
        >
          {quotedContexts.map((context) => {
            if (isDocumentMediaSnapshot(context)) {
              const item = context;
              const mode = mediaModes[item.snapshotId] ?? item.defaultMode;
              return (
                <article
                  className="agent-media-card"
                  data-review-id="agent-media-attachments"
                  key={item.snapshotId}
                >
                  <div className="agent-media-card-header">
                    {item.visual ? (
                      <img
                        src={`data:${item.visual.mediaType};base64,${item.visual.base64}`}
                        alt=""
                      />
                    ) : (
                      <FileImage size={28} />
                    )}
                    <span>
                      <strong>{item.displayLabel}</strong>
                      <small>
                        {item.documentPath}
                        {item.sectionLabel ? ` · ${item.sectionLabel}` : ""}
                        {item.diffContext
                          ? ` · ${item.diffContext.side === "left" ? "Before" : "After"} · ${item.diffContext.revisionLabel}`
                          : ""}
                      </small>
                    </span>
                    <button
                      type="button"
                      onClick={() => onReturnToQuotedContext?.(item)}
                    >
                      Show
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${item.displayLabel}`}
                      onClick={() => removeQuotedContext(item.snapshotId)}
                    >
                      <X size={12} />
                    </button>
                  </div>
                  {item.mediaKind === "diagram" &&
                  item.visual &&
                  item.diagram ? (
                    <div
                      className="agent-media-mode"
                      aria-label={`Input mode for ${item.displayLabel}`}
                    >
                      {(
                        [
                          ["visualAndSource", "Visual + source"],
                          ["visual", "Visual"],
                          ["source", "Source"],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          type="button"
                          key={value}
                          aria-pressed={mode === value}
                          onClick={() =>
                            setMediaModes((current) => ({
                              ...current,
                              [item.snapshotId]: value,
                            }))
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <small className="agent-media-fixed-mode">
                      {item.diagram ? "Source" : "Visual"}
                    </small>
                  )}
                </article>
              );
            }
            if (isDocumentChangeSnapshot(context)) {
              const change = context;
              return (
                <details
                  className="agent-selection-card agent-change-card"
                  data-review-id="agent-current-change-attachment"
                  key={change.snapshotId}
                >
                  <summary>
                    <FileText size={13} />
                    <span>{changeDisplayLabel(change)}</span>
                    <button
                      type="button"
                      aria-label="Return to current change"
                      onClick={(event) => {
                        event.preventDefault();
                        onReturnToQuotedContext?.(change);
                      }}
                    >
                      Show
                    </button>
                    <button
                      type="button"
                      aria-label="Remove current change"
                      onClick={(event) => {
                        event.preventDefault();
                        removeQuotedContext(change.snapshotId);
                      }}
                    >
                      <X size={12} />
                    </button>
                  </summary>
                  {change.before ? (
                    <section>
                      <small>Before · {change.before.documentRevision}</small>
                      <pre>{selectionSnapshotText(change.before)}</pre>
                    </section>
                  ) : null}
                  {change.after ? (
                    <section>
                      <small>After · {change.after.documentRevision}</small>
                      <pre>{selectionSnapshotText(change.after)}</pre>
                    </section>
                  ) : null}
                </details>
              );
            }
            const selection = context;
            return (
              <details
                className="agent-selection-card"
                key={selection.snapshotId}
              >
                <summary>
                  <FileText size={13} />
                  <span>
                    {selectionDisplayLabel(selection)}
                    {!selection.diffContext &&
                    activeDocument?.path === selection.documentPath &&
                    activeDocument.updatedAt !== selection.documentRevision ? (
                      <small>Document changed after selection</small>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    aria-label="Return to selected content"
                    onClick={(event) => {
                      event.preventDefault();
                      onReturnToQuotedContext?.(selection);
                    }}
                  >
                    Show
                  </button>
                  <button
                    type="button"
                    aria-label="Remove selected content"
                    onClick={(event) => {
                      event.preventDefault();
                      removeQuotedContext(selection.snapshotId);
                    }}
                  >
                    <X size={12} />
                  </button>
                </summary>
                <pre>{selectionSnapshotText(selection)}</pre>
              </details>
            );
          })}
        </div>
      ) : null}
      {images.length > 0 || imageErrors.length > 0 ? (
        <div
          className="agent-image-attachments"
          data-review-id="agent-image-attachments"
          aria-label="Images for this question"
        >
          {images.map((image) => (
            <span
              className="agent-image-chip"
              key={image.attachmentId}
              title={`${image.displayLabel} · ${image.width}×${image.height} · ${image.byteLength.toLocaleString()} bytes`}
            >
              <img src={image.thumbnailDataUrl} alt="" />
              <span>{image.displayLabel}</span>
              <button
                type="button"
                aria-label={`Remove ${image.displayLabel}`}
                onClick={() => void removeImage(image)}
              >
                <X size={12} />
              </button>
            </span>
          ))}
          {imageErrors.map((error) => (
            <span
              className="agent-image-chip error"
              key={error.id}
              title={error.message}
            >
              <ShieldAlert size={14} />
              <span className="agent-image-error-copy">
                <strong>{error.displayLabel}</strong>
                <small>{error.message}</small>
              </span>
              <button
                type="button"
                aria-label={`Dismiss ${error.displayLabel}`}
                onClick={() =>
                  setImageErrors((current) =>
                    current.filter((item) => item.id !== error.id),
                  )
                }
              >
                <X size={12} />
              </button>
            </span>
          ))}
          {images.length > 0 ? <small>{images.length}/4 images</small> : null}
        </div>
      ) : null}
      {actionNotice ? (
        <p className="agent-action-notice" role="status">
          {actionNotice}
        </p>
      ) : null}
      {pendingTurn ? (
        <div className="agent-pending-turn" role="status">
          <span>
            {pendingTurn.action === "stopAndSend"
              ? "Waiting for the current response to stop"
              : "Queued after the current response"}
          </span>
          <button type="button" onClick={cancelQueuedTurn}>
            Cancel Queue
          </button>
        </div>
      ) : null}
      <div className="agent-composer">
        <textarea
          ref={composerInputRef}
          value={question}
          placeholder="Ask about this workspace · ⌘/Ctrl+Enter to send"
          rows={2}
          readOnly={Boolean(pendingTurn)}
          aria-busy={sessionStarting}
          onChange={(event) => setQuestion(event.target.value)}
          onPaste={handlePaste}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              (event.metaKey || event.ctrlKey) &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              void submit();
            }
          }}
        />
        <div className="agent-composer-toolbar">
          <div className="agent-composer-toolbar-start">
            <div className="agent-add-menu">
              <button
                type="button"
                className="icon-button"
                aria-label="Add files or images"
                aria-expanded={addMenuOpen}
                onClick={() => {
                  session.setSettingsOpen(false);
                  setAddMenuOpen((value) => !value);
                }}
              >
                <Plus size={17} />
              </button>
              {addMenuOpen ? (
                <div role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAddMenuOpen(false);
                      void pickFocusFiles();
                    }}
                  >
                    <FileText size={14} />
                    Add files…
                  </button>
                  {probe?.capabilities.imageInput ? (
                    <button
                      type="button"
                      role="menuitem"
                      disabled={sessionStarting}
                      onClick={() => void pickImages()}
                    >
                      <FileImage size={14} />
                      Add images…
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
            <AgentAccessMenu
              onBeforeOpen={() => setAddMenuOpen(false)}
              placement={placement}
              probe={probe}
              session={session}
              workspaceRoot={workspaceRoot}
            />
          </div>
          {activeTurnId ? (
            <div
              className="agent-running-turn-actions"
              data-review-id="agent-running-turn-actions"
            >
              <button
                type="button"
                className="agent-running-primary"
                aria-label="Queue"
                disabled={!hasDraft || Boolean(pendingTurn) || sessionStarting}
                onClick={() => void submit()}
              >
                <Send size={15} />
                Queue
              </button>
              <details className="agent-running-action-menu">
                <summary aria-label="Choose running response action">
                  <ChevronDown size={15} />
                </summary>
                <div role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!hasDraft || Boolean(pendingTurn)}
                    onClick={() => void submit()}
                  >
                    Queue
                  </button>
                  {probe?.capabilities.turnSteering ? (
                    <button
                      type="button"
                      role="menuitem"
                      disabled={
                        !hasDraft ||
                        Boolean(pendingTurn) ||
                        Boolean(runningAction) ||
                        !steeringModeMatches
                      }
                      title={
                        steeringModeMatches
                          ? undefined
                          : "Steer cannot change Auto/Visualize mode. Use Queue or Stop and Send."
                      }
                      onClick={() => void steer()}
                    >
                      Steer
                    </button>
                  ) : null}
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!hasDraft || Boolean(pendingTurn)}
                    onClick={() => void stopAndSend()}
                  >
                    Stop and Send
                  </button>
                </div>
              </details>
              <button
                type="button"
                className="agent-send-button"
                aria-label="Cancel"
                onClick={() =>
                  void host.cancelAgentTurn(sessionIdRef.current, activeTurnId)
                }
              >
                <Square size={15} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="agent-send-button"
              aria-label="Send"
              disabled={!ready || sessionStarting || !hasDraft}
              onClick={() => void submit()}
            >
              <Send size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
