import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = process.cwd();
const runId =
  process.env.GITHUB_RUN_ID && process.env.GITHUB_RUN_ATTEMPT
    ? `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`
    : new Date().toISOString().replace(/[:.]/g, "-");
const artifactRoot = path.resolve(
  process.env.CROSS_PLATFORM_ARTIFACT_ROOT ??
    path.join(".artifacts", "cross-platform", runId),
);
const logsRoot = path.join(artifactRoot, "logs");

const stepOutcomes = {
  install: process.env.WINDOWS_INSTALL_OUTCOME ?? "unknown",
  unit: process.env.WINDOWS_UNIT_OUTCOME ?? "unknown",
  tauriTest: process.env.WINDOWS_TAURI_TEST_OUTCOME ?? "unknown",
  playwrightInstall:
    process.env.WINDOWS_PLAYWRIGHT_INSTALL_OUTCOME ?? "unknown",
  plantumlLocal: process.env.WINDOWS_PLANTUML_OUTCOME ?? "unknown",
  build: process.env.WINDOWS_BUILD_OUTCOME ?? "unknown",
};

function runVersionCommand(command, args = []) {
  try {
    return execFileSync(command, args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    return `unavailable: ${error.message}`;
  }
}

async function fileInfo(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  try {
    const stat = await fs.stat(absolutePath);
    return {
      relativePath,
      exists: stat.isFile(),
      bytes: stat.isFile() ? stat.size : null,
    };
  } catch {
    return { relativePath, exists: false, bytes: null };
  }
}

async function readText(relativePath) {
  return fs.readFile(path.join(repoRoot, relativePath), "utf8");
}

function check(id, category, passed, details = {}) {
  return {
    id,
    category,
    status: passed ? "passed" : "failed",
    details,
  };
}

function outcomeCheck(id, category, outcome) {
  if (outcome === "unknown") {
    return check(id, category, true, { outcome, skipped: true });
  }
  return check(id, category, outcome === "success", { outcome });
}

async function collectPathCases() {
  const pathHelper = await readText("src/ui/lib/path.ts");
  const displayHelper = await readText("src/core/pathDisplay.ts");
  const pathTests = await readText("test/unit/path.test.ts");
  const workspaceBootTests = await readText("test/unit/workspaceBoot.test.ts");
  const documentHtmlTests = await readText("test/unit/documentHtml.test.ts");
  const asciidocIncludeTests = await readText(
    "test/unit/asciidocInclude.test.ts",
  );
  const expectedCases = [
    {
      id: "windows-display-basename",
      input: "C:\\Users\\me\\project",
      expected: "project",
    },
    {
      id: "windows-file-basename",
      input: "C:\\Users\\me\\docs\\a.md",
      expected: "a.md",
    },
    {
      id: "unc-display-basename",
      input: "\\\\server\\share\\project",
      expected: "project",
    },
    {
      id: "verbatim-prefix-policy",
      input: "\\\\?\\C:\\Users\\me\\project",
      expectedUiPolicy: "backend strips verbatim prefix before UI payload",
    },
    {
      id: "posix-display-basename",
      input: "/Users/me/project",
      expected: "project",
    },
  ];
  const checks = [
    check(
      "path-display-helper-cross-separator",
      "path",
      /split\(\s*\/\[\\\\\/\\\\\]/u.test(displayHelper) ||
        /split\(\s*\/\[\\\\\/\]/u.test(displayHelper) ||
        displayHelper.includes(".split(/[\\\\/]/"),
      { file: "src/core/pathDisplay.ts" },
    ),
    check(
      "frontend-path-module-is-ui-only",
      "path",
      ![
        "parentDirectory",
        "isPathInsideRoot",
        "directoryAncestors",
        "resolvePath",
        "pathDepth",
      ].some((name) => pathHelper.includes(`function ${name}`)),
      { file: "src/ui/lib/path.ts" },
    ),
    check(
      "backend-owned-workspace-and-link-cases-present",
      "path",
      pathTests.includes("C:\\\\Users\\\\me\\\\project") &&
        workspaceBootTests.includes("host.resolveWorkspacePaths") &&
        documentHtmlTests.includes("resolveDocumentLink") &&
        asciidocIncludeTests.includes("Windows path include files"),
      {
        files: [
          "test/unit/path.test.ts",
          "test/unit/workspaceBoot.test.ts",
          "test/unit/documentHtml.test.ts",
          "test/unit/asciidocInclude.test.ts",
        ],
      },
    ),
  ];

  return { expectedCases, checks };
}

async function collectRendererCases() {
  const requiredFiles = await Promise.all([
    fileInfo("public/vendor/plantuml-teavm/worker.html"),
    fileInfo("public/vendor/plantuml-teavm/plantuml.js"),
    fileInfo("public/vendor/plantuml-teavm/viz-global.js"),
    fileInfo("public/vendor/plantuml-teavm/graphviz-worker.html"),
    fileInfo("docs/samples/assets/svard-sample.svg"),
    fileInfo("docs/samples/asciidoc-comprehensive-visual.adoc"),
    fileInfo("docs/samples/diagrams-mixed-long-ja.adoc"),
    fileInfo("docs/samples/mermaid-japanese-flow.adoc"),
    fileInfo("docs/samples/plantuml-japanese-combined.adoc"),
  ]);
  const comprehensive = await readText(
    "docs/samples/asciidoc-comprehensive-visual.adoc",
  );
  const mixedDiagrams = await readText(
    "docs/samples/diagrams-mixed-long-ja.adoc",
  );
  const extractDiagramTests = await readText(
    "test/unit/extractDiagrams.test.ts",
  );
  const backendDocumentIoTests = await readText(
    "src-tauri/src/backend_tests/document_io.rs",
  );
  const checks = [
    check(
      "renderer-assets-present",
      "diagram-render",
      requiredFiles.every((item) => item.exists),
      { files: requiredFiles },
    ),
    check(
      "local-image-fixture-present",
      "local-image",
      /image::assets\/svard-sample\.svg\[[^\]]*\]/u.test(comprehensive),
      { file: "docs/samples/asciidoc-comprehensive-visual.adoc" },
    ),
    check(
      "diagram-fixtures-cover-local-renderers",
      "diagram-render",
      /\[plantuml\]/u.test(mixedDiagrams) &&
        /\[mermaid\]/u.test(mixedDiagrams) &&
        /\[graphviz\]/u.test(mixedDiagrams),
      { file: "docs/samples/diagrams-mixed-long-ja.adoc" },
    ),
    check(
      "plantuml-extraction-regression-present",
      "diagram-render",
      extractDiagramTests.includes(
        "extracts CRLF literal-delimited PlantUML blocks",
      ) && extractDiagramTests.includes("[plantuml]"),
      { file: "test/unit/extractDiagrams.test.ts" },
    ),
    check(
      "backend-include-drawio-regression-present",
      "local-image",
      backendDocumentIoTests.includes(
        "open_document_collects_include_and_resolves_drawio_image_from_real_files",
      ),
      { file: "src-tauri/src/backend_tests/document_io.rs" },
    ),
    outcomeCheck(
      "plantuml-local-suite-outcome",
      "diagram-render",
      stepOutcomes.plantumlLocal,
    ),
  ];

  return { requiredFiles, checks };
}

function collectNativeIntegrationCases() {
  const platform = process.platform;
  const supportLevel =
    platform === "darwin" || platform === "win32" ? "official" : "best-effort";
  const cases = [
    {
      id: "file-dialog",
      supportLevel,
      automated:
        platform === "win32" ? "unit-and-launch-smoke" : "manual-smoke",
    },
    {
      id: "native-drop",
      supportLevel,
      automated: "unit-and-browser-harness",
    },
    {
      id: "file-association",
      supportLevel,
      automated:
        platform === "win32" ? "bundle-artifact-check" : "manual-smoke",
    },
    {
      id: "watchers",
      supportLevel,
      automated: "tauri-rust-tests",
    },
  ];
  const checks = [
    outcomeCheck(
      "tauri-tests-outcome",
      "native-integration",
      stepOutcomes.tauriTest,
    ),
    outcomeCheck("tauri-build-outcome", "packaging", stepOutcomes.build),
  ];
  return { cases, checks };
}

function classifyFailures(checks) {
  const failed = checks.filter((item) => item.status !== "passed");
  if (failed.length === 0) {
    return "none";
  }
  const priorityByCategory = {
    path: "P0",
    "local-image": "P0",
    "diagram-render": "P0",
    "native-integration": "P1",
    packaging: "P2",
    "test-environment": "P2",
  };
  return failed.map((item) => ({
    id: item.id,
    category: item.category,
    priority: priorityByCategory[item.category] ?? "P2",
  }));
}

async function main() {
  await fs.mkdir(logsRoot, { recursive: true });
  const packageJson = JSON.parse(await readText("package.json"));
  const versions = {
    os: `${process.platform} ${process.arch}`,
    node: process.version,
    pnpm: runVersionCommand("pnpm", ["--version"]),
    rustc: runVersionCommand("rustc", ["--version"]),
    cargo: runVersionCommand("cargo", ["--version"]),
    appVersion: packageJson.version,
    commitSha: process.env.GITHUB_SHA ?? "local",
    runId: process.env.GITHUB_RUN_ID ?? "local",
    runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? "local",
  };

  const pathCases = await collectPathCases();
  const rendererCases = await collectRendererCases();
  const nativeIntegration = collectNativeIntegrationCases();
  const checks = [
    ...pathCases.checks,
    ...rendererCases.checks,
    ...nativeIntegration.checks,
  ];
  const outcome = checks.every((item) => item.status === "passed")
    ? "passed"
    : "failed";
  const report = {
    schemaVersion: 1,
    outcome,
    artifactRoot,
    generatedAt: new Date().toISOString(),
    supportPolicy: {
      macOS: "official",
      Windows: "official",
      Linux: "best-effort",
      wineWhisky: "not-authoritative",
    },
    versions,
    stepOutcomes,
    checks,
    failureClassification: classifyFailures(checks),
  };

  await fs.writeFile(
    path.join(artifactRoot, "path-cases.json"),
    `${JSON.stringify(pathCases, null, 2)}\n`,
  );
  await fs.writeFile(
    path.join(artifactRoot, "renderer-cases.json"),
    `${JSON.stringify(rendererCases, null, 2)}\n`,
  );
  await fs.writeFile(
    path.join(artifactRoot, "native-integration-cases.json"),
    `${JSON.stringify(nativeIntegration, null, 2)}\n`,
  );
  await fs.writeFile(
    path.join(artifactRoot, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  await fs.writeFile(
    path.join(artifactRoot, "summary.md"),
    buildSummary(report),
  );

  console.log(JSON.stringify({ outcome, artifactRoot }, null, 2));
  if (outcome !== "passed") {
    process.exitCode = 1;
  }
}

function buildSummary(report) {
  const failed = report.checks.filter((item) => item.status !== "passed");
  return [
    "# Cross-platform Smoke",
    "",
    `- outcome: ${report.outcome}`,
    `- generatedAt: ${report.generatedAt}`,
    `- os: ${report.versions.os}`,
    `- artifactRoot: ${report.artifactRoot}`,
    "",
    "## Failed checks",
    "",
    ...(failed.length === 0
      ? ["None"]
      : failed.map((item) => `- ${item.id} (${item.category})`)),
    "",
  ].join("\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
