import {
  ArrowDown,
  Check,
  ChevronRight,
  FileImage,
  FileText,
  LoaderCircle,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import type { HostAdapter } from "../../core/types";
import { isDocumentMediaSnapshot } from "../../core/types";
import {
  SvardOpenUiAnswer,
  validateOpenUiResponse,
} from "../codex/openUiLibrary";
import {
  agentActivityHasExpandableDetail,
  agentActivityItems,
  currentAgentActivity,
  redactAgentWorkspacePaths,
  shouldShowAgentWorkSummary,
  type AgentActivityItem,
  type AgentConversationTurn,
} from "./agentChatState";
import { selectionDisplayLabel } from "./agentPanelModel";
import type { AgentSessionController } from "./useAgentSessionController";
import type { AgentTurnComposer } from "./useAgentTurnComposer";

function ActivityItem({
  activity,
  workspaceRoot,
}: {
  activity: AgentActivityItem;
  workspaceRoot: string | null;
}) {
  const visible = (value: string) =>
    redactAgentWorkspacePaths(value, workspaceRoot);
  const detail = activity.detail ?? activity.summary;
  const duration =
    typeof activity.durationMs === "number" && activity.durationMs > 0
      ? activity.durationMs < 1000
        ? `${activity.durationMs} ms`
        : `${(activity.durationMs / 1000).toFixed(1)} s`
      : null;
  const hasDetails = agentActivityHasExpandableDetail(activity);
  const label = (
    <>
      {activity.status === "failed" || activity.status === "denied" ? (
        <X size={13} />
      ) : (
        <Check size={13} />
      )}
      <span>{visible(activity.title)}</span>
      {!hasDetails && activity.target ? (
        <small> · {visible(activity.target)}</small>
      ) : null}
    </>
  );
  if (!hasDetails) {
    return (
      <div
        className={`agent-activity ${activity.status}`}
        data-activity-category={activity.category}
      >
        <div className="agent-activity-row">{label}</div>
      </div>
    );
  }
  return (
    <details
      className={`agent-activity ${activity.status}`}
      data-activity-category={activity.category}
    >
      <summary>
        {label}
        <ChevronRight className="activity-chevron" size={13} />
      </summary>
      <div className="agent-activity-detail">
        {activity.target ? <strong>{visible(activity.target)}</strong> : null}
        {detail ? <pre>{visible(detail)}</pre> : null}
        {duration ? <small>{duration}</small> : null}
      </div>
    </details>
  );
}

function ConversationTurn({
  actionsDisabled,
  restoreInputDisabled,
  turn,
  host,
  clientSessionId,
  onAgentAction,
  onOpenExternalLink,
  onOpenFile,
  onRestoreInput,
  onReviewChanges,
  resolveWorkspaceImage,
  workspaceRoot,
}: {
  actionsDisabled: boolean;
  restoreInputDisabled: boolean;
  turn: AgentConversationTurn;
  host: HostAdapter;
  clientSessionId: string;
  onAgentAction: (message: string) => void;
  onOpenExternalLink: (url: string) => void;
  onOpenFile: (relativePath: string) => void;
  onRestoreInput: (turn: AgentConversationTurn) => void;
  onReviewChanges?: () => void | Promise<void>;
  resolveWorkspaceImage: (relativePath: string) => Promise<string | null>;
  workspaceRoot: string | null;
}) {
  const visible = (value: string) =>
    redactAgentWorkspacePaths(value, workspaceRoot);
  const activities = agentActivityItems(turn.tools);
  const currentActivity = currentAgentActivity(turn);
  const showWorkSummary = shouldShowAgentWorkSummary(turn);
  const visibleAnswer = visible(turn.answer);
  const restoredOpenUi =
    Boolean(turn.restored) &&
    validateOpenUiResponse(visibleAnswer).candidate !== null;
  const renderOpenUi = turn.responseMode === "visualize" || restoredOpenUi;
  return (
    <article className="agent-turn" data-turn-status={turn.status}>
      <div className="agent-user-message">
        {turn.images.length > 0 ? (
          <div className="agent-message-images">
            {turn.images.map((image) => (
              <img
                key={image.attachmentId}
                src={image.thumbnailDataUrl}
                alt={image.displayLabel}
                title={image.displayLabel}
              />
            ))}
          </div>
        ) : null}
        {turn.quotedContexts.length > 0 ? (
          <div className="agent-message-selections">
            {turn.quotedContexts.map((context) =>
              isDocumentMediaSnapshot(context) ? (
                <span key={context.snapshotId}>
                  {context.visual ? (
                    <img
                      className="agent-message-media-thumbnail"
                      src={`data:${context.visual.mediaType};base64,${context.visual.base64}`}
                      alt=""
                    />
                  ) : (
                    <FileImage size={12} />
                  )}
                  {context.displayLabel}
                </span>
              ) : (
                <span key={context.snapshotId}>
                  <FileText size={12} />
                  {selectionDisplayLabel(context)}
                </span>
              ),
            )}
          </div>
        ) : null}
        {turn.question ? <span>{turn.question}</span> : null}
      </div>
      {turn.steeringMessages.map((message, index) => (
        <div
          className="agent-steering-message"
          key={`${turn.id}:steer:${index}`}
        >
          <small>Steered</small>
          <span>{visible(message)}</span>
        </div>
      ))}
      {turn.changedPaths.length > 0 ? (
        <section
          className="agent-changed-files"
          data-review-id="agent-changed-files"
          aria-label="Changed files"
        >
          <div>
            <strong>Changed files</strong>
            <small>{turn.changedPaths.length}</small>
          </div>
          <ul>
            {turn.changedPaths.slice(0, 5).map((path) => (
              <li key={path}>
                <FileText size={12} />
                <span>{path}</span>
              </li>
            ))}
          </ul>
          {turn.changedPaths.length > 5 ? (
            <small>+{turn.changedPaths.length - 5} more</small>
          ) : null}
          {onReviewChanges ? (
            <button
              type="button"
              className="button"
              onClick={() => void onReviewChanges()}
            >
              {turn.restored ? "Review current changes" : "Review changes"}
            </button>
          ) : null}
        </section>
      ) : null}
      {turn.commentary ? (
        <p className="agent-commentary">{visible(turn.commentary)}</p>
      ) : null}
      {turn.status === "running" ? (
        <div className="agent-current-activity" aria-live="polite">
          <LoaderCircle className="spin" size={13} />
          <span>{visible(currentActivity ?? "Analyzing…")}</span>
        </div>
      ) : null}
      {showWorkSummary ? (
        <details className="agent-work-summary">
          <summary>
            <ChevronRight className="activity-chevron" size={13} />
            Work summary
          </summary>
          <div>
            {turn.plan.length > 0 ? (
              <ol className="agent-plan">
                {turn.plan.map((step) => (
                  <li key={step.id} data-status={step.status}>
                    {step.status === "inProgress" ? (
                      <LoaderCircle className="spin" size={12} />
                    ) : (
                      <Check size={12} />
                    )}
                    {visible(step.title)}
                  </li>
                ))}
              </ol>
            ) : null}
            {activities.length > 0 ? (
              <div className="agent-activities">
                {activities.map((activity) => (
                  <ActivityItem
                    key={activity.id}
                    activity={activity}
                    workspaceRoot={workspaceRoot}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </details>
      ) : null}
      {turn.approval ? (
        <section className="agent-approval" aria-label="Approval required">
          <ShieldAlert size={17} />
          <div>
            <strong>{visible(turn.approval.title)}</strong>
            {turn.approval.detail ? (
              <p>{visible(turn.approval.detail)}</p>
            ) : null}
            <small>{visible(turn.approval.impact)}</small>
            <div>
              <button
                type="button"
                className="button"
                onClick={() =>
                  void host.respondToAgentApproval({
                    clientSessionId,
                    requestId: turn.approval!.requestId,
                    decision: "deny",
                  })
                }
              >
                Deny
              </button>
              <button
                type="button"
                className="button primary"
                onClick={() =>
                  void host.respondToAgentApproval({
                    clientSessionId,
                    requestId: turn.approval!.requestId,
                    decision: "allowOnce",
                  })
                }
              >
                Allow once
              </button>
            </div>
          </div>
        </section>
      ) : null}
      {turn.answer ? (
        renderOpenUi ? (
          <SvardOpenUiAnswer
            content={visibleAnswer}
            disabled={actionsDisabled || turn.restored}
            images={turn.restored ? undefined : turn.images}
            isStreaming={!turn.restored && turn.status === "running"}
            onAgentAction={turn.restored ? undefined : onAgentAction}
            onOpenExternalLink={turn.restored ? undefined : onOpenExternalLink}
            onOpenFile={turn.restored ? undefined : onOpenFile}
            preferUi={turn.responseMode === "visualize"}
            readOnly={Boolean(turn.restored)}
            resolveWorkspaceImage={
              turn.restored ? undefined : resolveWorkspaceImage
            }
          />
        ) : (
          <SvardOpenUiAnswer
            allowStructured={false}
            content={visibleAnswer}
            isStreaming={turn.status === "running"}
            onOpenExternalLink={onOpenExternalLink}
            onOpenFile={onOpenFile}
          />
        )
      ) : null}
      {turn.error ? (
        <p className="agent-turn-error">{visible(turn.error)}</p>
      ) : null}
      {turn.status === "cancelled" ? (
        <small className="agent-turn-cancelled">Cancelled</small>
      ) : null}
      {!turn.restored &&
      turn.restoreEligible &&
      turn.inputAccepted &&
      ["failed", "cancelled"].includes(turn.status) ? (
        <div className="agent-turn-restore">
          {turn.question || turn.quotedContexts.length > 0 ? (
            <button
              type="button"
              className="button"
              disabled={restoreInputDisabled}
              title={
                restoreInputDisabled
                  ? "Send or clear the current draft before restoring this input."
                  : "Restore this input to the composer without sending it."
              }
              onClick={() => onRestoreInput(turn)}
            >
              Restore input
            </button>
          ) : null}
          {turn.images.length > 0 ? (
            <small>Attach the image again to retry.</small>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function AgentConversation({
  composer,
  host,
  onReviewChanges,
  session,
  workspaceRoot,
}: {
  composer: AgentTurnComposer;
  host: HostAdapter;
  onReviewChanges?: () => void | Promise<void>;
  session: AgentSessionController;
  workspaceRoot: string | null;
}) {
  const {
    activeTurnId,
    chatVisible,
    olderHistoryCursor,
    olderHistoryLoading,
    newActivityAvailable,
    scrollRef,
    sessionIdRef,
    state,
    followLatestConversation,
    handleConversationScroll,
    loadOlderSessionHistory,
  } = session;
  const {
    lastAnsweredTurn,
    openAgentExternalLink,
    openAgentWorkspaceFile,
    resolveAgentWorkspaceImage,
    restoreInputBlocked,
    restoreTurnInput,
    submit,
  } = composer;
  if (!chatVisible) {
    return (
      <div className="agent-focused-answer">
        {lastAnsweredTurn?.answer ? (
          <SvardOpenUiAnswer
            content={redactAgentWorkspacePaths(
              lastAnsweredTurn.answer,
              workspaceRoot,
            )}
            disabled={Boolean(activeTurnId)}
            images={lastAnsweredTurn.images}
            isStreaming={lastAnsweredTurn.status === "running"}
            onAgentAction={(message) => void submit(message)}
            onOpenExternalLink={openAgentExternalLink}
            onOpenFile={openAgentWorkspaceFile}
            preferUi={lastAnsweredTurn.responseMode === "visualize"}
            resolveWorkspaceImage={resolveAgentWorkspaceImage}
          />
        ) : (
          "No answer yet."
        )}
      </div>
    );
  }
  return (
    <div className="agent-conversation-shell">
      <div
        className="agent-conversation"
        ref={scrollRef}
        onScroll={handleConversationScroll}
      >
        {olderHistoryCursor ? (
          <button
            type="button"
            className="button agent-history-load-older"
            disabled={olderHistoryLoading}
            onClick={() => void loadOlderSessionHistory()}
          >
            {olderHistoryLoading ? (
              <LoaderCircle className="spin" size={13} />
            ) : null}
            Load earlier messages
          </button>
        ) : null}
        {state.turns.length === 0 ? (
          <div className="agent-welcome">
            <Sparkles size={18} />
            <strong>Ask about this workspace</strong>
            <p>
              Codex can follow relationships across files and show what it is
              doing as it works.
            </p>
          </div>
        ) : null}
        {state.turns.map((turn) => (
          <ConversationTurn
            actionsDisabled={Boolean(activeTurnId)}
            restoreInputDisabled={restoreInputBlocked}
            key={turn.id}
            turn={turn}
            host={host}
            clientSessionId={sessionIdRef.current}
            onAgentAction={(message) => void submit(message)}
            onOpenExternalLink={openAgentExternalLink}
            onOpenFile={openAgentWorkspaceFile}
            onRestoreInput={restoreTurnInput}
            onReviewChanges={onReviewChanges}
            resolveWorkspaceImage={resolveAgentWorkspaceImage}
            workspaceRoot={workspaceRoot}
          />
        ))}
        {state.disconnectedMessage ? (
          <p className="agent-turn-error">
            {redactAgentWorkspacePaths(
              state.disconnectedMessage,
              workspaceRoot,
            )}
          </p>
        ) : null}
      </div>
      {newActivityAvailable ? (
        <button
          type="button"
          className="agent-new-activity"
          onClick={followLatestConversation}
        >
          <ArrowDown size={13} />
          New activity
        </button>
      ) : null}
    </div>
  );
}
