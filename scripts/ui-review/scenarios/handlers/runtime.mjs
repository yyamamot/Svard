export async function applyRuntimeScenario(context) {
  const scenario = context.scenario;
  const page = context.page;
  if (scenario === "viewer-runtime-artifacts") {
    await page.locator("text=render-fixtures.adoc").click();
  } else {
    return false;
  }
  return true;
}
