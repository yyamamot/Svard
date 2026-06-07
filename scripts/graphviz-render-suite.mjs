import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const fixtureRoot = path.join(root, "test", "fixtures", "graphviz");
const vendorWorker = path.join(
  root,
  "public",
  "vendor",
  "plantuml-teavm",
  "graphviz-worker.html",
);

async function loadManifest() {
  return JSON.parse(
    await fs.readFile(path.join(fixtureRoot, "manifest.json"), "utf8"),
  );
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) {
    return "text/html; charset=utf-8";
  }
  if (filePath.endsWith(".js")) {
    return "text/javascript; charset=utf-8";
  }
  return "application/octet-stream";
}

async function startVendorServer() {
  const vendorRoot = path.dirname(vendorWorker);
  const server = http.createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
      const filePath = path.join(vendorRoot, path.basename(pathname));
      const body = await fs.readFile(filePath);
      response.writeHead(200, { "content-type": contentType(filePath) });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end("not found");
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("failed to start Graphviz vendor server");
  }
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function renderFixture(page, source, timeoutMs = 10000) {
  return page.evaluate(
    ({ source: dot, timeoutMs: timeout }) =>
      new Promise((resolve) => {
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.src = window.__GRAPHVIZ_WORKER_URL__;
        document.body.append(iframe);

        const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const timer = setTimeout(() => {
          iframe.remove();
          resolve({
            status: "timeout",
            diagnostics: ["Graphviz render timed out."],
          });
        }, timeout);

        window.addEventListener(
          "message",
          (event) => {
            if (
              !event.data ||
              event.data.requestId !== requestId ||
              !["GRAPHVIZ_RESULT", "GRAPHVIZ_ERROR"].includes(event.data.type)
            ) {
              return;
            }

            clearTimeout(timer);
            iframe.remove();
            resolve({
              status:
                event.data.type === "GRAPHVIZ_RESULT" ? "rendered" : "error",
              svg: event.data.svg,
              diagnostics: event.data.diagnostics ?? [],
              metrics: event.data.metrics ?? {},
            });
          },
          { once: true },
        );

        iframe.addEventListener("load", () => {
          iframe.contentWindow.postMessage(
            { type: "GRAPHVIZ_RENDER", requestId, source: dot },
            "*",
          );
        });
      }),
    { source, timeoutMs },
  );
}

function svgText(svg) {
  return svg
    ? svg
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    : "";
}

async function main() {
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const artifactRoot = path.join(root, ".artifacts", "graphviz-suite", runId);
  await fs.mkdir(path.join(artifactRoot, "svg"), { recursive: true });

  const manifest = await loadManifest();
  const vendorServer = await startVendorServer();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(vendorServer.baseUrl);
  await page.evaluate((workerUrl) => {
    window.__GRAPHVIZ_WORKER_URL__ = workerUrl;
  }, `${vendorServer.baseUrl}/graphviz-worker.html`);

  const results = [];
  for (const fixture of manifest.fixtures) {
    const source = await fs.readFile(
      path.join(fixtureRoot, fixture.file),
      "utf8",
    );
    const started = performance.now();
    const result = await renderFixture(page, source);
    const renderMs = performance.now() - started;
    const text = svgText(result.svg);
    const textPassed = fixture.expectedText.every((value) =>
      result.status === "rendered"
        ? text.includes(value)
        : result.diagnostics.join("\n").toLowerCase().includes(value),
    );
    const passed =
      result.status === fixture.expectedStatus &&
      textPassed &&
      (result.status !== "rendered" || result.svg?.includes("<svg"));

    if (result.svg) {
      await fs.writeFile(
        path.join(artifactRoot, "svg", `${fixture.id}.svg`),
        result.svg,
      );
    }

    results.push({
      id: fixture.id,
      status: result.status,
      expectedStatus: fixture.expectedStatus,
      passed,
      diagnostics: result.diagnostics,
      renderMs,
      svgBytes: result.svg
        ? new TextEncoder().encode(result.svg).byteLength
        : 0,
    });
  }

  await browser.close();
  await vendorServer.close();

  const report = {
    runId,
    outcome: results.every((result) => result.passed) ? "passed" : "failed",
    artifactRoot,
    results,
  };
  await fs.writeFile(
    path.join(artifactRoot, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(`Graphviz local renderer suite: ${artifactRoot}`);

  if (report.outcome !== "passed") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
