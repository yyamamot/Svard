import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import type { AgentQuotedContext } from "../../core/types";
import { isDocumentMediaSnapshot } from "../../core/types";
import { appendAgentQuotedContext } from "../agent/agentQuotedContext";
import { revealDocumentMedia } from "../lib/documentMedia";
import { revealDocumentSelection } from "../lib/documentSelection";
import {
  revealRenderedDiffSelection,
  type SelectionRevealTarget,
} from "../lib/diffDocumentSelection";

interface QuotedContextNotice {
  (message: string, options: { tone: "warning" }): void;
}

interface PendingQuotedContextReveal {
  snapshot: AgentQuotedContext;
  target: SelectionRevealTarget;
}

export function useAgentQuotedContextState({
  agentChatAvailable,
  preferencesOpen,
  rootDirectory,
  setCodexPanelOpen,
  showInlineNotice,
}: {
  agentChatAvailable: boolean;
  preferencesOpen: boolean;
  rootDirectory: string | null;
  setCodexPanelOpen: Dispatch<SetStateAction<boolean>>;
  showInlineNotice: QuotedContextNotice;
}) {
  const [quotedContexts, setQuotedContexts] = useState<AgentQuotedContext[]>(
    [],
  );
  const quotedContextsRef = useRef<AgentQuotedContext[]>([]);
  const [pendingReveal, setPendingReveal] =
    useState<PendingQuotedContextReveal | null>(null);
  const revealTargetsRef = useRef(new Map<string, SelectionRevealTarget>());

  useEffect(() => {
    quotedContextsRef.current = [];
    setQuotedContexts([]);
    setPendingReveal(null);
    revealTargetsRef.current.clear();
  }, [rootDirectory]);

  useEffect(() => {
    if (preferencesOpen || !agentChatAvailable) {
      setCodexPanelOpen(false);
    }
    if (preferencesOpen) {
      quotedContextsRef.current = [];
      setQuotedContexts([]);
      setPendingReveal(null);
      revealTargetsRef.current.clear();
    }
  }, [agentChatAvailable, preferencesOpen, setCodexPanelOpen]);

  function registerQuotedContext(
    snapshot: AgentQuotedContext,
    revealTarget: SelectionRevealTarget = {
      kind: "document",
      documentPath: snapshot.documentPath,
    },
  ): boolean {
    if (!rootDirectory) {
      showInlineNotice("Open a workspace before starting AI Chat.", {
        tone: "warning",
      });
      return false;
    }
    const result = appendAgentQuotedContext(
      quotedContextsRef.current,
      snapshot,
    );
    if (!result.ok) {
      showInlineNotice(result.message, { tone: "warning" });
      return false;
    }
    revealTargetsRef.current.set(snapshot.snapshotId, revealTarget);
    quotedContextsRef.current = result.contexts;
    setQuotedContexts(result.contexts);
    return true;
  }

  function addQuotedContext(
    snapshot: AgentQuotedContext,
    revealTarget?: SelectionRevealTarget,
  ) {
    if (!registerQuotedContext(snapshot, revealTarget)) return false;
    setCodexPanelOpen(true);
    return true;
  }

  function removeQuotedContext(snapshotId: string) {
    revealTargetsRef.current.delete(snapshotId);
    const next = quotedContextsRef.current.filter(
      (item) => item.snapshotId !== snapshotId,
    );
    quotedContextsRef.current = next;
    setQuotedContexts(next);
  }

  function acceptQuotedContexts(snapshotIds: string[]) {
    const next = quotedContextsRef.current.filter(
      (item) => !snapshotIds.includes(item.snapshotId),
    );
    quotedContextsRef.current = next;
    setQuotedContexts(next);
  }

  function beginQuotedContextReveal(snapshot: AgentQuotedContext) {
    const target = revealTargetsRef.current.get(snapshot.snapshotId) ?? {
      kind: "document" as const,
      documentPath: snapshot.documentPath,
    };
    setPendingReveal({ snapshot, target });
    return target;
  }

  return {
    acceptQuotedContexts,
    addQuotedContext,
    beginQuotedContextReveal,
    pendingReveal,
    quotedContexts,
    registerQuotedContext,
    removeQuotedContext,
    setPendingReveal,
  };
}

export function useAgentQuotedContextReveal({
  articleRef,
  documentDiffPreview,
  documentDiffStreamPreview,
  documentHtmlRevision,
  documentPath,
  pendingReveal,
  setPendingReveal,
  showInlineNotice,
}: {
  articleRef: RefObject<HTMLElement | null>;
  documentDiffPreview: unknown;
  documentDiffStreamPreview: unknown;
  documentHtmlRevision: number;
  documentPath: string | undefined;
  pendingReveal: PendingQuotedContextReveal | null;
  setPendingReveal: Dispatch<SetStateAction<PendingQuotedContextReveal | null>>;
  showInlineNotice: QuotedContextNotice;
}) {
  useEffect(() => {
    if (
      !pendingReveal ||
      isDocumentMediaSnapshot(pendingReveal.snapshot) ||
      pendingReveal.target.kind !== "document" ||
      documentPath !== pendingReveal.target.documentPath
    ) {
      return;
    }
    const snapshot = pendingReveal.snapshot;
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (cancelled) return;
        const revealed = revealDocumentSelection(articleRef.current, snapshot);
        if (!revealed) {
          showInlineNotice(
            "The document changed and the selected content could not be located.",
            { tone: "warning" },
          );
        }
        setPendingReveal(null);
      });
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [
    articleRef,
    documentHtmlRevision,
    documentPath,
    pendingReveal,
    setPendingReveal,
    showInlineNotice,
  ]);

  useEffect(() => {
    if (
      !pendingReveal ||
      !isDocumentMediaSnapshot(pendingReveal.snapshot) ||
      pendingReveal.target.kind !== "document" ||
      documentPath !== pendingReveal.target.documentPath
    ) {
      return;
    }
    const snapshot = pendingReveal.snapshot;
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (cancelled) return;
        if (!revealDocumentMedia(articleRef.current, snapshot)) {
          showInlineNotice(
            "The document changed and the image could not be located.",
            { tone: "warning" },
          );
        }
        setPendingReveal(null);
      });
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [
    articleRef,
    documentHtmlRevision,
    documentPath,
    pendingReveal,
    setPendingReveal,
    showInlineNotice,
  ]);

  useEffect(() => {
    if (
      !pendingReveal ||
      !isDocumentMediaSnapshot(pendingReveal.snapshot) ||
      pendingReveal.target.kind === "document"
    ) {
      return;
    }
    const snapshot = pendingReveal.snapshot;
    let cancelled = false;
    let attempts = 0;
    const reveal = () => {
      if (cancelled) return;
      const root = document.querySelector<HTMLElement>(
        pendingReveal.target.kind === "diffStream"
          ? ".diff-stream-panel"
          : ".git-diff-panel",
      );
      if (root && revealDocumentMedia(root, snapshot)) {
        setPendingReveal(null);
        return;
      }
      attempts += 1;
      if (attempts < 40) {
        window.setTimeout(reveal, 50);
      } else {
        showInlineNotice(
          "The diff changed and the image could not be located.",
          { tone: "warning" },
        );
        setPendingReveal(null);
      }
    };
    window.setTimeout(reveal, 0);
    return () => {
      cancelled = true;
    };
  }, [
    documentDiffPreview,
    documentDiffStreamPreview,
    pendingReveal,
    setPendingReveal,
    showInlineNotice,
  ]);

  useEffect(() => {
    if (
      !pendingReveal ||
      isDocumentMediaSnapshot(pendingReveal.snapshot) ||
      pendingReveal.target.kind === "document"
    ) {
      return;
    }
    const snapshot = pendingReveal.snapshot;
    let cancelled = false;
    let attempts = 0;
    const reveal = () => {
      if (cancelled) return;
      const root = document.querySelector<HTMLElement>(
        pendingReveal.target.kind === "diffStream"
          ? ".diff-stream-panel"
          : ".git-diff-panel",
      );
      if (root && revealRenderedDiffSelection(root, snapshot)) {
        setPendingReveal(null);
        return;
      }
      attempts += 1;
      if (attempts < 40) {
        window.setTimeout(reveal, 50);
      } else {
        showInlineNotice("The diff changed after selection.", {
          tone: "warning",
        });
        setPendingReveal(null);
      }
    };
    window.setTimeout(reveal, 0);
    return () => {
      cancelled = true;
    };
  }, [
    documentDiffPreview,
    documentDiffStreamPreview,
    pendingReveal,
    setPendingReveal,
    showInlineNotice,
  ]);
}
