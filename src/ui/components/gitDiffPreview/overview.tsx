import type { DocumentDiffPreview } from "../../../core/types";
import {
  isRenderedChangeBlock,
  type GitRenderedDiffSummary,
  type RenderedDiffFallbackReason,
  type RenderedDiffPresentation,
} from "../../lib/gitRenderedDiff";
import type { GitTableDiffSummary } from "../../lib/gitTableDiff";
import { sourceChangeIndexes } from "./sourceView";
import { fallbackMessage } from "./tableView";
import type { OverviewSection } from "./types";

function overviewSections(
  renderedPresentation: RenderedDiffPresentation,
  activeChangeIndex: number,
  fallbackPath: string | undefined,
  sourceChanges: number,
): OverviewSection[] {
  if (renderedPresentation.sectionOutline.length > 0) {
    return renderedPresentation.sectionOutline.map((section, index, list) => {
      const next = list[index + 1];
      const active =
        activeChangeIndex >= section.firstChangeIndex &&
        activeChangeIndex <
          (next?.firstChangeIndex ?? Number.POSITIVE_INFINITY);
      return { ...section, active };
    });
  }
  if (sourceChanges > 0) {
    return [
      {
        id: "source-changes",
        label: `Source changes in ${fallbackPath}`,
        level: 0,
        firstChangeIndex: 0,
        changeCount: sourceChanges,
        active: activeChangeIndex >= 0,
      },
    ];
  }
  return [];
}

function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function renderedFallbackCategoryLabel(
  fallback: RenderedDiffFallbackReason,
): string {
  const target = fallback.kind === "list" ? "List fallback" : "Table fallback";
  return `${target}: ${fallback.reason.replace(/-/g, " ")}`;
}

function renderedFallbackReasonCounts(
  renderedPresentation: RenderedDiffPresentation,
): string[] {
  const counts = new Map<string, number>();
  for (const fallback of renderedPresentation.fallbackReasons) {
    const label = renderedFallbackCategoryLabel(fallback);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([label, count]) =>
    count === 1 ? label : `${label} (${count})`,
  );
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
  activeChangeIndex = 0,
}: {
  preview: DocumentDiffPreview;
  renderedSummary: GitRenderedDiffSummary;
  renderedPresentation: RenderedDiffPresentation;
  tableSummary: GitTableDiffSummary;
  activeChangeIndex?: number;
}) {
  const sourceChanges = sourceChangeIndexes(preview).size;
  const changedRenderedBlocks = renderedSummary.blocks.filter(
    isRenderedChangeBlock,
  );
  const changedSections = overviewSections(
    renderedPresentation,
    activeChangeIndex,
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
    ...renderedFallbackReasonCounts(renderedPresentation),
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
  activeChangeIndex,
  overview,
  onJumpToPreviewChange,
}: {
  activeChangeIndex: number;
  overview: ReturnType<typeof overviewStats>;
  onJumpToPreviewChange: (index: number) => void;
}) {
  const summaryItems = overviewSummaryItems(overview);
  return (
    <div
      className="git-diff-overview"
      data-review-id="git-diff-overview"
      data-active-change-index={activeChangeIndex}
    >
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
            {overview.changedSections.map((section) => (
              <li key={section.id}>
                <button
                  type="button"
                  className={section.active ? "active" : undefined}
                  data-review-id="git-diff-overview-jump-preview"
                  data-active-change={section.active ? "true" : undefined}
                  aria-current={section.active ? "true" : undefined}
                  onClick={() =>
                    onJumpToPreviewChange(section.firstChangeIndex)
                  }
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
