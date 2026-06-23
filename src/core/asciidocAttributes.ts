import { escapeHtml } from "./markdown/escape";

export interface AsciiDocDocumentAttributeRow {
  name: string;
  value: string;
  kind: "set" | "empty" | "unset";
}

export interface AsciiDocDocumentAttributes {
  htmlPrefix: string;
  rows: AsciiDocDocumentAttributeRow[];
  parsed: boolean;
}

const attributePattern = /^:([^:!\s][^:]*):\s*(.*)$/;
const unsetAttributePattern = /^:(?:!([^:]+)|([^:!]+)!):\s*$/;
const titlePattern = /^=\s+\S/;

function attributeValueHtml(row: AsciiDocDocumentAttributeRow): string {
  if (row.kind === "unset") {
    return '<span class="frontmatter-null">unset</span>';
  }
  if (row.kind === "empty") {
    return '<span class="frontmatter-null">empty</span>';
  }
  return escapeHtml(row.value);
}

function renderRows(rows: AsciiDocDocumentAttributeRow[]): string {
  return rows
    .map(
      (row) =>
        `<tr><th>${escapeHtml(row.name)}</th><td>${attributeValueHtml(row)}</td></tr>`,
    )
    .join("");
}

function detailsHtml(body: string): string {
  return `<details class="markdown-frontmatter asciidoc-document-attributes"><summary>Document Attributes</summary>${body}</details>`;
}

export function extractAsciiDocDocumentAttributes(
  source: string,
): AsciiDocDocumentAttributes {
  const lines = source.split(/\r?\n/);
  const rows: AsciiDocDocumentAttributeRow[] = [];
  const rawAttributeLines: string[] = [];
  let sawHeaderLine = false;
  let parsed = true;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") {
      if (sawHeaderLine) {
        break;
      }
      continue;
    }

    if (titlePattern.test(trimmed)) {
      sawHeaderLine = true;
      continue;
    }

    const unset = unsetAttributePattern.exec(trimmed);
    if (unset) {
      sawHeaderLine = true;
      rawAttributeLines.push(line);
      rows.push({
        name: (unset[1] ?? unset[2]).trim(),
        value: "",
        kind: "unset",
      });
      continue;
    }

    const assignment = attributePattern.exec(trimmed);
    if (assignment) {
      sawHeaderLine = true;
      rawAttributeLines.push(line);
      const name = assignment[1].trim();
      const value = assignment[2].trim();
      rows.push({
        name,
        value,
        kind: value === "" ? "empty" : "set",
      });
      continue;
    }

    if (trimmed.startsWith(":") && sawHeaderLine) {
      parsed = false;
      rawAttributeLines.push(line);
      continue;
    }

    break;
  }

  if (rows.length === 0 && rawAttributeLines.length === 0) {
    return { htmlPrefix: "", rows: [], parsed: true };
  }

  if (!parsed) {
    return {
      htmlPrefix: detailsHtml(
        `<pre><code>${escapeHtml(rawAttributeLines.join("\n"))}</code></pre>`,
      ),
      rows: [],
      parsed: false,
    };
  }

  return {
    htmlPrefix: detailsHtml(`<table><tbody>${renderRows(rows)}</tbody></table>`),
    rows,
    parsed: true,
  };
}
