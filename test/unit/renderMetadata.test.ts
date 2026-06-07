import { describe, expect, it } from "vitest";

import { fixtureDocuments, fixturePath } from "../../src/core/fixtures";

describe("fixtures", () => {
  it("contains an MVP guide with Kroki and Preferences coverage", () => {
    const source = fixtureDocuments[fixturePath];

    expect(source).toContain("Svard MVP Guide");
    expect(source).toContain("[mermaid]");
    expect(source).toContain("[plantuml]");
    expect(source).toContain("Preferences");
  });
});
