import { describe, expect, it } from "vitest";

import { renderAsciiDocContract } from "./renderContractTestUtils";

describe("AsciiDoc document attributes render contract", () => {
  it("renders root document attributes before the AsciiDoc body", async () => {
    const { doc, renderResult } = await renderAsciiDocContract({
      source: `= Guide
:toc:
:icons: font
:imagesdir: assets

== Section

Body.
`,
    });

    const attributes = doc.querySelector(".asciidoc-document-attributes");
    expect(attributes).toBeTruthy();
    expect(attributes?.querySelector("summary")?.textContent).toBe(
      "Document Attributes · 3 items",
    );
    expect(attributes?.querySelector("table")?.textContent).toContain(
      "imagesdir",
    );
    expect(doc.body.firstElementChild).toBe(attributes);
    expect(renderResult.html).toContain("asciidoc-document-attributes");
    const sectionHeading = renderResult.headings.find(
      (heading) => heading.text === "Section",
    );
    expect(sectionHeading?.sourceLocation?.sourcePath).toBe(
      "/workspace/docs/contract.adoc",
    );
    expect(
      renderResult.headings.some(
        (heading) => heading.text === "Document Attributes",
      ),
    ).toBe(false);
  });

  it("does not render injected or included attributes as document attributes", async () => {
    const { doc } = await renderAsciiDocContract({
      source: `= Guide

include::partial.adoc[]
`,
      includeFiles: [
        {
          path: "/workspace/docs/partial.adoc",
          source: `:included-only: hidden

== Included
`,
        },
      ],
      attributes: { showtitle: true, icons: "font" },
      contextAttributes: { imagesdir: "assets" },
    });

    const attributes = doc.querySelector(".asciidoc-document-attributes");
    expect(attributes).toBeNull();
    expect(doc.body.textContent).not.toContain("included-only");
    expect(doc.body.textContent).not.toContain("imagesdir");
  });
});
