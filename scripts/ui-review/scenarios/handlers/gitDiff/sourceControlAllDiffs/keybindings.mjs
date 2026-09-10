export async function exerciseAllDiffsKeybindings(page) {
  await page
    .locator('[data-review-id="source-control-all-diffs-panel"]')
    .click({ position: { x: 20, y: 20 } });
  await page.waitForFunction(
    () =>
      document
        .querySelector('.diff-stream-rendered-body [data-active-change="true"]')
        ?.getAttribute("data-change-index") === "0",
  );
  await page.keyboard.press("Alt+ArrowDown");
  await page.waitForFunction(
    () =>
      document
        .querySelector('.diff-stream-rendered-body [data-active-change="true"]')
        ?.getAttribute("data-change-index") === "1",
  );
  await page.keyboard.press("Alt+ArrowUp");
  await page.waitForFunction(
    () =>
      document
        .querySelector('.diff-stream-rendered-body [data-active-change="true"]')
        ?.getAttribute("data-change-index") === "0",
  );
  await page.evaluate(async () => {
    const streamBody = document.querySelector(".diff-stream-body");
    const scrollable =
      streamBody instanceof HTMLElement
        ? streamBody.scrollHeight > streamBody.clientHeight
        : false;
    const bottomResult =
      await window.__SVARD_COMMANDS__?.dispatch("viewer.bottom");
    const afterBottom = streamBody?.scrollTop ?? 0;
    const topResult = await window.__SVARD_COMMANDS__?.dispatch("viewer.top");
    const afterTop = streamBody?.scrollTop ?? -1;
    const activeChangeIndex =
      document
        .querySelector('.diff-stream-rendered-body [data-active-change="true"]')
        ?.getAttribute("data-change-index") ?? "";
    const closeResult = await window.__SVARD_COMMANDS__?.dispatch("tab.close");
    window.__SVARD_ALL_DIFFS_KEYBINDING_SAMPLE__ = {
      afterBottom,
      afterTop,
      activeChangeIndex,
      bottomStatus: bottomResult?.status ?? "",
      closeStatus: closeResult?.status ?? "",
      closeCommand: window.__SVARD_COMMANDS__?.getLastCommand(),
      scrollable,
      topStatus: topResult?.status ?? "",
    };
  });
  await page
    .locator('[data-review-id="source-control-all-diffs-panel"]')
    .waitFor({ state: "detached" });
  await page.evaluate(() => {
    window.__SVARD_ALL_DIFFS_KEYBINDING_SAMPLE__ = {
      ...window.__SVARD_ALL_DIFFS_KEYBINDING_SAMPLE__,
      panelCount: document.querySelectorAll(
        '[data-review-id="source-control-all-diffs-panel"]',
      ).length,
    };
  });
}
