import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const dependencyPolicy = {
  nodeEngine: ">=24.0.0 <25",
  nodeMajor: 24,
  artifactPath: path.join(
    ".artifacts",
    "dependencies",
    "dependency-policy-report.json",
  ),
  heldCandidates: [
    {
      name: "@types/node",
      latest: "25.x",
      reason: "Held to the Node 24 runtime baseline.",
    },
    {
      name: "notify",
      latest: "9.0.0-rc",
      reason: "Prerelease watcher crates require a separate compatibility IMP.",
    },
    {
      name: "keyring",
      latest: "4.x",
      reason: "Major keyring updates require an API and MSRV review.",
    },
    {
      name: "reqwest",
      latest: "0.13.x",
      reason: "Major HTTP client updates require a separate backend review.",
    },
    {
      name: "sha2",
      latest: "0.11.x",
      reason: "Crypto/hash major updates require a separate compatibility IMP.",
    },
  ],
};

/**
 * @typedef {object} WorkflowSource
 * @property {string} name
 * @property {string} content
 *
 * @typedef {object} DependencyPolicyInput
 * @property {Record<string, unknown>|string} packageJson
 * @property {string} cargoToml
 * @property {WorkflowSource[]} workflows
 *
 * @typedef {object} DependencyPolicyResult
 * @property {string} name
 * @property {string} current
 * @property {string} latest
 * @property {"ok"|"fail"|"held"} status
 * @property {string} reason
 */

/**
 * @param {DependencyPolicyInput} input
 */
export function checkDependencyPolicy(input) {
  const packageJson =
    typeof input.packageJson === "string"
      ? JSON.parse(input.packageJson)
      : input.packageJson;
  const packageRecord =
    packageJson && typeof packageJson === "object" ? packageJson : {};
  const devDependencies = recordValue(packageRecord, "devDependencies");
  const engines = recordValue(packageRecord, "engines");
  const results = [
    checkNodeEngine(engines),
    checkTypesNode(devDependencies),
    ...checkWorkflowNodeVersions(input.workflows),
    checkCargoDependency(input.cargoToml, {
      name: "notify",
      latest: "9.0.0-rc",
      validate: (version) =>
        prereleasePattern.test(version)
          ? "notify prerelease / rc updates are held by policy"
          : "",
    }),
    checkCargoDependency(input.cargoToml, {
      name: "keyring",
      latest: "4.x",
      validate: (version) =>
        majorVersion(version) >= 4
          ? "keyring 4.x or newer requires a separate migration IMP"
          : "",
    }),
    ...heldCandidateResults(packageJson, input.cargoToml),
  ];
  return {
    schemaVersion: 1,
    passed: results.every((result) => result.status !== "fail"),
    results,
  };
}

/**
 * @param {unknown} value
 */
export function sanitizeDependencyReport(value) {
  const report =
    value && typeof value === "object"
      ? /** @type {Record<string, unknown>} */ (value)
      : {};
  const results = Array.isArray(report.results)
    ? report.results.map(sanitizeResult)
    : [];
  return {
    schemaVersion: 1,
    generatedAt:
      typeof report.generatedAt === "string" ? report.generatedAt : "",
    passed: report.passed === true,
    results,
  };
}

function checkNodeEngine(engines) {
  const current = stringValue(engines.node);
  return {
    name: "engines.node",
    current,
    latest: dependencyPolicy.nodeEngine,
    status: current === dependencyPolicy.nodeEngine ? "ok" : "fail",
    reason:
      current === dependencyPolicy.nodeEngine
        ? "Node runtime floor is pinned to 24.x LTS."
        : "engines.node must stay at >=24.0.0 <25.",
  };
}

function checkTypesNode(devDependencies) {
  const current = stringValue(devDependencies["@types/node"]);
  const version = extractVersion(current);
  return {
    name: "@types/node",
    current,
    latest: "25.x",
    status:
      majorVersion(version) === dependencyPolicy.nodeMajor ? "ok" : "fail",
    reason:
      majorVersion(version) === dependencyPolicy.nodeMajor
        ? "@types/node is aligned with the Node 24 baseline."
        : "@types/node must stay on major 24 while runtime baseline is Node 24.",
  };
}

/**
 * @param {WorkflowSource[]} workflows
 */
function checkWorkflowNodeVersions(workflows) {
  const versions = workflows.flatMap((workflow) =>
    [
      ...workflow.content.matchAll(/node-version:\s*["']?([^"'\n#]+)["']?/g),
    ].map((match) => ({
      name: workflow.name,
      version: match[1].trim(),
    })),
  );
  if (versions.length === 0) {
    return [
      {
        name: "ci.setup-node",
        current: "missing",
        latest: "24",
        status: "fail",
        reason: "No CI setup-node node-version entry was found.",
      },
    ];
  }
  return versions.map((entry) => ({
    name: `ci.setup-node:${entry.name}`,
    current: entry.version,
    latest: "24",
    status: entry.version === "24" ? "ok" : "fail",
    reason:
      entry.version === "24"
        ? "CI uses the Node 24 baseline."
        : "CI setup-node must use node-version: 24.",
  }));
}

function checkCargoDependency(cargoToml, options) {
  const versions = extractCargoDependencyVersions(cargoToml, options.name);
  if (versions.length === 0) {
    return {
      name: options.name,
      current: "missing",
      latest: options.latest,
      status: "fail",
      reason: `${options.name} dependency was not found in Cargo.toml.`,
    };
  }
  const failures = versions
    .map((version) => ({ version, reason: options.validate(version) }))
    .filter((entry) => entry.reason);
  return {
    name: options.name,
    current: versions.join(", "),
    latest: options.latest,
    status: failures.length === 0 ? "ok" : "fail",
    reason:
      failures.length === 0
        ? `${options.name} dependency follows the upgrade policy.`
        : failures.map((entry) => entry.reason).join("; "),
  };
}

function heldCandidateResults(packageJson, cargoToml) {
  const currentByName = new Map([
    [
      "@types/node",
      stringValue(recordValue(packageJson, "devDependencies")["@types/node"]),
    ],
    ...extractCargoDependencyVersions(cargoToml, "notify").map((version) => [
      "notify",
      version,
    ]),
    ...extractCargoDependencyVersions(cargoToml, "keyring").map((version) => [
      "keyring",
      version,
    ]),
    ...extractCargoDependencyVersions(cargoToml, "reqwest").map((version) => [
      "reqwest",
      version,
    ]),
    ...extractCargoDependencyVersions(cargoToml, "sha2").map((version) => [
      "sha2",
      version,
    ]),
  ]);
  return dependencyPolicy.heldCandidates.map((candidate) => ({
    name: `${candidate.name}.policyHold`,
    current: currentByName.get(candidate.name) ?? "not queried",
    latest: candidate.latest,
    status: "held",
    reason: candidate.reason,
  }));
}

const prereleasePattern = /(?:-|\.)(?:rc|alpha|beta|pre)\b/i;

function extractCargoDependencyVersions(cargoToml, name) {
  const versions = [];
  const linePattern = new RegExp(`^${escapeRegExp(name)}\\s*=\\s*(.+)$`, "gm");
  for (const match of cargoToml.matchAll(linePattern)) {
    const version = extractCargoVersionFromSpec(match[1]);
    if (version) {
      versions.push(version);
    }
  }
  return versions;
}

function extractCargoVersionFromSpec(spec) {
  const quoted = spec.match(/^"([^"]+)"/);
  if (quoted) {
    return quoted[1];
  }
  const objectVersion = spec.match(/\bversion\s*=\s*"([^"]+)"/);
  return objectVersion?.[1] ?? "";
}

function extractVersion(value) {
  return value.match(/\d+(?:\.\d+){0,2}(?:-[0-9A-Za-z.-]+)?/)?.[0] ?? "";
}

function majorVersion(value) {
  const major = Number.parseInt(extractVersion(value).split(".")[0] ?? "", 10);
  return Number.isFinite(major) ? major : -1;
}

function recordValue(record, key) {
  const value =
    record && typeof record === "object"
      ? /** @type {Record<string, unknown>} */ (record)[key]
      : undefined;
  return value && typeof value === "object"
    ? /** @type {Record<string, unknown>} */ (value)
    : {};
}

function stringValue(value) {
  return typeof value === "string" ? value : "";
}

function sanitizeResult(result) {
  const record = result && typeof result === "object" ? result : {};
  return {
    name: stringValue(record.name),
    current: stringValue(record.current),
    latest: stringValue(record.latest),
    status: ["ok", "fail", "held"].includes(stringValue(record.status))
      ? stringValue(record.status)
      : "fail",
    reason: stringValue(record.reason),
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readWorkflowSources(repoRoot) {
  const workflowDir = path.join(repoRoot, ".github", "workflows");
  if (!fs.existsSync(workflowDir)) {
    return [];
  }
  return fs
    .readdirSync(workflowDir)
    .filter((entry) => entry.endsWith(".yml") || entry.endsWith(".yaml"))
    .sort()
    .map((entry) => ({
      name: entry,
      content: fs.readFileSync(path.join(workflowDir, entry), "utf8"),
    }));
}

function runCli() {
  const repoRoot = process.cwd();
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"),
  );
  const cargoToml = fs.readFileSync(
    path.join(repoRoot, "src-tauri", "Cargo.toml"),
    "utf8",
  );
  const report = checkDependencyPolicy({
    packageJson,
    cargoToml,
    workflows: readWorkflowSources(repoRoot),
  });
  const output = sanitizeDependencyReport({
    ...report,
    generatedAt: new Date().toISOString(),
  });
  const outputPath = path.join(repoRoot, dependencyPolicy.artifactPath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);

  for (const result of output.results) {
    const log = result.status === "fail" ? console.error : console.log;
    log(
      `${result.status}: ${result.name} ${result.current} (${result.reason})`,
    );
  }
  console.log(`dependency policy report: ${dependencyPolicy.artifactPath}`);
  if (!output.passed) {
    process.exitCode = 1;
  }
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  runCli();
}
