import { useCallback, useEffect, type RefObject } from "react";
import type {
  DocumentSelectionSnapshot,
  DocumentDiffPreview,
} from "../../core/types";
import {
  extractRenderedDiffSelection,
  renderedDiffOriginalReference,
  renderedDiffReference,
  type RenderedDiffSelectionContext,
  type SelectionRevealTarget,
} from "../lib/diffDocumentSelection";
import {
  selectionHasBlockingDiagnostic,
  selectionPlainCopy,
  selectionTextReference,
} from "../lib/documentSelection";
import { useSelectionRangeController } from "../hooks/useSelectionRangeController";
import { useSelectionSnapshotActions } from "../hooks/useSelectionSnapshotActions";
import { SelectionMiniToolbar } from "./SelectionMiniToolbar";

function renderedPaneForNode(node: Node) {
  const element =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement;
  return element?.closest<HTMLElement>(".git-rendered-pane") ?? null;
}

export function RenderedDiffSelectionController({
  actionRef,
  comparisonLabel,
  onAddSelection,
  resolveContext,
  resolveRevealTarget,
  rootRef,
  showNotice,
}: {
  actionRef?: RefObject<RenderedDiffSelectionActionBridge | null>;
  comparisonLabel?: string | null;
  onAddSelection?: (
    snapshot: DocumentSelectionSnapshot,
    revealTarget: SelectionRevealTarget,
  ) => void;
  resolveContext: (pane: HTMLElement) => {
    preview: DocumentDiffPreview;
    side: "left" | "right";
  } | null;
  resolveRevealTarget: (
    pane: HTMLElement,
    context: RenderedDiffSelectionContext,
  ) => SelectionRevealTarget;
  rootRef: RefObject<HTMLElement | null>;
  showNotice: (message: string) => void;
}) {
  const resolveSelection = useCallback(
    (range: Range, root: HTMLElement) => {
      const startPane = renderedPaneForNode(range.startContainer);
      const endPane = renderedPaneForNode(range.endContainer);
      if (
        !startPane ||
        startPane !== endPane ||
        !root.contains(startPane) ||
        !startPane.contains(range.startContainer) ||
        !startPane.contains(range.endContainer)
      ) {
        return {
          message:
            startPane &&
            endPane &&
            root.contains(startPane) &&
            root.contains(endPane)
              ? "Select content within one rendered diff pane."
              : undefined,
        };
      }
      const resolved = resolveContext(startPane);
      if (!resolved) return {};
      return {
        selection: {
          bounds: root,
          context: {
            pane: startPane,
            preview: resolved.preview,
            side: resolved.side,
            comparisonLabel,
          },
        },
      };
    },
    [comparisonLabel, resolveContext],
  );
  const selection = useSelectionRangeController({
    enabled: true,
    isPointerSelectionTarget: (target, root) =>
      Boolean(target.closest(".git-rendered-pane") && root.contains(target)),
    resetKey: comparisonLabel ?? "",
    resolveSelection,
    rootRef,
    showNotice,
  });
  const prepareSnapshot = useCallback(
    async (
      active: NonNullable<typeof selection.active>,
    ): Promise<DocumentSelectionSnapshot> =>
      extractRenderedDiffSelection({
        ...active.context,
        range: active.range.cloneRange(),
      }),
    [],
  );
  const attachDiffSelection = useCallback(
    (
      snapshot: DocumentSelectionSnapshot,
      active: NonNullable<typeof selection.active>,
    ) => {
      if (!onAddSelection) return;
      onAddSelection(
        snapshot,
        resolveRevealTarget(active.context.pane, active.context),
      );
    },
    [onAddSelection, resolveRevealTarget],
  );
  const actions = useSelectionSnapshotActions({
    active: selection.active,
    canAsk: Boolean(onAddSelection),
    dismissSelection: selection.dismiss,
    onAddSelection: attachDiffSelection,
    prepareSnapshot,
    showNotice,
  });

  const prepareContextMenuAsk = useCallback(
    (range: Range) => {
      const root = rootRef.current;
      if (!root || range.collapsed) return undefined;
      const resolved = resolveSelection(range, root);
      if (!resolved.selection) return undefined;
      const rect = range.getBoundingClientRect();
      const preparedActive = {
        ...resolved.selection,
        range: range.cloneRange(),
        selectionId: -1,
        left: rect.left,
        top: rect.top,
        positioned: false,
        side: "above" as const,
      };
      const snapshotPromise = prepareSnapshot(preparedActive).catch(() => null);
      return () => {
        void snapshotPromise.then((snapshot) => {
          if (!snapshot) {
            showNotice("The selected content could not be prepared.");
            return;
          }
          if (selectionHasBlockingDiagnostic(snapshot)) {
            showNotice(
              snapshot.diagnostics.find(
                (diagnostic) => diagnostic.severity === "blocking",
              )?.message ?? "The selected content could not be prepared.",
            );
            return;
          }
          attachDiffSelection(snapshot, preparedActive);
          selection.dismiss();
        });
      };
    },
    [
      attachDiffSelection,
      prepareSnapshot,
      resolveSelection,
      rootRef,
      selection,
      showNotice,
    ],
  );

  useEffect(() => {
    if (!actionRef) return;
    actionRef.current = {
      ask: actions.ask,
      prepareContextMenuAsk,
    };
    return () => {
      actionRef.current = null;
    };
  }, [actionRef, actions.ask, prepareContextMenuAsk]);

  if (!selection.active) return null;
  const original = renderedDiffOriginalReference(
    selection.active.context,
    selection.active.range.cloneRange(),
  );
  const diff = renderedDiffReference(
    selection.active.context,
    selection.active.range.cloneRange(),
  );
  return (
    <SelectionMiniToolbar
      toolbarRef={selection.toolbarRef}
      placement={selection.active}
      canAsk={Boolean(onAddSelection)}
      menuOpen={Boolean(actions.menuSnapshot)}
      onAsk={() => void actions.ask()}
      onCopy={() => void actions.copy(selectionPlainCopy)}
      onToggleMenu={() => void actions.toggleMenu()}
      actions={[
        actions.textReferenceAction(selectionTextReference),
        ...(diff
          ? [
              {
                id: "diff-reference",
                label: "Copy Diff Reference",
                onSelect: () => void navigator.clipboard.writeText(diff),
              },
            ]
          : []),
        ...(original
          ? [
              {
                id: "original-reference",
                label: "Copy Original Text Reference",
                onSelect: () => void navigator.clipboard.writeText(original),
              },
            ]
          : []),
      ]}
    />
  );
}

export interface RenderedDiffSelectionActionBridge {
  ask: () => Promise<void>;
  prepareContextMenuAsk: (range: Range) => (() => void) | undefined;
}
