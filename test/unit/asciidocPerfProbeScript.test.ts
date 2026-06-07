import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("AsciiDoc perf probe script", () => {
  const script = fs.readFileSync(
    path.join(process.cwd(), "scripts/asciidoc-perf-probe.mjs"),
    "utf8",
  );
  const probe = fs.readFileSync(
    path.join(process.cwd(), "test/perf/asciidocPerfProbe.test.ts"),
    "utf8",
  );

  it("exposes default and budget modes", () => {
    expect(script).toContain("--budget");
    expect(script).toContain("SVARD_ASCIIDOC_PERF_BUDGET");
    expect(script).toContain("SVARD_ASCIIDOC_PERF_OUT");
    expect(probe).toContain("budgetPassed");
    expect(probe).toContain("budgetResults");
    expect(probe).toContain("prepareDocumentHtmlMs");
    expect(probe).toContain("sanitizedDomParseMs");
    expect(probe).toContain("sanitizedDomParseSkipped");
    expect(probe).toContain("mathSkippedMs");
  });

  it("uses a synthetic fixture without private data", () => {
    expect(probe).toContain("createSyntheticDocument");
    expect(probe).toContain("/perf/generated/large-asciidoc");
    expect(probe).not.toContain(["test", "data"].join(""));
    expect(probe).toContain('["", "Users", ""].join("/")');
  });
});
