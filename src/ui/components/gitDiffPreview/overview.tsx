import type { DocumentDiffPreview } from "../../../core/types";
import {
  isRenderedChangeBlock,
  isRenderedDiffPresentationChangeEntry,
  renderedDiffPresentationEntryBlocks,
  type GitRenderedDiffSummary,
  type RenderedDiffPresentation,
  type RenderedDiffPresentationEntry,
} from "../../lib/gitRenderedDiff";
import type { GitTableDiffSummary } from "../../lib/gitTableDiff";
import { sourceChangeIndexes } from "./sourceView";
import { fallbackMessage } from "./tableView";
import type { OverviewSection } from "./types";

function overviewSections(
  entries: RenderedDiffPresentationEntry[],
  indexes: Map<string, number>,
  fallbackPath: string | undefined,
  sourceChanges: number,
): OverviewSection[] {
  const sections = new Map<string, OverviewSection>();
  let currentHeading = "Document start";
  for (const entry of entries) {
    const blocks = renderedDiffPresentationEntryBlocks(entry);
    const block = blocks[0];
    if (!block) {
      continue;
    }
    if (block.blockKind === "heading") {
      currentHeading =
        block.right?.text || block.left?.text || "Untitled section";
    }
    if (!isRenderedDiffPresentationChangeEntry(entry)) {
      continue;
    }
    const changeIndex = indexes.get(entry.id);
    if (changeIndex === undefined) {
      continue;
    }
    const label =
      block.blockKind === "heading"
        ? block.right?.text || block.left?.text || "Untitled section"
        : currentHeading;
    const existing = sections.get(label);
    if (existing) {
      existing.changeCount += 1;
    } else {
      sections.set(label, { label, changeIndex, changeCount: 1 });
    }
  }
  if (sections.size === 0 && sourceChanges > 0) {
    sections.set("source-changes", {
      label: `Source changes in ${fallbackPath}`,
      changeIndex: 0,
      changeCount: sourceChanges,
    });
  }
  return Array.from(sections.values());
}

function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function overviewSummaryItems(
  overview: ReturnType<typeof overviewStats>,
) {
  return [
    { label: "Changed blocks", value: overview.changed },
    { label: "Added blocks", value: overview.added },
    { label: "Removed blocks", value: overview.removed },
    { label: "Tables", value: overview.changedTables },
    { label: "Diagrams", value: overview.changedDiagrams },
  ].filter((item) => item.value > 0);
}

export function overviewStats({
  preview,
  renderedSummary,
  renderedPresentation,
  tableSummary,
}: {
  preview: DocumentDiffPreview;
  renderedSummary: GitRenderedDiffSummary;
  renderedPresentation: RenderedDiffPresentation;
  tableSummary: GitTableDiffSummary;
}) {
  const sourceChanges = sourceChangeIndexes(preview).size;
  const changedRenderedBlocks = renderedSummary.blocks.filter(
    isRenderedChangeBlock,
  );
  const changedSections = overviewSections(
    renderedPresentation.entries,
    renderedPresentation.entryChangeIndexes,
    preview.relativePath ?? undefined,
    sourceChanges,
  );
  const diagrams = changedRenderedBlocks.filter(
    (block) => block.blockKind === "diagram",
  );
  const tables = changedRenderedBlocks.filter(
    (block) => block.blockKind === "table",
  );
  const added = changedRenderedBlocks.filter(
    (block) => block.kind === "added",
  ).length;
  const removed = changedRenderedBlocks.filter(
    (block) => block.kind === "removed",
  ).length;
  const changedBlockCount = changedRenderedBlocks.filter(
    (block) => block.kind === "changed",
  ).length;
  const changed =
    renderedSummary.blocks.length > 0 ? changedBlockCount : sourceChanges;
  const fallbackReasons = [
    renderedSummary.fallbackMessage,
    tableSummary.fallbackReason
      ? fallbackMessage(tableSummary.fallbackReason)
      : undefined,
    preview.message,
  ].filter(Boolean) as string[];
  return {
    added,
    removed,
    changed,
    changedSections,
    changedTables: tables.length || tableSummary.renderedTables.length,
    changedDiagrams: diagrams.length,
    fallbackReasons,
  };
}

export function DiffOverview({
  overview,
  onJumpToPreviewChange,
}: {
  overview: ReturnType<typeof overviewStats>;
  onJumpToPreviewChange: (index: number) => void;
}) {
  const summaryItems = overviewSummaryItems(overview);
  return (
    <div className="git-diff-overview" data-review-id="git-diff-overview">
      <section>
        <h3>Summary</h3>
        {summaryItems.length > 0 ? (
          <div className="git-diff-overview-summary">
            {summaryItems.map((item) => (
              <span key={item.label}>
                <strong>{item.label}</strong>
                <em>{item.value}</em>
              </span>
            ))}
          </div>
        ) : (
          <p>No rendered changes detected.</p>
        )}
      </section>
      <section data-review-id="git-diff-overview-sections">
        <h3>Changed sections</h3>
        {overview.changedSections.length > 0 ? (
          <ul>
            {overview.changedSections.map((section, index) => (
              <li key={`changed-section:${index}`}>
                <button
                  type="button"
                  data-review-id="git-diff-overview-jump-preview"
                  onClick={() => onJumpToPreviewChange(section.changeIndex)}
                >
                  {section.label}
                  {section.changeCount > 1 && (
                    <>
                      <span
                        className="git-diff-overview-section-separator"
                        aria-hidden="true"
                      >
                        ·
                      </span>
                      <span>
                        {pluralize(section.changeCount, "change", "changes")}
                      </span>
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>No changed heading blocks were detected.</p>
        )}
      </section>
      {overview.fallbackReasons.length > 0 && (
        <section data-review-id="git-diff-fallback-reason">
          <h3>Fallback</h3>
          <ul>
            {overview.fallbackReasons.map((reason, index) => (
              <li key={`fallback:${index}`}>{reason}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
