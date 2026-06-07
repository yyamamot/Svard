import path from "node:path";
import fs from "node:fs/promises";
import { runVlmReview } from "./ui-review-utils.mjs";

async function resolveArtifactRoot(artifactArg) {
  if (artifactArg) {
    return path.resolve(artifactArg);
  }

  const latestRoot = path.resolve(".artifacts/ui-review/latest");
  try {
    await fs.access(path.join(latestRoot, "ui-review-report.json"));
    return latestRoot;
  } catch {
    const uiReviewRoot = path.resolve(".artifacts/ui-review");
    const entries = await fs.readdir(uiReviewRoot, { withFileTypes: true });
    const candidates = [];

    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith("ui-review-")) {
        continue;
      }

      const artifactRoot = path.join(uiReviewRoot, entry.name);
      try {
        await fs.access(path.join(artifactRoot, "ui-review-report.json"));
        candidates.push(artifactRoot);
      } catch {
        // Ignore incomplete captures.
      }
    }

    candidates.sort();
    const newest = candidates.at(-1);
    if (!newest) {
      throw new Error(
        "No UI review artifacts with ui-review-report.json found.",
      );
    }
    return newest;
  }
}

async function main() {
  const artifactArg = process.argv.slice(2).find((arg) => arg !== "--");
  const artifactRoot = await resolveArtifactRoot(artifactArg);
  const result = await runVlmReview(artifactRoot);
  console.log(JSON.stringify(result, null, 2));

  if (result.outcome === "blocked") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
