import fs from "node:fs/promises";
import path from "node:path";
import { readDocuments } from "./markdown-perf/documents.mjs";
import { startServer } from "./markdown-perf/server.mjs";
import {
  derivePlaceholderMeasurements,
  withoutPlaceholderMeasurementDocuments,
} from "./markdown-perf/metrics.mjs";
import {
  defaultBudgets,
  deriveBudgetSummary,
} from "./markdown-perf/budgets.mjs";
import { runProbe } from "./markdown-perf/phases.mjs";

function parseArgs(argv) {
  const args = {
    budget: false,
    diagnostic: false,
    documents: [],
    out: null,
    port: 4292,
    url: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--out") {
      args.out = argv[++index] ?? null;
    } else if (value === "--diagnostic") {
      args.diagnostic = true;
    } else if (value === "--budget") {
      args.budget = true;
    } else if (value === "--port") {
      args.port = Number(argv[++index] ?? args.port);
    } else if (value === "--url") {
      args.url = argv[++index] ?? null;
    } else if (value === "--") {
      continue;
    } else {
      args.documents.push(value);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const documents = await readDocuments(args.documents, args.budget);
  let server = null;
  const url = args.url ?? (server = await startServer(args.port)).url;
  try {
    const reportData = await runProbe({
      diagnostic: args.diagnostic,
      documents,
      url,
    });
    const placeholderMeasurements = derivePlaceholderMeasurements(
      reportData.phases,
    );
    const artifactReportData =
      withoutPlaceholderMeasurementDocuments(reportData);
    const report = {
      ...(args.budget
        ? deriveBudgetSummary(
            reportData.phases,
            reportData.summary,
            defaultBudgets,
          )
        : {}),
      diagnostic: args.diagnostic,
      schemaVersion: 2,
      generatedAt: new Date().toISOString(),
      placeholderMeasurements,
      ...artifactReportData,
    };
    const output = `${JSON.stringify(report, null, 2)}\n`;
    if (args.out) {
      await fs.mkdir(path.dirname(path.resolve(args.out)), { recursive: true });
      await fs.writeFile(args.out, output);
    }
    process.stdout.write(output);
    if (args.budget && !report.budgetPassed) {
      process.exitCode = 1;
    }
  } finally {
    server?.stop();
  }
}

await main();
