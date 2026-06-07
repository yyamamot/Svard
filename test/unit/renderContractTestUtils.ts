import Asciidoctor from "@asciidoctor/core";

import { expandAsciiDocIncludes } from "../../src/core/asciidocInclude";
import {
  extractHeadings,
  extractSourceBlocks,
} from "../../src/core/asciidocSourceMap";
import {
  detectDiagramDiagnostics,
  extractDiagramSlots,
  extractGraphvizDiagrams,
  extractKrokiDiagrams,
  extractMermaidDiagrams,
  extractPlantUmlDiagrams,
  replaceDiagramBlocksWithPlaceholders,
} from "../../src/core/extractDiagrams";
import { renderMarkdownCore } from "../../src/core/renderMarkdownCore";
import type {
  AsciiDocIncludeFile,
  DocumentLinkResolution,
  DocumentPayload,
  LocalImageResult,
  RenderResult,
  SecurityConfig,
} from "../../src/core/types";
import { prepareDocumentHtml } from "../../src/ui/lib/documentHtml";
import { unwrapSafeHtml } from "../../src/ui/lib/sanitizeHtml";

const asciidoctor = Asciidoctor();

export const renderContractSecurity = {
  security: {
    allowLocalImages: true,
    confirmExternalLinks: true,
    showExternalImages: false,
  } satisfies Pick<
    SecurityConfig,
    "allowLocalImages" | "confirmExternalLinks" | "showExternalImages"
  >,
};

export function svgImageResult(label: string): LocalImageResult {
  return {
    status: "resolved",
    mediaType: "image/svg+xml",
    encoding: "utf8",
    content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 24"><text>${label}</text></svg>`,
  };
}

export function blockedImageResult(message = "Local image is not available.") {
  return {
    status: "blocked" as const,
    placeholderText: message,
  };
}

export function parseHtml(html: string) {
  return new DOMParser().parseFromString(html, "text/html");
}

export interface RenderAsciiDocContractInput {
  source: string;
  documentPath?: string;
  documentDir?: string;
  baseDir?: string;
  workspaceRoot?: string;
  includeFiles?: AsciiDocIncludeFile[];
  attributes?: Record<string, string | boolean>;
  contextAttributes?: Record<string, string>;
  resourceRoots?: string[];
  resolveLocalImage?: (
    path: string,
    documentPath: string,
    context: DocumentPayload["asciidocContext"],
  ) => Promise<LocalImageResult> | LocalImageResult;
}

export async function renderAsciiDocContract({
  source,
  documentPath = "/workspace/docs/contract.adoc",
  documentDir = "/workspace/docs",
  baseDir = documentDir,
  workspaceRoot = "/workspace",
  includeFiles = [],
  attributes = {},
  contextAttributes = {},
  resourceRoots = [workspaceRoot, documentDir],
  resolveLocalImage,
}: RenderAsciiDocContractInput) {
  const expanded = expandAsciiDocIncludes(source, documentPath, includeFiles);
  const renderSource = replaceDiagramBlocksWithPlaceholders(expanded.source);
  const html = asciidoctor.convert(renderSource, {
    base_dir: baseDir,
    safe: "safe",
    sourcemap: true,
    attributes: {
      showtitle: true,
      icons: "font",
      ...attributes,
    },
  }) as string;
  const renderResult: RenderResult = {
    html,
    headings: extractHeadings(html, expanded.source, expanded.lineOrigins),
    sourceBlocks: extractSourceBlocks(expanded.source, expanded.lineOrigins),
    diagnostics: [
      ...expanded.diagnostics,
      ...detectDiagramDiagnostics(expanded.source, expanded.lineOrigins),
    ],
    diagramSlots: extractDiagramSlots(expanded.source, expanded.lineOrigins),
    mermaidDiagrams: extractMermaidDiagrams(
      expanded.source,
      expanded.lineOrigins,
    ),
    plantUmlDiagrams: extractPlantUmlDiagrams(
      expanded.source,
      expanded.lineOrigins,
    ),
    graphvizDiagrams: extractGraphvizDiagrams(
      expanded.source,
      expanded.lineOrigins,
    ),
    krokiDiagrams: extractKrokiDiagrams(expanded.source, expanded.lineOrigins),
  };
  const document: DocumentPayload = {
    path: documentPath,
    basePath: documentDir,
    format: "asciidoc",
    source: expanded.source,
    updatedAt: "2026-06-04T00:00:00.000Z",
    includeFiles,
    asciidocContext: {
      baseDir,
      workspaceRoot,
      documentDir,
      attributes: contextAttributes,
      resourceRoots,
    },
  };
  const preparedHtml = await prepareDocumentHtml(
    html,
    document,
    renderContractSecurity,
    renderResult,
    {
      resolveLocalImage: resolveLocalImage
        ? async (path, docPath, context) =>
            resolveLocalImage(path, docPath, context)
        : undefined,
    },
  );

  return {
    document,
    expanded,
    html,
    preparedHtml: unwrapSafeHtml(preparedHtml),
    renderResult,
    doc: parseHtml(unwrapSafeHtml(preparedHtml)),
  };
}

export interface RenderMarkdownContractInput {
  source: string;
  documentPath?: string;
  documentDir?: string;
  resolveLocalImage?: (
    path: string,
    documentPath: string,
    context: DocumentPayload["asciidocContext"],
  ) => Promise<LocalImageResult> | LocalImageResult;
  resolveDocumentLink?: (
    href: string,
    documentPath: string,
    options?: { kind?: "local" | "wikilink"; target?: string; label?: string },
  ) => Promise<DocumentLinkResolution>;
}

export async function renderMarkdownContract({
  source,
  documentPath = "/workspace/docs/contract.md",
  documentDir = "/workspace/docs",
  resolveLocalImage,
  resolveDocumentLink,
}: RenderMarkdownContractInput) {
  const renderResult = renderMarkdownCore(source);
  const document: DocumentPayload = {
    path: documentPath,
    basePath: documentDir,
    format: "markdown",
    source,
    updatedAt: "2026-06-04T00:00:00.000Z",
  };
  const preparedHtml = await prepareDocumentHtml(
    renderResult.html,
    document,
    renderContractSecurity,
    renderResult,
    {
      resolveLocalImage: resolveLocalImage
        ? async (path, docPath, context) =>
            resolveLocalImage(path, docPath, context)
        : undefined,
      resolveDocumentLink,
    },
  );

  return {
    document,
    preparedHtml: unwrapSafeHtml(preparedHtml),
    renderResult,
    doc: parseHtml(unwrapSafeHtml(preparedHtml)),
  };
}
