import { describe, expect, it } from "vitest";

import { isExcludedMaintainabilityPath } from "../../scripts/check-maintainability.mjs";

describe("maintainability script", () => {
  it("excludes dependency and generated directories by exact path and descendants", () => {
    expect(isExcludedMaintainabilityPath("node_modules")).toBe(true);
    expect(
      isExcludedMaintainabilityPath("node_modules/.pnpm/pkg/index.js"),
    ).toBe(true);
    expect(isExcludedMaintainabilityPath("site/node_modules")).toBe(true);
    expect(
      isExcludedMaintainabilityPath(
        "site/node_modules/.pnpm/typescript/lib/typescript.js",
      ),
    ).toBe(true);
    expect(isExcludedMaintainabilityPath("site/dist")).toBe(true);
    expect(isExcludedMaintainabilityPath("site/dist/index.html")).toBe(true);
    expect(isExcludedMaintainabilityPath(".artifacts")).toBe(true);
    expect(isExcludedMaintainabilityPath(".artifacts/report.json")).toBe(true);
  });

  it("keeps repo-owned source files eligible for maintainability checks", () => {
    expect(isExcludedMaintainabilityPath("src/ui/App.tsx")).toBe(false);
    expect(isExcludedMaintainabilityPath("scripts/site-screenshots.mjs")).toBe(
      false,
    );
    expect(isExcludedMaintainabilityPath("site/src/pages/index.astro")).toBe(
      false,
    );
    expect(isExcludedMaintainabilityPath("site/src/styles/global.css")).toBe(
      false,
    );
  });

  it("excludes localized site content registries from source maintainability checks", () => {
    expect(isExcludedMaintainabilityPath("site/src/content/site.en.ts")).toBe(
      true,
    );
    expect(isExcludedMaintainabilityPath("site/src/content/site.ja.ts")).toBe(
      true,
    );
  });
});
