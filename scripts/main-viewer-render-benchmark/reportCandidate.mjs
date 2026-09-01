function summarizeCandidateHook(candidateName, candidate) {
  const rasterFixtures =
    candidate.fixtures?.filter((fixture) => fixture.mediaKind === "raster") ??
    [];
  const samples = rasterFixtures.flatMap((fixture) => fixture.samples ?? []);
  const expectedMeasurementCount = Number.isFinite(candidate.measurementCount)
    ? candidate.measurementCount
    : 0;
  const expectedSampleCount = rasterFixtures.length * expectedMeasurementCount;
  let violationCount = Math.max(0, expectedSampleCount - samples.length);
  for (const sample of samples) {
    const counts = sample.counts ?? {};
    const hookMatches =
      counts.candidateHookViolationCount === 0 &&
      counts.rasterSidecarHydratedCount === counts.mediaElementCount &&
      counts.inlineRasterDataUrlCount === 0;
    if (!hookMatches) violationCount += 1;
  }
  return {
    candidateName,
    status:
      candidateName === "raster-sidecar" &&
      expectedSampleCount > 0 &&
      samples.length === expectedSampleCount &&
      violationCount === 0
        ? "applied"
        : "unavailable",
    violationCount,
  };
}

export function buildMainViewerCandidatePair({
  baseline,
  candidate,
  candidateName,
  comparisonOrder,
}) {
  if (candidateName !== "raster-sidecar") {
    throw new Error(`Unsupported Main Viewer candidate: ${candidateName}`);
  }
  if (comparisonOrder !== "AB" && comparisonOrder !== "BA") {
    throw new Error(`Invalid Main Viewer comparison order: ${comparisonOrder}`);
  }
  const artifactsByArm = { baseline, candidate };
  const armOrder =
    comparisonOrder === "AB"
      ? ["baseline", "candidate"]
      : ["candidate", "baseline"];
  return {
    ...candidate,
    candidateHook: summarizeCandidateHook(candidateName, candidate),
    candidateName,
    comparisonOrder,
    pairedArms: armOrder.map((arm) => ({
      arm,
      fixtures: artifactsByArm[arm].fixtures,
      headroom: artifactsByArm[arm].headroom,
    })),
  };
}
