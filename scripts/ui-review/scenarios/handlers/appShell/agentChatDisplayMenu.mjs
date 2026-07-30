export async function selectAgentChatDisplay(
  page,
  label,
  { source = "panel" } = {},
) {
  const trigger =
    source === "topbar"
      ? page.locator('[data-review-id="codex-spike-toggle"]')
      : page
          .locator('[data-review-id="agent-panel"]')
          .locator('[data-review-id="agent-display-menu-trigger"]');
  await trigger.click();
  const menu = page.locator('[data-review-id="agent-display-menu"]').last();
  await menu.waitFor();
  await menu.getByText(label, { exact: true }).click();
}
