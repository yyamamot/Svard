import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import go from "highlight.js/lib/languages/go";
import ini from "highlight.js/lib/languages/ini";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdownLanguage from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import { escapeAttribute, escapeHtml } from "./escape";
import { MARKDOWN_RENDERER_PROVENANCE_INTEGRITY_ERROR } from "./rendererProvenance";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("c", c);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("css", css);
hljs.registerLanguage("diff", diff);
hljs.registerLanguage("dockerfile", dockerfile);
hljs.registerLanguage("go", go);
hljs.registerLanguage("ini", ini);
hljs.registerLanguage("java", java);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("md", markdownLanguage);
hljs.registerLanguage("markdown", markdownLanguage);
hljs.registerLanguage("py", python);
hljs.registerLanguage("python", python);
hljs.registerLanguage("rs", rust);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("toml", ini);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("yml", yaml);

export function highlightCode(value: string, language: string): string {
  return highlightCodeWithPreAttributes(value, language, []);
}

export function highlightCodeWithPreAttributes(
  value: string,
  language: string,
  preAttributes: readonly (readonly [string, string])[],
): string {
  const normalizedLanguage = language.trim().toLowerCase();
  const highlightedCode = highlightCodeContent(value, normalizedLanguage);
  const renderedPreAttributes = preAttributes
    .map(([name, attributeValue]) => {
      if (!/^[a-z][a-z0-9-]*$/.test(name)) {
        throw new Error(MARKDOWN_RENDERER_PROVENANCE_INTEGRITY_ERROR);
      }
      return ` ${name}="${escapeAttribute(attributeValue)}"`;
    })
    .join("");
  if (normalizedLanguage && hljs.getLanguage(normalizedLanguage)) {
    return `<pre class="hljs"${renderedPreAttributes}><code class="language-${escapeAttribute(normalizedLanguage)}">${highlightedCode}</code></pre>`;
  }

  return `<pre class="hljs"${renderedPreAttributes}><code>${highlightedCode}</code></pre>`;
}

export function highlightCodeContent(value: string, language: string): string {
  const normalizedLanguage = language.trim().toLowerCase();
  if (!normalizedLanguage || !hljs.getLanguage(normalizedLanguage)) {
    return escapeHtml(value);
  }

  return hljs.highlight(value, {
    language: normalizedLanguage,
    ignoreIllegals: true,
  }).value;
}
