import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { analyzeDocumentOrderSources } from "../../scripts/document-order-pattern-probe.mjs";

function writeFixture(root: string, name: string, content: string) {
  const filePath = path.join(root, name);
  fs.writeFileSync(filePath, content);
  return filePath;
}

describe("document order pattern probe", () => {
  it("summarizes config shapes without preserving source identifiers", async () => {
    const root = fs.mkdtempSync(path.join(process.cwd(), ".tmp-document-order-probe-"));
    try {
      const mkdocs = writeFixture(
        root,
        "mkdocs.yml",
        "INHERIT: base.yml\ndocs_dir: docs\nnav:\n  - Home: index.md\n  - Guide:\n      - Intro: guide/intro.md\n",
      );
      const playbook = writeFixture(
        root,
        "antora-playbook.yml",
        "content:\n  sources:\n    - url: https://example.invalid/repository.git\n      start_paths: docs/component-a, docs/component-b\n",
      );
      const nav = writeFixture(
        root,
        "nav.adoc",
        ".Guide\n* xref:guide.adoc#install[]\ninclude::partial/nav.adoc[]\n",
      );

      const report = await analyzeDocumentOrderSources([mkdocs, playbook, nav]);
      const serialized = JSON.stringify(report);

      expect(report.sampleCount).toBe(3);
      expect(report.patterns.mkdocsInheritConfigured).toBe(1);
      expect(report.patterns.antoraCommaSeparatedStartPaths).toBe(1);
      expect(report.patterns.antoraNavXrefsWithAnchor).toBe(1);
      expect(report.patterns.antoraNavIncludes).toBe(1);
      expect(serialized).not.toContain("example.invalid");
      expect(serialized).not.toContain("repository.git");
      expect(serialized).not.toContain(root);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
