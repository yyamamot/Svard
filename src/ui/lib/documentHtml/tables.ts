import type { DocumentPayload } from "../../../core/types";
import type { DocumentHtmlPhaseContext, RendererTargets } from "./types";
import { perfDuration, perfNow, tracePerf } from "../perfTrace";
import { htmlMayContainElement, sourceReference } from "./helpers";

function tableSourceLines(source: string, format: DocumentPayload["format"]) {
  const lines: number[] = [];
  if (format === "asciidoc") {
    const pattern = /^\|===/gm;
    let match: RegExpExecArray | null;
    let markerIndex = 0;

    while ((match = pattern.exec(source)) !== null) {
      if (markerIndex % 2 === 0) {
        lines.push(source.slice(0, match.index).split("\n").length);
      }
      markerIndex += 1;
    }

    return lines;
  }

  const pattern =
    /^[ \t]*\|.+\|[ \t]*\n[ \t]*\|?[ \t]*:?-{3,}:?[ \t]*(?:\|[ \t]*:?-{3,}:?[ \t]*)+\|?[ \t]*$/gm;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    lines.push(source.slice(0, match.index).split("\n").length);
  }

  return lines;
}

function shouldWrapMarkdownTable(table: HTMLTableElement): boolean {
  if (table.classList.contains("rouge-table")) {
    return false;
  }
  if (
    table.closest(
      ".admonitionblock, .markdown-frontmatter, .asciidoc-document-attributes, .frontmatter-nested, .markdown-table-scroll",
    )
  ) {
    return false;
  }
  return true;
}

function wrapMarkdownTable(doc: Document, table: HTMLTableElement): void {
  if (!shouldWrapMarkdownTable(table)) {
    return;
  }
  const wrapper = doc.createElement("div");
  wrapper.className = "markdown-table-scroll";
  wrapper.setAttribute("data-review-id", "markdown-table-scroll");
  table.replaceWith(wrapper);
  wrapper.append(table);
}

export function prepareTables(
  { html, doc, document, basename }: DocumentHtmlPhaseContext,
  { markdownTableElements }: RendererTargets,
  authorHtmlBlockRootElements: Set<Element>,
) {
  const tablesStartedAt = perfNow();
  const shouldProcessTables =
    htmlMayContainElement(html, "table") ||
    Array.from(authorHtmlBlockRootElements).some(
      (root) =>
        root.localName === "table" || Boolean(root.querySelector("table")),
    );
  let tableCount = 0;
  let tableLineCount = 0;
  if (shouldProcessTables) {
    const tables = Array.from(doc.querySelectorAll("table")).filter(
      (table) =>
        !table.closest(
          ".admonitionblock, .markdown-frontmatter, .asciidoc-document-attributes, .frontmatter-nested",
        ),
    );
    tableCount = tables.length;
    const tableSourceScanStartedAt = perfNow();
    const tableLines =
      document.format === "asciidoc"
        ? tableSourceLines(document.source, document.format)
        : [];
    tracePerf("render.prepareDocumentHtml.tableSourceScan", {
      basename,
      format: document.format,
      count: tableLines.length,
      skipped: document.format === "markdown",
      durationMs: perfDuration(tableSourceScanStartedAt),
    });
    tableLineCount =
      document.format === "markdown"
        ? markdownTableElements.size
        : tableLines.length;
    tables.forEach((table, index) => {
      const sourceLine =
        document.format === "markdown"
          ? markdownTableElements.has(table)
            ? Number(table.getAttribute("data-source-selection-start")) ||
              undefined
            : undefined
          : tableLines[index];
      table.setAttribute("data-review-id", "rendered-table");
      if (sourceLine) {
        table.setAttribute("data-source-line", String(sourceLine));
        table.setAttribute(
          "data-source-reference",
          sourceReference(document, sourceLine),
        );
      }
      if (document.format === "markdown") {
        wrapMarkdownTable(doc, table);
      }
    });
  }
  if (!shouldProcessTables) {
    tracePerf("render.prepareDocumentHtml.tableSourceScan", {
      basename,
      format: document.format,
      count: 0,
      skipped: true,
      durationMs: 0,
    });
  }
  tracePerf("render.prepareDocumentHtml.tables", {
    basename,
    format: document.format,
    count: tableLineCount || tableCount,
    skipped: !shouldProcessTables,
    durationMs: perfDuration(tablesStartedAt),
  });
}
