import {
  Eye,
  EyeOff,
  History,
  RotateCcw,
  Settings2,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import { AgentComposer } from "./AgentComposer";
import { AgentConversation } from "./AgentConversation";
import { AgentSessionHistoryMenu } from "./AgentSessionHistoryMenu";
import { permissionLabel, probeLabel } from "./agentPanelModel";
import type { AgentPanelHostProps } from "./agentPanelTypes";
import type { AgentSessionController } from "./useAgentSessionController";
import type { AgentTurnComposer } from "./useAgentTurnComposer";

export function AgentPanelView({
  composer,
  hostProps,
  session,
}: {
  composer: AgentTurnComposer;
  hostProps: AgentPanelHostProps;
  session: AgentSessionController;
}) {
  const { host, onClose, onReviewChanges, workspaceRoot } = hostProps;
  const { probe, ready } = composer;
  const {
    activeTurnId,
    chatVisible,
    cancelFullAccessStart,
    closeSessionRuntime,
    confirmFullAccessStart,
    confirmClosedFullAccessResume,
    confirmFullAccess,
    deleteSession,
    historyArchived,
    historyOpen,
    loadSessionPage,
    networkAccess,
    openSessionHistory,
    pendingFullAccessResume,
    permissionMode,
    probeError,
    renameSession,
    responseMode,
    restartSessionFromProviderDefaults,
    resumeSessionTransaction,
    sessionIdRef,
    sessionListError,
    sessionListLoading,
    sessionPage,
    sessionStarting,
    sessionSettings,
    selectNetworkAccess,
    selectPermissionMode,
    selectWebSearch,
    setChatVisible,
    setHistoryArchived,
    setHistoryOpen,
    setPendingFullAccessResume,
    setResponseMode,
    setSessionArchived,
    setSettingsOpen,
    settingsOpen,
    webSearch,
  } = session;
  return (
    <aside className="codex-panel agent-panel" data-review-id="agent-panel">
      <header className="codex-panel-header">
        <div>
          <strong>AI Chat</strong>
          <span
            title={`Workspace · Codex · ${
              sessionSettings?.modelDisplayName ?? "Codex default"
            } · ${permissionLabel(permissionMode)}${
              networkAccess ? " · Network" : ""
            }`}
            aria-label={`Workspace, Codex, ${
              sessionSettings?.modelDisplayName ?? "Codex default"
            }, ${permissionLabel(permissionMode)}${
              networkAccess ? ", Network" : ""
            }`}
          >
            Workspace · Codex ·{" "}
            {sessionSettings?.modelDisplayName ?? "Codex default"} ·{" "}
            {permissionLabel(permissionMode)}
            {networkAccess ? " · Network" : ""}
          </span>
        </div>
        <div className="codex-panel-actions">
          <button
            type="button"
            className={`button codex-visualize-toggle ${responseMode === "visualize" ? "active" : ""}`}
            data-review-id="agent-response-mode"
            aria-pressed={responseMode === "visualize"}
            onClick={() =>
              setResponseMode((mode) =>
                mode === "visualize" ? "auto" : "visualize",
              )
            }
          >
            <Sparkles size={14} />
            {responseMode === "visualize" ? "Visualize" : "Auto"}
          </button>
          <button
            type="button"
            className={`icon-button ${settingsOpen ? "active" : ""}`}
            aria-label="Agent settings"
            onClick={() => setSettingsOpen((value) => !value)}
          >
            <Settings2 size={15} />
          </button>
          <button
            type="button"
            className={`icon-button ${historyOpen ? "active" : ""}`}
            aria-label="Open chat history"
            disabled={!workspaceRoot}
            onClick={() => void openSessionHistory()}
          >
            <History size={15} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Start new chat"
            disabled={sessionStarting}
            onClick={() => void restartSessionFromProviderDefaults()}
          >
            <RotateCcw size={15} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={chatVisible ? "Hide Chat" : "Show Chat"}
            onClick={() => setChatVisible((value) => !value)}
          >
            {chatVisible ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Close AI Chat"
            onClick={() => {
              void (async () => {
                await closeSessionRuntime();
                onClose();
              })();
            }}
          >
            <X size={15} />
          </button>
        </div>
      </header>

      {historyOpen ? (
        <AgentSessionHistoryMenu
          activeSessionId={sessionIdRef.current}
          activeTurn={Boolean(activeTurnId)}
          capabilities={sessionPage?.managementCapabilities ?? null}
          error={sessionListError}
          loading={sessionListLoading}
          nextCursor={sessionPage?.nextCursor ?? null}
          onClose={() => setHistoryOpen(false)}
          onDelete={deleteSession}
          onLoadMore={() => loadSessionPage(false, historyArchived)}
          onRename={renameSession}
          onResume={resumeSessionTransaction}
          onSetArchived={setSessionArchived}
          onShowArchivedChange={(archived) => {
            setHistoryArchived(archived);
            void loadSessionPage(true, archived);
          }}
          sessions={sessionPage?.sessions ?? []}
          showArchived={historyArchived}
        />
      ) : null}

      {settingsOpen ? (
        <section
          className="codex-execution-settings"
          aria-label="Agent settings"
        >
          <div className="codex-execution-settings-heading">
            <strong>Agent access</strong>
            <span>New chat</span>
          </div>
          <fieldset>
            <legend>Permission mode</legend>
            {(["observe", "agent", "fullAccess"] as const).map((mode) => (
              <label key={mode}>
                <input
                  type="radio"
                  checked={permissionMode === mode}
                  disabled={sessionStarting}
                  onChange={() => void selectPermissionMode(mode)}
                />
                <span>{permissionLabel(mode)}</span>
              </label>
            ))}
          </fieldset>
          {probe?.capabilities.networkAccess ? (
            <label className="codex-execution-toggle">
              <input
                type="checkbox"
                checked={networkAccess}
                disabled={sessionStarting}
                onChange={(event) => {
                  void selectNetworkAccess(event.target.checked);
                }}
              />
              <span>Network access</span>
              <small>Allow commands to connect to the network.</small>
            </label>
          ) : null}
          {probe?.capabilities.webSearch ? (
            <label className="codex-execution-toggle">
              <input
                type="checkbox"
                checked={webSearch}
                disabled={sessionStarting}
                onChange={(event) => {
                  void selectWebSearch(event.target.checked);
                }}
              />
              <span>Web search</span>
              <small>Allow the provider to search the web.</small>
            </label>
          ) : null}
          <p>The agent works from the folder currently open in Svard.</p>
        </section>
      ) : null}

      {confirmFullAccess ? (
        <section className="codex-execution-danger" role="alertdialog">
          <ShieldAlert size={20} />
          <div>
            <strong>Enable Full Access for this chat?</strong>
            <p>
              Commands can read and modify files outside the open workspace.
              Network access remains controlled separately.
            </p>
            <div>
              <button
                type="button"
                className="button"
                onClick={cancelFullAccessStart}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button danger"
                onClick={() => void confirmFullAccessStart(false)}
              >
                Enable Full Access
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {pendingFullAccessResume ? (
        <section className="codex-execution-danger" role="alertdialog">
          <ShieldAlert size={20} />
          <div>
            <strong>Resume this chat with Full Access?</strong>
            <p>
              The saved chat used Full Access. Confirm it again before Codex can
              continue outside the open workspace.
            </p>
            <div>
              <button
                type="button"
                className="button"
                onClick={() => setPendingFullAccessResume(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button danger"
                onClick={() => {
                  const session = pendingFullAccessResume;
                  setPendingFullAccessResume(null);
                  void resumeSessionTransaction(session, true);
                }}
              >
                Resume with Full Access
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {confirmClosedFullAccessResume ? (
        <section className="codex-execution-danger" role="alertdialog">
          <ShieldAlert size={20} />
          <div>
            <strong>Resume this chat with Full Access?</strong>
            <p>
              Full Access is never restored automatically after the chat runtime
              closes.
            </p>
            <div>
              <button
                type="button"
                className="button"
                onClick={cancelFullAccessStart}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button danger"
                onClick={() => void confirmFullAccessStart(true)}
              >
                Resume with Full Access
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {!workspaceRoot ? (
        <div className="codex-panel-state">
          <h2>Open a workspace folder.</h2>
        </div>
      ) : null}

      {workspaceRoot ? (
        <div className="agent-chat-shell">
          <div
            className={`agent-runtime-notice ${probeError ? "error" : ""}`}
            role="status"
            hidden={ready && !probeError && !sessionStarting}
          >
            {probeError
              ? probeError
              : sessionStarting
                ? "Starting AI Chat…"
                : probeLabel(probe)}
            {!probeError && !ready ? (
              <span>
                Open AI Providers in Preferences to choose or refresh the Codex
                installation.
              </span>
            ) : null}
          </div>
          <AgentConversation
            composer={composer}
            host={host}
            onReviewChanges={onReviewChanges}
            session={session}
            workspaceRoot={workspaceRoot}
          />
          <AgentComposer
            composer={composer}
            hostProps={hostProps}
            session={session}
          />
        </div>
      ) : null}
    </aside>
  );
}
