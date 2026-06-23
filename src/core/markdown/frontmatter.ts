import { escapeHtml } from "./escape";
import type { FrontmatterValue } from "./types";

const frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

function parseFrontmatterScalar(value: string): FrontmatterValue {
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }
  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }
  const quoted = trimmed.match(/^(['"])(.*)\1$/);
  return quoted?.[2] ?? trimmed;
}

function parseFrontmatter(frontmatter: string): {
  rows: Array<[string, FrontmatterValue]>;
  parsed: boolean;
} {
  const lines = frontmatter.split(/\r?\n/);
  const rows: Array<[string, FrontmatterValue]> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const row = line.match(/^([A-Za-z0-9_.-]+):\s*(.*)$/);
    if (!row) {
      if (line.trim() !== "") {
        return { rows: [], parsed: false };
      }
      continue;
    }

    const key = row[1];
    const value = row[2];
    const children: string[] = [];
    let cursor = index + 1;
    while (cursor < lines.length && /^\s+/.test(lines[cursor])) {
      children.push(lines[cursor]);
      cursor += 1;
    }
    index = cursor - 1;

    if (children.length === 0) {
      rows.push([key, parseFrontmatterScalar(value)]);
      continue;
    }

    if (children.every((child) => /^ {2}-\s+/.test(child))) {
      rows.push([
        key,
        children.map((child) =>
          parseFrontmatterScalar(child.replace(/^ {2}-\s+/, "")),
        ),
      ]);
      continue;
    }

    const objectEntries: Record<string, FrontmatterValue> = {};
    let objectParsed = true;
    for (const child of children) {
      const childRow = child.match(/^ {2}([A-Za-z0-9_.-]+):\s*(.*)$/);
      if (!childRow) {
        objectParsed = false;
        break;
      }
      objectEntries[childRow[1]] = parseFrontmatterScalar(childRow[2]);
    }
    if (!objectParsed) {
      return { rows: [], parsed: false };
    }
    rows.push([key, objectEntries]);
  }

  return { rows, parsed: rows.length > 0 };
}

function renderFrontmatterValue(value: FrontmatterValue): string {
  if (value === null) {
    return '<span class="frontmatter-null">null</span>';
  }
  if (typeof value === "boolean") {
    return `<span class="frontmatter-boolean">${value ? "true" : "false"}</span>`;
  }
  if (typeof value === "number") {
    return `<span class="frontmatter-number">${value}</span>`;
  }
  if (typeof value === "string") {
    return escapeHtml(value);
  }
  if (Array.isArray(value)) {
    const items = value
      .map((item) => `<li>${renderFrontmatterValue(item)}</li>`)
      .join("");
    return `<ul class="frontmatter-list">${items}</ul>`;
  }

  const rows = Object.entries(value)
    .map(
      ([key, childValue]) =>
        `<tr><th>${escapeHtml(key)}</th><td>${renderFrontmatterValue(childValue)}</td></tr>`,
    )
    .join("");
  return `<table class="frontmatter-nested"><tbody>${rows}</tbody></table>`;
}

function frontmatterSummary(count: number | "raw"): string {
  const countLabel = count === "raw" ? "raw" : `${count} fields`;
  return `<summary><span class="metadata-label">Frontmatter</span> · <span class="metadata-count">${countLabel}</span></summary>`;
}

export function splitFrontmatter(source: string): {
  body: string;
  htmlPrefix: string;
  lineOffset: number;
} {
  const match = source.match(frontmatterPattern);
  if (!match) {
    return { body: source, htmlPrefix: "", lineOffset: 0 };
  }

  const frontmatter = match[1];
  const { rows, parsed } = parseFrontmatter(frontmatter);
  const lineOffset = match[0].split(/\r?\n/).length - 1;
  const body = source.slice(match[0].length);

  if (!parsed) {
    return {
      body,
      lineOffset,
      htmlPrefix: `<details class="markdown-frontmatter">${frontmatterSummary("raw")}<pre><code>${escapeHtml(frontmatter)}</code></pre></details>`,
    };
  }

  const tableRows = rows
    .map(
      ([key, value]) =>
        `<tr><th>${escapeHtml(key)}</th><td>${renderFrontmatterValue(value)}</td></tr>`,
    )
    .join("");
  return {
    body,
    lineOffset,
    htmlPrefix: `<details class="markdown-frontmatter">${frontmatterSummary(rows.length)}<table><tbody>${tableRows}</tbody></table></details>`,
  };
}
