import type { RenderResult } from "./types";
import { renderMarkdownDocument } from "./markdown/render";

export function renderMarkdownCore(source: string): RenderResult {
  return renderMarkdownDocument(source);
}
