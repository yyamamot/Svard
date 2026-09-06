export async function applyMacosMenuSettingsScenario({ scenario, page }) {
  if (scenario !== "viewer-macos-menu-settings") return false;
  await page.locator('[data-review-id="document-viewer"]').waitFor();
  await page.keyboard.press("Meta+,");
  await page.locator('[data-review-id="preferences-page"]').waitFor();
  const labels = await page.evaluate(() => ({
    title: document
      .querySelector('[data-review-id="active-document-title"]')
      ?.textContent?.trim(),
    panel: document
      .querySelector('[data-review-id="preferences-dialog"]')
      ?.getAttribute("aria-label"),
    tab: document
      .querySelector('[data-tab-kind="preferences"] .open-file-button')
      ?.getAttribute("aria-label"),
    close: document
      .querySelector(
        '[data-tab-kind="preferences"] [data-review-id="open-file-close"]',
      )
      ?.getAttribute("aria-label"),
    command: window.__SVARD_COMMANDS__?.getLastCommand(),
  }));
  await page
    .locator('[data-review-id="preferences-nav-item"]')
    .filter({ hasText: "Keybindings" })
    .click();
  await page
    .locator('[data-review-id="keybinding-search"]')
    .fill("Close Settings");
  await page
    .locator('[data-review-id="keybinding-command-id"]')
    .filter({ hasText: "preferences.close" })
    .waitFor();
  const closeSearch =
    (await page
      .locator('[data-review-id="keybinding-shortcut-table"] tbody tr')
      .count()) === 1;
  await page
    .locator('[data-review-id="keybinding-search"]')
    .fill("Open Settings");
  await page
    .locator('[data-review-id="keybinding-command-id"]')
    .filter({ hasText: "preferences.open" })
    .waitFor();
  await page.evaluate(
    (checks) => {
      window.__SVARD_MACOS_SETTINGS_CHECK__ = checks;
    },
    { labels, closeSearch },
  );
  return true;
}
