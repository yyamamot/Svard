import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { preview } from "vite";
import {
  parseSystemReviewArgs,
  runSystemConsistencyReview,
} from "./ui-review/system-consistency.mjs";

const lockDir = path.resolve(
  ".artifacts",
  "ui-review",
  ".system-ui-review.lock",
);
const lockRetryMs = 1000;
const staleLockMs = 20 * 60 * 1000;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function writeLockMetadata(args) {
  await fs.writeFile(
    path.join(lockDir, "owner.json"),
    `${JSON.stringify(
      {
        pid: process.pid,
        scenarios: args.scenarioIds,
        featureId: args.id,
        reuseLatest: args.reuseLatest,
        startedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );
}

async function removeIfStaleLock() {
  try {
    const stat = await fs.stat(lockDir);
    if (Date.now() - stat.mtimeMs <= staleLockMs) {
      return false;
    }
    await fs.rm(lockDir, { recursive: true, force: true });
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function acquireUiReviewLock(args) {
  await fs.mkdir(path.dirname(lockDir), { recursive: true });
  let announcedWait = false;

  while (true) {
    try {
      await fs.mkdir(lockDir);
      await writeLockMetadata(args);
      return async () => {
        await fs.rm(lockDir, { recursive: true, force: true });
      };
    } catch (error) {
      if (error?.code !== "EEXIST") {
        throw error;
      }
      const removedStaleLock = await removeIfStaleLock();
      if (removedStaleLock) {
        continue;
      }
      if (!announcedWait) {
        console.error(
          "Another system UI review run is active; waiting for the UI review lock...",
        );
        announcedWait = true;
      }
      await delay(lockRetryMs);
    }
  }
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `${command} ${args.join(" ")} failed with exit code ${code}`,
          ),
        );
      }
    });
  });
}

async function main() {
  const args = parseSystemReviewArgs(process.argv.slice(2));
  const releaseLock = await acquireUiReviewLock(args);
  const port = 4288;
  const baseURL = `http://127.0.0.1:${port}`;
  let server = null;

  try {
    if (!args.reuseLatest) {
      await run("pnpm", ["run", "build"]);
      server = await preview({
        preview: {
          host: "127.0.0.1",
          port,
          strictPort: true,
        },
      });
    }

    const result = await runSystemConsistencyReview({
      ...args,
      baseURL,
    });

    console.log(
      JSON.stringify(
        {
          outcome: result.outcome,
          scenarioIds: result.scenarioIds,
          artifactRoot: result.artifactRoot,
        },
        null,
        2,
      ),
    );
  } finally {
    if (server) {
      await server.httpServer.close();
    }
    await releaseLock();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
