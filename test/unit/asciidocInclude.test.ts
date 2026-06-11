import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import asciidoctor from "@asciidoctor/core";

import { expandAsciiDocIncludes } from "../../src/core/asciidocInclude";
import {
  extractHeadings,
  extractSourceBlocks,
} from "../../src/core/asciidocSourceMap";
import { extractPlantUmlDiagrams } from "../../src/core/extractDiagrams";

const rootPath = "/workspace/docs/include-main.adoc";
const includeFiles = [
  {
    path: "/workspace/docs/partials/partial.adoc",
    source: `= Partial Title

== Partial Source

[source,ts]
----
export const included = true;
----

== Partial Diagram

[plantuml,id=included-sequence]
----
@startuml
Alice -> Bob: included
@enduml
----`,
  },
];

describe("AsciiDoc include expansion", () => {
  it("keeps the conditional include sample focused on active branches", () => {
    const samplePath = resolve("docs/samples/conditional-include.adoc");
    const partialRoot = resolve("docs/samples/partials/conditional");
    const includeFiles: Array<{ path: string; source: string }> = [];

    function collect(dir: string) {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
          collect(path);
          continue;
        }
        includeFiles.push({ path, source: readFileSync(path, "utf8") });
      }
    }

    collect(partialRoot);

    const expanded = expandAsciiDocIncludes(
      readFileSync(samplePath, "utf8"),
      samplePath,
      includeFiles,
    );

    expect(expanded.diagnostics).toEqual([]);
    expect(expanded.source).toContain("Feature Preview Branch");
    expect(expanded.source).toContain("Modern Mode Branch");
    expect(expanded.source).toContain("Production Target Branch");
    expect(expanded.source).toContain("Propagated Attribute Include");
    expect(expanded.source).not.toContain("Feature Disabled Branch");
    expect(expanded.source).not.toContain("Legacy Mode Branch");
    expect(expanded.source).not.toContain("Development Target Branch");
  });

  it("keeps nested header attributes and leveloffset wrappers out of rendered text", () => {
    const expanded = expandAsciiDocIncludes(
      `= Root

Intro paragraph.
include::section.adoc[leveloffset=+1]
After include.`,
      "/workspace/modules/sample/pages/index.adoc",
      [
        {
          path: "/workspace/modules/sample/pages/section.adoc",
          source: `include::../partials/header.adoc[]

= Synthetic Section

Trailing paragraph without final blank.`,
        },
        {
          path: "/workspace/modules/sample/partials/header.adoc",
          source: `:lang: ja
:doctype: book
:toc: left
:icons: font
:imagesdir: ../images`,
        },
      ],
    );

    const html = asciidoctor().convert(expanded.source).toString();

    expect(expanded.diagnostics).toEqual([]);
    expect(html).toContain("Synthetic Section");
    expect(html).toContain("Trailing paragraph without final blank.");
    expect(html).not.toContain(":leveloffset:");
    expect(html).not.toContain(":doctype:");
    expect(html).not.toContain(":imagesdir:");
    expect(
      extractHeadings(html, expanded.source, expanded.lineOrigins),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "_synthetic_section",
          level: 2,
          text: "Synthetic Section",
        }),
      ]),
    );
  });

  it("applies explicit leveloffset once and keeps included source origins", () => {
    const expanded = expandAsciiDocIncludes(
      `= Root

include::partials/partial.adoc[leveloffset=+1]

== After`,
      rootPath,
      includeFiles,
    );
    const html =
      '<h1 id="_root">Root</h1><h2 id="_partial_title">Partial Title</h2><h3 id="_partial_source">Partial Source</h3><h3 id="_partial_diagram">Partial Diagram</h3><h2 id="_after">After</h2>';

    expect(
      extractHeadings(html, expanded.source, expanded.lineOrigins),
    ).toEqual([
      {
        id: "_root",
        level: 1,
        text: "Root",
        sourceLocation: {
          line: 1,
          column: 1,
          sourcePath: "/workspace/docs/include-main.adoc",
        },
      },
      {
        id: "_partial_title",
        level: 2,
        text: "Partial Title",
        sourceLocation: {
          line: 1,
          column: 1,
          sourcePath: "/workspace/docs/partials/partial.adoc",
        },
      },
      {
        id: "_partial_source",
        level: 3,
        text: "Partial Source",
        sourceLocation: {
          line: 3,
          column: 1,
          sourcePath: "/workspace/docs/partials/partial.adoc",
        },
      },
      {
        id: "_partial_diagram",
        level: 3,
        text: "Partial Diagram",
        sourceLocation: {
          line: 10,
          column: 1,
          sourcePath: "/workspace/docs/partials/partial.adoc",
        },
      },
      {
        id: "_after",
        level: 2,
        text: "After",
        sourceLocation: {
          line: 5,
          column: 1,
          sourcePath: "/workspace/docs/include-main.adoc",
        },
      },
    ]);
  });

  it("maps included source blocks and diagrams to the included file", () => {
    const expanded = expandAsciiDocIncludes(
      `= Root

include::partials/partial.adoc[leveloffset=+1]`,
      rootPath,
      includeFiles,
    );

    expect(
      extractSourceBlocks(expanded.source, expanded.lineOrigins)[0],
    ).toEqual({
      id: "source-1",
      language: "ts",
      sourceLocation: {
        line: 5,
        column: 1,
        sourcePath: "/workspace/docs/partials/partial.adoc",
      },
    });
    expect(
      extractPlantUmlDiagrams(expanded.source, expanded.lineOrigins)[0]
        .sourceLocation,
    ).toEqual({
      line: 12,
      column: 1,
      sourcePath: "/workspace/docs/partials/partial.adoc",
    });
  });

  it("keeps disallowed or missing includes as diagnostics instead of throwing", () => {
    const expanded = expandAsciiDocIncludes(
      `= Root

include::../secret.adoc[]

include::partials/missing.adoc[]`,
      rootPath,
      [],
    );

    expect(expanded.diagnostics).toHaveLength(2);
    expect(expanded.diagnostics[0]).toMatchObject({
      message: "Include file not found or not allowed: ../secret.adoc",
      sourceLocation: {
        line: 3,
        sourcePath: "/workspace/docs/include-main.adoc",
      },
    });
    expect(expanded.diagnostics[1].message).toContain("Include file not found");
  });

  it("expands Windows path include files collected by the backend", () => {
    const expanded = expandAsciiDocIncludes(
      `= Root

include::partials/partial.adoc[]`,
      "C:\\Users\\me\\project\\docs\\main.adoc",
      [
        {
          path: "C:\\Users\\me\\project\\docs\\partials\\partial.adoc",
          source: `== Windows Partial

[plantuml]
----
@startuml
Alice -> Bob: windows include
@enduml
----`,
        },
      ],
    );

    expect(expanded.diagnostics).toEqual([]);
    expect(expanded.source).toContain("== Windows Partial");
    expect(
      extractPlantUmlDiagrams(expanded.source, expanded.lineOrigins)[0]
        .sourceLocation,
    ).toEqual({
      line: 3,
      column: 1,
      sourcePath: "C:/Users/me/project/docs/partials/partial.adoc",
    });
  });

  it("expands sibling directory includes when backend authorized them", () => {
    const expanded = expandAsciiDocIncludes(
      `= Root

include::../partials/partial.adoc[]`,
      "/workspace/project/docs/index.adoc",
      [
        {
          path: "/workspace/project/partials/partial.adoc",
          source: "== Sibling Partial\n\nIncluded from project root.",
        },
      ],
    );

    expect(expanded.diagnostics).toEqual([]);
    expect(expanded.source).toContain("== Sibling Partial");
    expect(expanded.lineOrigins).toContainEqual({
      sourcePath: "/workspace/project/partials/partial.adoc",
      line: 1,
    });
  });

  it("keeps included imagesdir attributes for Antora module page assets", () => {
    const expanded = expandAsciiDocIncludes(
      `= Module Page

include::../partials/header.adoc[]

== Diagram

image:diagram.drawio.svg[]`,
      "/workspace/modules/module-a/pages/index.adoc",
      [
        {
          path: "/workspace/modules/module-a/partials/header.adoc",
          source: ":imagesdir: ../images\n\n== Included Header",
        },
      ],
    );

    expect(expanded.diagnostics).toEqual([]);
    expect(expanded.source).toContain(":imagesdir: ../images");
    expect(expanded.source).toContain("image:diagram.drawio.svg[]");
  });

  it("expands only the active include branch for ifdef and ifndef", () => {
    const expanded = expandAsciiDocIncludes(
      `= Root
:feature:

ifdef::feature[]
include::partials/enabled.adoc[]
endif::[]

ifndef::feature[]
include::partials/disabled.adoc[]
endif::[]`,
      rootPath,
      [
        {
          path: "/workspace/docs/partials/enabled.adoc",
          source: "== Enabled\n\nVisible content.",
        },
      ],
    );

    expect(expanded.diagnostics).toEqual([]);
    expect(expanded.missingIncludes).toEqual([]);
    expect(expanded.source).toContain("Visible content.");
    expect(expanded.source).not.toContain("disabled.adoc");
  });

  it("evaluates ifeval before collecting an include", () => {
    const expanded = expandAsciiDocIncludes(
      `= Root
:env: prod

ifeval::["{env}" == "prod"]
include::partials/prod.adoc[]
endif::[]

ifeval::["{env}" == "dev"]
include::partials/dev.adoc[]
endif::[]`,
      rootPath,
      [
        {
          path: "/workspace/docs/partials/prod.adoc",
          source: "== Production\n\nProduction-only content.",
        },
      ],
    );

    expect(expanded.diagnostics).toEqual([]);
    expect(expanded.source).toContain("Production-only content.");
    expect(expanded.source).not.toContain("dev.adoc");
  });

  it("substitutes attributes in include targets", () => {
    const expanded = expandAsciiDocIncludes(
      `= Root
:partialsdir: partials

include::{partialsdir}/partial.adoc[leveloffset=+1]`,
      rootPath,
      includeFiles,
    );

    expect(expanded.diagnostics).toEqual([]);
    expect(expanded.source).toContain("Partial Title");
    expect(expanded.lineOrigins).toContainEqual({
      sourcePath: "/workspace/docs/partials/partial.adoc",
      line: 1,
    });
  });

  it("propagates attributes from included files to later includes", () => {
    const expanded = expandAsciiDocIncludes(
      `= Root

include::partials/header.adoc[]
include::{nextdir}/next.adoc[]`,
      rootPath,
      [
        {
          path: "/workspace/docs/partials/header.adoc",
          source: ":nextdir: partials/nested\n\n== Header",
        },
        {
          path: "/workspace/docs/partials/nested/next.adoc",
          source: "== Next\n\nAttribute-propagated include.",
        },
      ],
    );

    expect(expanded.diagnostics).toEqual([]);
    expect(expanded.source).toContain("Attribute-propagated include.");
    expect(expanded.lineOrigins).toContainEqual({
      sourcePath: "/workspace/docs/partials/nested/next.adoc",
      line: 1,
    });
  });

  it("expands include directives inside source blocks as literal source", () => {
    const expanded = expandAsciiDocIncludes(
      `= API Reference

[source]
----
include::../examples/service.proto[service.proto]
----`,
      "/workspace/project/docs/index.adoc",
      [
        {
          path: "/workspace/project/examples/service.proto",
          source: `syntax = "proto3";

message RenderRequest {
  string document_path = 1;
}`,
        },
      ],
    );

    expect(expanded.diagnostics).toEqual([]);
    expect(expanded.source).toContain('syntax = "proto3";');
    expect(expanded.source).not.toContain("include::../examples/service.proto");
    expect(expanded.lineOrigins).toContainEqual({
      sourcePath: "/workspace/project/examples/service.proto",
      line: 1,
    });
    expect(expanded.lineOrigins).toContainEqual({
      sourcePath: "/workspace/project/examples/service.proto",
      line: 4,
    });
  });

  it("expands backend-provided text include files without extension-specific handling", () => {
    const expanded = expandAsciiDocIncludes(
      `= Text Includes

[source,systemd]
----
include::../examples/service-unit.service[]
----`,
      "/workspace/project/docs/index.adoc",
      [
        {
          path: "/workspace/project/examples/service-unit.service",
          source: `[Service]
ExecStart=/usr/bin/example`,
        },
      ],
    );

    expect(expanded.diagnostics).toEqual([]);
    expect(expanded.source).toContain("[Service]");
    expect(expanded.source).toContain("ExecStart=/usr/bin/example");
    expect(expanded.source).not.toContain(
      "include::../examples/service-unit.service",
    );
    expect(expanded.lineOrigins).toContainEqual({
      sourcePath: "/workspace/project/examples/service-unit.service",
      line: 1,
    });
  });

  it("expands extensionless include directives inside source blocks as literal source", () => {
    const expanded = expandAsciiDocIncludes(
      `= Helper

[source,ruby]
----
include::../scripts/git-helper[]
----

include::../scripts/missing-helper[]`,
      "/workspace/project/docs/index.adoc",
      [
        {
          path: "/workspace/project/scripts/git-helper",
          source: `#!/usr/bin/env ruby
puts "helper"`,
        },
      ],
    );

    expect(expanded.source).toContain("#!/usr/bin/env ruby");
    expect(expanded.source).toContain('puts "helper"');
    expect(expanded.source).not.toContain("----\n\n#!/usr/bin/env ruby");
    expect(expanded.source).not.toContain("include::../scripts/git-helper");
    expect(expanded.diagnostics).toHaveLength(1);
    expect(expanded.diagnostics[0]).toMatchObject({
      message:
        "Include file not found or not allowed: ../scripts/missing-helper",
      sourceLocation: {
        line: 8,
        sourcePath: "/workspace/project/docs/index.adoc",
      },
    });
    expect(expanded.lineOrigins).toContainEqual({
      sourcePath: "/workspace/project/scripts/git-helper",
      line: 1,
    });
    expect(expanded.lineOrigins).toContainEqual({
      sourcePath: "/workspace/project/scripts/git-helper",
      line: 2,
    });
  });
});
