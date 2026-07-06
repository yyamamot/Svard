#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

import { ossMirrorPolicy } from "./check-oss-mirror.mjs";

const privateRepo = process.cwd();

function git(args) {
  const output = execFileSync("git", args, {
    cwd: privateRepo,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return output.trim();
}

function normalizePath(filePath) {
  return filePath.replaceAll("\\", "/");
}

function isExcluded(filePath) {
  const normalizedPath = normalizePath(filePath);
  return ossMirrorPolicy.excludedPrivateFiles.some((excludedPath) => {
    if (excludedPath.endsWith("/")) {
      if (normalizedPath === excludedPath.slice(0, -1)) {
        return true;
      }
      return normalizedPath.startsWith(excludedPath);
    }
    return normalizedPath === excludedPath;
  });
}

function collectChangedFiles() {
  try {
    const head = git(["rev-parse", "HEAD"]);
    const parent = git(["rev-parse", "HEAD^"]).trim();
    const diff = git(["diff", "--name-only", `${parent}..${head}`]);
    return diff ? diff.split(/\r?\n/).filter(Boolean) : [];
  } catch (error) {
    console.error(
      "mirror: failed to resolve git history; fallback as empty diff",
    );
    return [];
  }
}

function shouldSync(commitFiles) {
  if (commitFiles.length === 0) {
    console.log("mirror: no changed files detected in HEAD commit.");
    return {
      shouldSync: false,
      matchedFiles: [],
      skippedFiles: [],
    };
  }

  const publicFiles = [];
  const skippedFiles = [];

  for (const file of commitFiles) {
    const normalized = normalizePath(file);
    if (isExcluded(normalized)) {
      skippedFiles.push(normalized);
      continue;
    }
    publicFiles.push(normalized);
  }

  return {
    shouldSync: publicFiles.length > 0,
    matchedFiles: publicFiles,
    skippedFiles,
  };
}

function inferCommitSummary(commitFiles) {
  const hasDocumentReviewSession = commitFiles.some(
    (file) =>
      file.includes("DocumentReviewSession") ||
      file.includes("documentReviewSession") ||
      file.includes("sourceControlContextMenus") ||
      file.includes("SourceControlPanel") ||
      file.includes("DocumentsView"),
  );
  const hasRenderedDiff = commitFiles.some(
    (file) =>
      file.startsWith("src/ui/lib/gitRenderedDiff/") ||
      file.startsWith("src/ui/components/") ||
      file.startsWith("src/ui/styles/") ||
      file.includes("PostDiffGitMarkers") ||
      file.includes("gitRenderedDiff"),
  );
  const hasUiReview = commitFiles.some((file) =>
    file.startsWith("scripts/ui-review/"),
  );
  const hasUnitTest = commitFiles.some((file) => file.startsWith("test/unit/"));
  const hasFixture = commitFiles.some((file) => file.includes("fixtures"));

  if (hasDocumentReviewSession && hasUiReview && hasUnitTest) {
    return "add document review session stream";
  }
  if (hasDocumentReviewSession && hasUnitTest) {
    return "add document review session tests";
  }
  if (hasDocumentReviewSession) {
    return "add document review session";
  }
  if (hasRenderedDiff && hasUiReview && hasUnitTest) {
    return "sync rendered diff markers implementation and review coverage";
  }
  if (hasRenderedDiff && hasUnitTest) {
    return "sync rendered diff marker implementation and tests";
  }
  if (hasRenderedDiff) {
    return "sync rendered diff marker implementation";
  }
  if (hasUiReview) {
    return "sync review scenario and assertion updates";
  }
  if (hasFixture) {
    return "sync fixture updates";
  }
  if (hasUnitTest) {
    return "sync unit test updates";
  }
  return "sync public-facing changes";
}

function mirrorCommit(message) {
  const result = spawnSync(
    "make",
    ["-f", path.join(privateRepo, "Makefile.private"), "mirror-commit"],
    {
      stdio: "inherit",
      cwd: privateRepo,
      env: {
        ...process.env,
        MIRROR_COMMIT_MESSAGE: message,
      },
    },
  );

  if (result.status !== 0 || result.error) {
    process.exit(result.status ?? 1);
  }
}

function run() {
  const commitFiles = collectChangedFiles();
  const decision = shouldSync(commitFiles);

  if (!decision.shouldSync) {
    console.log(
      "mirror: public mirror sync is skipped because changed files are mirror-excluded.",
    );
    if (
      decision.matchedFiles.length === 0 &&
      decision.skippedFiles.length > 0
    ) {
      console.log(`mirror: skipped files: ${decision.skippedFiles.join(", ")}`);
    }
    return;
  }
  const shortSha = git(["rev-parse", "--short=8", "HEAD"]);
  const message =
    process.env.MIRROR_COMMIT_MESSAGE?.trim() ||
    `feat(viewer): ${inferCommitSummary(decision.matchedFiles)} (${shortSha})`;

  console.log("mirror: detected mirror-relevant files:");
  for (const file of decision.matchedFiles) {
    console.log(`  - ${file}`);
  }

  mirrorCommit(message);
}

run();
