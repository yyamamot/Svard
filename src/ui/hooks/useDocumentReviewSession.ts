import { useEffect, useMemo, useState } from "react";
import type {
  DocumentReviewState,
  DocumentReviewStateByPath,
  DocumentReviewSessionControls,
} from "../lib/documentReviewSession";
import {
  summarizeDocumentReviewSession,
  uniqueDocumentReviewPaths,
} from "../lib/documentReviewSession";

export function useDocumentReviewSession(
  targetPaths: readonly string[],
): DocumentReviewSessionControls {
  const stableTargetPaths = useMemo(
    () => uniqueDocumentReviewPaths(targetPaths),
    [targetPaths],
  );
  const [stateByPath, setStateByPath] = useState<DocumentReviewStateByPath>({});

  useEffect(() => {
    const targets = new Set(stableTargetPaths);
    setStateByPath((current) => {
      const next: DocumentReviewStateByPath = {};
      for (const path of stableTargetPaths) {
        next[path] = current[path] ?? "unreviewed";
      }
      for (const [path, state] of Object.entries(current)) {
        if (targets.has(path) && next[path] === undefined) {
          next[path] = state;
        }
      }
      return sameReviewState(current, next) ? current : next;
    });
  }, [stableTargetPaths]);

  const summary = useMemo(
    () =>
      summarizeDocumentReviewSession({
        stateByPath,
        targetPaths: stableTargetPaths,
      }),
    [stableTargetPaths, stateByPath],
  );

  function update(path: string, state: DocumentReviewState | null) {
    setStateByPath((current) => {
      if (!stableTargetPaths.includes(path)) {
        return current;
      }
      const next = { ...current };
      if (state) {
        next[path] = state;
      } else {
        next[path] = "unreviewed";
      }
      return sameReviewState(current, next) ? current : next;
    });
  }

  return {
    stateByPath,
    summary,
    markViewed: (path) => update(path, "viewed"),
    markNeedsAttention: (path) => update(path, "needs-attention"),
    reset: (path) => update(path, null),
  };
}

function sameReviewState(
  left: DocumentReviewStateByPath,
  right: DocumentReviewStateByPath,
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key) => left[key] === right[key])
  );
}
