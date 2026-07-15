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
  GitDiffResourceSource,
} from "../../../core/types";
import { applyInlineDiagramsToHtml } from "../diagramHtml";
import { prepareDocumentHtml } from "../documentHtml";
import {
  perfDuration,
  perfNow,
  perfTraceEnabled,
  tracePerf,
} from "../perfTrace";
import { extractRenderedBlocksFromHtml } from "./extraction";
import { compareRenderedBlocks } from "./matching";
import type {
  GitRenderedDiffSummary,
  GitRenderedDiffSummaryOptions,
  RenderedBlock,
} from "./types";

interface DiffSidePhaseMetrics {
  workflowStartedAt: number;
  // Repeated phase calls use a first-start to last-end bounding interval.
  renderCount: number;
  renderDurationMs: number;
  renderStartOffsetMs: number | null;
  renderEndOffsetMs: number | null;
  prepareCount: number;
  prepareDurationMs: number;
  prepareStartOffsetMs: number | null;
  prepareEndOffsetMs: number | null;
  blockParseCount: number;
  blockParseDurationMs: number;
  blockParseStartOffsetMs: number | null;
  blockParseEndOffsetMs: number | null;
}

interface DiffArtifactPerfMetrics {
  owner: NonNullable<GitRenderedDiffSummaryOptions["perfOwner"]>;
  perfEntryIndex: number;
  format: DocumentFormat;
  startedAt: number;
  left: DiffSidePhaseMetrics;
  right: DiffSidePhaseMetrics;
}

function phaseOffsetMs(workflowStartedAt: number, timestamp: number): number {
  return Number((timestamp - workflowStartedAt).toFixed(2));
}

function phaseDurationMs(startedAt: number, endedAt: number): number {
  return Number((endedAt - startedAt).toFixed(2));
}

function emptySidePhaseMetrics(
  workflowStartedAt: number,
): DiffSidePhaseMetrics {
  return {
    workflowStartedAt,
    renderCount: 0,
    renderDurationMs: 0,
    renderStartOffsetMs: null,
    renderEndOffsetMs: null,
    prepareCount: 0,
    prepareDurationMs: 0,
    prepareStartOffsetMs: null,
    prepareEndOffsetMs: null,
    blockParseCount: 0,
    blockParseDurationMs: 0,
    blockParseStartOffsetMs: null,
    blockParseEndOffsetMs: null,
  };
}

function measureRenderPhase<T>(
  metrics: DiffSidePhaseMetrics | null,
  operation: () => Promise<T>,
): Promise<T> {
  if (!metrics) {
    return operation();
  }
  metrics.renderCount += 1;
  const startedAt = perfNow();
  metrics.renderStartOffsetMs ??= phaseOffsetMs(
    metrics.workflowStartedAt,
    startedAt,
  );
  const finish = () => {
    const endedAt = perfNow();
    metrics.renderDurationMs += phaseDurationMs(startedAt, endedAt);
    metrics.renderEndOffsetMs = phaseOffsetMs(
      metrics.workflowStartedAt,
      endedAt,
    );
  };
  try {
    return operation().finally(finish);
  } catch (error) {
    finish();
    throw error;
  }
}

function measurePreparePhase<T>(
  metrics: DiffSidePhaseMetrics | null,
  operation: () => Promise<T>,
): Promise<T> {
  if (!metrics) {
    return operation();
  }
  metrics.prepareCount += 1;
  const startedAt = perfNow();
  metrics.prepareStartOffsetMs ??= phaseOffsetMs(
    metrics.workflowStartedAt,
    startedAt,
  );
  const finish = () => {
    const endedAt = perfNow();
    metrics.prepareDurationMs += phaseDurationMs(startedAt, endedAt);
    metrics.prepareEndOffsetMs = phaseOffsetMs(
      metrics.workflowStartedAt,
      endedAt,
    );
  };
  try {
    return operation().finally(finish);
  } catch (error) {
    finish();
    throw error;
  }
}

function measureBlockParsePhase<T>(
  metrics: DiffSidePhaseMetrics | null,
  operation: () => T,
): T {
  if (!metrics) {
    return operation();
  }
  metrics.blockParseCount += 1;
  const startedAt = perfNow();
  metrics.blockParseStartOffsetMs ??= phaseOffsetMs(
    metrics.workflowStartedAt,
    startedAt,
  );
  try {
    return operation();
  } finally {
    const endedAt = perfNow();
    metrics.blockParseDurationMs += phaseDurationMs(startedAt, endedAt);
    metrics.blockParseEndOffsetMs = phaseOffsetMs(
      metrics.workflowStartedAt,
      endedAt,
    );
  }
}

function traceDiffArtifactReady(
  metrics: DiffArtifactPerfMetrics | null,
  outcome: "ready" | "empty" | "fallback",
  leftBlockCount: number,
  rightBlockCount: number,
  outputBlockCount: number,
): void {
  if (!metrics) {
    return;
  }
  tracePerf("diff-artifact-ready", {
    owner: metrics.owner,
    perfEntryIndex: metrics.perfEntryIndex,
    format: metrics.format,
    outcome,
    leftRenderCount: metrics.left.renderCount,
    leftRenderDurationMs: metrics.left.renderDurationMs,
    leftRenderStartOffsetMs: metrics.left.renderStartOffsetMs,
    leftRenderEndOffsetMs: metrics.left.renderEndOffsetMs,
    rightRenderCount: metrics.right.renderCount,
    rightRenderDurationMs: metrics.right.renderDurationMs,
    rightRenderStartOffsetMs: metrics.right.renderStartOffsetMs,
    rightRenderEndOffsetMs: metrics.right.renderEndOffsetMs,
    leftPrepareCount: metrics.left.prepareCount,
    leftPrepareDurationMs: metrics.left.prepareDurationMs,
    leftPrepareStartOffsetMs: metrics.left.prepareStartOffsetMs,
    leftPrepareEndOffsetMs: metrics.left.prepareEndOffsetMs,
    rightPrepareCount: metrics.right.prepareCount,
    rightPrepareDurationMs: metrics.right.prepareDurationMs,
    rightPrepareStartOffsetMs: metrics.right.prepareStartOffsetMs,
    rightPrepareEndOffsetMs: metrics.right.prepareEndOffsetMs,
    leftBlockParseCount: metrics.left.blockParseCount,
    leftBlockParseDurationMs: metrics.left.blockParseDurationMs,
    leftBlockParseStartOffsetMs: metrics.left.blockParseStartOffsetMs,
    leftBlockParseEndOffsetMs: metrics.left.blockParseEndOffsetMs,
    rightBlockParseCount: metrics.right.blockParseCount,
    rightBlockParseDurationMs: metrics.right.blockParseDurationMs,
    rightBlockParseStartOffsetMs: metrics.right.blockParseStartOffsetMs,
    rightBlockParseEndOffsetMs: metrics.right.blockParseEndOffsetMs,
    leftBlockCount,
    rightBlockCount,
    outputBlockCount,
    totalDurationMs: perfDuration(metrics.startedAt),
  });
}

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
  resourceContext?: {
    repositoryRoot: string;
    source: GitDiffResourceSource;
  } | null,
  phaseMetrics: DiffSidePhaseMetrics | null = null,
): Promise<RenderedBlock[]> {
  if (!source) {
    return [];
  }
  const documentContext =
    documentPath && options.loadDocumentContext
      ? await loadDiffDocumentContext(documentPath, options)
      : null;
  const result = await measureRenderPhase(phaseMetrics, () =>
    renderDocument({
      format,
      source,
      path: documentPath ?? undefined,
      includeFiles: documentContext?.includeFiles,
      resourceContext: documentContext?.resourceContext,
      asciidocContext: documentContext?.asciidocContext,
    }),
  );
  const diagramSignatures = diagramSignaturesForRenderResult(result);
  const showExternalImages = (options.config ?? defaultConfig).security
    .showExternalImages;
  if (!documentPath) {
    return measureBlockParsePhase(phaseMetrics, () =>
      extractRenderedBlocksFromHtml(result.html, {
        diagramSignatures,
        showExternalImages,
      }),
    );
  }
  const document: DocumentPayload = {
    path: documentPath,
    basePath: documentPath,
    format,
    source,
    updatedAt: "",
    includeFiles: documentContext?.includeFiles,
    resourceContext: documentContext?.resourceContext,
    asciidocContext: documentContext?.asciidocContext,
  };
  const htmlWithDiagrams = await renderDiffDocumentHtml({
    document,
    result,
    options,
    resourceContext,
    phaseMetrics,
  });
  return measureBlockParsePhase(phaseMetrics, () =>
    extractRenderedBlocksFromHtml(htmlWithDiagrams, {
      diagramSignatures,
      showExternalImages,
    }),
  );
}

async function loadDiffDocumentContext(
  documentPath: string,
  options: GitRenderedDiffSummaryOptions,
): Promise<Pick<
  DocumentPayload,
  "includeFiles" | "resourceContext" | "asciidocContext"
> | null> {
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
  resourceContext,
  phaseMetrics,
}: {
  document: DocumentPayload;
  result: RenderResult;
  options: GitRenderedDiffSummaryOptions;
  resourceContext?: {
    repositoryRoot: string;
    source: GitDiffResourceSource;
  } | null;
  phaseMetrics: DiffSidePhaseMetrics | null;
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
  const resolveLocalImage = options.resolveLocalImage;

  const html = await measurePreparePhase(phaseMetrics, () =>
    prepareDocumentHtml(
      result.html,
      document,
      diffPreparationConfig,
      result,
      resolveLocalImage
        ? {
            resolveLocalImage: (source, documentPath, context) =>
              resolveGitRenderedDiffLocalImage(
                resolveLocalImage,
                source,
                documentPath,
                context,
                resourceContext,
              ),
          }
        : {},
    ),
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

export function resolveGitRenderedDiffLocalImage(
  resolver: NonNullable<GitRenderedDiffSummaryOptions["resolveLocalImage"]>,
  source: string,
  documentPath: string,
  context: Parameters<
    NonNullable<GitRenderedDiffSummaryOptions["resolveLocalImage"]>
  >[2],
  resourceContext?: {
    repositoryRoot: string;
    source: GitDiffResourceSource;
  } | null,
) {
  return resolver(
    source,
    documentPath,
    context,
    resourceContext?.repositoryRoot,
    resourceContext?.source,
  );
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

  const mermaidPromise = renderMermaidDiagrams(
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

  const localGraphvizResultsPromise =
    config.diagram.graphvizRenderer === "local"
      ? renderGraphvizDiagrams(result.graphvizDiagrams, {
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
  const localPlantUmlResultsPromise =
    config.diagram.plantumlRenderer === "local"
      ? renderPlantUmlDiagrams(result.plantUmlDiagrams, {
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
  const [mermaid, localGraphvizResults, localPlantUmlResults] =
    await Promise.all([
      mermaidPromise,
      localGraphvizResultsPromise,
      localPlantUmlResultsPromise,
    ]);
  const localGraphvizById = new Map(
    localGraphvizResults.map((item) => [item.id, item.result]),
  );
  const localPlantUmlById = new Map(
    localPlantUmlResults.map((item) => [item.id, item.result]),
  );
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
        result: localGraphvizById.get(diagram.id),
        fallbackResult,
      };
    }),
  );

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
        result: localPlantUmlById.get(diagram.id),
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
  let perfMetrics: DiffArtifactPerfMetrics | null = null;
  if (options.perfOwner && perfTraceEnabled()) {
    const startedAt = perfNow();
    perfMetrics = {
      owner: options.perfOwner,
      perfEntryIndex: options.perfEntryIndex ?? -1,
      format,
      startedAt,
      left: emptySidePhaseMetrics(startedAt),
      right: emptySidePhaseMetrics(startedAt),
    };
  }
  try {
    const fallbackPath =
      preview.relativePath ??
      `diff-preview.${format === "markdown" ? "md" : "adoc"}`;
    const leftPath = diffPreviewDocumentPath(preview, "left") ?? fallbackPath;
    const rightPath = diffPreviewDocumentPath(preview, "right") ?? fallbackPath;
    const leftResourceContext = diffPreviewResourceContext(preview, "left");
    const rightResourceContext = diffPreviewResourceContext(preview, "right");
    const leftBlocksPromise = renderBlocksFromSource(
      preview.leftText,
      format,
      leftPath,
      options,
      leftResourceContext,
      perfMetrics?.left ?? null,
    );
    const rightBlocksPromise = renderBlocksFromSource(
      preview.rightText,
      format,
      rightPath,
      options,
      rightResourceContext,
      perfMetrics?.right ?? null,
    );
    let leftBlocks: RenderedBlock[];
    let rightBlocks: RenderedBlock[];
    if (perfMetrics) {
      const [leftResult, rightResult] = await Promise.allSettled([
        leftBlocksPromise,
        rightBlocksPromise,
      ]);
      if (
        leftResult.status === "rejected" ||
        rightResult.status === "rejected"
      ) {
        traceDiffArtifactReady(perfMetrics, "fallback", 0, 0, 0);
        return {
          blocks: [],
          fallbackMessage:
            "Rendered document diff is not available. Use Source view.",
        };
      }
      leftBlocks = leftResult.value;
      rightBlocks = rightResult.value;
    } else {
      [leftBlocks, rightBlocks] = await Promise.all([
        leftBlocksPromise,
        rightBlocksPromise,
      ]);
    }
    const blocks = compareRenderedBlocks(leftBlocks, rightBlocks);
    traceDiffArtifactReady(
      perfMetrics,
      leftBlocks.length === 0 && rightBlocks.length === 0 ? "empty" : "ready",
      leftBlocks.length,
      rightBlocks.length,
      blocks.length,
    );
    return {
      blocks,
      fallbackMessage:
        leftBlocks.length === 0 && rightBlocks.length === 0
          ? "No rendered document preview is available."
          : undefined,
    };
  } catch {
    traceDiffArtifactReady(perfMetrics, "fallback", 0, 0, 0);
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
    (side === "left" ? preview.leftRelativePath : preview.rightRelativePath) ??
      preview.relativePath,
  );
}

function diffPreviewResourceContext(
  preview: DocumentDiffPreview,
  side: "left" | "right",
): { repositoryRoot: string; source: GitDiffResourceSource } | null {
  const source =
    side === "left" ? preview.leftResourceSource : preview.rightResourceSource;
  return preview.repositoryRoot && source
    ? { repositoryRoot: preview.repositoryRoot, source }
    : null;
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
