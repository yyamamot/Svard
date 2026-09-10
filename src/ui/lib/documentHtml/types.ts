import type {
  DocumentPayload,
  DocumentLinkResolution,
  LocalImageResolveContext,
  LocalImageResult,
  RenderResult,
  SecurityConfig,
} from "../../../core/types";
import type { MarkdownRendererProvenanceValidation } from "../markdownRendererProvenance";

export interface PrepareDocumentHtmlOptions {
  resolveLocalImage?: (
    path: string,
    documentPath: string,
    context: LocalImageResolveContext | null | undefined,
  ) => Promise<LocalImageResult>;
  resolveDocumentLink?: (
    href: string,
    documentPath: string,
    options?: { kind?: "local" | "wikilink"; target?: string; label?: string },
  ) => Promise<DocumentLinkResolution>;
  localRasterPayloadOwner?: RenderResult;
}

export type DocumentHtmlConfig = {
  security: Pick<SecurityConfig, "allowLocalImages" | "confirmExternalLinks"> &
    Partial<Pick<SecurityConfig, "showExternalImages">>;
};

export type DocumentHtmlRenderResult = Pick<
  RenderResult,
  | "headings"
  | "sourceBlocks"
  | "sourceTextBlocks"
  | "sourceSelectionBlocks"
  | "markdownAuthorHtmlFragments"
  | "markdownRendererProvenance"
> &
  Partial<Pick<RenderResult, "diagnostics" | "diagramSlots">>;

export interface DocumentHtmlPhaseContext {
  html: string;
  doc: Document;
  document: DocumentPayload;
  renderResult?: DocumentHtmlRenderResult;
  basename: string;
}

export interface RendererTargets {
  markdownRendererValidation: MarkdownRendererProvenanceValidation;
  markdownHeadingElements: Map<string, HTMLElement>;
  markdownSourceElements: Map<string, HTMLElement>;
  markdownSourceTextElements: Map<string, HTMLElement>;
  markdownSelectionElements: Map<string, HTMLElement>;
  markdownTableElements: Set<HTMLElement>;
}
