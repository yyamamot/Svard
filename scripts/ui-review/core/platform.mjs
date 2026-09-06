export async function expectedSettingsLabel(page) {
  return page.evaluate(() => {
    const platform = navigator.userAgentData?.platform ?? navigator.platform;
    return platform.toLowerCase().includes("mac") ? "Settings" : "Preferences";
  });
}
