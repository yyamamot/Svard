import type { RefObject } from "react";
import type { DocumentDiffPreview, DocumentFormat } from "../../../core/types";
import type {
  GitRenderedDiffSummary,
  RenderedDiffContentCursorTarget,
  RenderedDiffPresentation,
  RenderedDiffPresentationEntry,
} from "../../lib/gitRenderedDiff";
import type { GitTableDiffSummary } from "../../lib/gitTableDiff";
import { DiffOverview, overviewStats } from "./overview";
import {
  renderedEntryChangeIndex,
  renderedListItemChangeIndex,
  renderedStructuredChildChangeIndex,
  renderedTableRowChangeIndex,
  RenderedDiffPane,
} from "./renderedView";
import { DiffPane, sideLines } from "./sourceView";
import {
  changedCellCount,
  fallbackMessage,
  tableCellIndexes,
  TableDiffPane,
} from "./tableView";
import { statusLabel } from "./toolbar";
import { DiffChangeRuler } from "./changeRuler";
import type { DiffView } from "./types";

interface DiffPreviewBodyProps {
  activeChangeIndex: number;
  activeTableIndex: number;
  changeCount: number;
  contentCursorActive: RenderedDiffContentCursorTarget | null;
  documentClassName: string;
  documentFormat: DocumentFormat;
  hasDiff: boolean;
  leftRef: RefObject<HTMLDivElement | null>;
  overview: ReturnType<typeof overviewStats>;
  preview: DocumentDiffPreview;
  renderedChangedEntries: RenderedDiffPresentationEntry[];
  renderedEntrySyncIndexes: Map<string, number>;
  renderedLeftRef: RefObject<HTMLDivElement | null>;
  renderedPresentation: RenderedDiffPresentation;
  renderedRightRef: RefObject<HTMLDivElement | null>;
  renderedSummary: GitRenderedDiffSummary;
  renderedSummaryLoading: boolean;
  rightRef: RefObject<HTMLDivElement | null>;
  showChangeRuler: boolean;
  sourceIndexes: Map<string, number>;
  tableSummary: GitTableDiffSummary;
  tableSummaryLoading: boolean;
  view: DiffView;
  jumpToPreviewChange: (index: number) => void;
  selectChange: (index: number) => void;
  setActiveTableIndex: (index: number) => void;
  syncDirectScroll: (
    source: HTMLDivElement,
    target: HTMLDivElement | null,
  ) => void;
  syncRenderedScroll: (
    source: HTMLDivElement,
    target: HTMLDivElement | null,
  ) => void;
}

export function DiffPreviewBody({
  activeChangeIndex,
  activeTableIndex,
  changeCount,
  contentCursorActive,
  documentClassName,
  documentFormat,
  hasDiff,
  leftRef,
  overview,
  preview,
  renderedChangedEntries,
  renderedEntrySyncIndexes,
  renderedLeftRef,
  renderedPresentation,
  renderedRightRef,
  renderedSummary,
  renderedSummaryLoading,
  rightRef,
  showChangeRuler,
  sourceIndexes,
  tableSummary,
  tableSummaryLoading,
  view,
  jumpToPreviewChange,
  selectChange,
  setActiveTableIndex,
  syncDirectScroll,
  syncRenderedScroll,
}: DiffPreviewBodyProps) {
  const activeTable = tableSummary.renderedTables[activeTableIndex];
  const tableChangeIndexes = tableCellIndexes(activeTable);

  if (hasDiff && view === "overview") {
    return (
      <DiffOverview
        activeChangeIndex={activeChangeIndex}
        overview={overview}
        onJumpToPreviewChange={jumpToPreviewChange}
      />
    );
  }

  if (hasDiff && view === "source") {
    return (
      <div className="git-diff-body-with-ruler">
        <div className="git-diff-body">
          <DiffPane
            label={preview.leftLabel}
            lines={sideLines(
              preview,
              "left",
              tableSummary.tableMarkers,
              sourceIndexes,
            )}
            paneRef={leftRef}
            reviewId="git-diff-left-pane"
            onScroll={(event) =>
              syncDirectScroll(event.currentTarget, rightRef.current)
            }
          />
          <DiffPane
            label={preview.rightLabel}
            lines={sideLines(
              preview,
              "right",
              tableSummary.tableMarkers,
              sourceIndexes,
            )}
            paneRef={rightRef}
            reviewId="git-diff-right-pane"
            onScroll={(event) =>
              syncDirectScroll(event.currentTarget, leftRef.current)
            }
          />
        </div>
        {showChangeRuler && (
          <DiffChangeRuler
            activeChangeIndex={activeChangeIndex}
            changeCount={changeCount}
            leftRef={leftRef}
            onSelectChange={selectChange}
            renderedLeftRef={renderedLeftRef}
            renderedNavigationTargets={renderedPresentation.navigationTargets}
            renderedRightRef={renderedRightRef}
            rightRef={rightRef}
            view={view}
          />
        )}
      </div>
    );
  }

  if (hasDiff && view === "preview" && renderedSummary.blocks.length > 0) {
    return (
      <div className="git-diff-body-with-ruler">
        <div
          className="git-rendered-diff-body git-full-preview-diff-body"
          data-review-id="git-full-preview-diff"
        >
          <RenderedDiffPane
            label={preview.leftLabel}
            entries={renderedPresentation.entries}
            side="left"
            paneRef={renderedLeftRef}
            reviewId="git-full-preview-left-pane"
            blockReviewId="git-full-preview-block"
            contentCursorActive={contentCursorActive}
            documentClassName={documentClassName}
            documentFormat={documentFormat}
            activeChangeIndex={activeChangeIndex}
            showBlockMeta={false}
            changeIndexForEntry={(entry) =>
              renderedEntryChangeIndex(renderedPresentation, entry, "left")
            }
            changeIndexForListItem={(entry, itemIndex) =>
              renderedListItemChangeIndex(
                renderedPresentation,
                entry,
                "left",
                itemIndex,
              )
            }
            changeIndexForStructuredChild={(entry, childIndex) =>
              renderedStructuredChildChangeIndex(
                renderedPresentation,
                entry,
                "left",
                childIndex,
              )
            }
            changeIndexForTableRow={(entry, rowIndex) =>
              renderedTableRowChangeIndex(
                renderedPresentation,
                entry,
                "left",
                rowIndex,
              )
            }
            syncIndexForEntry={(entry) =>
              renderedEntrySyncIndexes.get(entry.id) ?? 0
            }
            onScroll={(event) =>
              syncRenderedScroll(event.currentTarget, renderedRightRef.current)
            }
          />
          <RenderedDiffPane
            label={preview.rightLabel}
            entries={renderedPresentation.entries}
            side="right"
            paneRef={renderedRightRef}
            reviewId="git-full-preview-right-pane"
            blockReviewId="git-full-preview-block"
            contentCursorActive={contentCursorActive}
            documentClassName={documentClassName}
            documentFormat={documentFormat}
            activeChangeIndex={activeChangeIndex}
            showBlockMeta={false}
            changeIndexForEntry={(entry) =>
              renderedEntryChangeIndex(renderedPresentation, entry, "right")
            }
            changeIndexForListItem={(entry, itemIndex) =>
              renderedListItemChangeIndex(
                renderedPresentation,
                entry,
                "right",
                itemIndex,
              )
            }
            changeIndexForStructuredChild={(entry, childIndex) =>
              renderedStructuredChildChangeIndex(
                renderedPresentation,
                entry,
                "right",
                childIndex,
              )
            }
            changeIndexForTableRow={(entry, rowIndex) =>
              renderedTableRowChangeIndex(
                renderedPresentation,
                entry,
                "right",
                rowIndex,
              )
            }
            syncIndexForEntry={(entry) =>
              renderedEntrySyncIndexes.get(entry.id) ?? 0
            }
            onScroll={(event) =>
              syncRenderedScroll(event.currentTarget, renderedLeftRef.current)
            }
          />
        </div>
        {showChangeRuler && (
          <DiffChangeRuler
            activeChangeIndex={activeChangeIndex}
            changeCount={changeCount}
            leftRef={leftRef}
            onSelectChange={selectChange}
            renderedLeftRef={renderedLeftRef}
            renderedNavigationTargets={renderedPresentation.navigationTargets}
            renderedRightRef={renderedRightRef}
            rightRef={rightRef}
            view={view}
          />
        )}
      </div>
    );
  }

  if (hasDiff && view === "rendered" && renderedChangedEntries.length > 0) {
    return (
      <div className="git-diff-body-with-ruler">
        <div
          className="git-rendered-diff-body"
          data-review-id="git-rendered-diff"
        >
          <RenderedDiffPane
            label={preview.leftLabel}
            entries={renderedChangedEntries}
            side="left"
            paneRef={renderedLeftRef}
            reviewId="git-rendered-left-pane"
            blockReviewId="git-rendered-block"
            contentCursorActive={contentCursorActive}
            documentClassName={documentClassName}
            documentFormat={documentFormat}
            activeChangeIndex={activeChangeIndex}
            focusTableRows={true}
            changeIndexForEntry={(entry) =>
              renderedEntryChangeIndex(renderedPresentation, entry, "left")
            }
            changeIndexForListItem={(entry, itemIndex) =>
              renderedListItemChangeIndex(
                renderedPresentation,
                entry,
                "left",
                itemIndex,
              )
            }
            changeIndexForStructuredChild={(entry, childIndex) =>
              renderedStructuredChildChangeIndex(
                renderedPresentation,
                entry,
                "left",
                childIndex,
              )
            }
            changeIndexForTableRow={(entry, rowIndex) =>
              renderedTableRowChangeIndex(
                renderedPresentation,
                entry,
                "left",
                rowIndex,
              )
            }
            syncIndexForEntry={(entry) =>
              renderedEntrySyncIndexes.get(entry.id) ?? 0
            }
            onScroll={(event) =>
              syncRenderedScroll(event.currentTarget, renderedRightRef.current)
            }
          />
          <RenderedDiffPane
            label={preview.rightLabel}
            entries={renderedChangedEntries}
            side="right"
            paneRef={renderedRightRef}
            reviewId="git-rendered-right-pane"
            blockReviewId="git-rendered-block"
            contentCursorActive={contentCursorActive}
            documentClassName={documentClassName}
            documentFormat={documentFormat}
            activeChangeIndex={activeChangeIndex}
            focusTableRows={true}
            changeIndexForEntry={(entry) =>
              renderedEntryChangeIndex(renderedPresentation, entry, "right")
            }
            changeIndexForListItem={(entry, itemIndex) =>
              renderedListItemChangeIndex(
                renderedPresentation,
                entry,
                "right",
                itemIndex,
              )
            }
            changeIndexForStructuredChild={(entry, childIndex) =>
              renderedStructuredChildChangeIndex(
                renderedPresentation,
                entry,
                "right",
                childIndex,
              )
            }
            changeIndexForTableRow={(entry, rowIndex) =>
              renderedTableRowChangeIndex(
                renderedPresentation,
                entry,
                "right",
                rowIndex,
              )
            }
            syncIndexForEntry={(entry) =>
              renderedEntrySyncIndexes.get(entry.id) ?? 0
            }
            onScroll={(event) =>
              syncRenderedScroll(event.currentTarget, renderedLeftRef.current)
            }
          />
        </div>
        {showChangeRuler && (
          <DiffChangeRuler
            activeChangeIndex={activeChangeIndex}
            changeCount={changeCount}
            leftRef={leftRef}
            onSelectChange={selectChange}
            renderedLeftRef={renderedLeftRef}
            renderedNavigationTargets={renderedPresentation.navigationTargets}
            renderedRightRef={renderedRightRef}
            rightRef={rightRef}
            view={view}
          />
        )}
      </div>
    );
  }

  if (hasDiff && view === "table" && activeTable) {
    return (
      <div className="git-diff-table-view" data-review-id="git-diff-table-diff">
        <div className="git-diff-table-list">
          {tableSummary.renderedTables.map((table, index) => (
            <button
              type="button"
              key={table.id}
              className={index === activeTableIndex ? "active" : ""}
              data-review-id="git-diff-table-selector"
              onClick={() => setActiveTableIndex(index)}
            >
              {table.label}
            </button>
          ))}
        </div>
        <div className="git-diff-table-body">
          <TableDiffPane
            label={preview.leftLabel}
            table={activeTable}
            side="left"
            reviewId="git-diff-table-left-pane"
            changeIndexForCell={(rowIndex, cellIndex) =>
              tableChangeIndexes.get(`${rowIndex}:${cellIndex}`) ?? null
            }
          />
          <TableDiffPane
            label={preview.rightLabel}
            table={activeTable}
            side="right"
            reviewId="git-diff-table-right-pane"
            changeIndexForCell={(rowIndex, cellIndex) =>
              tableChangeIndexes.get(`${rowIndex}:${cellIndex}`) ?? null
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="git-diff-empty" data-review-id="git-diff-empty-state">
      <strong>{statusLabel(preview.status)}</strong>
      <p>
        {!hasDiff
          ? (preview.message ?? "No inline source diff is available.")
          : view === "table"
            ? tableSummaryLoading
              ? "Preparing rendered table diff..."
              : fallbackMessage(tableSummary.fallbackReason)
            : view === "rendered" || view === "preview"
              ? renderedSummaryLoading
                ? "Preparing changes-only preview..."
                : (renderedSummary.fallbackMessage ??
                  "No changes-only preview is available. Use Source view.")
              : (preview.message ?? "No inline source diff is available.")}
      </p>
    </div>
  );
}

export function diffPreviewChangeCount({
  activeTableIndex,
  renderedChangeCount,
  sourceChangeCount,
  tableSummary,
  view,
}: {
  activeTableIndex: number;
  renderedChangeCount: number;
  sourceChangeCount: number;
  tableSummary: GitTableDiffSummary;
  view: DiffView;
}): number {
  const tableChangeCount = changedCellCount(
    tableSummary.renderedTables[activeTableIndex],
  );
  return view === "source"
    ? sourceChangeCount
    : view === "table"
      ? tableChangeCount
      : view === "rendered" || view === "preview"
        ? renderedChangeCount
        : Math.max(renderedChangeCount, sourceChangeCount);
}
