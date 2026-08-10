import type MarkdownIt from "markdown-it";
import { renderMathBlock, renderMathInline } from "../math";

function escapeHtmlAttribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function isWhitespace(value: string | undefined) {
  return value === undefined || /\s/u.test(value);
}

function isAsciiWordCharacter(value: string | undefined) {
  return value !== undefined && /[A-Za-z0-9_]/u.test(value);
}

function isNonAsciiProseBoundary(value: string | undefined) {
  return (
    value !== undefined && !isWhitespace(value) && value.charCodeAt(0) > 0x7f
  );
}

function hasUnescapedPipe(value: string) {
  let escaped = false;
  for (const char of value) {
    if (char === "\\" && !escaped) {
      escaped = true;
      continue;
    }
    if (char === "|" && !escaped) {
      return true;
    }
    escaped = false;
  }
  return false;
}

function isProseCharacter(value: string | undefined) {
  return value !== undefined && /[\p{L}\p{M}\p{N}]/u.test(value);
}

function looksLikeCurrencyFragment(
  value: string,
  source: string,
  openPosition: number,
  closePosition: number,
) {
  if (!/^\d/u.test(value)) {
    return false;
  }
  if (/[\\^_=+*/<>]/u.test(value)) {
    return false;
  }

  const before = openPosition > 0 ? source[openPosition - 1] : undefined;
  const after =
    closePosition + 1 < source.length ? source[closePosition + 1] : undefined;
  return isProseCharacter(before) || isProseCharacter(after);
}

function canOpenInlineMath(source: string, position: number, max: number) {
  const next = source[position + 1];
  if (!next || next === "$" || isWhitespace(next)) {
    return false;
  }

  const previous = position > 0 ? source[position - 1] : undefined;
  if (previous === "\\" || previous === "$" || isAsciiWordCharacter(previous)) {
    return false;
  }

  return position + 1 < max;
}

function canOpenInlineMathAfterAsciiLabel(
  source: string,
  position: number,
  max: number,
) {
  const next = source[position + 1];
  const previous = position > 0 ? source[position - 1] : undefined;
  return (
    Boolean(next) &&
    next !== "$" &&
    !isWhitespace(next) &&
    isAsciiWordCharacter(previous) &&
    position + 1 < max
  );
}

function canCloseInlineMath(source: string, position: number, max: number) {
  const previous = source[position - 1];
  if (!previous || isWhitespace(previous)) {
    return false;
  }

  const next = position + 1 < max ? source[position + 1] : undefined;
  return !isAsciiWordCharacter(next);
}

export function registerMathRules(markdown: MarkdownIt) {
  markdown.block.ruler.before(
    "fence",
    "math_block",
    (state, startLine, endLine, silent) => {
      const start = state.bMarks[startLine] + state.tShift[startLine];
      const max = state.eMarks[startLine];
      const firstLine = state.src.slice(start, max);
      const firstTrimmed = firstLine.trim();
      if (!firstTrimmed.startsWith("$$")) {
        return false;
      }

      const inlineRest = firstTrimmed.slice(2);
      const inlineCloseIndex = inlineRest.indexOf("$$");
      let content: string;
      let nextLine = startLine + 1;

      if (inlineCloseIndex >= 0) {
        const trailing = inlineRest.slice(inlineCloseIndex + 2);
        if (trailing.trim()) {
          return false;
        }
        content = inlineRest.slice(0, inlineCloseIndex).trim();
      } else {
        if (inlineRest.trim()) {
          return false;
        }
        const lines: string[] = [];
        let foundClose = false;
        for (; nextLine < endLine; nextLine += 1) {
          const lineStart = state.bMarks[nextLine] + state.tShift[nextLine];
          const lineEnd = state.eMarks[nextLine];
          const line = state.src.slice(lineStart, lineEnd);
          const closeIndex = line.indexOf("$$");
          if (closeIndex >= 0) {
            const trailing = line.slice(closeIndex + 2);
            if (trailing.trim()) {
              return false;
            }
            lines.push(line.slice(0, closeIndex));
            foundClose = true;
            nextLine += 1;
            break;
          }
          lines.push(line);
        }
        if (!foundClose) {
          return false;
        }
        content = lines.join("\n").trim();
      }

      if (!content) {
        return false;
      }

      if (silent) {
        return true;
      }

      const token = state.push("html_block", "", 0);
      token.block = true;
      token.map = [startLine, nextLine];
      token.content = `<div class="math-block" data-review-id="math-block" data-math-source="${escapeHtmlAttribute(content)}">${renderMathBlock(content)}</div>\n`;
      state.line = nextLine;
      return true;
    },
  );

  markdown.inline.ruler.before("escape", "math_inline", (state, silent) => {
    if (state.src.charCodeAt(state.pos) !== 0x24) {
      return false;
    }
    if (state.src.charCodeAt(state.pos + 1) === 0x24) {
      return false;
    }
    const opensAfterAsciiLabel = canOpenInlineMathAfterAsciiLabel(
      state.src,
      state.pos,
      state.posMax,
    );
    if (
      !canOpenInlineMath(state.src, state.pos, state.posMax) &&
      !opensAfterAsciiLabel
    ) {
      return false;
    }

    let cursor = state.pos + 1;
    let escaped = false;
    while (cursor < state.posMax) {
      const char = state.src[cursor];
      if (char === "\\" && !escaped) {
        escaped = true;
        cursor += 1;
        continue;
      }
      if (char === "$" && !escaped) {
        break;
      }
      escaped = false;
      cursor += 1;
    }

    if (
      cursor >= state.posMax ||
      !canCloseInlineMath(state.src, cursor, state.posMax)
    ) {
      return false;
    }

    const source = state.src.slice(state.pos + 1, cursor).trim();
    if (
      !source ||
      hasUnescapedPipe(source) ||
      looksLikeCurrencyFragment(source, state.src, state.pos, cursor)
    ) {
      return false;
    }

    let rendered: string | undefined;
    if (opensAfterAsciiLabel) {
      if (!isNonAsciiProseBoundary(state.src[cursor + 1])) {
        return false;
      }
      rendered = renderMathInline(source);
      if (rendered.includes('class="math-render-error"')) {
        return false;
      }
    }

    if (!silent) {
      const token = state.push("html_inline", "", 0);
      token.content = `<span class="math-inline" data-math-source="${escapeHtmlAttribute(source)}">${rendered ?? renderMathInline(source)}</span>`;
    }
    state.pos = cursor + 1;
    return true;
  });
}
