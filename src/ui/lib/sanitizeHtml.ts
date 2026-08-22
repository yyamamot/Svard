import createDOMPurify from "dompurify";
import type { Config } from "dompurify";
import type { DocumentFormat } from "../../core/types";
import { markSafeHtml, unwrapSafeHtml } from "./safeHtml";
import type { SafeHtml } from "./safeHtml";

const DOMPurify = createDOMPurify(window);

const allowedUriPattern =
  /^(?:(?:(?:https?|mailto|data|asset|file):)|(?:[A-Za-z]:[\\/])|(?:[./#])|(?:\/(?!\/)))/i;
const privateRendererAttributes = ["data-source-renderer-id"] as const;

const commonConfig = {
  ALLOW_ARIA_ATTR: true,
  ALLOW_DATA_ATTR: true,
  ALLOWED_URI_REGEXP: allowedUriPattern,
  FORBID_ATTR: ["style", ...privateRendererAttributes],
} satisfies Config;

export interface SanitizeDocumentHtmlOptions {
  format?: DocumentFormat;
}

const viewerMetadataAttributes = [
  "target",
  "rel",
  "aria-label",
  "checked",
  "data-review-id",
  "data-source-line",
  "data-source-column",
  "data-source-reference",
  "data-source-block-id",
  "data-source-text-block-id",
  "data-selection-exclude",
  "data-copy-source",
  "data-copy-source-button",
  "data-copy-source-location-button",
  "data-source-wrap-toggle",
  "data-source-collapse-toggle",
  "data-image-reference",
  "data-image-path",
  "data-image-resolved-path",
  "data-image-url",
  "data-diagram-id",
  "data-diagram-type",
  "data-diagram-renderer",
  "data-source-selection-block-id",
  "data-source-selection-start",
  "data-source-selection-end",
  "data-source-selection-source-path",
  "data-kroki-confirm-key",
  "data-kroki-fallback-key",
  "data-active-change",
  "data-change-index",
  "data-content-cursor-active",
  "data-sync-index",
  "disabled",
  "type",
] as const;

const asciiDocStructureTags = [
  "article",
  "section",
  "header",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "div",
  "span",
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "colgroup",
  "col",
  "caption",
  "pre",
  "code",
  "blockquote",
  "strong",
  "em",
  "b",
  "i",
  "sub",
  "sup",
  "a",
  "img",
] as const;

const asciiDocTableAttributes = [
  "align",
  "colspan",
  "rowspan",
  "valign",
  "width",
] as const;

function sanitizeConfigForFormat(format: DocumentFormat | undefined): Config {
  if (format !== "asciidoc") {
    return {
      ...commonConfig,
      ADD_ATTR: [...viewerMetadataAttributes],
    };
  }

  return {
    ...commonConfig,
    ADD_TAGS: [...asciiDocStructureTags],
    ADD_ATTR: [...viewerMetadataAttributes, ...asciiDocTableAttributes],
    ADD_URI_SAFE_ATTR: [...asciiDocTableAttributes],
  };
}

export function sanitizeDocumentHtml(
  html: string,
  options: SanitizeDocumentHtmlOptions = {},
): SafeHtml {
  return markSafeHtml(
    restoreTaskListCheckboxes(
      DOMPurify.sanitize(html, sanitizeConfigForFormat(options.format)),
    ),
  );
}

export function sanitizeDocumentBodyInPlace(
  body: HTMLElement,
  options: SanitizeDocumentHtmlOptions = {},
): SafeHtml {
  DOMPurify.sanitize(body, {
    ...sanitizeConfigForFormat(options.format),
    IN_PLACE: true,
  });
  return markSafeHtml(restoreTaskListCheckboxes(body.innerHTML));
}

export function sanitizeRenderedBlockHtml(
  html: string,
  options: SanitizeDocumentHtmlOptions = {},
): SafeHtml {
  if (html.includes("katex")) {
    const sanitized = DOMPurify.sanitize(html, {
      ...sanitizeConfigForFormat(options.format),
      FORBID_ATTR: [...privateRendererAttributes],
    });
    const doc = new DOMParser().parseFromString(sanitized, "text/html");
    doc.body.querySelectorAll<HTMLElement>("[style]").forEach((element) => {
      if (!element.closest(".katex")) {
        element.removeAttribute("style");
      }
    });
    return markSafeHtml(doc.body.innerHTML);
  }
  return sanitizeDocumentHtml(html, options);
}

export function sanitizeSvg(svg: string): SafeHtml {
  return markSafeHtml(
    DOMPurify.sanitize(svg, {
      ALLOW_ARIA_ATTR: true,
      ALLOW_DATA_ATTR: true,
      USE_PROFILES: { svg: true, svgFilters: true },
      FORBID_ATTR: [...privateRendererAttributes],
      FORBID_TAGS: ["foreignObject", "iframe", "object", "embed", "script"],
      ADD_ATTR: [
        "aria-label",
        "role",
        "viewBox",
        "preserveAspectRatio",
        "xmlns",
        "xmlns:xlink",
        "xlink:href",
      ],
    })
      .replaceAll(" viewbox=", " viewBox=")
      .replaceAll(" preserveaspectratio=", " preserveAspectRatio=")
      .replaceAll("&nbsp;", "&#160;"),
  );
}

function restoreTaskListCheckboxes(html: string): string {
  if (!html.includes("task-list-item-checkbox")) {
    return html;
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  let restored = false;

  doc
    .querySelectorAll<HTMLInputElement>("input.task-list-item-checkbox")
    .forEach((input) => {
      input.setAttribute("type", "checkbox");
      input.setAttribute("disabled", "");
      restored = true;
    });

  return restored ? doc.body.innerHTML : html;
}

export { unwrapSafeHtml };
