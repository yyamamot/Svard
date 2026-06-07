import { chromium } from "@playwright/test";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const artifactRoot = path.join(repoRoot, ".artifacts", "plantuml-teavm");
const assetRoot = path.join(artifactRoot, "assets");
const outputRoot = path.join(artifactRoot, "output");
const runnerPath = path.join(artifactRoot, "runner.html");
const workerPath = path.join(artifactRoot, "worker.html");
const metricsPath = path.join(artifactRoot, "metrics.jsonl");
const reportPath = path.join(artifactRoot, "report.json");

const assetUrls = {
  "plantuml.js": "https://plantuml.github.io/plantuml/js-plantuml/plantuml.js",
  "viz-global.js":
    "https://plantuml.github.io/plantuml/js-plantuml/viz-global.js",
};

const timeoutMs = Number(process.env.PLANTUML_TEAVM_TIMEOUT_MS ?? 10000);

const fixtures = [
  {
    id: "sequence",
    required: true,
    source: `@startuml
Alice -> Bob: Authentication Request
Bob --> Alice: Authentication Response
@enduml`,
  },
  {
    id: "class",
    required: true,
    source: `@startuml
class Document
class Renderer
class Cache
Document --> Renderer
Renderer --> Cache
@enduml`,
  },
  {
    id: "component",
    required: true,
    source: `@startuml
package "Svard" {
  [Viewer UI] --> [HostAdapter]
  [HostAdapter] --> [Diagram Renderer]
}
@enduml`,
  },
  {
    id: "activity",
    required: true,
    source: `@startuml
start
:Open AsciiDoc;
:Extract PlantUML block;
:Render SVG locally;
stop
@enduml`,
  },
  {
    id: "state",
    required: true,
    source: `@startuml
[*] --> Disabled
Disabled --> Local : enable
Local --> [*]
@enduml`,
  },
  {
    id: "mindmap",
    required: false,
    source: `@startmindmap
* Svard
** Local PlantUML
** Kroki fallback
** Safe cache
@endmindmap`,
  },
  {
    id: "gantt",
    required: false,
    source: `@startgantt
[PoC] lasts 1 day
[Integration] starts at [PoC]'s end and lasts 2 days
@endgantt`,
  },
  {
    id: "syntax-error",
    required: false,
    expectDiagnostic: true,
    source: `@startuml
Alice -> Bob
this is not valid plantuml {
@enduml`,
  },
  {
    id: "large-class",
    required: false,
    source: buildLargeClassFixture(),
  },
];

function buildLargeClassFixture() {
  const lines = ["@startuml"];
  for (let index = 1; index <= 40; index += 1) {
    lines.push(`class Node${index}`);
    if (index > 1) {
      lines.push(`Node${index - 1} --> Node${index}`);
    }
  }
  lines.push("@enduml");
  return lines.join("\n");
}

async function main() {
  await fs.mkdir(assetRoot, { recursive: true });
  await fs.mkdir(outputRoot, { recursive: true });
  await fs.writeFile(metricsPath, "");

  const assets = await downloadAssets();
  const sizeReport = await measureAssetSizes(assets);
  const viteSizeReport = await measureViteDistSize(assets);
  const cheerpjComparison = await measureCheerpjComparison();

  await writeRunnerHtml();
  await writeWorkerHtml();

  const browser = await chromium.launch({ headless: true });
  const directPage = await browser.newPage();
  await directPage.goto(pathToFileURL(runnerPath).href);

  const directResults = await runDirectMode(directPage);
  await directPage.close();

  const workerPage = await browser.newPage();
  await workerPage.goto(pathToFileURL(runnerPath).href);
  const workerResults = await runIframeWorkerMode(workerPage);
  await workerPage.close();
  await browser.close();

  const report = {
    generatedAt: new Date().toISOString(),
    artifactRoot,
    source: {
      plantumlJsEditors:
        "https://plantuml.github.io/plantuml/js-plantuml/index-collection.html",
      basicExample:
        "https://plantuml.github.io/plantuml/js-plantuml/index-basic.html",
      githubIntegrationDoc:
        "https://raw.githubusercontent.com/plantuml/plantuml/master/src/main/resources/teavm/GITHUB_INTEGRATION.md",
    },
    assets: sizeReport,
    viteDist: viteSizeReport,
    cheerpjComparison,
    direct: summarizeMode(directResults),
    iframeWorker: summarizeMode(workerResults),
    fixtures: {
      direct: directResults,
      iframeWorker: workerResults,
    },
    decision: buildDecision(directResults, workerResults, sizeReport),
  };

  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`PlantUML TeaVM PoC report: ${reportPath}`);
  console.log(`PlantUML TeaVM PoC metrics: ${metricsPath}`);

  if (report.decision.outcome !== "pass") {
    process.exitCode = 1;
  }
}

async function downloadAssets() {
  const assets = [];
  for (const [fileName, url] of Object.entries(assetUrls)) {
    const filePath = path.join(assetRoot, fileName);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`failed to download ${url}: HTTP ${response.status}`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(filePath, bytes);
    assets.push({ fileName, filePath, url });
  }
  return assets;
}

async function measureAssetSizes(assets) {
  const result = [];
  for (const asset of assets) {
    const bytes = await fs.readFile(asset.filePath);
    result.push({
      fileName: asset.fileName,
      url: asset.url,
      rawBytes: bytes.byteLength,
      gzipBytes: gzipSync(bytes).byteLength,
      brotliBytes: brotliCompressSync(bytes).byteLength,
    });
  }
  return result;
}

async function measureViteDistSize(assets) {
  const viteRoot = path.join(artifactRoot, "vite-size");
  const publicRoot = path.join(viteRoot, "public", "plantuml-teavm");
  const outDir = path.join(artifactRoot, "vite-dist");
  await fs.rm(viteRoot, { recursive: true, force: true });
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(publicRoot, { recursive: true });
  for (const asset of assets) {
    await fs.copyFile(asset.filePath, path.join(publicRoot, asset.fileName));
  }
  await fs.writeFile(
    path.join(viteRoot, "index.html"),
    `<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>PlantUML TeaVM size probe</title></head>
  <body>
    <script src="/plantuml-teavm/viz-global.js"></script>
    <script src="/plantuml-teavm/plantuml.js"></script>
  </body>
</html>
`,
  );

  execFileSync(
    "pnpm",
    ["exec", "vite", "build", viteRoot, "--outDir", outDir, "--emptyOutDir"],
    { cwd: repoRoot, stdio: "pipe" },
  );

  const files = await collectFiles(outDir);
  let totalBytes = 0;
  for (const file of files) {
    totalBytes += (await fs.stat(file)).size;
  }
  return {
    outDir,
    totalBytes,
    files: await Promise.all(
      files.map(async (file) => ({
        path: path.relative(outDir, file),
        bytes: (await fs.stat(file)).size,
      })),
    ),
  };
}

async function collectFiles(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryPath)));
    } else {
      files.push(entryPath);
    }
  }
  return files;
}

async function measureCheerpjComparison() {
  const root = path.join(repoRoot, "plantuml.js", "plantuml-wasm");
  const result = { available: false };
  try {
    const jarJs = path.join(root, "plantuml-core.jar.js");
    const jar = path.join(root, "plantuml-core.jar");
    result.available = true;
    result.packageBytes = await directorySize(root);
    result.files = {
      "plantuml-core.jar.js": (await fs.stat(jarJs)).size,
      "plantuml-core.jar": (await fs.stat(jar)).size,
    };
  } catch (error) {
    result.message = error instanceof Error ? error.message : String(error);
  }
  return result;
}

async function directorySize(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  let size = 0;
  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      size += await directorySize(entryPath);
    } else {
      size += (await fs.stat(entryPath)).size;
    }
  }
  return size;
}

async function writeRunnerHtml() {
  await fs.writeFile(
    runnerPath,
    `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>PlantUML TeaVM PoC runner</title>
    <script src="assets/viz-global.js"></script>
    <script src="assets/plantuml.js"></script>
  </head>
  <body>
    <div id="out"></div>
    <script>
      const target = document.getElementById("out");
      let initialized = false;
      let renderToStringSupported = null;

      function initializePlantUml() {
        const started = performance.now();
        if (!initialized) {
          plantumlLoad();
          initialized = true;
        }
        return {
          initMs: performance.now() - started,
          renderToStringType: typeof window.plantuml.renderToString
        };
      }

      function timeoutPromise(timeoutMs, label) {
        return new Promise((resolve) => {
          setTimeout(() => resolve({
            status: "timeout",
            diagnostics: [label + " timed out after " + timeoutMs + "ms"]
          }), timeoutMs);
        });
      }

      function resultFromSvg(svg, started, initMs, diagnostics = []) {
        const text = new DOMParser()
          .parseFromString(svg, "image/svg+xml")
          .documentElement.textContent || "";
        const hasErrorText = /error|syntax|not recognized|cannot/i.test(text);
        return {
          status: hasErrorText ? "error" : "rendered",
          svg,
          diagnostics: hasErrorText ? diagnostics.concat([text.trim().slice(0, 500)]) : diagnostics,
          metrics: {
            initMs,
            renderMs: performance.now() - started,
            svgBytes: new TextEncoder().encode(svg).byteLength
          }
        };
      }

      function renderViaDom(lines, theme, timeoutMs, initMs) {
        return Promise.race([
          new Promise((resolve) => {
            const started = performance.now();
            target.innerHTML = "";
            const observer = new MutationObserver(() => {
              const svg = target.querySelector("svg");
              if (svg) {
                observer.disconnect();
                resolve(resultFromSvg(target.innerHTML, started, initMs, ["dom-render"]));
              }
            });
            observer.observe(target, { childList: true, subtree: true });
            try {
              window.plantuml.render(lines, "out", theme === "dark" ? { dark: true } : undefined);
            } catch (error) {
              observer.disconnect();
              resolve({
                status: "error",
                diagnostics: [String(error && error.message ? error.message : error)],
                metrics: { initMs, renderMs: performance.now() - started }
              });
            }
          }),
          timeoutPromise(timeoutMs, "dom render")
        ]);
      }

      function renderViaString(lines, theme, timeoutMs, initMs) {
        if (renderToStringSupported === false || typeof window.plantuml.renderToString !== "function") {
          renderToStringSupported = false;
          return Promise.resolve(null);
        }

        return Promise.race([
          new Promise((resolve) => {
            const started = performance.now();
            let settled = false;
            function settle(value) {
              if (!settled) {
                settled = true;
                resolve(value);
              }
            }
            try {
              window.plantuml.renderToString(
                lines,
                (svg) => {
                  renderToStringSupported = true;
                  settle(resultFromSvg(svg, started, initMs, ["render-to-string"]));
                },
                (error) => {
                  renderToStringSupported = true;
                  settle({
                    status: "error",
                    diagnostics: [String(error)],
                    metrics: { initMs, renderMs: performance.now() - started }
                  });
                },
                theme === "dark" ? { dark: true } : undefined
              );
            } catch (_error) {
              renderToStringSupported = false;
              settle(null);
            }
          }),
          new Promise((resolve) => {
            setTimeout(() => {
              renderToStringSupported = false;
              resolve(null);
            }, Math.min(timeoutMs, 750));
          })
        ]);
      }

      window.__plantumlPoc = {
        initialize: initializePlantUml,
        async renderSvg(input) {
          const init = initializePlantUml();
          const lines = input.source.split(/\\r\\n|\\r|\\n/);
          const stringResult = await renderViaString(lines, input.theme, input.timeoutMs, init.initMs);
          if (stringResult) {
            return stringResult;
          }
          return renderViaDom(lines, input.theme, input.timeoutMs, init.initMs);
        },
        renderToStringSupported() {
          return renderToStringSupported;
        }
      };
    </script>
  </body>
</html>
`,
  );
}

async function runDirectMode(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  const initMetrics = await readMetrics(cdp, "direct:init-before");
  const initInfo = await page.evaluate(() => window.__plantumlPoc.initialize());
  await appendMetric({ mode: "direct", fixture: "initialize", initInfo });
  await appendMetric({
    mode: "direct",
    ...(await readMetrics(cdp, "direct:init-after")),
  });

  const results = [];
  for (const fixture of fixtures) {
    const result = await page.evaluate(
      ({ source, timeoutMs: inputTimeoutMs }) =>
        window.__plantumlPoc.renderSvg({
          source,
          theme: "light",
          timeoutMs: inputTimeoutMs,
        }),
      { source: fixture.source, timeoutMs },
    );
    await fs.writeFile(
      path.join(outputRoot, `direct-${fixture.id}.svg`),
      result.svg ?? "",
    );
    const memory = await readMetrics(cdp, `direct:${fixture.id}`);
    const normalized = normalizeFixtureResult(
      "direct",
      fixture,
      result,
      memory,
    );
    results.push(normalized);
    await appendMetric(normalized);
  }

  await appendMetric({ mode: "direct", ...initMetrics });
  return results;
}

async function runIframeWorkerMode(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  await appendMetric({
    mode: "iframe-worker",
    ...(await readMetrics(cdp, "iframe:init-before")),
  });

  const workerUrl = pathToFileURL(workerPath).href;
  const results = [];
  for (const fixture of fixtures) {
    const result = await page.evaluate(
      ({ source, workerUrl: inputWorkerUrl, timeoutMs: inputTimeoutMs }) =>
        new Promise((resolve) => {
          const requestId = "puml-" + Math.random().toString(36).slice(2);
          const started = performance.now();
          const iframe = document.createElement("iframe");
          iframe.style.cssText =
            "position:absolute;width:0;height:0;border:0;visibility:hidden";

          const timeout = setTimeout(() => {
            iframe.remove();
            resolve({
              status: "timeout",
              diagnostics: [
                "iframe worker timed out after " + inputTimeoutMs + "ms",
              ],
              metrics: { renderMs: performance.now() - started },
            });
          }, inputTimeoutMs);

          function onMessage(event) {
            if (!event.data || event.data.requestId !== requestId) {
              return;
            }
            clearTimeout(timeout);
            window.removeEventListener("message", onMessage);
            iframe.remove();
            if (event.data.type === "PLANTUML_ERROR") {
              resolve({
                status: "error",
                diagnostics: [event.data.error],
                metrics: { renderMs: event.data.renderMs },
              });
              return;
            }
            const text =
              new DOMParser().parseFromString(event.data.svg, "image/svg+xml")
                .documentElement.textContent || "";
            const hasErrorText = /error|syntax|not recognized|cannot/i.test(
              text,
            );
            resolve({
              status: hasErrorText ? "error" : "rendered",
              svg: event.data.svg,
              diagnostics: hasErrorText
                ? [text.trim().slice(0, 500)]
                : ["iframe-worker"],
              metrics: {
                renderMs: event.data.renderMs,
                svgBytes: new TextEncoder().encode(event.data.svg).byteLength,
              },
            });
          }

          window.addEventListener("message", onMessage);
          document.body.appendChild(iframe);
          iframe.src = inputWorkerUrl;
          iframe.addEventListener("load", () => {
            iframe.contentWindow.postMessage(
              {
                requestId,
                lines: source.split(/\\r\\n|\\r|\\n/),
                dark: false,
              },
              "*",
            );
          });
        }),
      { source: fixture.source, workerUrl, timeoutMs },
    );

    await fs.writeFile(
      path.join(outputRoot, `iframe-worker-${fixture.id}.svg`),
      result.svg ?? "",
    );
    const memory = await readMetrics(cdp, `iframe:${fixture.id}`);
    const normalized = normalizeFixtureResult(
      "iframe-worker",
      fixture,
      result,
      memory,
    );
    results.push(normalized);
    await appendMetric(normalized);
  }
  return results;
}

async function writeWorkerHtml() {
  await fs.writeFile(
    workerPath,
    `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <script src="assets/viz-global.js"></script>
    <script src="assets/plantuml.js"></script>
  </head>
  <body>
    <div id="out"></div>
    <script>
      plantumlLoad();
      const target = document.getElementById("out");

      function resultFromSvg(requestId, svg, renderMs) {
        const text = new DOMParser()
          .parseFromString(svg, "image/svg+xml")
          .documentElement.textContent || "";
        const hasErrorText = /error|syntax|not recognized|cannot/i.test(text);
        window.parent.postMessage({
          type: "PLANTUML_RESULT",
          requestId,
          svg,
          renderMs,
          diagnosticText: hasErrorText ? text.trim().slice(0, 500) : ""
        }, "*");
      }

      window.addEventListener("message", (event) => {
        const started = performance.now();
        const requestId = event.data.requestId;
        target.innerHTML = "";

        if (typeof window.plantuml.renderToString === "function") {
          try {
            window.plantuml.renderToString(
              event.data.lines,
              (svg) => resultFromSvg(requestId, svg, performance.now() - started),
              (error) => {
                window.parent.postMessage({
                  type: "PLANTUML_ERROR",
                  requestId,
                  error: String(error),
                  renderMs: performance.now() - started
                }, "*");
              },
              event.data.dark ? { dark: true } : undefined
            );
            return;
          } catch (_error) {
            target.innerHTML = "";
          }
        }

        const observer = new MutationObserver(() => {
          if (target.querySelector("svg")) {
            observer.disconnect();
            resultFromSvg(requestId, target.innerHTML, performance.now() - started);
          }
        });
        observer.observe(target, { childList: true, subtree: true });
        try {
          window.plantuml.render(event.data.lines, "out", event.data.dark ? { dark: true } : undefined);
        } catch (error) {
          observer.disconnect();
          window.parent.postMessage({
            type: "PLANTUML_ERROR",
            requestId,
            error: String(error && error.message ? error.message : error),
            renderMs: performance.now() - started
          }, "*");
        }
      });
    </script>
  </body>
</html>
`,
  );
}

async function readMetrics(cdp, label) {
  const response = await cdp.send("Performance.getMetrics");
  const metrics = Object.fromEntries(
    response.metrics.map((metric) => [metric.name, metric.value]),
  );
  return {
    label,
    jsHeapUsedBytes: Math.round(metrics.JSHeapUsedSize ?? 0),
    jsHeapTotalBytes: Math.round(metrics.JSHeapTotalSize ?? 0),
    nodes: Math.round(metrics.Nodes ?? 0),
    documents: Math.round(metrics.Documents ?? 0),
  };
}

function normalizeFixtureResult(mode, fixture, result, memory) {
  const svg = result.svg ?? "";
  const hasSvg = svg.includes("<svg");
  return {
    mode,
    fixtureId: fixture.id,
    required: fixture.required,
    expectedDiagnostic: fixture.expectDiagnostic === true,
    status: result.status,
    hasSvg,
    svgHead: svg.slice(0, 160),
    diagnostics: result.diagnostics ?? [],
    metrics: result.metrics ?? {},
    memory,
    passed: fixture.expectDiagnostic
      ? result.status === "error" && hasSvg
      : result.status === "rendered" && hasSvg,
  };
}

async function appendMetric(value) {
  await fs.appendFile(metricsPath, `${JSON.stringify(value)}\n`);
}

function summarizeMode(results) {
  return {
    total: results.length,
    passed: results.filter((result) => result.passed).length,
    requiredPassed: results.filter((result) => result.required && result.passed)
      .length,
    requiredTotal: results.filter((result) => result.required).length,
    failed: results
      .filter((result) => !result.passed)
      .map((result) => result.fixtureId),
    renderMs: {
      min: Math.min(...results.map((result) => result.metrics.renderMs ?? 0)),
      max: Math.max(...results.map((result) => result.metrics.renderMs ?? 0)),
      total: results.reduce(
        (sum, result) => sum + (result.metrics.renderMs ?? 0),
        0,
      ),
    },
    maxJsHeapUsedBytes: Math.max(
      ...results.map((result) => result.memory.jsHeapUsedBytes ?? 0),
    ),
  };
}

function buildDecision(directResults, workerResults, sizeReport) {
  const requiredDirectPassed = directResults.every(
    (result) => !result.required || result.passed,
  );
  const requiredWorkerPassed = workerResults.every(
    (result) => !result.required || result.passed,
  );
  const syntaxDiagnostic = directResults.some(
    (result) => result.fixtureId === "syntax-error" && result.passed,
  );
  const rawAssetBytes = sizeReport.reduce(
    (sum, asset) => sum + asset.rawBytes,
    0,
  );
  const outcome =
    requiredDirectPassed && requiredWorkerPassed && syntaxDiagnostic
      ? "pass"
      : "fail";

  return {
    outcome,
    requiredDirectPassed,
    requiredWorkerPassed,
    syntaxDiagnostic,
    rawAssetBytes,
    notes: [
      "Direct mode uses one engine instance and must serialize renders.",
      "Iframe worker mode isolates the DOM-dependent renderer and avoids direct main-thread rendering.",
      "Assets are downloaded into .artifacts and are not vendored into the repository by this PoC.",
    ],
  };
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
