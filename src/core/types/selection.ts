export const maximumSelectionBytes = 256 * 1024;
export const maximumTurnSelectionBytes = 1024 * 1024;
export const maximumTurnSelections = 8;

export type SelectionProseRole =
  | "heading"
  | "paragraph"
  | "list"
  | "definitionList"
  | "quote"
  | "admonition";

export interface SelectionProseBlock {
  type: "prose";
  role: SelectionProseRole;
  markdown: string;
  plainText: string;
}

export interface SelectionCodeBlock {
  type: "code";
  text: string;
  language?: string;
}

export interface SelectionTableCell {
  rowSpan: number;
  columnSpan: number;
  blocks: Array<SelectionProseBlock | SelectionCodeBlock>;
}

export interface SelectionTableRow {
  cells: SelectionTableCell[];
}

export interface SelectionTableBlock {
  type: "table";
  rows: SelectionTableRow[];
}

export interface SelectionImageBlock {
  type: "image";
  imageId: string;
  kind: "image" | "diagram";
  label: string;
}

export type SelectionBlock =
  | SelectionProseBlock
  | SelectionCodeBlock
  | SelectionTableBlock
  | SelectionImageBlock;

export interface SelectionImageResource {
  imageId: string;
  displayLabel: string;
  mediaType: "image/png";
  base64: string;
  byteLength: number;
}

export interface SelectionProvenance {
  sourcePath: string;
  startLine: number;
  endLine: number;
  startOffset?: number;
  endOffset?: number;
  exact: boolean;
}

export type SelectionDiagnosticCode =
  | "outsideViewer"
  | "collapsed"
  | "unsupportedElement"
  | "imageUnavailable"
  | "imageCapabilityRequired"
  | "sourceAmbiguous"
  | "selectionTooLarge"
  | "turnLimitExceeded"
  | "documentChanged";

export interface SelectionDiagnostic {
  severity: "warning" | "blocking";
  code: SelectionDiagnosticCode;
  message: string;
}

export interface DocumentSelectionDiffContext {
  kind: "renderedDiff";
  displayPath: string;
  side: "left" | "right";
  revisionLabel: string;
  comparisonLabel: string;
}

export interface DocumentSelectionSnapshot {
  snapshotId: string;
  documentPath: string;
  documentRevision: string;
  sectionLabel?: string;
  plainText: string;
  blocks: SelectionBlock[];
  imageResources: SelectionImageResource[];
  provenance: SelectionProvenance[];
  diagnostics: SelectionDiagnostic[];
  diffContext?: DocumentSelectionDiffContext;
}

export type DocumentMediaKind = "image" | "diagram";
export type DocumentMediaMode = "visualAndSource" | "visual" | "source";

export interface DocumentMediaSnapshot {
  snapshotId: string;
  contextType: "media";
  documentPath: string;
  documentRevision: string;
  sectionLabel?: string;
  displayLabel: string;
  caption?: string;
  alt?: string;
  sourceLine?: number;
  mediaKind: DocumentMediaKind;
  visual?: SelectionImageResource;
  diagram?: {
    type: string;
    source: string;
  };
  defaultMode: DocumentMediaMode;
  diagnostics: SelectionDiagnostic[];
  diffContext?: DocumentSelectionDiffContext;
}

export interface DocumentChangeSnapshot {
  snapshotId: string;
  contextType: "change";
  documentPath: string;
  comparisonLabel: string;
  changeKind: "added" | "removed" | "changed";
  before?: DocumentSelectionSnapshot;
  after?: DocumentSelectionSnapshot;
  diagnostics: SelectionDiagnostic[];
}

export type AgentQuotedContext =
  | DocumentSelectionSnapshot
  | DocumentMediaSnapshot
  | DocumentChangeSnapshot;

export function isDocumentMediaSnapshot(
  context: AgentQuotedContext,
): context is DocumentMediaSnapshot {
  return "contextType" in context && context.contextType === "media";
}

export function isDocumentChangeSnapshot(
  context: AgentQuotedContext,
): context is DocumentChangeSnapshot {
  return "contextType" in context && context.contextType === "change";
}

export type AgentTurnContentPart =
  | { type: "text"; text: string }
  | { type: "image"; attachmentId: string };
