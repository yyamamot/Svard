export async function applyReloadRestoreScenario(context) {
  const scenario = context.scenario;
  const page = context.page;
  if (scenario === "viewer-session-restore") {
    await page.locator('[data-review-id="split-view-toggle"]').click();
    await page.locator('[data-review-id="viewer-split"]').waitFor();
    await page.locator('[data-review-id="toc"] a').nth(1).click();
  } else if (scenario === "viewer-reload-watch") {
    await page.locator("text=render-fixtures.adoc").click();
    await page.locator("text=Render Fixtures").waitFor();
    await page
      .locator(
        '[data-review-id="active-tab"], [data-review-id="active-document-title"]',
      )
      .waitFor();
  } else if (scenario === "viewer-smart-scroll-restore") {
    const path = "/workspace/docs/markdown-sample.md";
    const initialSource = `# Markdown Sample

Intro before smart scroll.

## Top Section

${"Top filler paragraph.\n\n".repeat(16)}

## Target Section

This is the smart scroll restoration target.

${"Target filler paragraph.\n\n".repeat(18)}

## Tail Section

Tail content.
`;
    const updatedSource = `# Markdown Sample

Prepended update before target.

${"New top content.\n\n".repeat(12)}

## Top Section

${"Top filler paragraph.\n\n".repeat(16)}

## Target Section

This is the smart scroll restoration target.

${"Target filler paragraph.\n\n".repeat(18)}

## Tail Section

Tail content.
`;
    await page.waitForFunction(
      () => typeof window.__SVARD_TRIGGER_DOCUMENT_CHANGE__ === "function",
    );
    await page.evaluate(
      ({ path: documentPath, source }) => {
        window.__SVARD_DOCUMENT_OVERRIDES__ = {
          [documentPath]: {
            source,
            updatedAt: "2026-05-12T00:04:00.000Z",
          },
        };
      },
      { path, source: initialSource },
    );
    await page.locator("text=markdown-sample.md").click();
    await page.getByRole("heading", { name: "Target Section" }).waitFor();
    await page.evaluate(() => {
      const viewer = document.querySelector(
        '[data-review-id="document-viewer"]',
      );
      const target = [...document.querySelectorAll("h2")].find(
        (heading) => heading.textContent?.trim() === "Target Section",
      );
      if (viewer instanceof HTMLElement && target instanceof HTMLElement) {
        viewer.scrollTop = Math.max(0, target.offsetTop - 72);
        viewer.dispatchEvent(new Event("scroll", { bubbles: true }));
      }
    });
    await page.waitForFunction(() => {
      const viewer = document.querySelector(
        '[data-review-id="document-viewer"]',
      );
      return (viewer?.scrollTop ?? 0) > 0;
    });
    await page.waitForTimeout(150);
    await page.evaluate(
      ({ path: documentPath, source }) => {
        const viewer = document.querySelector(
          '[data-review-id="document-viewer"]',
        );
        const target = [...document.querySelectorAll("h2")].find(
          (heading) => heading.textContent?.trim() === "Target Section",
        );
        window.__SVARD_SMART_SCROLL_RESTORE_BEFORE__ = {
          scrollTop: viewer?.scrollTop ?? 0,
          targetTop: target?.getBoundingClientRect().top ?? null,
        };
        window.__SVARD_DOCUMENT_OVERRIDES__ = {
          [documentPath]: {
            source,
            updatedAt: "2026-05-12T00:05:00.000Z",
          },
        };
        window.__SVARD_TRIGGER_DOCUMENT_CHANGE__?.(documentPath);
      },
      { path, source: updatedSource },
    );
    await page.getByText("Prepended update before target").waitFor();
    await page.waitForTimeout(250);
    await page.evaluate(() => {
      const viewer = document.querySelector(
        '[data-review-id="document-viewer"]',
      );
      const target = [...document.querySelectorAll("h2")].find(
        (heading) => heading.textContent?.trim() === "Target Section",
      );
      const viewerRect = viewer?.getBoundingClientRect();
      const targetRect = target?.getBoundingClientRect();
      window.__SVARD_SMART_SCROLL_RESTORE_CHECK__ = {
        before: window.__SVARD_SMART_SCROLL_RESTORE_BEFORE__,
        restoredNearTarget:
          Boolean(viewerRect && targetRect) &&
          targetRect.top >= viewerRect.top - 24 &&
          targetRect.top <= viewerRect.top + 180,
        scrollTop: viewer?.scrollTop ?? 0,
        targetText: target?.textContent?.trim() ?? "",
      };
    });
  } else {
    return false;
  }
  return true;
}
