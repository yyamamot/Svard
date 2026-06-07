import { describe, expect, it } from "vitest";

import type { AsciiDocIncludeFile } from "../../src/core/types";
import {
  blockedImageResult,
  renderAsciiDocContract,
  svgImageResult,
} from "./renderContractTestUtils";

const documentPath =
  "/workspace/docs/book/modules/module-a/pages/resource-context.adoc";
const documentDir = "/workspace/docs/book/modules/module-a/pages";

describe("resource context render contract", () => {
  it("keeps Antora-style image and include resources resolved through context", async () => {
    const includeFiles: AsciiDocIncludeFile[] = [
      {
        path: "/workspace/docs/book/modules/module-a/pages/partials/header.adoc",
        source: `:imagesdir: ../images

== Module Header

image::module-header.svg[Module Header Image]

include::nested/detail.adoc[leveloffset=+1]`,
      },
      {
        path: "/workspace/docs/book/modules/module-a/pages/partials/nested/detail.adoc",
        source: `== Nested Detail

image::module-detail.svg[Module Detail Image]`,
      },
    ];
    const resolvedImages: string[] = [];
    const { doc, expanded, renderResult } = await renderAsciiDocContract({
      source: `= Resource Context Contract
:imagesdir: ../../shared-images

include::partials/header.adoc[]

== Root Image

image::root.svg[Root Image]

== Missing Image

image::missing.svg[Missing Context Image]

include::partials/missing.adoc[]`,
      documentPath,
      documentDir,
      baseDir: "/workspace/docs/book",
      workspaceRoot: "/workspace/docs/book",
      includeFiles,
      contextAttributes: { imagesdir: "../../shared-images" },
      resourceRoots: [
        "/workspace/docs/book",
        documentDir,
        "/workspace/docs/book/modules/module-a/images",
      ],
      resolveLocalImage: (source, docPath, context) => {
        expect(docPath).toBe(documentPath);
        expect(context?.documentDir).toBe(documentDir);
        expect(context?.resourceRoots).toContain(
          "/workspace/docs/book/modules/module-a/images",
        );
        resolvedImages.push(source);
        if (source.includes("missing.svg")) {
          return blockedImageResult("Local image is not available.");
        }
        return svgImageResult(`resolved:${source}`);
      },
    });
    const bodyText = doc.body.textContent ?? "";

    expect(expanded.diagnostics).toHaveLength(1);
    expect(expanded.diagnostics[0]).toMatchObject({
      message: expect.stringContaining("partials/missing.adoc"),
      sourceLocation: { sourcePath: documentPath },
    });
    expect(renderResult.headings.map((heading) => heading.text)).toEqual(
      expect.arrayContaining([
        "Module Header",
        "Nested Detail",
        "Root Image",
        "Missing Image",
      ]),
    );
    expect(bodyText).toContain("Include file not found or not allowed");
    expect(bodyText).not.toContain(":imagesdir:");
    expect(bodyText).not.toContain(":leveloffset:");
    expect(resolvedImages).toEqual([
      "../images/module-header.svg",
      "../images/module-detail.svg",
      "../images/root.svg",
      "../images/missing.svg",
    ]);
    expect(
      doc.querySelector(
        'img[alt="Module Header Image"][data-image-path="../images/module-header.svg"]',
      ),
    ).toBeTruthy();
    expect(
      doc.querySelector(
        'img[alt="Module Detail Image"][data-image-path="../images/module-detail.svg"]',
      ),
    ).toBeTruthy();
    expect(
      doc.querySelector(
        'img[alt="Root Image"][data-image-path="../images/root.svg"]',
      ),
    ).toBeTruthy();
    expect(
      Array.from(doc.querySelectorAll(".image-placeholder")).some(
        (placeholder) =>
          placeholder.textContent === "Local image is not available.",
      ),
    ).toBe(true);
  });
});
