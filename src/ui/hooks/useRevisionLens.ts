import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import type { PostDiffGitMarker } from "../lib/gitRenderedDiff";
import { isEditableTarget } from "../lib/path";
import { setElementSafeHtml } from "../lib/safeHtml";
import { sanitizeRenderedBlockHtml } from "../lib/sanitizeHtml";
import type {
  ResolveRevisionLensTargets,
  RevisionLensResolvedTarget,
  RevisionLensTargetRequest,
} from "../types";

export interface RevisionLensMarkerTarget {
  marker: PostDiffGitMarker;
  blockTarget: HTMLElement;
  interactionTarget: HTMLElement;
}

export interface RevisionLensHint {
  message: string;
  tone: "ready" | "preparing" | "unavailable";
  left: number;
  top: number;
}

interface RevisionLensCandidate {
  markers: RevisionLensMarkerTarget[];
  resolved: RevisionLensResolvedTarget[] | null;
  hint: Omit<RevisionLensHint, "message" | "tone">;
  phase: "preparing" | "ready";
}

interface AppliedReplacement {
  replacement: HTMLElement;
  target: HTMLElement;
  originalDisplay: string;
  hidden: boolean;
}

function requestForMarker(
  target: RevisionLensMarkerTarget,
): RevisionLensTargetRequest {
  return {
    markerId: target.marker.id,
    diffBlockId: target.marker.diffBlockId ?? target.marker.id,
    anchorBlockId: target.marker.anchorBlockId,
    kind: target.marker.kind,
  };
}

function markerHintPosition(target: HTMLElement, pane: HTMLElement) {
  const rect = target.getBoundingClientRect();
  const paneRect = pane.getBoundingClientRect();
  return {
    left: Math.min(
      Math.max(rect.left, paneRect.left + 8),
      paneRect.right - 260,
    ),
    top: Math.min(
      Math.max(rect.top + 6, paneRect.top + 8),
      paneRect.bottom - 34,
    ),
  };
}

export function uniqueRevisionLensBlockTargets(
  targets: RevisionLensMarkerTarget[],
) {
  const seen = new Set<string>();
  return targets.filter((target) => {
    const identity = target.marker.diffBlockId ?? target.marker.id;
    if (seen.has(identity)) {
      return false;
    }
    seen.add(identity);
    return true;
  });
}

function fixedStatusMessage(
  status: RevisionLensResolvedTarget["status"],
): string {
  if (status === "added") {
    return "Added in Working Tree — no Base content";
  }
  if (status === "removed") {
    return "Removed from Working Tree";
  }
  return "Base unavailable";
}

function modalBlocksRevisionLens(): boolean {
  return Boolean(
    document.querySelector(
      '[role="dialog"], [data-review-id="quick-open"], [data-review-id="preferences-dialog"]',
    ),
  );
}

export function useRevisionLens({
  articleRef,
  contextIdentity,
  resolveTargets,
}: {
  articleRef: RefObject<HTMLElement | null>;
  contextIdentity: string;
  resolveTargets?: ResolveRevisionLensTargets;
}) {
  const [candidate, setCandidate] = useState<RevisionLensCandidate | null>(
    null,
  );
  const [held, setHeld] = useState(false);
  const candidateRef = useRef(candidate);
  const heldRef = useRef(held);
  const generationRef = useRef(0);
  const replacementsRef = useRef<AppliedReplacement[]>([]);
  const pointerHoldTimerRef = useRef(0);
  const pointerHoldStartRef = useRef<{ x: number; y: number } | null>(null);
  const pointerHoldActivatedRef = useRef(false);

  candidateRef.current = candidate;
  heldRef.current = held;

  const clearReplacements = useCallback(() => {
    const replacements = replacementsRef.current;
    if (replacements.length === 0) {
      return;
    }
    const pane =
      articleRef.current?.closest<HTMLElement>(".viewer-pane") ?? null;
    const beforeTop = replacements[0]?.replacement.getBoundingClientRect().top;
    for (const applied of replacements) {
      applied.replacement.remove();
      if (applied.hidden) {
        applied.target.style.display = applied.originalDisplay;
      }
    }
    replacementsRef.current = [];
    const firstTarget = replacements[0]?.target;
    if (pane && firstTarget && beforeTop !== undefined) {
      pane.scrollTop += firstTarget.getBoundingClientRect().top - beforeTop;
    }
  }, [articleRef]);

  const releaseHeld = useCallback(() => {
    if (!heldRef.current) {
      return;
    }
    heldRef.current = false;
    setHeld(false);
    clearReplacements();
  }, [clearReplacements]);

  const clearPointerHold = useCallback(() => {
    window.clearTimeout(pointerHoldTimerRef.current);
    pointerHoldTimerRef.current = 0;
    pointerHoldStartRef.current = null;
  }, []);

  const reset = useCallback(() => {
    generationRef.current += 1;
    clearPointerHold();
    pointerHoldActivatedRef.current = false;
    heldRef.current = false;
    setHeld(false);
    clearReplacements();
    candidateRef.current = null;
    setCandidate(null);
  }, [clearPointerHold, clearReplacements]);

  const prepare = useCallback(
    async (
      nextMarkers: RevisionLensMarkerTarget[],
      hint: RevisionLensCandidate["hint"],
    ) => {
      const uniqueMarkers = uniqueRevisionLensBlockTargets(nextMarkers);
      if (uniqueMarkers.length === 0) {
        reset();
        return;
      }
      const generation = generationRef.current + 1;
      generationRef.current = generation;
      const preparing: RevisionLensCandidate = {
        markers: uniqueMarkers,
        resolved: null,
        hint,
        phase: "preparing",
      };
      candidateRef.current = preparing;
      setCandidate(preparing);
      const resolved = resolveTargets
        ? await resolveTargets(uniqueMarkers.map(requestForMarker))
        : uniqueMarkers.map((target) => ({
            ...requestForMarker(target),
            status: "unavailable" as const,
          }));
      if (generationRef.current !== generation) {
        return;
      }
      const ready: RevisionLensCandidate = {
        ...preparing,
        resolved,
        phase: "ready",
      };
      candidateRef.current = ready;
      setCandidate(ready);
    },
    [reset, resolveTargets],
  );

  const prepareMarkers = useCallback(
    (nextMarkers: RevisionLensMarkerTarget[]) => {
      const article = articleRef.current;
      const pane = article?.closest<HTMLElement>(".viewer-pane");
      const firstTarget = nextMarkers[0]?.interactionTarget;
      if (!article || !pane || !firstTarget) {
        return;
      }
      void prepare(nextMarkers, markerHintPosition(firstTarget, pane));
    },
    [articleRef, prepare],
  );

  const beginPointerHold = useCallback(
    (
      nextMarkers: RevisionLensMarkerTarget[],
      point: { x: number; y: number },
    ) => {
      if (modalBlocksRevisionLens()) {
        return;
      }
      clearPointerHold();
      pointerHoldActivatedRef.current = false;
      pointerHoldStartRef.current = point;
      prepareMarkers(nextMarkers);
      pointerHoldTimerRef.current = window.setTimeout(() => {
        pointerHoldTimerRef.current = 0;
        pointerHoldActivatedRef.current = true;
        heldRef.current = true;
        setHeld(true);
      }, 200);
    },
    [clearPointerHold, prepareMarkers],
  );

  const movePointerHold = useCallback(
    (point: { x: number; y: number }) => {
      const start = pointerHoldStartRef.current;
      if (!start || Math.hypot(point.x - start.x, point.y - start.y) <= 6) {
        return;
      }
      clearPointerHold();
      pointerHoldActivatedRef.current = false;
      releaseHeld();
    },
    [clearPointerHold, releaseHeld],
  );

  const endPointerHold = useCallback(() => {
    const activated = pointerHoldActivatedRef.current;
    clearPointerHold();
    pointerHoldActivatedRef.current = false;
    releaseHeld();
    return activated;
  }, [clearPointerHold, releaseHeld]);

  const cancelPointerHold = useCallback(() => {
    clearPointerHold();
    pointerHoldActivatedRef.current = false;
    releaseHeld();
  }, [clearPointerHold, releaseHeld]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && candidateRef.current) {
        event.preventDefault();
        event.stopPropagation();
        reset();
        return;
      }
      if (
        event.key.toLowerCase() !== "b" ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.isComposing ||
        isEditableTarget(event.target) ||
        modalBlocksRevisionLens() ||
        !candidateRef.current ||
        candidateRef.current.markers.length === 0
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat || heldRef.current) {
        return;
      }
      heldRef.current = true;
      setHeld(true);
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "b") {
        releaseHeld();
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") {
        reset();
      }
    }

    function handleBlur() {
      reset();
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("keyup", handleKeyUp, { capture: true });
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("keyup", handleKeyUp, { capture: true });
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [releaseHeld, reset]);

  useEffect(() => {
    clearReplacements();
    if (!held || candidate?.phase !== "ready" || !candidate.resolved) {
      return;
    }
    const article = articleRef.current;
    const pane = article?.closest<HTMLElement>(".viewer-pane");
    if (!article || !pane) {
      return;
    }
    const resolvedByBlock = new Map(
      candidate.resolved.map((target) => [target.diffBlockId, target]),
    );
    const firstTarget = candidate.markers[0]?.blockTarget;
    const beforeTop = firstTarget?.getBoundingClientRect().top;
    const applied: AppliedReplacement[] = [];
    for (const marker of candidate.markers) {
      const resolved = resolvedByBlock.get(
        marker.marker.diffBlockId ?? marker.marker.id,
      );
      const parent = marker.blockTarget.parentElement;
      if (!resolved || !parent) {
        continue;
      }
      const replacement = document.createElement("div");
      replacement.className = `revision-lens-replacement ${resolved.status}`;
      replacement.dataset.reviewId = "revision-lens-replacement";
      replacement.dataset.revisionLensStatus = resolved.status;
      replacement.dataset.selectionExclude = "true";
      const label = document.createElement("div");
      label.className = "revision-lens-label";
      label.dataset.reviewId = "revision-lens-label";
      label.textContent =
        resolved.status === "base"
          ? "Base"
          : fixedStatusMessage(resolved.status);
      replacement.append(label);
      if (
        (resolved.status === "base" || resolved.status === "removed") &&
        resolved.html
      ) {
        const content = document.createElement("div");
        content.className = "revision-lens-content";
        setElementSafeHtml(content, sanitizeRenderedBlockHtml(resolved.html));
        replacement.append(content);
      }
      parent.insertBefore(replacement, marker.blockTarget);
      const hidden =
        resolved.status !== "removed" || resolved.hideCurrent === true;
      const originalDisplay = marker.blockTarget.style.display;
      if (hidden) {
        marker.blockTarget.style.display = "none";
      }
      applied.push({
        replacement,
        target: marker.blockTarget,
        originalDisplay,
        hidden,
      });
    }
    replacementsRef.current = applied;
    if (firstTarget && beforeTop !== undefined) {
      const firstReplacement = applied[0]?.replacement;
      if (firstReplacement) {
        pane.scrollTop +=
          firstReplacement.getBoundingClientRect().top - beforeTop;
      }
    }
    return clearReplacements;
  }, [articleRef, candidate, clearReplacements, held]);

  useEffect(() => {
    reset();
    return () => clearReplacements();
  }, [clearReplacements, contextIdentity, reset]);

  let hint: RevisionLensHint | null = null;
  if (candidate && held && candidate.phase === "preparing") {
    hint = {
      ...candidate.hint,
      message: "Preparing Base…",
      tone: "preparing",
    };
  }

  return {
    hint,
    beginPointerHold,
    cancelPointerHold,
    endPointerHold,
    movePointerHold,
    prepareMarkers,
  };
}
