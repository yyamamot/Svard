import MarkdownIt from "markdown-it";
import markdownItFootnote from "markdown-it-footnote";
import { highlightCode } from "./highlight";
import { registerMathRules } from "./mathRules";
import { registerWikilinkRule } from "./wikilinks";
import {
  markdownPlaceholderTokenType,
  renderMarkdownPlaceholderToken,
} from "./placeholders";

export const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
  highlight: highlightCode,
});

markdown.use(markdownItFootnote);
registerMathRules(markdown);
registerWikilinkRule(markdown);

markdown.renderer.rules.diagram_slot = (tokens, index) => tokens[index].content;
markdown.renderer.rules[markdownPlaceholderTokenType] =
  renderMarkdownPlaceholderToken;
