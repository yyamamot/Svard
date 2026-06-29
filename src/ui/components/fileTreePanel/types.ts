import type {
  AntoraPlaybookContextSummary,
  DocumentOrderResult,
} from "../../../core/types";
import type { DocumentsViewMode } from "../../lib/fileTreeDocuments";

export type FilesViewMode = DocumentsViewMode;

export type DocumentsFilter = "all" | "changed";

export type DocumentOrderSectionOptions = {
  sectionReviewId: string;
  notInNavReviewId: string;
  notInNavLabel: string;
  showNotInNav?: boolean;
};

export type ActiveDocumentOrder = {
  order: DocumentOrderResult;
  options: DocumentOrderSectionOptions;
} | null;

export type SuggestedDocumentsMode = {
  mode: Extract<
    FilesViewMode,
    "documents-mkdocs" | "documents-zensical" | "documents-antora"
  >;
  label: string;
  antoraContexts?: AntoraPlaybookContextSummary[];
  selectedAntoraContextId?: string | null;
};

export interface DocumentsPanelCommands {
  collapseAllDocumentSections(): void;
  revealCurrentDocument(): boolean;
  canRevealCurrentDocument(): boolean;
}
