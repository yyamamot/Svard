import { useEffect, useMemo, useState } from "react";
import { renderMarkdownFragmentHtml } from "../../core/markdown/enhancements";
import { sanitizeDocumentHtml, unwrapSafeHtml } from "../lib/sanitizeHtml";
import { dangerouslySetSafeHtml, markSafeHtml } from "../lib/safeHtml";
import type { SvardOpenUiRuntime } from "./openUiRuntime";

export type AgentMarkdownLinkTarget =
  | { kind: "external"; url: string }
  | { kind: "workspace"; path: string };

export function agentMarkdownLinkTarget(
  href: string,
): AgentMarkdownLinkTarget | null {
  const value = href.trim();
  if (!value || value.includes("\u0000")) return null;
  if (/^(?:https?):\/\//iu.test(value) || /^mailto:/iu.test(value)) {
    return { kind: "external", url: value };
  }
  if (
    value.startsWith("#") ||
    value.startsWith("/") ||
    value.startsWith("\\") ||
    /^[a-z]:[\\/]/iu.test(value) ||
    /^[a-z][a-z0-9+.-]*:/iu.test(value)
  ) {
    return null;
  }
  const withoutSuffix = value.split(/[?#]/u, 1)[0].replace(/^\.\//u, "");
  let decoded: string;
  try {
    decoded = decodeURIComponent(withoutSuffix);
  } catch {
    return null;
  }
  if (
    !decoded ||
    decoded.includes("\\") ||
    decoded
      .split("/")
      .some((segment) => segment === ".." || segment === "." || !segment)
  ) {
    return null;
  }
  return { kind: "workspace", path: decoded };
}

export function renderAgentMarkdownHtml(
  content: string,
  { copyCode = true }: { copyCode?: boolean } = {},
) {
  const sanitized = sanitizeDocumentHtml(
    renderMarkdownFragmentHtml(content, { images: "altText" }),
  );
  const doc = new DOMParser().parseFromString(
    unwrapSafeHtml(sanitized),
    "text/html",
  );
  doc.body
    .querySelectorAll("img,iframe,form,input,button,textarea,select")
    .forEach((element) => {
      if (element instanceof HTMLImageElement) {
        element.replaceWith(doc.createTextNode(element.alt));
      } else {
        element.remove();
      }
    });
  doc.body.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
    const href = anchor.getAttribute("href") ?? "";
    if (!agentMarkdownLinkTarget(href)) {
      anchor.removeAttribute("href");
    }
    anchor.removeAttribute("target");
    anchor.removeAttribute("rel");
  });
  if (copyCode) {
    doc.body.querySelectorAll<HTMLPreElement>("pre").forEach((pre) => {
      const code = pre.querySelector(":scope > code");
      if (!code) return;
      pre.classList.add("agent-code-block");
      const button = doc.createElement("button");
      button.type = "button";
      button.className = "agent-copy-code";
      button.setAttribute("aria-label", "Copy code");
      button.setAttribute("data-agent-copy-code", "");
      button.textContent = "Copy";
      pre.prepend(button);
    });
  }
  return markSafeHtml(doc.body.innerHTML);
}

export function activateAgentMarkdownLink(
  href: string,
  {
    onOpenExternalLink,
    onOpenFile,
  }: Pick<SvardOpenUiRuntime, "onOpenExternalLink" | "onOpenFile">,
) {
  const link = agentMarkdownLinkTarget(href);
  if (link?.kind === "workspace") {
    onOpenFile?.(link.path);
  } else if (link?.kind === "external") {
    onOpenExternalLink?.(link.url);
  }
}

export function AgentMarkdownAnswer({
  content,
  isStreaming = false,
  onOpenExternalLink,
  onOpenFile,
}: {
  content: string;
  isStreaming?: boolean;
  onOpenExternalLink?: (url: string) => void;
  onOpenFile?: (relativePath: string) => void;
}) {
  const html = useMemo(
    () => renderAgentMarkdownHtml(content, { copyCode: !isStreaming }),
    [content, isStreaming],
  );
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  useEffect(() => {
    if (!copyFeedback) return;
    const timeout = window.setTimeout(() => setCopyFeedback(null), 1600);
    return () => window.clearTimeout(timeout);
  }, [copyFeedback]);

  async function copyText(value: string, successMessage: string) {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(value);
      setCopyFeedback(successMessage);
    } catch {
      setCopyFeedback("Copy failed");
    }
  }

  return (
    <div className="agent-markdown-response">
      <div
        className="agent-final-answer agent-markdown-answer"
        data-review-id="agent-text-response"
        dangerouslySetInnerHTML={dangerouslySetSafeHtml(html)}
        onClick={(event) => {
          const target = event.target;
          if (!(target instanceof Element)) return;
          const copyButton = target.closest<HTMLButtonElement>(
            "[data-agent-copy-code]",
          );
          if (copyButton) {
            event.preventDefault();
            const code =
              copyButton.parentElement?.querySelector("code")?.textContent ??
              "";
            void copyText(code, "Code copied");
            return;
          }
          const anchor = target.closest<HTMLAnchorElement>("a[href]");
          if (!anchor) return;
          event.preventDefault();
          activateAgentMarkdownLink(anchor.getAttribute("href") ?? "", {
            onOpenExternalLink,
            onOpenFile,
          });
        }}
      />
      {!isStreaming && content.trim() ? (
        <div className="agent-answer-actions">
          <button
            type="button"
            className="agent-copy-answer"
            onClick={() => void copyText(content, "Answer copied")}
          >
            Copy answer
          </button>
        </div>
      ) : null}
      <span className="agent-copy-feedback" role="status" aria-live="polite">
        {copyFeedback}
      </span>
    </div>
  );
}
