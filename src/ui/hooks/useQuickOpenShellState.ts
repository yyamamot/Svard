import { useEffect, useState, type RefObject } from "react";

export function useQuickOpenShellState({
  inputRef,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const [quickOpenOpen, setQuickOpenOpen] = useState(false);
  const [quickOpenQuery, setQuickOpenQuery] = useState("");
  const [viewerShortcutHintsOpen, setViewerShortcutHintsOpen] = useState(false);

  useEffect(() => {
    if (quickOpenOpen) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [inputRef, quickOpenOpen]);

  function openQuickOpen() {
    setQuickOpenOpen(true);
    setQuickOpenQuery("");
  }

  function closeQuickOpen() {
    setQuickOpenOpen(false);
    setQuickOpenQuery("");
  }

  function showViewerShortcuts() {
    closeQuickOpen();
    setViewerShortcutHintsOpen(true);
  }

  return {
    closeQuickOpen,
    openQuickOpen,
    quickOpenOpen,
    quickOpenQuery,
    setQuickOpenOpen,
    setQuickOpenQuery,
    setViewerShortcutHintsOpen,
    showViewerShortcuts,
    viewerShortcutHintsOpen,
  };
}
