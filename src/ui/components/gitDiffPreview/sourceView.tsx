import type { MouseEvent, RefObject, UIEvent } from "react";
import type { DocumentDiffPreview, GitDiffLine } from "../../../core/types";
import type { TableBlockMarker } from "../../lib/gitTableDiff";

interface SideLine {
  key: string;
  kind: GitDiffLine["kind"] | "blank";
  lineNumber: number | null;
  text: string;
  tableChanged: boolean;
  changeIndex: number | null;
}

export function rawSourceLines(source: string | null | undefined): SideLine[] {
  return (source ?? "").split(/\r\n|\r|\n/u).map((text, index) => ({
    key: `raw:${index}`,
    kind: "context",
    lineNumber: index + 1,
    text,
    tableChanged: false,
    changeIndex: null,
  }));
}

export function sideLines(
  preview: DocumentDiffPreview,
  side: "left" | "right",
  tableMarkers: TableBlockMarker[],
  changeIndexes: Map<string, number>,
): SideLine[] {
  return preview.hunks.flatMap((hunk, hunkIndex) =>
    hunk.lines.map((line, lineIndex) => {
      const key = `${hunkIndex}:${lineIndex}:${side}`;
      const changeIndex =
        changeIndexes.get(`${hunkIndex}:${lineIndex}`) ?? null;
      const lineNumber = side === "left" ? line.oldLine : line.newLine;
      const tableChanged = tableMarkers.some(
        (marker) =>
          marker.side === side &&
          lineNumber &&
          lineNumber >= marker.startLine &&
          lineNumber <= marker.endLine,
      );
      if (line.kind === "context") {
        return {
          key,
          kind: "context",
          lineNumber:
            side === "left" ? (line.oldLine ?? null) : (line.newLine ?? null),
          text: line.text,
          tableChanged,
          changeIndex,
        };
      }
      if (side === "left" && line.kind === "removed") {
        return {
          key,
          kind: "removed",
          lineNumber: line.oldLine ?? null,
          text: line.text,
          tableChanged,
          changeIndex,
        };
      }
      if (side === "right" && line.kind === "added") {
        return {
          key,
          kind: "added",
          lineNumber: line.newLine ?? null,
          text: line.text,
          tableChanged,
          changeIndex,
        };
      }
      return {
        key,
        kind: "blank",
        lineNumber: null,
        text: "",
        tableChanged: false,
        changeIndex,
      };
    }),
  );
}

export function sourceChangeIndexes(
  preview: DocumentDiffPreview,
): Map<string, number> {
  const indexes = new Map<string, number>();
  let changeIndex = 0;
  preview.hunks.forEach((hunk, hunkIndex) => {
    hunk.lines.forEach((line, lineIndex) => {
      if (line.kind !== "context") {
        indexes.set(`${hunkIndex}:${lineIndex}`, changeIndex);
        changeIndex += 1;
      }
    });
  });
  return indexes;
}

export function DiffPane({
  label,
  lines,
  reviewId,
  onContextMenu,
  onScroll,
  paneRef,
}: {
  label: string;
  lines: SideLine[];
  reviewId: string;
  paneRef: RefObject<HTMLDivElement | null>;
  onContextMenu?: (event: MouseEvent<HTMLElement>) => void;
  onScroll: (event: UIEvent<HTMLDivElement>) => void;
}) {
  return (
    <section
      className="git-diff-pane"
      data-review-id={reviewId}
      onContextMenu={onContextMenu}
    >
      <header>{label}</header>
      <div className="git-diff-lines" ref={paneRef} onScroll={onScroll}>
        {lines.map((line) => (
          <div
            key={line.key}
            className={`git-diff-line ${line.kind} ${
              line.changeIndex !== null ? "change-target" : ""
            }`}
            data-review-id="git-diff-line"
            data-change-index={line.changeIndex ?? undefined}
          >
            <span className="git-diff-line-number">
              {line.lineNumber ?? ""}
            </span>
            <code>
              {line.tableChanged && (
                <span
                  className="git-diff-table-badge"
                  data-review-id="git-diff-asciidoc-table-badge"
                >
                  Table block changed
                </span>
              )}
              {line.text || "\u00a0"}
            </code>
          </div>
        ))}
      </div>
    </section>
  );
}
