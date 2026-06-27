import type { DocumentOrderResult } from "../../../core/types";
import type { DocumentsViewMode } from "../../lib/fileTreeDocuments";

export type FilesViewMode = DocumentsViewMode;

export type DocumentsFilter = "all" | "changed";

export type DocumentOrderSectionOptions = {
  sectionReviewId: string;
  notInNavReviewId: string;
  notInNavLabel: string;
};

export type ActiveDocumentOrder = {
  order: DocumentOrderResult;
  options: DocumentOrderSectionOptions;
} | null;
