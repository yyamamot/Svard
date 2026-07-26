import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const executableArgument = process.argv.indexOf("--executable");
const executable =
  executableArgument >= 0 ? process.argv[executableArgument + 1] : "codex";
if (executableArgument >= 0 && !executable) {
  throw new Error("--executable requires a path.");
}
const outputDirectory = fs.mkdtempSync(
  path.join(os.tmpdir(), "svard-codex-app-server-"),
);

const requiredTokens = [
  '"method": "initialize"',
  '"method": "thread/start"',
  '"method": "turn/start"',
  '"method": "turn/interrupt"',
  '"method": "item/commandExecution/requestApproval"',
  '"method": "item/fileChange/requestApproval"',
  '"method": "item/permissions/requestApproval"',
  '"method": "item/agentMessage/delta"',
  '"method": "item/reasoning/summaryTextDelta"',
  '"method": "turn/plan/updated"',
  '"method": "turn/completed"',
];

try {
  const version = spawnSync(executable, ["--version"], {
    encoding: "utf8",
    timeout: 2_000,
  });
  if (version.error || version.status !== 0) {
    throw new Error("Codex CLI could not be started.");
  }

  const generated = spawnSync(
    executable,
    ["app-server", "generate-ts", "--experimental", "--out", outputDirectory],
    {
      encoding: "utf8",
      timeout: 30_000,
      maxBuffer: 4 * 1024 * 1024,
    },
  );
  if (generated.error || generated.status !== 0) {
    throw new Error("Codex app-server schema generation failed.");
  }

  const sources = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else if (entry.isFile() && entry.name.endsWith(".ts")) {
        sources.push(fs.readFileSync(entryPath, "utf8"));
      }
    }
  };
  visit(outputDirectory);
  const schemaText = sources.join("\n");
  const missing = requiredTokens.filter((token) => !schemaText.includes(token));
  if (missing.length > 0) {
    throw new Error(
      `Codex app-server is missing required protocol entries: ${missing.join(", ")}`,
    );
  }

  console.log(
    `Codex app-server protocol check passed (${version.stdout.trim()}).`,
  );
} finally {
  fs.rmSync(outputDirectory, { recursive: true, force: true });
}
