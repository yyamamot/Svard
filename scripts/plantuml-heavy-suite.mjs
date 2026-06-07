import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const vendorRoot = path.join(repoRoot, "public", "vendor", "plantuml-teavm");
const artifactBase = path.join(repoRoot, ".artifacts", "plantuml-heavy");
const timeoutMs = Number(process.env.PLANTUML_HEAVY_TIMEOUT_MS ?? 30000);
const trials = Number(process.env.PLANTUML_HEAVY_TRIALS ?? 3);
const writeSample = process.argv.includes("--write-sample");

const fixtures = [
  {
    id: "sequence-wide-40",
    diagramType: "sequence",
    source: buildWideSequence(40),
  },
  {
    id: "class-dense-28",
    diagramType: "class",
    source: buildDenseClass(28),
  },
  {
    id: "component-cluster-36",
    diagramType: "component",
    source: buildComponentCluster(36),
  },
  {
    id: "state-grid-30",
    diagramType: "state",
    source: buildStateGrid(30),
  },
  {
    id: "japanese-long-sequence-16",
    diagramType: "sequence",
    source: buildJapaneseLongSequence(16),
  },
  {
    id: "oversized-sequence-80",
    diagramType: "sequence",
    source: buildWideSequence(80),
  },
];

const documentFixtures = [
  {
    id: "mixed-heavy-document-30",
    diagramCount: 30,
    sources: Array.from({ length: 6 }, () => [
      buildWideSequence(40),
      buildDenseClass(28),
      buildComponentCluster(36),
      buildStateGrid(30),
      buildJapaneseLongSequence(16),
    ]).flat(),
  },
];

async function main() {
  if (writeSample) {
    const samplePath = path.join(
      repoRoot,
      "docs",
      "samples",
      "plantuml-heavy-mixed-stress.adoc",
    );
    await fs.writeFile(samplePath, buildHeavyMixedSample(), "utf8");
    console.log(JSON.stringify({ samplePath, diagramCount: 30 }, null, 2));
    return;
  }

  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const artifactRoot = path.join(artifactBase, runId);
  const svgRoot = path.join(artifactRoot, "svg");
  const screenshotRoot = path.join(artifactRoot, "screenshots");
  const metricsPath = path.join(artifactRoot, "metrics.jsonl");
  await fs.mkdir(svgRoot, { recursive: true });
  await fs.mkdir(screenshotRoot, { recursive: true });
  await fs.writeFile(metricsPath, "");

  const runnerPath = path.join(artifactRoot, "runner.html");
  await fs.writeFile(runnerPath, buildRunnerHtml());

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  await page.goto(pathToFileURL(runnerPath).href);

  const results = [];
  for (const fixture of fixtures) {
    const runs = [];
    for (let trial = 1; trial <= trials; trial += 1) {
      const rendered = await page.evaluate(
        async ({ source, timeout }) =>
          window.__plantumlHeavySuite.render(source, timeout),
        { source: fixture.source, timeout: timeoutMs },
      );
      const svgBytes = rendered.svg
        ? new TextEncoder().encode(rendered.svg).byteLength
        : 0;
      const result = {
        fixtureId: fixture.id,
        diagramType: fixture.diagramType,
        trial,
        status: rendered.status,
        diagnostics: rendered.diagnostics ?? [],
        renderMs: rendered.metrics?.renderMs ?? null,
        svgBytes,
      };
      runs.push(result);
      await fs.appendFile(metricsPath, `${JSON.stringify(result)}\n`);

      if (trial === 1 && rendered.svg) {
        const svgPath = path.join(svgRoot, `${fixture.id}.svg`);
        const screenshotPath = path.join(screenshotRoot, `${fixture.id}.png`);
        await fs.writeFile(svgPath, rendered.svg);
        await page.evaluate(
          (svg) => window.__plantumlHeavySuite.preview(svg),
          rendered.svg,
        );
        await page.locator("#preview svg").screenshot({
          path: screenshotPath,
          timeout: 5000,
        });
      }
    }
    results.push(summarizeFixture(fixture, runs));
  }

  const documents = [];
  for (const fixture of documentFixtures) {
    const runs = [];
    for (let trial = 1; trial <= trials; trial += 1) {
      const run = await page.evaluate(
        async ({ sources, timeout }) => {
          const started = performance.now();
          const results = [];
          for (const source of sources) {
            results.push(
              await window.__plantumlHeavySuite.render(source, timeout),
            );
          }
          return {
            totalMs: performance.now() - started,
            results,
          };
        },
        { sources: fixture.sources, timeout: timeoutMs },
      );
      const entry = {
        fixtureId: fixture.id,
        trial,
        totalMs: run.totalMs,
        renderedCount: run.results.filter(
          (result) => result.status === "rendered",
        ).length,
        errorCount: run.results.filter((result) => result.status === "error")
          .length,
        timeoutCount: run.results.filter(
          (result) => result.status === "timeout",
        ).length,
      };
      runs.push(entry);
      await fs.appendFile(metricsPath, `${JSON.stringify(entry)}\n`);
    }
    documents.push(summarizeDocumentFixture(fixture, runs));
  }

  await browser.close();

  const report = {
    runId,
    generatedAt: new Date().toISOString(),
    artifactRoot,
    timeoutMs,
    trials,
    summary: summarizeReport(results),
    results,
    documents,
    metricsPath,
    screenshotRoot,
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
        outcome: "measured",
        artifactRoot,
        timeoutMs,
        trials,
        summary: report.summary,
      },
      null,
      2,
    ),
  );
}

function summarizeFixture(fixture, runs) {
  const renderTimes = runs
    .map((run) => run.renderMs)
    .filter((value) => typeof value === "number")
    .sort((left, right) => left - right);
  return {
    fixtureId: fixture.id,
    diagramType: fixture.diagramType,
    statusCounts: countBy(runs, "status"),
    medianRenderMs: percentile(renderTimes, 0.5),
    p95RenderMs: percentile(renderTimes, 0.95),
    maxRenderMs: renderTimes.at(-1) ?? null,
    maxSvgBytes: Math.max(...runs.map((run) => run.svgBytes), 0),
    diagnostics: runs.flatMap((run) => run.diagnostics).slice(0, 3),
    runs,
  };
}

function summarizeReport(results) {
  const heavyThresholdMs = 1000;
  return {
    totalFixtures: results.length,
    renderedFixtures: results.filter(
      (result) => (result.statusCounts.rendered ?? 0) > 0,
    ).length,
    timeoutFixtures: results.filter(
      (result) => (result.statusCounts.timeout ?? 0) > 0,
    ).length,
    errorFixtures: results.filter(
      (result) => (result.statusCounts.error ?? 0) > 0,
    ).length,
    heavyFixtures: results
      .filter((result) => (result.medianRenderMs ?? 0) >= heavyThresholdMs)
      .map((result) => result.fixtureId),
    heavyThresholdMs,
  };
}

function summarizeDocumentFixture(fixture, runs) {
  const totals = runs
    .map((run) => run.totalMs)
    .sort((left, right) => left - right);
  return {
    fixtureId: fixture.id,
    diagramCount: fixture.diagramCount,
    medianTotalMs: percentile(totals, 0.5),
    p95TotalMs: percentile(totals, 0.95),
    maxTotalMs: totals.at(-1) ?? null,
    renderedCount: Math.max(...runs.map((run) => run.renderedCount), 0),
    errorCount: Math.max(...runs.map((run) => run.errorCount), 0),
    timeoutCount: Math.max(...runs.map((run) => run.timeoutCount), 0),
    runs,
  };
}

function countBy(items, key) {
  const counts = {};
  for (const item of items) {
    counts[item[key]] = (counts[item[key]] ?? 0) + 1;
  }
  return counts;
}

function percentile(values, fraction) {
  if (values.length === 0) {
    return null;
  }
  const index = Math.min(
    values.length - 1,
    Math.max(0, Math.ceil(values.length * fraction) - 1),
  );
  return values[index];
}

function buildWideSequence(count) {
  const lines = ["@startuml", "skinparam maxMessageSize 120"];
  for (let index = 1; index <= count; index += 1) {
    lines.push(`participant "Service ${index}" as S${index}`);
  }
  for (let index = 1; index < count; index += 1) {
    lines.push(`S${index} -> S${index + 1}: request ${index}`);
    lines.push(`S${index + 1} --> S${index}: response ${index}`);
  }
  lines.push("@enduml");
  return lines.join("\n");
}

function buildDenseClass(count) {
  const lines = ["@startuml", "skinparam classAttributeIconSize 0"];
  for (let index = 1; index <= count; index += 1) {
    lines.push(`class Entity${index} {`);
    lines.push(`  +id${index}: string`);
    lines.push(`  +render${index}(): Svg${index}`);
    lines.push("}");
  }
  for (let index = 1; index < count; index += 1) {
    lines.push(`Entity${index} --> Entity${index + 1}`);
  }
  for (let index = 1; index <= count - 10; index += 10) {
    lines.push(`Entity${index} ..> Entity${index + 10}`);
  }
  lines.push("@enduml");
  return lines.join("\n");
}

function buildComponentCluster(count) {
  const lines = ["@startuml"];
  for (let group = 1; group <= 6; group += 1) {
    lines.push(`package "Subsystem ${group}" {`);
    for (let index = 1; index <= count / 6; index += 1) {
      const id = (group - 1) * (count / 6) + index;
      lines.push(`  component "Component ${id}" as C${id}`);
    }
    lines.push("}");
  }
  for (let index = 1; index < count; index += 1) {
    lines.push(`C${index} --> C${index + 1}`);
  }
  lines.push("@enduml");
  return lines.join("\n");
}

function buildStateGrid(count) {
  const lines = ["@startuml"];
  for (let index = 1; index <= count; index += 1) {
    lines.push(`state "State ${index}" as State${index}`);
  }
  for (let index = 1; index < count; index += 1) {
    lines.push(`State${index} --> State${index + 1}: event ${index}`);
  }
  for (let index = 1; index <= count - 8; index += 8) {
    lines.push(`State${index} --> State${index + 8}: skip`);
  }
  lines.push("@enduml");
  return lines.join("\n");
}

function buildJapaneseLongSequence(count) {
  const lines = ["@startuml", "skinparam maxMessageSize 180"];
  for (let index = 1; index <= count; index += 1) {
    lines.push(
      `participant "長い日本語ラベルを持つ処理者 ${index}" as P${index}`,
    );
  }
  for (let index = 1; index < count; index += 1) {
    lines.push(
      `P${index} -> P${index + 1}: 日本語の長いメッセージ ${index} を折り返しながら描画する`,
    );
  }
  lines.push("@enduml");
  return lines.join("\n");
}

function buildHeavyMixedSample() {
  const sources = documentFixtures[0].sources;
  const sections = sources.map((source, index) => {
    const id = String(index + 1).padStart(2, "0");
    return `== Heavy Diagram ${id}

[plantuml]
----
${source}
----`;
  });
  return `= PlantUML Heavy Mixed Stress Sample
:toc:

This synthetic sample contains 30 local PlantUML diagrams that stay under the browser renderer size limit while producing a measurable combined render time.

The sample is intended for human checks of initial render latency, scroll responsiveness, and diagnostic behavior. It does not contain private document source.

${sections.join("\n\n")}
`;
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

      window.__plantumlHeavySuite = {
        render,
        preview(svg) {
          previewTarget.innerHTML = svg || "";
        },
      };
    </script>
  </body>
</html>
`;
}

function buildSummary(report) {
  const rows = report.results
    .map(
      (result) =>
        `| ${result.fixtureId} | ${result.diagramType} | ${JSON.stringify(
          result.statusCounts,
        )} | ${Math.round(result.medianRenderMs ?? 0)} | ${Math.round(
          result.p95RenderMs ?? 0,
        )} | ${Math.round(result.maxSvgBytes / 1024)} |`,
    )
    .join("\n");
  const documentRows = report.documents
    .map(
      (result) =>
        `| ${result.fixtureId} | ${result.diagramCount} | ${Math.round(
          result.medianTotalMs ?? 0,
        )} | ${Math.round(result.p95TotalMs ?? 0)} | ${result.renderedCount} | ${
          result.errorCount
        } | ${result.timeoutCount} |`,
    )
    .join("\n");

  return `# PlantUML Heavy Renderer Suite

- runId: ${report.runId}
- timeoutMs: ${report.timeoutMs}
- trials: ${report.trials}
- heavyThresholdMs: ${report.summary.heavyThresholdMs}
- heavyFixtures: ${
    report.summary.heavyFixtures.length === 0
      ? "none"
      : report.summary.heavyFixtures.join(", ")
  }

| fixture | type | status counts | median render ms | p95 render ms | max svg KiB |
| --- | --- | --- | ---: | ---: | ---: |
${rows}

## Composite Documents

| fixture | diagrams | median total ms | p95 total ms | rendered | errors | timeouts |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${documentRows}
`;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
