import { describe, expect, it } from "vitest";

import { defaultConfig } from "../../src/core/defaultConfig";
import type { AppConfig, DocumentPayload } from "../../src/core/types";
import {
  documentPayloadRenderSignature,
  documentRenderConfigSignature,
  documentRenderSetSignature,
} from "../../src/ui/hooks/useDocumentRender";

function cloneConfig(): AppConfig {
  return structuredClone(defaultConfig);
}

function documentPayload(overrides: Partial<DocumentPayload> = {}) {
  return {
    path: "/workspace/docs/diagrams-mixed-long-ja.adoc",
    basePath: "/workspace/docs",
    format: "asciidoc" as const,
    source:
      "= Mixed Diagram Japanese Sample\n\n[mermaid]\n....\ngraph TD\n....\n",
    updatedAt: "2026-01-01T00:00:00.000Z",
    asciidocContext: {
      baseDir: "/workspace/docs",
      workspaceRoot: "/workspace",
      documentDir: "/workspace/docs",
      attributes: { icons: "font" },
      resourceRoots: ["/workspace/docs"],
    },
    ...overrides,
  };
}

describe("useDocumentRenderSignatures", () => {
  it("ignores workspace and sidebar state that must not restart document render", () => {
    const before = cloneConfig();
    const after = cloneConfig();
    after.workspace = {
      ...after.workspace,
      activeHeadingByPath: {
        "/workspace/docs/diagrams-mixed-long-ja.adoc": "_plantuml",
      },
      scrollPositions: {
        "/workspace/docs/diagrams-mixed-long-ja.adoc": 840,
      },
      sidebarTab: "sourceControl",
      sourceControlView: "graph",
    };
    after.sidebarVisible = false;
    after.rightSidebarVisible = false;
    after.layout = {
      ...after.layout,
      leftSidebarWidth: after.layout.leftSidebarWidth + 24,
    };

    expect(documentRenderConfigSignature(after)).toBe(
      documentRenderConfigSignature(before),
    );
  });

  it("changes when render-affecting config changes", () => {
    const before = cloneConfig();
    const after = cloneConfig();
    after.diagram = {
      ...after.diagram,
      plantumlTimeoutMs: after.diagram.plantumlTimeoutMs + 1000,
    };

    expect(documentRenderConfigSignature(after)).not.toBe(
      documentRenderConfigSignature(before),
    );
  });

  it("changes when Kroki, security, theme, or placeholder render settings change", () => {
    const before = cloneConfig();
    const krokiChanged = cloneConfig();
    krokiChanged.kroki = { ...krokiChanged.kroki, timeoutMs: 12345 };
    const securityChanged = cloneConfig();
    securityChanged.security = {
      ...securityChanged.security,
      showExternalImages: true,
    };
    const themeChanged = cloneConfig();
    themeChanged.theme = "dark";
    const placeholderChanged = cloneConfig();
    placeholderChanged.experimental = {
      ...placeholderChanged.experimental,
      diagramPlaceholderRendering: true,
    };

    const baseSignature = documentRenderConfigSignature(before);
    expect(documentRenderConfigSignature(krokiChanged)).not.toBe(baseSignature);
    expect(documentRenderConfigSignature(securityChanged)).not.toBe(
      baseSignature,
    );
    expect(documentRenderConfigSignature(themeChanged)).not.toBe(baseSignature);
    expect(documentRenderConfigSignature(placeholderChanged)).not.toBe(
      baseSignature,
    );
  });

  it("uses document path, source, format, and AsciiDoc context as payload render inputs", () => {
    const base = documentPayload();
    const baseSignature = documentPayloadRenderSignature(base);

    expect(
      documentPayloadRenderSignature(
        documentPayload({ updatedAt: "2026-02-01T00:00:00.000Z" }),
      ),
    ).toBe(baseSignature);
    expect(
      documentPayloadRenderSignature(
        documentPayload({ source: `${base.source}\n== Added\n` }),
      ),
    ).not.toBe(baseSignature);
    expect(
      documentPayloadRenderSignature(
        documentPayload({ path: "/workspace/docs/other.adoc" }),
      ),
    ).not.toBe(baseSignature);
    expect(
      documentPayloadRenderSignature(
        documentPayload({ format: "markdown", source: "# Sample\n" }),
      ),
    ).not.toBe(baseSignature);
    expect(
      documentPayloadRenderSignature(
        documentPayload({
          asciidocContext: {
            ...base.asciidocContext!,
            attributes: { icons: "font", sectnums: "" },
          },
        }),
      ),
    ).not.toBe(baseSignature);
  });

  it("sorts diagram confirmation sets so insertion order does not affect dependencies", () => {
    expect(documentRenderSetSignature(new Set(["b", "a", "c"]))).toBe(
      documentRenderSetSignature(new Set(["c", "b", "a"])),
    );
    expect(documentRenderSetSignature(new Set(["a", "b", "d"]))).not.toBe(
      documentRenderSetSignature(new Set(["a", "b", "c"])),
    );
  });
});
