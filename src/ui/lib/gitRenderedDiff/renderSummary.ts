import { documentFormatForPath } from "../../../core/documentFormat";
import { defaultConfig } from "../../../core/defaultConfig";
import { renderGraphvizDiagrams } from "../../../core/renderGraphviz";
import { renderMermaidDiagrams } from "../../../core/renderMermaid";
import {
  normalizePlantUmlRenderSource,
  renderPlantUmlDiagrams,
} from "../../../core/renderPlantUml";
import { renderDocument } from "../../../core/renderDocument";
import type {
  DocumentDiffPreview,
  DocumentFormat,
  DocumentPayload,
  GraphvizDiagram,
  GraphvizRenderResult,
  KrokiDiagram,
  KrokiResult,
  MermaidDiagram,
  PlantUmlDiagram,
  PlantUmlRenderResult,
  RenderResult,
} from "../../../core/types";
import { applyInlineDiagramsToHtml } from "../diagramHtml";
import { prepareDocumentHtml } from "../documentHtml";
import { extractRenderedBlocksFromHtml } from "./extraction";
import { compareRenderedBlocks } from "./matching";
import type {
  GitRenderedDiffSummary,
  GitRenderedDiffSummaryOptions,
  RenderedBlock,
} from "./types";

function normalizedDiagramSource(value: string): string {
  return value.replace(/\r\n?/gu, "\n").trim();
}

function diagramSignature({
  renderer,
  diagramType,
  source,
}: {
  renderer: string;
  diagramType: string;
  source: string;
}): string | null {
  const normalizedSource = normalizedDiagramSource(source);
  if (!normalizedSource) {
    return null;
  }
  return `diagram:${renderer}:${diagramType}:${normalizedSource}`;
}

function diagramSignaturesForRenderResult(
  result: RenderResult,
): ReadonlyMap<string, string> {
  const signatures = new Map<string, string>();
  const setSignature = (
    id: string,
    input: { renderer: string; diagramType: string; source: string },
  ) => {
    const signature = diagramSignature(input);
    if (signature) {
      signatures.set(id, signature);
    }
  };

  for (const diagram of result.mermaidDiagrams) {
    setSignature(diagram.id, {
      renderer: "mermaid",
      diagramType: "mermaid",
      source: diagram.source,
    });
  }
  for (const diagram of result.plantUmlDiagrams) {
    setSignature(diagram.id, {
      renderer: "plantuml",
      diagramType: "plantuml",
      source: diagram.source,
    });
  }
  for (const diagram of result.graphvizDiagrams) {
    setSignature(diagram.id, {
      renderer: "graphviz",
      diagramType: diagram.diagramType,
      source: diagram.source,
    });
  }
  for (const diagram of result.krokiDiagrams) {
    setSignature(diagram.id, {
      renderer: "kroki",
      diagramType: diagram.diagramType,
      source: diagram.source,
    });
  }

  return signatures;
}

async function renderBlocksFromSource(
  source: string | null | undefined,
  format: DocumentFormat,
  documentPath: string | null,
  options: GitRenderedDiffSummaryOptions,
): Promise<RenderedBlock[]> {
  if (!source) {
    return [];
  }
  const documentContext =
    documentPath && format === "asciidoc" && options.loadDocumentContext
      ? await loadDiffDocumentContext(documentPath, options)
      : null;
  const result = await renderDocument({
    format,
    source,
    path: documentPath ?? undefined,
    includeFiles: documentContext?.includeFiles,
    asciidocContext: documentContext?.asciidocContext,
  });
  const diagramSignatures = diagramSignaturesForRenderResult(result);
  const showExternalImages = (options.config ?? defaultConfig).security
    .showExternalImages;
  if (!documentPath) {
    return extractRenderedBlocksFromHtml(result.html, {
      diagramSignatures,
      showExternalImages,
    });
  }
  const document: DocumentPayload = {
    path: documentPath,
    basePath: documentPath,
    format,
    source,
    updatedAt: "",
    includeFiles: documentContext?.includeFiles,
    asciidocContext: documentContext?.asciidocContext,
  };
  const htmlWithDiagrams = await renderDiffDocumentHtml({
    document,
    result,
    options,
  });
  return extractRenderedBlocksFromHtml(htmlWithDiagrams, {
    diagramSignatures,
    showExternalImages,
  });
}

async function loadDiffDocumentContext(
  documentPath: string,
  options: GitRenderedDiffSummaryOptions,
): Promise<Pick<DocumentPayload, "includeFiles" | "asciidocContext"> | null> {
  try {
    return (await options.loadDocumentContext?.(documentPath)) ?? null;
  } catch {
    return null;
  }
}

async function renderDiffDocumentHtml({
  document,
  result,
  options,
}: {
  document: DocumentPayload;
  result: RenderResult;
  options: GitRenderedDiffSummaryOptions;
}): Promise<string> {
  const effectiveConfig = options.config ?? defaultConfig;
  // Keep external image src in the in-memory diff HTML so signature comparison
  // can detect URL changes. extractRenderedBlocksFromHtml() still applies the
  // user-facing display policy before any diff HTML reaches the UI.
  const diffPreparationConfig =
    effectiveConfig.security.showExternalImages === true
      ? effectiveConfig
      : {
          ...effectiveConfig,
          security: {
            ...effectiveConfig.security,
            showExternalImages: true,
          },
        };

  const html = await prepareDocumentHtml(
    result.html,
    document,
    diffPreparationConfig,
    result,
    options.resolveLocalImage
      ? { resolveLocalImage: options.resolveLocalImage }
      : {},
  );
  const renderedDiagrams = await renderDiffDiagrams({
    document,
    result,
    options,
  });
  return applyInlineDiagramsToHtml({
    html,
    document,
    slots: result.diagramSlots,
    mermaidDiagrams: renderedDiagrams.mermaid,
    plantUmlDiagrams: renderedDiagrams.plantUml,
    graphvizDiagrams: renderedDiagrams.graphviz,
    krokiDiagrams: renderedDiagrams.kroki,
    krokiMode: effectiveConfig.kroki.mode,
  });
}

async function renderDiffDiagrams({
  document,
  result,
  options,
}: {
  document: DocumentPayload;
  result: RenderResult;
  options: GitRenderedDiffSummaryOptions;
}): Promise<{
  mermaid: Array<MermaidDiagram & { svg?: string; error?: string }>;
  plantUml: Array<
    PlantUmlDiagram & {
      result?: PlantUmlRenderResult;
      fallbackResult?: KrokiResult;
    }
  >;
  graphviz: Array<
    GraphvizDiagram & {
      result?: GraphvizRenderResult;
      fallbackResult?: KrokiResult;
    }
  >;
  kroki: Array<KrokiDiagram & { result?: KrokiResult }>;
}> {
  const config = options.config ?? defaultConfig;
  const confirmedRemoteDiagramKeys =
    options.confirmedRemoteDiagramKeys ?? new Set<string>();
  const krokiFallbackDiagramKeys =
    options.krokiFallbackDiagramKeys ?? new Set<string>();
  const diagramKey = (renderer: string, id: string) =>
    `${document.path}::${renderer}:${id}`;
  const renderKrokiDiagram = async (
    diagramType: string,
    source: string,
    key: string,
  ) =>
    options.renderDiagram?.({
      diagramType,
      source,
      config: config.kroki,
      confirmedRemoteSend: confirmedRemoteDiagramKeys.has(key),
    });

  const mermaid = await renderMermaidDiagrams(
    result.mermaidDiagrams,
    config.theme,
  )
    .then((rendered) =>
      rendered.map((diagram) => ({
        ...result.mermaidDiagrams.find((item) => item.id === diagram.id)!,
        svg: diagram.svg,
      })),
    )
    .catch((error) =>
      result.mermaidDiagrams.map((diagram) => ({
        ...diagram,
        error: error instanceof Error ? error.message : "Mermaid render failed",
      })),
    );

  const localGraphvizResults =
    config.diagram.graphvizRenderer === "local"
      ? await renderGraphvizDiagrams(result.graphvizDiagrams, {
          timeoutMs: config.diagram.graphvizTimeoutMs,
        }).catch((error) =>
          result.graphvizDiagrams.map((diagram) => ({
            id: diagram.id,
            result: {
              status: "error" as const,
              diagnostics: [
                error instanceof Error
                  ? error.message
                  : "Graphviz render failed",
              ],
            },
          })),
        )
      : [];
  const graphviz = await Promise.all(
    result.graphvizDiagrams.map(async (diagram) => {
      const key = diagramKey("graphviz", diagram.id);
      const fallbackResult =
        config.diagram.graphvizRenderer === "kroki" ||
        krokiFallbackDiagramKeys.has(key)
          ? await renderKrokiDiagram("graphviz", diagram.source, key)
          : undefined;
      return {
        ...diagram,
        result: localGraphvizResults.find((item) => item.id === diagram.id)
          ?.result,
        fallbackResult,
      };
    }),
  );

  const localPlantUmlResults =
    config.diagram.plantumlRenderer === "local"
      ? await renderPlantUmlDiagrams(result.plantUmlDiagrams, {
          theme: config.theme,
          timeoutMs: config.diagram.plantumlTimeoutMs,
        }).catch((error) =>
          result.plantUmlDiagrams.map((diagram) => ({
            id: diagram.id,
            result: {
              status: "error" as const,
              diagnostics: [
                error instanceof Error
                  ? error.message
                  : "PlantUML render failed",
              ],
            },
          })),
        )
      : [];
  const plantUml = await Promise.all(
    result.plantUmlDiagrams.map(async (diagram) => {
      const key = diagramKey("plantuml", diagram.id);
      const fallbackResult =
        config.diagram.plantumlRenderer === "kroki" ||
        krokiFallbackDiagramKeys.has(key)
          ? await renderKrokiDiagram(
              "plantuml",
              normalizePlantUmlRenderSource(diagram.source),
              key,
            )
          : undefined;
      return {
        ...diagram,
        result: localPlantUmlResults.find((item) => item.id === diagram.id)
          ?.result,
        fallbackResult,
      };
    }),
  );

  const kroki = await Promise.all(
    result.krokiDiagrams.map(async (diagram) => {
      const key = diagramKey("kroki", diagram.id);
      return {
        ...diagram,
        result: await renderKrokiDiagram(
          diagram.diagramType,
          diagram.source,
          key,
        ),
      };
    }),
  );

  return { mermaid, plantUml, graphviz, kroki };
}

export async function deriveGitRenderedDiffSummary(
  preview: DocumentDiffPreview,
  options: GitRenderedDiffSummaryOptions = {},
): Promise<GitRenderedDiffSummary> {
  const format = documentFormatForPath(preview.relativePath ?? "");
  try {
    const fallbackPath =
      preview.relativePath ??
      `diff-preview.${format === "markdown" ? "md" : "adoc"}`;
    const leftPath = diffPreviewDocumentPath(preview, "left") ?? fallbackPath;
    const rightPath = diffPreviewDocumentPath(preview, "right") ?? fallbackPath;
    const [leftBlocks, rightBlocks] = await Promise.all([
      renderBlocksFromSource(preview.leftText, format, leftPath, options),
      renderBlocksFromSource(preview.rightText, format, rightPath, options),
    ]);
    return {
      blocks: compareRenderedBlocks(leftBlocks, rightBlocks),
      fallbackMessage:
        leftBlocks.length === 0 && rightBlocks.length === 0
          ? "No rendered document preview is available."
          : undefined,
    };
  } catch {
    return {
      blocks: [],
      fallbackMessage:
        "Rendered document diff is not available. Use Source view.",
    };
  }
}

function diffPreviewDocumentPath(
  preview: DocumentDiffPreview,
  side: "left" | "right",
): string | null {
  const explicitPath = side === "left" ? preview.leftPath : preview.rightPath;
  if (explicitPath) {
    return explicitPath;
  }
  if (!preview.repositoryRoot || !preview.relativePath) {
    return null;
  }
  return joinRepositoryRelativePath(
    preview.repositoryRoot,
    preview.relativePath,
  );
}

function joinRepositoryRelativePath(
  root: string,
  relativePath: string,
): string {
  const separator = root.includes("\\") && !root.includes("/") ? "\\" : "/";
  const trimmedRoot = root.replace(/[\\/]+$/u, "");
  const trimmedRelative = relativePath.replace(/^[\\/]+/u, "");
  return `${trimmedRoot}${separator}${trimmedRelative}`;
}
