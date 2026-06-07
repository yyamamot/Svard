import {
  createArtifactRoot,
  captureScenario,
  parseArgs,
} from "./ui-review-utils.mjs";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const artifactRoot = await createArtifactRoot("ui-feature");
  const report = await captureScenario({ ...args, artifactRoot });
  console.log(
    JSON.stringify({ outcome: report.outcome, artifactRoot }, null, 2),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
