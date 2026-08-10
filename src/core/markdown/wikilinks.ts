import type MarkdownIt from "markdown-it";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeHtmlAttribute(value: string) {
  return escapeHtml(value).replaceAll('"', "&quot;");
}

function splitWikilinkContent(content: string): {
  target: string;
  label: string;
} | null {
  const pipeIndex = content.indexOf("|");
  const target = (
    pipeIndex >= 0 ? content.slice(0, pipeIndex) : content
  ).trim();
  const label = (pipeIndex >= 0 ? content.slice(pipeIndex + 1) : target).trim();
  if (!target || !label) {
    return null;
  }
  return { target, label };
}

export function registerWikilinkRule(markdown: MarkdownIt) {
  markdown.inline.ruler.before("link", "wikilink", (state, silent) => {
    if (
      state.src.charCodeAt(state.pos) !== 0x5b ||
      state.src.charCodeAt(state.pos + 1) !== 0x5b
    ) {
      return false;
    }
    if (state.pos > 0 && state.src[state.pos - 1] === "!") {
      return false;
    }

    const closeIndex = state.src.indexOf("]]", state.pos + 2);
    if (closeIndex < 0 || closeIndex > state.posMax) {
      return false;
    }
    const raw = state.src.slice(state.pos, closeIndex + 2);
    const parsed = splitWikilinkContent(
      state.src.slice(state.pos + 2, closeIndex),
    );
    if (!parsed) {
      return false;
    }

    if (!silent) {
      const token = state.push("html_inline", "", 0);
      token.meta = { svardHeadingText: parsed.label };
      const encodedTarget = encodeURIComponent(parsed.target);
      token.content = `<a href="svard-wikilink:${encodedTarget}" data-wikilink-target="${escapeHtmlAttribute(parsed.target)}" data-wikilink-label="${escapeHtmlAttribute(parsed.label)}" data-wikilink-raw="${escapeHtmlAttribute(raw)}">${escapeHtml(parsed.label)}</a>`;
    }
    state.pos = closeIndex + 2;
    return true;
  });
}
