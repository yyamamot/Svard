import { describe, expect, it } from "vitest";

import {
  tableToCsv,
  tableToMarkdown,
  tableToMatrix,
  tableToTsv,
} from "../../src/ui/lib/tableClipboard";

function table(html: string): HTMLTableElement {
  const template = document.createElement("template");
  template.innerHTML = html;
  const element = template.content.querySelector("table");
  if (!(element instanceof HTMLTableElement)) {
    throw new Error("table fixture is missing");
  }
  return element;
}

describe("table clipboard serializers", () => {
  it("serializes a table as TSV", () => {
    const element = table(`
      <table>
        <tr><th>Item</th><th>Status</th></tr>
        <tr><td>AsciiDoc</td><td>Rendered</td></tr>
      </table>
    `);

    expect(tableToTsv(element)).toBe("Item\tStatus\nAsciiDoc\tRendered");
  });

  it("serializes CSV with quotes, commas, and newlines escaped", () => {
    const element = table(`
      <table>
        <tr><th>Name</th><th>Note</th></tr>
        <tr><td>Alice, Bob</td><td>He said "OK"</td></tr>
        <tr><td>Line</td><td>one<br>two</td></tr>
      </table>
    `);

    expect(tableToCsv(element)).toBe(
      'Name,Note\n"Alice, Bob","He said ""OK"""\nLine,one two',
    );
  });

  it("serializes Markdown table and escapes pipes", () => {
    const element = table(`
      <table>
        <tr><th>Item</th><th>Value</th></tr>
        <tr><td>A|B</td><td>Done</td></tr>
      </table>
    `);

    expect(tableToMarkdown(element)).toBe(
      "| Item | Value |\n| --- | --- |\n| A\\|B | Done |",
    );
  });

  it("flattens simple row and column spans", () => {
    const element = table(`
      <table>
        <tr><th rowspan="2">Item</th><th colspan="2">Status</th></tr>
        <tr><th>Local</th><th>Remote</th></tr>
      </table>
    `);

    expect(tableToMatrix(element)).toEqual([
      ["Item", "Status", ""],
      ["", "Local", "Remote"],
    ]);
  });
});
