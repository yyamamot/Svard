import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type {
  AgentChatHandoffSnapshot,
  AgentChatOwnerSync,
  AgentChatWindowOpenRequest,
} from "../core/types";
import { appHost as host } from "./appHost";
import { AgentPanelHost } from "./agent/AgentPanelHost";
import { agentChatHandoffPayload } from "./agent/agentChatHandoff";

export function AgentChatWindowApp() {
  const [request, setRequest] = useState<AgentChatWindowOpenRequest | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [ownerSync, setOwnerSync] = useState<AgentChatOwnerSync | null>(null);
  const [dismissedSyncedContexts, setDismissedSyncedContexts] = useState<
    Set<string>
  >(() => new Set());
  const [reattaching, setReattaching] = useState(false);
  const latestSnapshotRef = useRef<AgentChatHandoffSnapshot | null>(null);
  const closingExplicitlyRef = useRef(false);
  const reattachingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void host
      .takeCurrentAgentChatWindowRequest()
      .then((nextRequest) => {
        if (cancelled) return;
        if (!nextRequest) {
          setError("This detached AI Chat request is no longer available.");
          return;
        }
        latestSnapshotRef.current = nextRequest.snapshot;
        setRequest(nextRequest);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : "AI Chat could not open in this window.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let handle: { dispose(): void } | null = null;
    void host
      .watchAgentChatOwnerSync((sync) => {
        if (!disposed) setOwnerSync(sync);
      })
      .then((nextHandle) => {
        if (disposed) nextHandle.dispose();
        else handle = nextHandle;
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
      handle?.dispose();
    };
  }, []);

  const reattach = useCallback(
    async (snapshot: AgentChatHandoffSnapshot) => {
      if (!request?.originWindowLabel || reattachingRef.current) return;
      reattachingRef.current = true;
      setReattaching(true);
      let readyHandle: { dispose(): void } | null = null;
      let timeoutId: number | null = null;
      try {
        let resolveReady: () => void = () => undefined;
        const ready = new Promise<void>((resolve) => {
          resolveReady = resolve;
        });
        readyHandle = await host.watchAgentChatReattachReady(resolveReady);
        await host.emitAgentChatReattach(request.originWindowLabel, snapshot);
        const timeout = new Promise<never>((_, reject) => {
          timeoutId = window.setTimeout(
            () =>
              reject(
                new Error(
                  "AI Chat did not finish returning to Main within 10 seconds.",
                ),
              ),
            10_000,
          );
        });
        await Promise.race([ready, timeout]);
        closingExplicitlyRef.current = true;
        await host.closeAgentChatWindow(request.originWindowLabel);
      } catch (reason) {
        reattachingRef.current = false;
        setReattaching(false);
        setError(
          reason instanceof Error
            ? reason.message
            : "AI Chat could not return to the Main window.",
        );
      } finally {
        readyHandle?.dispose();
        if (timeoutId !== null) window.clearTimeout(timeoutId);
      }
    },
    [request?.originWindowLabel],
  );

  useEffect(() => {
    if (!request) return;
    let disposed = false;
    let unlisten: (() => void) | null = null;
    void getCurrentWindow()
      .onCloseRequested((event) => {
        if (closingExplicitlyRef.current) return;
        event.preventDefault();
        const snapshot = latestSnapshotRef.current;
        if (snapshot) void reattach(snapshot);
      })
      .then((nextUnlisten) => {
        if (disposed) nextUnlisten();
        else unlisten = nextUnlisten;
      });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [reattach, request]);

  if (error && !request) {
    return (
      <main className="agent-detached-error" role="alert">
        {error}
      </main>
    );
  }
  if (!request) {
    return <main className="agent-detached-loading">Moving AI Chat…</main>;
  }
  const payload = agentChatHandoffPayload(request.snapshot);
  if (!payload) {
    return (
      <main className="agent-detached-error" role="alert">
        This AI Chat state could not be restored.
      </main>
    );
  }
  const initialQuotedContextIds = new Set(
    payload.quotedContexts.map((context) => context.snapshotId),
  );
  const syncedQuotedContexts = (ownerSync?.quotedContexts ?? []).filter(
    (context) =>
      !initialQuotedContextIds.has(context.snapshotId) &&
      !dismissedSyncedContexts.has(context.snapshotId),
  );

  return (
    <main
      className={`app-shell theme-${payload.theme} agent-detached-window ${
        reattaching ? "is-moving" : ""
      }`}
    >
      {reattaching ? (
        <div className="agent-detached-moving" role="status">
          Moving AI Chat…
        </div>
      ) : null}
      {error ? (
        <div className="agent-detached-notice" role="alert">
          {error}
        </div>
      ) : null}
      <AgentPanelHost
        activeDocument={ownerSync?.activeDocument ?? payload.activeDocument}
        detached
        handoffSnapshot={request.snapshot}
        host={host}
        open
        onClose={() => {
          closingExplicitlyRef.current = true;
          void host
            .emitAgentChatClosed(request.originWindowLabel ?? "main")
            .then(() => host.closeAgentChatWindow(request.originWindowLabel))
            .catch((reason: unknown) => {
              closingExplicitlyRef.current = false;
              setError(
                reason instanceof Error
                  ? reason.message
                  : "AI Chat could not be closed.",
              );
            });
        }}
        onOpenDocument={(path) => {
          void host
            .routeAgentChatOriginAction({ type: "openDocument", path })
            .catch((reason: unknown) => {
              setError(
                reason instanceof Error
                  ? reason.message
                  : "The file could not be shown in the Main window.",
              );
            });
        }}
        onReviewChanges={() => {
          void host
            .routeAgentChatOriginAction({ type: "reviewChanges" })
            .catch((reason: unknown) => {
              setError(
                reason instanceof Error
                  ? reason.message
                  : "Changes could not be reviewed in the Main window.",
              );
            });
        }}
        onQuotedContextsAccepted={(snapshotIds) => {
          setDismissedSyncedContexts((current) => {
            const next = new Set(current);
            snapshotIds.forEach((id) => next.add(id));
            return next;
          });
        }}
        onRemoveQuotedContext={(snapshotId) => {
          setDismissedSyncedContexts((current) => {
            const next = new Set(current);
            next.add(snapshotId);
            return next;
          });
        }}
        onReturnToQuotedContext={(snapshot) => {
          void host
            .routeAgentChatOriginAction({
              type: "returnToQuotedContext",
              snapshot,
            })
            .catch((reason: unknown) => {
              setError(
                reason instanceof Error
                  ? reason.message
                  : "The quoted context could not be shown.",
              );
            });
        }}
        onMainPlacementChange={() => undefined}
        onReattach={reattach}
        onHandoffSnapshotChange={(snapshot) => {
          latestSnapshotRef.current = snapshot;
        }}
        onHandoffReady={() => {
          const handoffId = request.handoffId;
          if (handoffId && request.originWindowLabel) {
            void host.emitAgentChatReady(request.originWindowLabel, handoffId);
          }
        }}
        placement={
          request.snapshot.lastMainPlacement === "bottom"
            ? "mainBottom"
            : "mainRight"
        }
        providerConfig={payload.providerConfig}
        theme={payload.theme}
        quotedContexts={syncedQuotedContexts}
        workspaceRoot={
          ownerSync?.workspaceRoot ?? request.snapshot.workspaceRoot
        }
      />
    </main>
  );
}
