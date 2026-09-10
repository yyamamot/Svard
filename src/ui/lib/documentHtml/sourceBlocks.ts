import { highlightCodeContent } from "../../../core/markdown/highlight";
import type { DocumentHtmlPhaseContext, RendererTargets } from "./types";
import { perfDuration, perfNow, tracePerf } from "../perfTrace";
import { htmlMayContainElement, sourceReference } from "./helpers";

export function attachSourceBlocks(
  { html, doc, document, renderResult, basename }: DocumentHtmlPhaseContext,
  { markdownSourceElements }: RendererTargets,
) {
  const sourceBlocksStartedAt = perfNow();
  const sourceBlockTargets =
    document.format === "markdown"
      ? (renderResult?.sourceBlocks ?? []).flatMap((sourceBlock, index) => {
          const pre = markdownSourceElements.get(sourceBlock.id);
          return pre ? [{ pre, sourceBlock, index }] : [];
        })
      : Array.from(doc.querySelectorAll<HTMLElement>("pre")).map(
          (pre, index) => ({
            pre,
            sourceBlock: renderResult?.sourceBlocks[index],
            index,
          }),
        );
  const shouldProcessSourceBlocks =
    document.format === "markdown"
      ? sourceBlockTargets.length > 0
      : htmlMayContainElement(html, "pre");
  let sourceBlockCount = 0;
  if (shouldProcessSourceBlocks) {
    sourceBlockTargets.forEach(({ pre, sourceBlock, index }) => {
      sourceBlockCount += 1;
      const sourceLine = sourceBlock?.sourceLocation?.line;
      const sourceLanguage = sourceBlock?.language?.trim() || "Source";
      const sourceCode = pre.querySelector("code");
      if (
        document.format === "asciidoc" &&
        sourceBlock?.language &&
        sourceCode
      ) {
        sourceCode.innerHTML = highlightCodeContent(
          sourceCode.textContent ?? "",
          sourceBlock.language,
        );
        sourceCode.classList.add(
          `language-${sourceBlock.language.trim().toLowerCase()}`,
        );
        pre.classList.add("hljs");
      }
      pre.setAttribute("data-copy-source", `${index + 1}`);
      const wrapper = doc.createElement("div");
      wrapper.className = "source-block-frame";
      if (sourceBlock?.id) {
        wrapper.setAttribute("data-source-block-id", sourceBlock.id);
        pre.setAttribute("data-source-block-id", sourceBlock.id);
      }
      if (sourceLine) {
        wrapper.setAttribute("data-source-line", String(sourceLine));
        pre.setAttribute("data-source-line", String(sourceLine));
        if (sourceBlock?.sourceLocation?.column) {
          wrapper.setAttribute(
            "data-source-column",
            String(sourceBlock.sourceLocation.column),
          );
          pre.setAttribute(
            "data-source-column",
            String(sourceBlock.sourceLocation.column),
          );
        }
        wrapper.setAttribute(
          "data-source-reference",
          sourceReference(
            document,
            sourceLine,
            undefined,
            sourceBlock.sourceLocation,
          ),
        );
      }
      const toolbar = doc.createElement("div");
      toolbar.className = "source-block-toolbar";
      toolbar.setAttribute("data-review-id", "source-block-toolbar");
      toolbar.setAttribute("data-selection-exclude", "true");

      const languageLabel = doc.createElement("span");
      languageLabel.className = "source-block-language";
      languageLabel.setAttribute("data-review-id", "source-block-language");
      languageLabel.textContent = sourceLanguage;

      const toolbarActions = doc.createElement("span");
      toolbarActions.className = "source-block-actions";

      const button = doc.createElement("button");
      button.type = "button";
      button.className = "source-copy-button source-block-action";
      button.setAttribute("data-review-id", "source-copy-button");
      button.setAttribute("data-copy-source-button", `${index + 1}`);
      button.textContent = "Copy";
      const referenceButton = doc.createElement("button");
      referenceButton.type = "button";
      referenceButton.className =
        "source-reference-copy-button source-block-action";
      referenceButton.setAttribute(
        "data-review-id",
        "source-reference-copy-button",
      );
      referenceButton.setAttribute(
        "data-copy-source-location-button",
        `${index + 1}`,
      );
      referenceButton.textContent = "Ref";
      if (!sourceLine) {
        referenceButton.disabled = true;
        referenceButton.title = "Source location unavailable";
      } else {
        referenceButton.title = `Copy ${sourceReference(
          document,
          sourceLine,
          undefined,
          sourceBlock?.sourceLocation,
        )}`;
      }
      const wrapButton = doc.createElement("button");
      wrapButton.type = "button";
      wrapButton.className = "source-wrap-toggle source-block-action";
      wrapButton.setAttribute("data-review-id", "source-wrap-toggle");
      wrapButton.setAttribute("data-source-wrap-toggle", `${index + 1}`);
      wrapButton.setAttribute("aria-pressed", "false");
      wrapButton.title = "Toggle line wrap";
      wrapButton.textContent = "Wrap";

      const collapseButton = doc.createElement("button");
      collapseButton.type = "button";
      collapseButton.className = "source-collapse-toggle source-block-action";
      collapseButton.setAttribute("data-review-id", "source-collapse-toggle");
      collapseButton.setAttribute(
        "data-source-collapse-toggle",
        `${index + 1}`,
      );
      collapseButton.setAttribute("aria-expanded", "true");
      collapseButton.title = "Collapse source block";
      collapseButton.textContent = "Collapse";

      toolbarActions.append(
        button,
        referenceButton,
        wrapButton,
        collapseButton,
      );
      toolbar.append(languageLabel, toolbarActions);
      pre.replaceWith(wrapper);
      wrapper.append(toolbar, pre);
    });
  }
  tracePerf("render.prepareDocumentHtml.sourceBlocks", {
    basename,
    format: document.format,
    count: sourceBlockCount,
    skipped: !shouldProcessSourceBlocks,
    durationMs: perfDuration(sourceBlocksStartedAt),
  });
}
