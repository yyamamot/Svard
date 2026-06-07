import katex from "katex";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderMathInline(source: string): string {
  try {
    return katex.renderToString(source, {
      displayMode: false,
      output: "html",
      throwOnError: true,
      trust: false,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Math render failed";
    return `<span class="math-render-error" title="${escapeHtml(message)}">${escapeHtml(source)}</span>`;
  }
}

export function renderMathBlock(source: string): string {
  try {
    return katex.renderToString(source, {
      displayMode: true,
      output: "html",
      throwOnError: true,
      trust: false,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Math render failed";
    return `<div class="math-render-error math-render-error-block" title="${escapeHtml(message)}">${escapeHtml(source)}</div>`;
  }
}
