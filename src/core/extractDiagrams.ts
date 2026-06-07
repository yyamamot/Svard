import type {
  DiagramSlot,
  GraphvizDiagram,
  KrokiDiagram,
  MermaidDiagram,
  PlantUmlDiagram,
  RenderDiagnostic,
  SourceLocation,
} from "./types";
import type { SourceLineOrigin } from "./asciidocInclude";

const krokiDiagramTypes =
  "blockdiag|seqdiag|actdiag|nwdiag|packetdiag|rackdiag|c4plantuml";
const allDiagramTypes = `mermaid|plantuml|graphviz|dot|${krokiDiagramTypes}`;
const diagramTypePattern = new RegExp(`^(?:${allDiagramTypes})$`, "i");

interface AsciiDocDiagramBlock {
  type: string;
  source: string;
  index: number;
}

function sourceLocationAt(
  source: string,
  index: number,
  lineOrigins?: SourceLineOrigin[],
): SourceLocation {
  const prefix = source.slice(0, index);
  const lines = prefix.split("\n");
  const line = lines.length;
  const origin = lineOrigins?.[line - 1];
  return {
    line: origin?.line ?? line,
    column: lines.at(-1)!.length + 1,
    ...(origin?.sourcePath ? { sourcePath: origin.sourcePath } : {}),
  };
}

function diagramTypeFromAttributeList(attributeList: string): string | null {
  const firstAttribute = attributeList.split(",")[0]?.trim().toLowerCase();
  if (!firstAttribute || !diagramTypePattern.test(firstAttribute)) {
    return null;
  }
  return firstAttribute;
}

function diagramBlockPattern(): RegExp {
  return /^\[([^\]\r\n]+)\]\s*\r?\n(----|\.\.\.\.)[ \t]*\r?\n([\s\S]*?)\r?\n\2[ \t]*(?=\r?\n|$)/gim;
}

function extractAsciiDocDiagramBlocks(source: string): AsciiDocDiagramBlock[] {
  const blockPattern = diagramBlockPattern();
  const blocks: AsciiDocDiagramBlock[] = [];
  let match: RegExpExecArray | null;

  while ((match = blockPattern.exec(source)) !== null) {
    const type = diagramTypeFromAttributeList(match[1]);
    if (!type) {
      continue;
    }
    blocks.push({
      type,
      source: match[3].trim(),
      index: match.index,
    });
  }

  return blocks;
}

export function detectDiagramDiagnostics(
  source: string,
  lineOrigins?: SourceLineOrigin[],
): RenderDiagnostic[] {
  const diagnostics: RenderDiagnostic[] = [];

  for (const block of extractAsciiDocDiagramBlocks(source).filter(
    (block) => rendererForType(block.type) === "kroki",
  )) {
    diagnostics.push({
      id: `kroki-${diagnostics.length + 1}`,
      severity: "info",
      message: `Kroki ${block.type} diagram is disabled by default.`,
      sourceLocation: sourceLocationAt(source, block.index, lineOrigins),
    });
  }

  return diagnostics;
}

export function extractMermaidDiagrams(
  source: string,
  lineOrigins?: SourceLineOrigin[],
): MermaidDiagram[] {
  const diagrams: MermaidDiagram[] = [];

  for (const block of extractAsciiDocDiagramBlocks(source).filter(
    (block) => block.type === "mermaid",
  )) {
    diagrams.push({
      id: `mermaid-${diagrams.length + 1}`,
      source: block.source,
      sourceLocation: sourceLocationAt(source, block.index, lineOrigins),
    });
  }

  return diagrams;
}

export function extractPlantUmlDiagrams(
  source: string,
  lineOrigins?: SourceLineOrigin[],
): PlantUmlDiagram[] {
  const diagrams: PlantUmlDiagram[] = [];

  for (const block of extractAsciiDocDiagramBlocks(source).filter(
    (block) => block.type === "plantuml",
  )) {
    diagrams.push({
      id: `plantuml-${diagrams.length + 1}`,
      source: block.source,
      sourceLocation: sourceLocationAt(source, block.index, lineOrigins),
    });
  }

  return diagrams;
}

export function extractGraphvizDiagrams(
  source: string,
  lineOrigins?: SourceLineOrigin[],
): GraphvizDiagram[] {
  const diagrams: GraphvizDiagram[] = [];

  for (const block of extractAsciiDocDiagramBlocks(source).filter(
    (block) => block.type === "graphviz" || block.type === "dot",
  )) {
    diagrams.push({
      id: `graphviz-${diagrams.length + 1}`,
      diagramType: block.type as "graphviz" | "dot",
      source: block.source,
      sourceLocation: sourceLocationAt(source, block.index, lineOrigins),
    });
  }

  return diagrams;
}

export function extractKrokiDiagrams(
  source: string,
  lineOrigins?: SourceLineOrigin[],
): KrokiDiagram[] {
  const diagrams: KrokiDiagram[] = [];

  for (const block of extractAsciiDocDiagramBlocks(source).filter(
    (block) => rendererForType(block.type) === "kroki",
  )) {
    diagrams.push({
      id: `kroki-${diagrams.length + 1}`,
      diagramType: block.type,
      source: block.source,
      sourceLocation: sourceLocationAt(source, block.index, lineOrigins),
    });
  }

  return diagrams;
}

function rendererForType(type: string): DiagramSlot["renderer"] {
  const normalized = type.toLowerCase();
  if (normalized === "mermaid") {
    return "mermaid";
  }
  if (normalized === "plantuml") {
    return "plantuml";
  }
  if (normalized === "graphviz" || normalized === "dot") {
    return "graphviz";
  }
  return "kroki";
}

function slotIdForType(
  type: string,
  counters: Record<DiagramSlot["renderer"], number>,
): string {
  const renderer = rendererForType(type);
  counters[renderer] += 1;
  return `${renderer}-${counters[renderer]}`;
}

export function extractDiagramSlots(
  source: string,
  lineOrigins?: SourceLineOrigin[],
): DiagramSlot[] {
  const counters: Record<DiagramSlot["renderer"], number> = {
    mermaid: 0,
    plantuml: 0,
    graphviz: 0,
    kroki: 0,
  };
  const slots: DiagramSlot[] = [];

  for (const block of extractAsciiDocDiagramBlocks(source)) {
    slots.push({
      id: slotIdForType(block.type, counters),
      diagramType: block.type,
      renderer: rendererForType(block.type),
      sourceLocation: sourceLocationAt(source, block.index, lineOrigins),
    });
  }

  return slots;
}

export function replaceDiagramBlocksWithPlaceholders(source: string): string {
  const diagramPattern = diagramBlockPattern();
  const counters: Record<DiagramSlot["renderer"], number> = {
    mermaid: 0,
    plantuml: 0,
    graphviz: 0,
    kroki: 0,
  };

  return source.replace(diagramPattern, (block, attributeList: string) => {
    const normalizedType = diagramTypeFromAttributeList(attributeList);
    if (!normalizedType) {
      return block;
    }
    const renderer = rendererForType(normalizedType);
    const id = slotIdForType(normalizedType, counters);

    return [
      "++++",
      `<div class="diagram-slot" data-diagram-id="${id}" data-diagram-type="${normalizedType}" data-diagram-renderer="${renderer}"></div>`,
      "++++",
    ].join("\n");
  });
}
