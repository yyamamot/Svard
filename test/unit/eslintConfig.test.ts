import { describe, expect, it } from "vitest";

import eslintConfig from "../../eslint.config.js";

describe("ESLint configuration", () => {
  it("ignores only generated output and local test artifacts", () => {
    const ignoreConfig = eslintConfig.find((config) =>
      Array.isArray(config.ignores),
    );

    expect(ignoreConfig?.ignores).toEqual(
      expect.arrayContaining([
        "coverage",
        "playwright-report",
        "test-results",
        "site/.astro",
        "site/dist",
        "src-tauri/.artifacts",
      ]),
    );
  });
});
