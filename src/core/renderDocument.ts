import { disposeAsciiDocRenderWorkers, renderAsciiDoc } from "./renderAsciiDoc";
import { disposeMarkdownRenderWorkers, renderMarkdown } from "./renderMarkdown";
import type { RenderRequestOptions } from "./renderWorkerPool";
import type { DocumentPayload, RenderResult } from "./types";

export function renderDocument(
  document: Pick<DocumentPayload, "format" | "source"> &
    Partial<
      Pick<
        DocumentPayload,
        "path" | "includeFiles" | "resourceContext" | "asciidocContext"
      >
    >,
  options: RenderRequestOptions = {},
): Promise<RenderResult> {
  if (document.format === "markdown") {
    return renderMarkdown(document.source, options);
  }

  return renderAsciiDoc(document.source, {
    path: document.path,
    includeFiles: document.includeFiles,
    asciidocContext: document.asciidocContext,
    signal: options.signal,
    timeoutMs: options.timeoutMs,
  });
}

export function disposeRenderWorkers(): void {
  disposeAsciiDocRenderWorkers();
  disposeMarkdownRenderWorkers();
}
