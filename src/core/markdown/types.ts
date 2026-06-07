import type { DiagramSlot, SourceLocation } from "../types";

export type DiagramRenderer = DiagramSlot["renderer"];

export interface MarkdownDiagramSlot {
  id: string;
  diagramType: string;
  renderer: DiagramRenderer;
  source: string;
  sourceLocation: SourceLocation;
}

export type FrontmatterValue =
  | string
  | number
  | boolean
  | null
  | FrontmatterValue[]
  | { [key: string]: FrontmatterValue };

export interface MarkdownDetailsBlock {
  open: boolean;
  summary: string;
  body: string;
}
