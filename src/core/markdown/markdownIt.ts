import MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";
import markdownItFootnote from "markdown-it-footnote";
import { highlightCode, highlightCodeWithPreAttributes } from "./highlight";
import { registerMathRules } from "./mathRules";
import { registerWikilinkRule } from "./wikilinks";
import {
  markdownPlaceholderTokenType,
  renderMarkdownPlaceholderToken,
} from "./placeholders";
import {
  markdownAuthorHtmlTokenType,
  parseMarkdownAuthorHtmlInlineToken,
  renderMarkdownAuthorHtmlToken,
} from "./authorHtmlRuntime";
import {
  MARKDOWN_RENDERER_PROVENANCE_ATTRIBUTE,
  MARKDOWN_RENDERER_PROVENANCE_INTEGRITY_ERROR,
} from "./rendererProvenance";

interface FootnoteTokenMeta {
  id: number;
  subId: number;
}

function footnoteTokenMeta(token: Token): FootnoteTokenMeta {
  const meta = token.meta as Record<string, unknown> | null;
  const id = meta?.id;
  const subId = meta?.subId ?? 0;
  if (
    !Number.isSafeInteger(id) ||
    (id as number) < 0 ||
    !Number.isSafeInteger(subId) ||
    (subId as number) < 0
  ) {
    throw new Error(MARKDOWN_RENDERER_PROVENANCE_INTEGRITY_ERROR);
  }
  return { id: id as number, subId: subId as number };
}

function footnoteItemId(id: number): string {
  return `svard-footnote-item-${id + 1}`;
}

function footnoteReferenceId(id: number, subId: number): string {
  return `svard-footnote-ref-${id + 1}${subId > 0 ? `-${subId + 1}` : ""}`;
}

export const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
  highlight: highlightCode,
});

markdown.use(markdownItFootnote);
registerMathRules(markdown);
registerWikilinkRule(markdown);
markdown.inline.ruler.before(
  "text",
  markdownAuthorHtmlTokenType,
  parseMarkdownAuthorHtmlInlineToken,
);

const defaultFenceRenderer = markdown.renderer.rules.fence;
markdown.renderer.rules.fence = (tokens, index, options, env, renderer) => {
  const token = tokens[index];
  const rendererId = token.attrGet(MARKDOWN_RENDERER_PROVENANCE_ATTRIBUTE);
  if (!rendererId || !defaultFenceRenderer) {
    return defaultFenceRenderer
      ? defaultFenceRenderer(tokens, index, options, env, renderer)
      : renderer.renderToken(tokens, index, options);
  }
  if (
    !token.attrs ||
    token.attrs.length !== 1 ||
    token.attrs[0][0] !== MARKDOWN_RENDERER_PROVENANCE_ATTRIBUTE
  ) {
    throw new Error(MARKDOWN_RENDERER_PROVENANCE_INTEGRITY_ERROR);
  }
  const language = token.info.trim().split(/\s+/, 1)[0] ?? "";
  return `${highlightCodeWithPreAttributes(token.content, language, [
    [MARKDOWN_RENDERER_PROVENANCE_ATTRIBUTE, rendererId],
  ])}\n`;
};

markdown.renderer.rules.footnote_ref = (tokens, index, options, env, self) => {
  const { id, subId } = footnoteTokenMeta(tokens[index]);
  const caption = self.rules.footnote_caption
    ? self.rules.footnote_caption(tokens, index, options, env, self)
    : `[${id + 1}${subId > 0 ? `:${subId}` : ""}]`;
  return `<sup class="footnote-ref"><a href="#${footnoteItemId(id)}" id="${footnoteReferenceId(id, subId)}">${caption}</a></sup>`;
};

markdown.renderer.rules.footnote_open = (tokens, index) => {
  const { id } = footnoteTokenMeta(tokens[index]);
  return `<li id="${footnoteItemId(id)}" class="footnote-item">`;
};

markdown.renderer.rules.footnote_anchor = (tokens, index) => {
  const { id, subId } = footnoteTokenMeta(tokens[index]);
  return ` <a href="#${footnoteReferenceId(id, subId)}" class="footnote-backref">↩︎</a>`;
};

markdown.renderer.rules.diagram_slot = (tokens, index) => tokens[index].content;
markdown.renderer.rules[markdownPlaceholderTokenType] =
  renderMarkdownPlaceholderToken;
markdown.renderer.rules[markdownAuthorHtmlTokenType] =
  renderMarkdownAuthorHtmlToken;
