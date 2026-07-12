import { useCallback } from "react";

import type {
  DocumentDiffPreview,
  DocumentLinkResolution,
  DocumentPayload,
  GitDiffResourceSource,
  KrokiRequest,
  KrokiResult,
  LocalImageResolveContext,
  LocalImageResult,
} from "../../core/types";

interface DiffPreviewHost {
  getGitDiffPreview(path: string): Promise<DocumentDiffPreview>;
  openDocument(documentPath: string): Promise<DocumentPayload>;
  renderDiagram(request: KrokiRequest): Promise<KrokiResult>;
  resolveDocumentLink(input: {
    href: string;
    documentPath: string;
  }): Promise<DocumentLinkResolution>;
  resolveLocalImage(
    source: string,
    documentPath: string,
    context: LocalImageResolveContext | null | undefined,
  ): Promise<LocalImageResult>;
  resolveGitDiffLocalImage(input: {
    source: string;
    documentPath: string;
    repositoryRoot: string;
    resourceSource: GitDiffResourceSource;
    context?: LocalImageResolveContext | null;
  }): Promise<LocalImageResult>;
  openExternalUrl(url: string): Promise<void>;
}

export function useDiffPreviewHostCallbacks(host: DiffPreviewHost) {
  const resolveDiffDocumentLink = useCallback(
    (href: string, documentPath: string) =>
      host.resolveDocumentLink({ href, documentPath }),
    [host],
  );
  const openDiffExternalUrl = useCallback(
    (url: string): Promise<void> => host.openExternalUrl(url),
    [host],
  );
  const resolveDiffLocalImage = useCallback(
    (
      source: string,
      documentPath: string,
      context: LocalImageResolveContext | null | undefined,
      repositoryRoot?: string | null,
      resourceSource?: GitDiffResourceSource | null,
    ): Promise<LocalImageResult> => {
      if (repositoryRoot && resourceSource) {
        return host.resolveGitDiffLocalImage({
          source,
          documentPath,
          repositoryRoot,
          resourceSource,
          context,
        });
      }
      return host.resolveLocalImage(source, documentPath, context);
    },
    [host],
  );
  const loadDiffDocumentContext = useCallback(
    async (
      documentPath: string,
    ): Promise<Pick<
      DocumentPayload,
      "includeFiles" | "resourceContext" | "asciidocContext"
    > | null> => {
      const document = await host.openDocument(documentPath);
      return {
        includeFiles: document.includeFiles,
        resourceContext: document.resourceContext,
        asciidocContext: document.asciidocContext,
      };
    },
    [host],
  );
  const renderDiffDiagram = useCallback(
    (request: KrokiRequest): Promise<KrokiResult> =>
      host.renderDiagram(request),
    [host],
  );
  const getGitDiffPreview = useCallback(
    (path: string): Promise<DocumentDiffPreview> =>
      host.getGitDiffPreview(path),
    [host],
  );

  return {
    getGitDiffPreview,
    loadDiffDocumentContext,
    openDiffExternalUrl,
    renderDiffDiagram,
    resolveDiffDocumentLink,
    resolveDiffLocalImage,
  };
}
