import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const fixtureRoot = path.join(repoRoot, "test", "fixtures", "plantuml");
const manifestPath = path.join(fixtureRoot, "manifest.json");
const vendorRoot = path.join(repoRoot, "public", "vendor", "plantuml-teavm");
const artifactBase = path.join(repoRoot, ".artifacts", "plantuml-suite");
const timeoutMs = Number(process.env.PLANTUML_SUITE_TIMEOUT_MS ?? 10000);
const extended = process.argv.includes("--extended");

async function main() {
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const artifactRoot = path.join(artifactBase, runId);
  const svgRoot = path.join(artifactRoot, "svg");
  const screenshotRoot = path.join(artifactRoot, "screenshots");
  const metricsPath = path.join(artifactRoot, "metrics.jsonl");
  await fs.mkdir(svgRoot, { recursive: true });
  await fs.mkdir(screenshotRoot, { recursive: true });
  await fs.writeFile(metricsPath, "");

  const fixtures = await loadFixtures();
  if (extended) {
    fixtures.push(...(await loadExtendedFixtures()));
  }

  const runnerPath = path.join(artifactRoot, "runner.html");
  await fs.writeFile(runnerPath, buildRunnerHtml());

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  await page.goto(pathToFileURL(runnerPath).href);

  const results = [];
  for (const fixture of fixtures) {
    const result = await runFixture({
      page,
      fixture,
      svgRoot,
      screenshotRoot,
      metricsPath,
    });
    results.push(result);
  }

  await browser.close();

  const failedRequired = results.filter(
    (result) => result.required && !result.passed,
  );
  const report = {
    runId,
    generatedAt: new Date().toISOString(),
    artifactRoot,
    mode: extended ? "extended" : "required",
    timeoutMs,
    summary: {
      total: results.length,
      passed: results.filter((result) => result.passed).length,
      failed: results.filter((result) => !result.passed).length,
      required: results.filter((result) => result.required).length,
      failedRequired: failedRequired.length,
    },
    results,
  };

  await fs.writeFile(
    path.join(artifactRoot, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  await fs.writeFile(
    path.join(artifactRoot, "summary.md"),
    buildSummary(report),
  );

  console.log(
    JSON.stringify(
      {
        outcome: failedRequired.length === 0 ? "passed" : "failed",
        artifactRoot,
        total: report.summary.total,
        failedRequired: failedRequired.length,
      },
      null,
      2,
    ),
  );

  if (failedRequired.length > 0) {
    process.exitCode = 1;
  }
}

async function loadFixtures() {
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  return Promise.all(
    manifest.fixtures.map(async (fixture) => ({
      ...fixture,
      source: fixture.generated
        ? buildGeneratedFixture(fixture.generated)
        : await fs.readFile(path.join(fixtureRoot, fixture.file), "utf8"),
      origin: fixture.generated ? "generated" : fixture.file,
    })),
  );
}

async function loadExtendedFixtures() {
  const root = path.join(
    repoRoot,
    "plantuml.js",
    "playground",
    "example-pumls",
  );
  const files = await listFiles(root, ".puml").catch(() => []);
  return Promise.all(
    files.map(async (filePath) => ({
      id: `extended-${path
        .relative(root, filePath)
        .replaceAll(path.sep, "-")
        .replace(/\.puml$/i, "")}`,
      diagramType: "extended",
      expectedStatus: "rendered",
      required: false,
      expectedText: [],
      expectedDiagnostic: [],
      visualChecks: ["svg-present"],
      source: await fs.readFile(filePath, "utf8"),
      origin: path.relative(repoRoot, filePath),
    })),
  );
}

async function listFiles(root, extension) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryPath, extension)));
    } else if (entry.isFile() && entry.name.endsWith(extension)) {
      files.push(entryPath);
    }
  }
  return files;
}

function buildGeneratedFixture(name) {
  if (name !== "large-class-chain") {
    throw new Error(`Unknown generated PlantUML fixture: ${name}`);
  }

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

async function runFixture({
  page,
  fixture,
  svgRoot,
  screenshotRoot,
  metricsPath,
}) {
  const rendered = await page.evaluate(
    async ({ source, timeoutMs: timeout }) =>
      window.__plantumlSuite.render(source, timeout),
    { source: fixture.source, timeoutMs },
  );
  const text = await page.evaluate(
    (svg) => window.__plantumlSuite.svgText(svg),
    rendered.svg ?? "",
  );
  const normalizedText = normalizeText(text);
  const svgBytes = rendered.svg
    ? new TextEncoder().encode(rendered.svg).byteLength
    : 0;
  const svgPath = path.join(svgRoot, `${fixture.id}.svg`);
  const screenshotPath = path.join(screenshotRoot, `${fixture.id}.png`);

  if (rendered.svg) {
    await fs.writeFile(svgPath, rendered.svg);
    await page.evaluate(
      (svg) => window.__plantumlSuite.preview(svg),
      rendered.svg,
    );
    await page.locator("#preview svg").screenshot({ path: screenshotPath });
  }

  const bounds = await page.evaluate(() => window.__plantumlSuite.bounds());
  const checks = evaluateChecks({
    fixture,
    rendered,
    normalizedText,
    svgBytes,
    bounds,
  });
  const passed = checks.every((check) => check.passed);
  const safeResult = {
    fixtureId: fixture.id,
    diagramType: fixture.diagramType,
    origin: fixture.origin,
    required: fixture.required === true,
    expectedStatus: fixture.expectedStatus,
    status: rendered.status,
    passed,
    diagnostics: rendered.diagnostics,
    metrics: rendered.metrics,
    svgBytes,
    bounds,
    checks,
    svgPath: rendered.svg ? svgPath : null,
    screenshotPath: rendered.svg ? screenshotPath : null,
  };

  await fs.appendFile(
    metricsPath,
    `${JSON.stringify({
      fixtureId: fixture.id,
      required: fixture.required === true,
      status: rendered.status,
      passed,
      renderMs: rendered.metrics?.renderMs ?? null,
      svgBytes,
      bounds,
    })}\n`,
  );

  return safeResult;
}

function evaluateChecks({
  fixture,
  rendered,
  normalizedText,
  svgBytes,
  bounds,
}) {
  const checks = [];
  const diagnostics = normalizeText((rendered.diagnostics ?? []).join(" "));
  const expectedStatus = fixture.expectedStatus ?? "rendered";
  checks.push({
    name: "status",
    passed: rendered.status === expectedStatus,
    detail: `${rendered.status} === ${expectedStatus}`,
  });

  if (expectedStatus === "rendered") {
    checks.push({
      name: "svg-present",
      passed: Boolean(rendered.svg?.trim().startsWith("<svg")),
      detail: "SVG starts with <svg",
    });
    checks.push({
      name: "svg-size",
      passed: svgBytes > 100,
      detail: `${svgBytes} bytes`,
    });
  } else {
    checks.push({
      name: "error-diagnostic",
      passed: (fixture.expectedDiagnostic ?? []).every((value) =>
        diagnostics.toLowerCase().includes(String(value).toLowerCase()),
      ),
      detail: diagnostics.slice(0, 180),
    });
  }

  for (const expected of fixture.expectedText ?? []) {
    checks.push({
      name: `text:${expected}`,
      passed: normalizedText.includes(normalizeText(expected)),
      detail: expected,
    });
  }

  if ((fixture.visualChecks ?? []).includes("nonzero-bounds")) {
    checks.push({
      name: "nonzero-bounds",
      passed: bounds.width > 1 && bounds.height > 1,
      detail: `${bounds.width}x${bounds.height}`,
    });
  }

  return checks;
}

function normalizeText(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function buildRunnerHtml() {
  const plantumlJs = pathToFileURL(path.join(vendorRoot, "plantuml.js")).href;
  const vizGlobalJs = pathToFileURL(
    path.join(vendorRoot, "viz-global.js"),
  ).href;
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { margin: 0; padding: 24px; font-family: system-ui, sans-serif; }
      #preview { display: inline-block; background: white; }
    </style>
    <script src="${vizGlobalJs}"></script>
    <script src="${plantumlJs}"></script>
  </head>
  <body>
    <div id="out"></div>
    <div id="preview"></div>
    <script>
      plantumlLoad();
      const target = document.getElementById("out");
      const previewTarget = document.getElementById("preview");

      function diagnosticText(svg) {
        const text = new DOMParser()
          .parseFromString(svg || "", "image/svg+xml")
          .documentElement.textContent || "";
        return /error|syntax|not recognized|cannot|too large/i.test(text)
          ? text.trim().slice(0, 1000)
          : "";
      }

      function finishFromSvg(svg, started) {
        const diagnostic = diagnosticText(svg);
        return {
          status: diagnostic ? "error" : "rendered",
          svg,
          diagnostics: diagnostic ? [diagnostic] : [],
          metrics: {
            renderMs: performance.now() - started,
            svgBytes: new TextEncoder().encode(svg || "").byteLength,
          },
        };
      }

      function render(source, timeoutMs) {
        const started = performance.now();
        const lines = source.split(/\\r\\n|\\r|\\n/);
        target.innerHTML = "";
        return new Promise((resolve) => {
          const timer = setTimeout(() => {
            resolve({
              status: "timeout",
              diagnostics: ["PlantUML render timed out."],
              metrics: { renderMs: timeoutMs },
            });
          }, timeoutMs);

          const resolveOnce = (result) => {
            clearTimeout(timer);
            resolve(result);
          };

          if (typeof window.plantuml.renderToString === "function") {
            try {
              window.plantuml.renderToString(
                lines,
                (svg) => resolveOnce(finishFromSvg(svg, started)),
                (error) =>
                  resolveOnce({
                    status: "error",
                    diagnostics: [String(error)],
                    metrics: { renderMs: performance.now() - started },
                  }),
              );
              return;
            } catch (_error) {
              target.innerHTML = "";
            }
          }

          const observer = new MutationObserver(() => {
            const svg = target.querySelector("svg");
            if (svg) {
              observer.disconnect();
              resolveOnce(finishFromSvg(target.innerHTML, started));
            }
          });
          observer.observe(target, { childList: true, subtree: true });

          try {
            window.plantuml.render(lines, "out");
          } catch (error) {
            observer.disconnect();
            resolveOnce({
              status: "error",
              diagnostics: [String(error && error.message ? error.message : error)],
              metrics: { renderMs: performance.now() - started },
            });
          }
        });
      }

      window.__plantumlSuite = {
        render,
        svgText(svg) {
          if (!svg) return "";
          return new DOMParser()
            .parseFromString(svg, "image/svg+xml")
            .documentElement.textContent || "";
        },
        preview(svg) {
          previewTarget.innerHTML = svg || "";
        },
        bounds() {
          const svg = previewTarget.querySelector("svg");
          if (!svg) return { width: 0, height: 0 };
          const rect = svg.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        },
      };
    </script>
  </body>
</html>
`;
}

function buildSummary(report) {
  const failed = report.results.filter((result) => !result.passed);
  const japanese = report.results.filter((result) =>
    result.fixtureId.includes("japanese"),
  );
  return `# PlantUML Local Renderer Suite

- runId: ${report.runId}
- mode: ${report.mode}
- total: ${report.summary.total}
- passed: ${report.summary.passed}
- failed required: ${report.summary.failedRequired}

## Failed Fixtures

${
  failed.length === 0
    ? "None"
    : failed
        .map(
          (result) =>
            `- ${result.fixtureId}: ${result.status}; failed checks: ${result.checks
              .filter((check) => !check.passed)
              .map((check) => check.name)
              .join(", ")}`,
        )
        .join("\n")
}

## Japanese Fixtures

${japanese
  .map(
    (result) =>
      `- ${result.fixtureId}: ${result.passed ? "passed" : "failed"} (${result.status})`,
  )
  .join("\n")}
`;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
