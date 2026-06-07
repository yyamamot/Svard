import type {
  DiagramSlot,
  GraphvizDiagram,
  KrokiDiagram,
  MermaidDiagram,
  PlantUmlDiagram,
  RenderDiagnostic,
} from "../types";
import type { DiagramRenderer, MarkdownDiagramSlot } from "./types";

const krokiDiagramTypes = new Set([
  "blockdiag",
  "seqdiag",
  "actdiag",
  "nwdiag",
  "packetdiag",
  "rackdiag",
  "c4plantuml",
]);

export function rendererForType(type: string): DiagramRenderer | null {
  const normalized = type.toLowerCase();
  if (normalized === "mermaid") {
    return "mermaid";
  }
  if (normalized === "plantuml" || normalized === "puml") {
    return "plantuml";
  }
  if (normalized === "graphviz" || normalized === "dot") {
    return "graphviz";
  }
  if (krokiDiagramTypes.has(normalized)) {
    return "kroki";
  }
  return null;
}

export function normalizeDiagramType(type: string): string {
  return type.toLowerCase() === "puml" ? "plantuml" : type.toLowerCase();
}

export function slotIdForRenderer(
  renderer: DiagramRenderer,
  counters: Record<DiagramRenderer, number>,
): string {
  counters[renderer] += 1;
  return `${renderer}-${counters[renderer]}`;
}

export function diagramPlaceholder(slot: DiagramSlot): string {
  return `<div class="diagram-slot" data-diagram-id="${slot.id}" data-diagram-type="${slot.diagramType}" data-diagram-renderer="${slot.renderer}"></div>`;
}

export function addKrokiDisabledDiagnostic(
  diagnostics: RenderDiagnostic[],
  slot: DiagramSlot,
) {
  if (slot.renderer !== "kroki") {
    return;
  }
  diagnostics.push({
    id: slot.id,
    severity: "info",
    message: `Kroki ${slot.diagramType} diagram is disabled by default.`,
    sourceLocation: slot.sourceLocation,
  });
}

export function buildDiagramResults(
  markdownDiagramSlots: MarkdownDiagramSlot[],
) {
  const mermaidDiagrams: MermaidDiagram[] = markdownDiagramSlots
    .filter((slot) => slot.renderer === "mermaid")
    .map((slot) => ({
      id: slot.id,
      source: slot.source,
      sourceLocation: slot.sourceLocation,
    }));
  const plantUmlDiagrams: PlantUmlDiagram[] = markdownDiagramSlots
    .filter((slot) => slot.renderer === "plantuml")
    .map((slot) => ({
      id: slot.id,
      source: slot.source,
      sourceLocation: slot.sourceLocation,
    }));
  const graphvizDiagrams: GraphvizDiagram[] = markdownDiagramSlots
    .filter((slot) => slot.renderer === "graphviz")
    .map((slot) => ({
      id: slot.id,
      diagramType: slot.diagramType as "graphviz" | "dot",
      source: slot.source,
      sourceLocation: slot.sourceLocation,
    }));
  const krokiDiagrams: KrokiDiagram[] = markdownDiagramSlots
    .filter((slot) => slot.renderer === "kroki")
    .map((slot) => ({
      id: slot.id,
      diagramType: slot.diagramType,
      source: slot.source,
      sourceLocation: slot.sourceLocation,
    }));

  return { mermaidDiagrams, plantUmlDiagrams, graphvizDiagrams, krokiDiagrams };
}
