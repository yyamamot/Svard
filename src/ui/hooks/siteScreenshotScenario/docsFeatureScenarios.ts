import type { SiteScreenshotScenarioContext } from "./types";

const mathDocumentPath = "/workspace/docs/rendering-reference.md";
const copyDocumentPath = "/workspace/docs/context-reference.md";

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

async function waitForElement<T extends Element>(
  selector: string,
  timeoutMs = 10_000,
) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const element = document.querySelector<T>(selector);
    if (element) return element;
    await delay(50);
  }
  throw new Error(`Timed out waiting for screenshot element: ${selector}`);
}

function installOverride(path: string, source: string) {
  const target = window as typeof window & {
    __SVARD_DOCUMENT_OVERRIDES__?: Record<
      string,
      { source: string; updatedAt?: string }
    >;
  };
  target.__SVARD_DOCUMENT_OVERRIDES__ = {
    ...(target.__SVARD_DOCUMENT_OVERRIDES__ ?? {}),
    [path]: { source },
  };
}

async function openPublicDocument(
  context: SiteScreenshotScenarioContext,
  path: string,
) {
  context.closeAllTabs();
  await context.openDocument(path);
  context.setConfig((current) =>
    current
      ? { ...current, sidebarVisible: false, rightSidebarVisible: false }
      : current,
  );
  if (document.querySelector('[data-review-id="left-sidebar"]')) {
    await window.__SVARD_COMMANDS__?.dispatch("sidebar.toggleLeft");
  }
  await waitForElement('[data-review-id="document-body"]');
}

export async function runDocsFeatureScenarios(
  context: SiteScreenshotScenarioContext,
) {
  if (context.scenario === "reading-math-details") {
    installOverride(
      mathDocumentPath,
      `# Rendering Reference

Svard keeps equations readable beside technical prose.

## Capacity model

Inline math $D_{head} = D_{model} / H$ stays in the sentence.

$$
Attention(Q,K,V) = softmax(QK^T / \\sqrt{d_k})V
$$

<details open><summary>Review the calculation</summary>

For $D_{model}=12$ and $H=3$, each head uses **4 dimensions**.

</details>
`,
    );
    await openPublicDocument(context, mathDocumentPath);
    await waitForElement(".katex");
    await waitForElement(".markdown-details");
    await delay(250);
    return true;
  }

  if (
    context.scenario === "copy-reference-actions" ||
    context.scenario === "copy-image-reference"
  ) {
    installOverride(
      copyDocumentPath,
      `# Release Context Reference

Use references when a review needs provenance without the whole document.

\`\`\`yaml
review:
  rendered: true
  owner: documentation
\`\`\`

![Release review flow](assets/svard-sample.svg)
`,
    );
    await openPublicDocument(context, copyDocumentPath);
    const target =
      context.scenario === "copy-reference-actions"
        ? await waitForElement<HTMLElement>(".source-block-frame pre")
        : await waitForElement<HTMLImageElement>(
            '[data-review-id="document-body"] img',
          );
    target.scrollIntoView({ block: "center" });
    const openContextMenu = () => {
      const currentTarget =
        context.scenario === "copy-reference-actions"
          ? document.querySelector<HTMLElement>(".source-block-frame pre")
          : document.querySelector<HTMLImageElement>(
              '[data-review-id="document-body"] img',
            );
      if (!currentTarget) return;
      const currentRect = currentTarget.getBoundingClientRect();
      currentTarget.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: currentRect.left + Math.min(currentRect.width / 2, 280),
          clientY: currentRect.top + Math.min(currentRect.height / 2, 120),
          button: 2,
        }),
      );
    };
    openContextMenu();
    await waitForElement(
      context.scenario === "copy-reference-actions"
        ? '[data-review-id="context-menu-item-copy-source"]'
        : '[data-review-id="context-menu-item-copy-image-with-reference"]',
    );
    window.setInterval(openContextMenu, 750);
    await delay(250);
    return true;
  }

  return false;
}
