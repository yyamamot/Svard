import type {
  DiagramSlot,
  DocumentPayload,
  GraphvizDiagram,
  GraphvizRenderResult,
  KrokiDiagram,
  KrokiResult,
  MermaidDiagram,
  PlantUmlDiagram,
  PlantUmlRenderResult,
  RenderResult,
  SourceLocation,
} from "../../core/types";

export type DiagramInspectorRenderPath =
  | "local"
  | "kroki-fallback"
  | "disabled";

export type DiagramInspectorStatus =
  | "pending"
  | "rendered"
  | "error"
  | "timeout"
  | "disabled";

export interface DiagramRenderSnapshot {
  graphvizDiagrams: Array<
    GraphvizDiagram & {
      result?: GraphvizRenderResult;
      fallbackResult?: KrokiResult;
    }
  >;
  krokiDiagrams: Array<KrokiDiagram & { result?: KrokiResult }>;
  mermaidDiagrams: Array<MermaidDiagram & { svg?: string; error?: string }>;
  plantUmlDiagrams: Array<
    PlantUmlDiagram & {
      result?: PlantUmlRenderResult;
      fallbackResult?: KrokiResult;
    }
  >;
}

export interface DiagramInspectorItem {
  id: string;
  renderer: DiagramSlot["renderer"];
  diagramType: string;
  sourceLocation?: SourceLocation;
  sourceReference?: string;
  source?: string;
  renderPath: DiagramInspectorRenderPath;
  status: DiagramInspectorStatus;
  message?: string;
  svg?: string;
  metrics?: Record<string, number | string>;
  cacheStatus?: string;
}

export function buildDiagramInspectorItems({
  document,
  renderResult,
  renderSnapshot,
}: {
  document: DocumentPayload | null;
  renderResult: RenderResult | null;
  renderSnapshot: DiagramRenderSnapshot | null;
}): DiagramInspectorItem[] {
  if (!renderResult) {
    return [];
  }
  return renderResult.diagramSlots.map((slot) =>
    buildDiagramInspectorItem({ document, renderResult, renderSnapshot, slot }),
  );
}

function buildDiagramInspectorItem({
  document,
  renderResult,
  renderSnapshot,
  slot,
}: {
  document: DocumentPayload | null;
  renderResult: RenderResult;
  renderSnapshot: DiagramRenderSnapshot | null;
  slot: DiagramSlot;
}): DiagramInspectorItem {
  const base = {
    id: slot.id,
    renderer: slot.renderer,
    diagramType: slot.diagramType,
    sourceLocation: slot.sourceLocation,
    sourceReference: sourceReference(document, slot.sourceLocation),
  };
  if (!renderSnapshot) {
    return {
      ...base,
      source: diagramSource(renderResult, slot),
      renderPath: "local",
      status: "pending",
    };
  }

  if (slot.renderer === "mermaid") {
    const diagram = renderSnapshot.mermaidDiagrams.find(
      (item) => item.id === slot.id,
    );
    return {
      ...base,
      source: diagram?.source ?? diagramSource(renderResult, slot),
      renderPath: "local",
      status: diagram?.svg ? "rendered" : "error",
      message: diagram?.error,
      svg: diagram?.svg,
    };
  }

  if (slot.renderer === "kroki") {
    const diagram = renderSnapshot.krokiDiagrams.find(
      (item) => item.id === slot.id,
    );
    const result = diagram?.result;
    const svg =
      result?.status === "rendered" && result.mediaType === "image/svg+xml"
        ? result.content
        : undefined;
    return {
      ...base,
      source: diagram?.source ?? diagramSource(renderResult, slot),
      renderPath: result?.status === "disabled" ? "disabled" : "kroki-fallback",
      status: krokiStatus(result),
      message: result?.message,
      svg,
      cacheStatus: result?.cacheStatus,
      metrics: result?.cacheStatus
        ? { cacheStatus: result.cacheStatus }
        : undefined,
    };
  }

  if (slot.renderer === "plantuml") {
    const diagram = renderSnapshot.plantUmlDiagrams.find(
      (item) => item.id === slot.id,
    );
    return localDiagramItem({
      ...base,
      source: diagram?.source ?? diagramSource(renderResult, slot),
      localResult: diagram?.result,
      fallbackResult: diagram?.fallbackResult,
    });
  }

  const diagram = renderSnapshot.graphvizDiagrams.find(
    (item) => item.id === slot.id,
  );
  return localDiagramItem({
    ...base,
    source: diagram?.source ?? diagramSource(renderResult, slot),
    localResult: diagram?.result,
    fallbackResult: diagram?.fallbackResult,
  });
}

function localDiagramItem(input: {
  id: string;
  renderer: DiagramSlot["renderer"];
  diagramType: string;
  sourceLocation?: SourceLocation;
  sourceReference?: string;
  source?: string;
  localResult?: PlantUmlRenderResult | GraphvizRenderResult;
  fallbackResult?: KrokiResult;
}): DiagramInspectorItem {
  const fallbackSvg =
    input.fallbackResult?.status === "rendered" &&
    input.fallbackResult.mediaType === "image/svg+xml"
      ? input.fallbackResult.content
      : undefined;
  const localSvg =
    input.localResult?.status === "rendered"
      ? input.localResult.svg
      : undefined;
  const renderPath = input.fallbackResult
    ? "kroki-fallback"
    : input.localResult
      ? "local"
      : "disabled";
  const status = fallbackSvg
    ? "rendered"
    : input.fallbackResult
      ? krokiStatus(input.fallbackResult)
      : input.localResult
        ? localStatus(input.localResult)
        : "disabled";
  const message =
    input.fallbackResult?.message ??
    input.localResult?.diagnostics.find(Boolean) ??
    undefined;
  const localMetrics = input.localResult?.metrics;
  const metrics = localMetrics
    ? compactMetrics(localMetrics)
    : input.fallbackResult?.cacheStatus
      ? { cacheStatus: input.fallbackResult.cacheStatus }
      : undefined;

  return {
    id: input.id,
    renderer: input.renderer,
    diagramType: input.diagramType,
    sourceLocation: input.sourceLocation,
    sourceReference: input.sourceReference,
    source: input.source,
    renderPath,
    status,
    message,
    svg: localSvg ?? fallbackSvg,
    metrics,
    cacheStatus:
      metricCacheStatus(localMetrics) ?? input.fallbackResult?.cacheStatus,
  };
}

function compactMetrics(
  metrics: Record<string, unknown>,
): Record<string, number | string> {
  const entries = Object.entries(metrics).filter(
    (entry): entry is [string, number | string] =>
      typeof entry[1] === "number" || typeof entry[1] === "string",
  );
  return Object.fromEntries(entries);
}

function metricCacheStatus(
  metrics: Record<string, unknown> | undefined,
): string | undefined {
  return typeof metrics?.cacheStatus === "string"
    ? metrics.cacheStatus
    : undefined;
}

function krokiStatus(result?: KrokiResult): DiagramInspectorStatus {
  if (!result) {
    return "pending";
  }
  if (result.status === "disabled") {
    return "disabled";
  }
  if (result.status === "rendered") {
    return "rendered";
  }
  return "error";
}

function localStatus(
  result: PlantUmlRenderResult | GraphvizRenderResult,
): DiagramInspectorStatus {
  if (result.status === "timeout") {
    return "timeout";
  }
  if (result.status === "rendered") {
    return "rendered";
  }
  return "error";
}

function diagramSource(
  renderResult: RenderResult,
  slot: DiagramSlot,
): string | undefined {
  if (slot.renderer === "mermaid") {
    return renderResult.mermaidDiagrams.find((item) => item.id === slot.id)
      ?.source;
  }
  if (slot.renderer === "plantuml") {
    return renderResult.plantUmlDiagrams.find((item) => item.id === slot.id)
      ?.source;
  }
  if (slot.renderer === "graphviz") {
    return renderResult.graphvizDiagrams.find((item) => item.id === slot.id)
      ?.source;
  }
  return renderResult.krokiDiagrams.find((item) => item.id === slot.id)?.source;
}

function sourceReference(
  document: DocumentPayload | null,
  sourceLocation?: SourceLocation,
): string | undefined {
  if (!sourceLocation?.line) {
    return undefined;
  }
  return `${sourceLocation.sourcePath ?? document?.path ?? "document"}:${sourceLocation.line}`;
}
