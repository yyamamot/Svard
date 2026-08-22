import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const expectedCounts = [1, 8, 16];
const boundaryCount = 17;

function parseArgs(argv) {
  const args = {
    out: ".artifacts/perf/mermaid-budget.json",
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--out") {
      args.out = argv[++index] ?? args.out;
    }
  }
  return args;
}

function toArtifactRun(metrics) {
  return {
    count: metrics.requestedCount,
    attemptedCount: metrics.attemptedCount,
    renderedCount: metrics.renderedCount,
    blockedCount: metrics.blockedCount,
    inputBytes: metrics.inputBytes,
    outputBytes: metrics.outputBytes,
    durationMs: Number(metrics.durationMs.toFixed(2)),
    status: metrics.status,
  };
}

function assertRun(run, expectedCount) {
  if (
    run.count !== expectedCount ||
    run.attemptedCount !== expectedCount ||
    run.renderedCount !== expectedCount ||
    run.blockedCount !== 0 ||
    run.status !== "complete"
  ) {
    throw new Error(
      "Mermaid budget probe did not complete within the fixed budget.",
    );
  }
}

function assertBoundary(run) {
  if (
    run.count !== boundaryCount ||
    run.attemptedCount !== 16 ||
    run.renderedCount !== 16 ||
    run.blockedCount !== 1 ||
    run.status !== "partial"
  ) {
    throw new Error(
      "Mermaid count budget did not stop the seventeenth render.",
    );
  }
}

async function createProbeServer() {
  const server = await createServer({
    appType: "custom",
    logLevel: "error",
    server: {
      host: "127.0.0.1",
      port: 0,
      strictPort: false,
    },
    plugins: [
      {
        name: "svard-mermaid-budget-probe",
        configureServer(viteServer) {
          viteServer.middlewares.use(
            "/__mermaid-budget-probe__",
            (_request, response) => {
              response.statusCode = 200;
              response.setHeader("Content-Type", "text/html; charset=utf-8");
              response.end("<!doctype html><html><body></body></html>");
            },
          );
        },
      },
    ],
  });
  await server.listen();
  const url = server.resolvedUrls?.local.at(0);
  if (!url) {
    await server.close();
    throw new Error("Mermaid budget probe server did not expose a local URL.");
  }
  return { server, url: new URL("/__mermaid-budget-probe__", url).href };
}

async function measure(page, count, runSequence) {
  return page.evaluate(
    async ({ diagramCount, sequence }) => {
      const { createMermaidRenderSession, renderMermaidDiagrams } =
        await import("/src/core/renderMermaid.ts");
      const diagrams = Array.from({ length: diagramCount }, (_, index) => ({
        id: `mermaid-budget-${sequence}-${index}`,
        source: `flowchart TD\n  A${index}[Start] --> B${index}[Done]`,
      }));
      const session = createMermaidRenderSession({});
      await renderMermaidDiagrams(diagrams, "light", session);
      return session.getMetrics();
    },
    { diagramCount: count, sequence: runSequence },
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { server, url } = await createProbeServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url);

    const runs = [];
    for (const [index, count] of expectedCounts.entries()) {
      const run = toArtifactRun(await measure(page, count, index));
      assertRun(run, count);
      runs.push(run);
    }
    const boundary = toArtifactRun(
      await measure(page, boundaryCount, expectedCounts.length),
    );
    assertBoundary(boundary);

    const report = {
      status: "passed",
      runs,
      boundary,
    };
    const outputPath = path.resolve(args.out);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Mermaid budget probe failed.",
  );
  process.exitCode = 1;
});
