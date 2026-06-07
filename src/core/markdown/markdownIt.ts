import MarkdownIt from "markdown-it";
import markdownItFootnote from "markdown-it-footnote";
import { highlightCode } from "./highlight";
import { registerMathRules } from "./mathRules";
import { registerWikilinkRule } from "./wikilinks";

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
