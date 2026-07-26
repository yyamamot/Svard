import { useCallback, useEffect, useRef, useState } from "react";
import type { DocumentSelectionSnapshot } from "../../core/types";
import type { SelectionMiniToolbarAction } from "../components/SelectionMiniToolbar";
import { selectionHasBlockingDiagnostic } from "../lib/documentSelection";
import type { ActiveSelectionRange } from "./useSelectionRangeController";

export function useSelectionSnapshotActions<TContext>({
  active,
  canAsk,
  dismissSelection,
  onAddSelection,
  prepareSnapshot,
  showNotice,
}: {
  active: ActiveSelectionRange<TContext> | null;
  canAsk: boolean;
  dismissSelection: () => void;
  onAddSelection?: (
    snapshot: DocumentSelectionSnapshot,
    active: ActiveSelectionRange<TContext>,
  ) => void;
  prepareSnapshot: (
    active: ActiveSelectionRange<TContext>,
  ) => Promise<DocumentSelectionSnapshot | null>;
  showNotice: (message: string) => void;
}) {
  const [menuSnapshot, setMenuSnapshot] =
    useState<DocumentSelectionSnapshot | null>(null);
  const cacheRef = useRef<{
    promise: Promise<DocumentSelectionSnapshot | null>;
    selectionId: number;
  } | null>(null);
  const activeRef = useRef(active);
  const prepareRef = useRef(prepareSnapshot);
  const noticeRef = useRef(showNotice);
  activeRef.current = active;
  prepareRef.current = prepareSnapshot;
  noticeRef.current = showNotice;

  useEffect(() => {
    cacheRef.current = null;
    setMenuSnapshot(null);
  }, [active?.selectionId]);

  const prepare = useCallback(async () => {
    const current = activeRef.current;
    if (!current) return null;
    if (cacheRef.current?.selectionId === current.selectionId) {
      return cacheRef.current.promise;
    }
    const promise = prepareRef.current(current).catch(() => {
      noticeRef.current("The selected content could not be prepared.");
      return null;
    });
    cacheRef.current = {
      selectionId: current.selectionId,
      promise,
    };
    return promise;
  }, []);

  const copy = useCallback(
    async (
      resolve: (snapshot: DocumentSelectionSnapshot) => string | undefined,
    ) => {
      const snapshot = await prepare();
      if (!snapshot || selectionHasBlockingDiagnostic(snapshot)) return;
      const value = resolve(snapshot);
      if (!value) {
        noticeRef.current(
          "The requested reference cannot be identified exactly.",
        );
        return;
      }
      try {
        await navigator.clipboard.writeText(value);
        setMenuSnapshot(null);
      } catch {
        noticeRef.current("The selected content could not be copied.");
      }
    },
    [prepare],
  );

  const ask = useCallback(async () => {
    const current = activeRef.current;
    if (!current || !canAsk || !onAddSelection) return;
    const snapshot = await prepare();
    if (!snapshot) return;
    const blocking = snapshot.diagnostics.find(
      (diagnostic) => diagnostic.severity === "blocking",
    );
    if (blocking) {
      noticeRef.current(blocking.message);
      return;
    }
    onAddSelection(snapshot, current);
    dismissSelection();
    setMenuSnapshot(null);
  }, [canAsk, dismissSelection, onAddSelection, prepare]);

  const toggleMenu = useCallback(async () => {
    if (menuSnapshot) {
      setMenuSnapshot(null);
      return;
    }
    const snapshot = await prepare();
    if (snapshot && !selectionHasBlockingDiagnostic(snapshot)) {
      setMenuSnapshot(snapshot);
    }
  }, [menuSnapshot, prepare]);

  useEffect(() => {
    if (!canAsk) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.metaKey &&
        event.shiftKey &&
        event.key.toLowerCase() === "a" &&
        activeRef.current
      ) {
        event.preventDefault();
        void ask();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [ask, canAsk]);

  const textReferenceAction = useCallback(
    (
      resolve: (snapshot: DocumentSelectionSnapshot) => string | undefined,
    ): SelectionMiniToolbarAction => ({
      id: "text-reference",
      label: "Copy Text Reference",
      onSelect: () => void copy(resolve),
    }),
    [copy],
  );

  return {
    ask,
    copy,
    menuSnapshot,
    prepare,
    setMenuSnapshot,
    textReferenceAction,
    toggleMenu,
  };
}
