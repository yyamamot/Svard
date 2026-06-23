import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

export const defaultManifestPath = path.join(
  repoRoot,
  "site",
  "screenshot-manifest.json",
);

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function timestampId() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export function parseArgs(argv) {
  const args = { manifest: defaultManifestPath, only: null, force: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--manifest") {
      args.manifest = path.resolve(argv[++index] ?? args.manifest);
    } else if (value === "--only") {
      args.only = argv[++index] ?? null;
    } else if (value === "--force") {
      args.force = true;
    }
  }
  return args;
}

export async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

export async function ensureDir(directory) {
  await fs.mkdir(directory, { recursive: true });
}

export function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      env: options.env ?? process.env,
      stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      const result = { code: code ?? 1, signal, stdout, stderr };
      if (result.code === 0 || options.allowFailure) {
        resolve(result);
      } else {
        const error = new Error(
          `${command} ${args.join(" ")} failed with exit code ${result.code}`,
        );
        error.result = result;
        reject(error);
      }
    });
  });
}
