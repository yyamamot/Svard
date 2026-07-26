import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { placeSelectionToolbar } from "../lib/selectionToolbar";

export interface ResolvedSelectionRange<TContext> {
  bounds: HTMLElement;
  context: TContext;
}

export interface ActiveSelectionRange<TContext> {
  bounds: HTMLElement;
  context: TContext;
  left: number;
  positioned: boolean;
  range: Range;
  selectionId: number;
  side: "above" | "below" | "right" | "left";
  top: number;
}

export interface SelectionRangeResolution<TContext> {
  message?: string;
  selection?: ResolvedSelectionRange<TContext>;
}

export function useSelectionRangeController<TContext>({
  enabled,
  isPointerSelectionTarget,
  resetKey,
  resolveSelection,
  rootRef,
  showNotice,
}: {
  enabled: boolean;
  isPointerSelectionTarget: (target: Element, root: HTMLElement) => boolean;
  resetKey: string;
  resolveSelection: (
    range: Range,
    root: HTMLElement,
  ) => SelectionRangeResolution<TContext>;
  rootRef: RefObject<HTMLElement | null>;
  showNotice: (message: string) => void;
}) {
  const [active, setActive] = useState<ActiveSelectionRange<TContext> | null>(
    null,
  );
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const pointerSelectionRef = useRef(false);
  const pointerSelectionFrameRef = useRef<number | null>(null);
  const selectionSequenceRef = useRef(0);
  const resolverRef = useRef(resolveSelection);
  const pointerTargetRef = useRef(isPointerSelectionTarget);
  const noticeRef = useRef(showNotice);
  resolverRef.current = resolveSelection;
  pointerTargetRef.current = isPointerSelectionTarget;
  noticeRef.current = showNotice;

  const dismiss = useCallback(() => setActive(null), []);

  useEffect(() => {
    setActive(null);
  }, [enabled, resetKey]);

  useEffect(() => {
    if (!enabled) return;
    const root = rootRef.current;
    if (!root) return;

    const remember = () => {
      if (pointerSelectionRef.current) return;
      const currentRoot = rootRef.current;
      const selection = window.getSelection();
      if (!currentRoot || !selection?.rangeCount || selection.isCollapsed) {
        return;
      }
      const range = selection.getRangeAt(0).cloneRange();
      const resolved = resolverRef.current(range, currentRoot);
      if (!resolved.selection) {
        setActive(null);
        if (resolved.message) noticeRef.current(resolved.message);
        return;
      }
      const rect = range.getBoundingClientRect();
      if (!rect.width && !rect.height) return;
      setActive({
        ...resolved.selection,
        range,
        selectionId: ++selectionSequenceRef.current,
        left: rect.left,
        top: rect.top,
        positioned: false,
        side: "above",
      });
    };
    const finishPointerSelection = () => {
      if (!pointerSelectionRef.current) return;
      pointerSelectionRef.current = false;
      if (pointerSelectionFrameRef.current !== null) {
        cancelAnimationFrame(pointerSelectionFrameRef.current);
      }
      pointerSelectionFrameRef.current = requestAnimationFrame(() => {
        pointerSelectionFrameRef.current = null;
        remember();
      });
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (event.button === 2) return;
      const currentRoot = rootRef.current;
      if (
        currentRoot &&
        event.button === 0 &&
        event.target instanceof Element &&
        pointerTargetRef.current(event.target, currentRoot)
      ) {
        pointerSelectionRef.current = true;
        setActive(null);
        return;
      }
      if (
        event.target instanceof Element &&
        event.target.closest(".context-menu")
      ) {
        return;
      }
      if (!toolbarRef.current?.contains(event.target as Node)) {
        setActive(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActive(null);
    };
    const reposition = () =>
      setActive((current) =>
        current ? { ...current, positioned: false } : null,
      );

    document.addEventListener("selectionchange", remember);
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("pointerup", finishPointerSelection, true);
    document.addEventListener("pointercancel", finishPointerSelection, true);
    document.addEventListener("scroll", dismiss, true);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("selectionchange", remember);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("pointerup", finishPointerSelection, true);
      document.removeEventListener(
        "pointercancel",
        finishPointerSelection,
        true,
      );
      document.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", reposition);
      if (pointerSelectionFrameRef.current !== null) {
        cancelAnimationFrame(pointerSelectionFrameRef.current);
        pointerSelectionFrameRef.current = null;
      }
      pointerSelectionRef.current = false;
    };
  }, [dismiss, enabled, rootRef]);

  useLayoutEffect(() => {
    if (!active || !toolbarRef.current) return;
    const rects = Array.from(active.range.getClientRects()).filter(
      (rect) => rect.width > 0 || rect.height > 0,
    );
    const firstLine = rects[0];
    const lastLine = rects.at(-1);
    if (!firstLine || !lastLine) return;
    const toolbarRect = toolbarRef.current.getBoundingClientRect();
    const placement = placeSelectionToolbar({
      bounds: active.bounds.getBoundingClientRect(),
      firstLine,
      lastLine,
      toolbarHeight: toolbarRect.height,
      toolbarWidth: toolbarRect.width,
    });
    if (
      active.positioned &&
      active.left === placement.left &&
      active.top === placement.top
    ) {
      return;
    }
    setActive((current) =>
      current ? { ...current, ...placement, positioned: true } : null,
    );
  }, [active]);

  return {
    active,
    dismiss,
    toolbarRef,
  };
}
