import type { Dispatch, SetStateAction } from "react";
import { isSupportedDocumentPath } from "../../core/documentFormat";
import type {
  DocumentDiffPreview,
  DocumentPayload,
  HostAdapter,
} from "../../core/types";
import type { InlineNoticeOptions } from "../types";

export function useFileCompareActions({
  documentPayload,
  host,
  setDocumentDiffPreview,
  setFileComparePickerOpen,
  showInlineNotice,
}: {
  documentPayload: DocumentPayload | null;
  host: HostAdapter;
  setDocumentDiffPreview: Dispatch<SetStateAction<DocumentDiffPreview | null>>;
  setFileComparePickerOpen: Dispatch<SetStateAction<boolean>>;
  showInlineNotice: (message: string, options?: InlineNoticeOptions) => void;
}) {
  async function compareWithActiveFile(rightPath: string) {
    if (!documentPayload || !isSupportedDocumentPath(documentPayload.path)) {
      showInlineNotice("Open a markup document before comparing files", {
        tone: "warning",
      });
      return;
    }
    if (!rightPath || !isSupportedDocumentPath(rightPath)) {
      showInlineNotice("File diff is available for markup documents only", {
        tone: "warning",
      });
      return;
    }
    if (documentPayload.path === rightPath) {
      showInlineNotice("Choose two different markup documents to compare", {
        tone: "warning",
      });
      return;
    }
    await compareDocumentPaths(documentPayload.path, rightPath);
  }

  async function compareDocumentPaths(leftPath: string, rightPath: string) {
    if (
      !isSupportedDocumentPath(leftPath) ||
      !isSupportedDocumentPath(rightPath)
    ) {
      showInlineNotice("File diff is available for markup documents only", {
        tone: "warning",
      });
      return;
    }
    if (leftPath === rightPath) {
      showInlineNotice("Choose two different markup documents to compare", {
        tone: "warning",
      });
      return;
    }
    try {
      const preview = await host.compareDocuments(leftPath, rightPath);
      setDocumentDiffPreview(preview);
      setFileComparePickerOpen(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "File diff preview failed";
      showInlineNotice(message, { tone: "error" });
    }
  }

  async function compareActiveWithPickedDocument() {
    if (!documentPayload || !isSupportedDocumentPath(documentPayload.path)) {
      showInlineNotice("Open a markup document before comparing files", {
        tone: "warning",
      });
      return;
    }
    const pickedPath = await host.pickDocument();
    if (!pickedPath) {
      return;
    }
    await compareWithActiveFile(pickedPath);
  }

  async function comparePickedDocuments() {
    setFileComparePickerOpen(true);
  }

  async function chooseCompareDocument() {
    return host.pickDocument();
  }

  return {
    chooseCompareDocument,
    compareActiveWithPickedDocument,
    compareDocumentPaths,
    comparePickedDocuments,
    compareWithActiveFile,
  };
}
