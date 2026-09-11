export async function buildDocumentPositionAssertions({ scenario, page }) {
  if (scenario !== "viewer-document-switch-scroll-restore") return {};
  const check = await page.evaluate(
    () => window.__SVARD_DOCUMENT_POSITION_CHECK__,
  );
  return {
    hasDocumentPositionRestoration: check?.samples >= 10 && check.maxError <= 2,
    hasReadingPositionWithoutRerender:
      check?.idleRenderDelta === 0 &&
      check.idleCommitDelta === 0 &&
      check.idleDiagramDelta === 0,
  };
}
