export async function runAgentImageInputScenario({ composer, page }) {
  const internalDragSource = page
    .locator('[data-review-id="tree-file"]')
    .filter({ hasText: "git-untracked.md" });
  await internalDragSource.scrollIntoViewIfNeeded();
  const internalDragSourceBox = await internalDragSource.boundingBox();
  if (!internalDragSourceBox) {
    throw new Error("Agent internal drag source geometry is unavailable.");
  }
  await page.mouse.move(
    internalDragSourceBox.x + internalDragSourceBox.width / 2,
    internalDragSourceBox.y + internalDragSourceBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    internalDragSourceBox.x + internalDragSourceBox.width / 2 + 24,
    internalDragSourceBox.y + internalDragSourceBox.height / 2 + 4,
    { steps: 6 },
  );
  const internalDragPreview = page.locator(
    '[data-review-id="codex-context-drag-preview"]',
  );
  await internalDragPreview.waitFor();
  const internalDragPreviewVisible =
    (await internalDragPreview.isVisible()) &&
    (await internalDragPreview.locator("svg").count()) === 1 &&
    (await internalDragPreview.textContent())?.includes("git-untracked.md");
  await page.mouse.up();
  const attachSyntheticImage = async (kind, name) => {
    await composer.evaluate(
      (input, payload) => {
        const bytes = Uint8Array.from(atob(payload.base64), (character) =>
          character.charCodeAt(0),
        );
        const file = new File([bytes], payload.name, {
          type: "image/png",
        });
        const transfer = new DataTransfer();
        transfer.items.add(file);
        const event =
          payload.kind === "paste"
            ? new ClipboardEvent("paste", {
                bubbles: true,
                cancelable: true,
                clipboardData: transfer,
              })
            : new DragEvent("drop", {
                bubbles: true,
                cancelable: true,
                dataTransfer: transfer,
              });
        (payload.kind === "paste"
          ? input
          : input.closest(".agent-composer-dock")
        )?.dispatchEvent(event);
      },
      {
        base64:
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        kind,
        name,
      },
    );
  };
  await attachSyntheticImage("paste", "pasted-diagram.png");
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".agent-image-chip:not(.error)").length === 1,
  );
  await page.getByRole("button", { name: "Add files or images" }).click();
  await page.getByRole("menuitem", { name: "Add images…" }).click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".agent-image-chip:not(.error)").length === 2,
  );
  await attachSyntheticImage("drop", "dropped-diagram.png");
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".agent-image-chip:not(.error)").length === 3,
  );
  await page.locator('[data-review-id="agent-image-attachments"]').waitFor();
  const attachedBeforeRemove = await page
    .locator(".agent-image-chip:not(.error)")
    .count();
  await page.getByRole("button", { name: "Remove pasted-diagram.png" }).click();
  const attachedAfterRemove = await page
    .locator(".agent-image-chip:not(.error)")
    .count();
  await composer.press("Meta+Enter");
  await page.locator(".agent-message-images img").first().waitFor();
  await page.locator(".agent-final-answer").waitFor();
  await composer.fill("Continue checking the workspace.");
  await composer.press("Meta+Enter");
  await page
    .locator('.agent-turn[data-turn-status="running"]')
    .last()
    .waitFor();
  await attachSyntheticImage("paste", "next-question.png");
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".agent-image-chip:not(.error)").length === 1,
  );
  const attachedWhileWorking =
    (await page.locator(".agent-image-chip:not(.error)").count()) === 1;
  await page.waitForFunction(
    () => document.querySelectorAll(".agent-final-answer").length >= 2,
  );
  await composer.fill("Inspect the attached image.");
  await composer.press("Meta+Enter");
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".agent-message-images img").length >= 3 &&
      document.querySelectorAll(".agent-final-answer").length >= 3,
  );
  await page.evaluate(
    ({
      attachedAfterRemove,
      attachedBeforeRemove,
      attachedWhileWorking,
      internalDragPreviewVisible,
    }) => {
      window.__SVARD_AGENT_IMAGE_CHECK__ = {
        attachedAfterRemove,
        attachedBeforeRemove,
        attachedWhileWorking,
        internalDragPreviewVisible,
        historyImages: document.querySelectorAll(".agent-message-images img")
          .length,
        pendingImages: document.querySelectorAll(
          ".agent-image-chip:not(.error)",
        ).length,
      };
    },
    {
      attachedAfterRemove,
      attachedBeforeRemove,
      attachedWhileWorking,
      internalDragPreviewVisible,
    },
  );
}
