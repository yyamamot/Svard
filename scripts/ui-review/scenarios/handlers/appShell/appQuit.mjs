export async function applyAppQuitScenario({ scenario, page }) {
  if (scenario !== "viewer-app-quit") return false;
  await page.locator('[data-review-id="document-viewer"]').waitFor();
  await page.locator('[data-review-id="file-tree"]').waitFor();
  const initial = await page.evaluate(async () => {
    globalThis.__SVARD_QUIT_REQUEST_COUNT__ = 0;
    const commands = window.__SVARD_COMMANDS__;
    const rows = () =>
      [...document.querySelectorAll('[data-review-id="open-file-item"]')].map(
        (node) => node.textContent,
      );
    const before = rows();
    const enabled = commands.getCommandState("app.quit").enabled;
    const result = await commands.dispatch("app.quit");
    return {
      enabled,
      handled: result.status === "handled",
      requested: globalThis.__SVARD_QUIT_REQUEST_COUNT__ === 1,
      tabsPreserved:
        before.length > 0 && JSON.stringify(rows()) === JSON.stringify(before),
    };
  });
  await page.evaluate(async () => {
    await window.__SVARD_COMMANDS__.dispatch("tab.close");
  });
  await page.locator('[data-review-id="start-page"]').waitFor();
  const empty = await page.evaluate(async () => {
    const closeIndependent = globalThis.__SVARD_QUIT_REQUEST_COUNT__ === 1;
    const enabled =
      window.__SVARD_COMMANDS__.getCommandState("app.quit").enabled;
    await window.__SVARD_COMMANDS__.dispatch("app.quit");
    return {
      closeIndependent,
      enabled,
      requested: globalThis.__SVARD_QUIT_REQUEST_COUNT__ === 2,
    };
  });
  await page.evaluate(async () => {
    await window.__SVARD_COMMANDS__.dispatch("tab.restoreClosed");
  });
  await page.locator('[data-review-id="document-viewer"]').waitFor();
  await page.evaluate(async () => {
    await window.__SVARD_COMMANDS__.dispatch("preferences.open");
  });
  await page.locator('[data-review-id="preferences-page"]').waitFor();
  await page
    .locator('[data-review-id="preferences-nav-item"]')
    .filter({ hasText: "Keybindings" })
    .click();
  await page.locator('[data-review-id="keybinding-search"]').fill("app.quit");
  await page
    .locator('[data-review-id="keybinding-command-id"]')
    .filter({ hasText: "app.quit" })
    .waitFor();
  const preferences = await page.evaluate(async () => {
    const enabled =
      window.__SVARD_COMMANDS__.getCommandState("app.quit").enabled;
    await window.__SVARD_COMMANDS__.dispatch("app.quit");
    return {
      enabled,
      requested: globalThis.__SVARD_QUIT_REQUEST_COUNT__ === 3,
    };
  });
  await page.evaluate(
    (checks) => {
      window.__SVARD_APP_QUIT_CHECK__ = checks;
    },
    { initial, empty, preferences },
  );
  return true;
}
