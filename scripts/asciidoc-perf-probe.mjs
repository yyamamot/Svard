import { spawn } from "node:child_process";
import path from "node:path";

function parseArgs(argv) {
  const args = {
    budget: false,
    out: ".artifacts/perf/asciidoc.json",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--") {
      continue;
    }
    if (value === "--budget") {
      args.budget = true;
      continue;
    }
    if (value === "--out") {
      args.out = argv[++index] ?? args.out;
    }
  }
  return args;
}

function runVitest(args) {
  const child = spawn(
    "pnpm",
    [
      "exec",
      "vitest",
      "run",
      "test/perf/asciidocPerfProbe.test.ts",
      "--reporter",
      "dot",
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        SVARD_ASCIIDOC_PERF_BUDGET: args.budget ? "1" : "0",
        SVARD_ASCIIDOC_PERF_OUT: path.resolve(process.cwd(), args.out),
      },
      shell: process.platform === "win32",
      stdio: "inherit",
    },
  );

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exitCode = code ?? 1;
  });
}

runVitest(parseArgs(process.argv.slice(2)));
