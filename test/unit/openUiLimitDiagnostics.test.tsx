import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  SvardOpenUiAnswer,
  validateOpenUiResponse,
} from "../../src/ui/codex/openUiLibrary";
import {
  MAX_OPENUI_NODES,
  MAX_OPENUI_SOURCE_BYTES,
  MAX_TABLE_COLUMNS,
  MAX_TABLE_ROWS,
} from "../../src/ui/codex/openUiLimits";

function tableSource(rows: number, columns = 1) {
  const data = JSON.stringify(
    Array.from({ length: rows }, (_, index) => `Row ${index + 1}`),
  );
  const cols = Array.from(
    { length: columns },
    (_, index) => `Col("Column ${index + 1}", ${data})`,
  );
  return [
    'root = SvardExperience("Limit check", "Balanced Table boundary", [table])',
    `table = Table([${cols.join(",")}])`,
  ].join("\n");
}

function nodeSource(children: number) {
  const ids = Array.from({ length: children }, (_, index) => `item${index}`);
  return [
    `root = SvardExperience("Limit check", "Balanced component boundary", [${ids.join(",")}])`,
    ...ids.map((id, index) => `${id} = Heading("Item ${index + 1}", 2)`),
  ].join("\n");
}

describe("Balanced OpenUI limit diagnostics", () => {
  it("accepts the Table boundary and reports the first row overage", () => {
    expect(
      validateOpenUiResponse(tableSource(MAX_TABLE_ROWS), "balanced").valid,
    ).toBe(true);
    expect(
      validateOpenUiResponse(tableSource(MAX_TABLE_ROWS + 1), "balanced"),
    ).toMatchObject({
      valid: false,
      reason: "complexityLimit",
      limitDiagnostic: {
        metric: "tableRows",
        label: "Table rows",
        actual: MAX_TABLE_ROWS + 1,
        limit: MAX_TABLE_ROWS,
      },
    });
  });

  it("accepts the Table column boundary and reports the first overage", () => {
    expect(
      validateOpenUiResponse(tableSource(1, MAX_TABLE_COLUMNS), "balanced")
        .valid,
    ).toBe(true);
    expect(
      validateOpenUiResponse(tableSource(1, MAX_TABLE_COLUMNS + 1), "balanced"),
    ).toMatchObject({
      valid: false,
      reason: "complexityLimit",
      limitDiagnostic: {
        metric: "tableColumns",
        label: "Table columns",
        actual: MAX_TABLE_COLUMNS + 1,
        limit: MAX_TABLE_COLUMNS,
      },
    });
  });

  it("counts the root in the component limit", () => {
    expect(
      validateOpenUiResponse(nodeSource(MAX_OPENUI_NODES - 1), "balanced")
        .valid,
    ).toBe(true);
    expect(
      validateOpenUiResponse(nodeSource(MAX_OPENUI_NODES), "balanced"),
    ).toMatchObject({
      valid: false,
      reason: "complexityLimit",
      limitDiagnostic: {
        metric: "nodes",
        label: "UI components",
        actual: MAX_OPENUI_NODES + 1,
        limit: MAX_OPENUI_NODES,
      },
    });
  });

  it("reports the source byte limit before parsing", () => {
    const source =
      'root = SvardExperience("Large", "' +
      "x".repeat(MAX_OPENUI_SOURCE_BYTES) +
      '", [])';
    const result = validateOpenUiResponse(source, "balanced");

    expect(result).toMatchObject({
      valid: false,
      reason: "sourceLimit",
      limitDiagnostic: {
        metric: "sourceBytes",
        limit: MAX_OPENUI_SOURCE_BYTES,
      },
    });
    expect(result.limitDiagnostic?.actual).toBeGreaterThan(
      MAX_OPENUI_SOURCE_BYTES,
    );
  });

  it("renders only the safe limit table instead of raw OpenUI source", () => {
    const source = tableSource(MAX_TABLE_ROWS + 1);
    const html = renderToStaticMarkup(
      <SvardOpenUiAnswer content={source} profile="balanced" />,
    );

    expect(html).toContain('data-openui-failure="complexityLimit"');
    expect(html).toContain("Table rows");
    expect(html).toContain(`>${MAX_TABLE_ROWS + 1}<`);
    expect(html).toContain(`>${MAX_TABLE_ROWS}<`);
    expect(html).not.toContain("root = SvardExperience");
    expect(html).not.toContain("Review item");
    expect(html).not.toContain("parser");
  });
});
