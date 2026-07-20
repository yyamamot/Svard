import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  join(process.cwd(), "src/ui/styles/file-tree-topbar.css"),
  "utf8",
);

function ruleBody(selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escapedSelector}\\s*\\{(?<body>[^}]+)\\}`).exec(
    css,
  );
  return match?.groups?.body ?? "";
}

describe("FileTree row width stability CSS", () => {
  it("keeps Documents rows on fixed hierarchy and icon tracks", () => {
    const row = ruleBody(".tree-row-main.documents-view-row-main");
    const icon = ruleBody(".tree-row-main.documents-view-row-main > svg");

    expect(row).toContain("display: grid");
    expect(row).toContain("grid-template-columns: 22px 15px minmax(0, 1fr)");
    expect(icon).toContain("width: 15px");
    expect(icon).toContain("min-width: 15px");
    expect(icon).toContain("height: 15px");
  });

  it("prevents Tree icons and badges from becoming text shrink targets", () => {
    const icon = ruleBody(".tree-row-main > svg");
    const label = ruleBody(".tree-label");
    const openIndicator = ruleBody(".documents-view-open-indicator");

    expect(icon).toContain("flex: 0 0 auto");
    expect(label).toContain("flex: 0 1 auto");
    expect(label).toContain("text-overflow: ellipsis");
    expect(openIndicator).toContain("flex: 0 0 auto");
  });
});
