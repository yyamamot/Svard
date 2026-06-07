import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, filePath), "utf8"));
}

function readCargoPackageVersion() {
  const cargoToml = fs.readFileSync(
    path.join(repoRoot, "src-tauri", "Cargo.toml"),
    "utf8",
  );
  const packageSection = cargoToml.match(
    /(^|\r?\n)\[package\]\r?\n(?<body>[\s\S]*?)(?=\r?\n\[|$)/,
  );
  const version = packageSection?.groups?.body.match(
    /^version\s*=\s*"([^"]+)"/m,
  )?.[1];
  if (!version) {
    throw new Error("Could not find [package] version in src-tauri/Cargo.toml");
  }
  return version;
}

function readCargoLockPackageVersion(packageName) {
  const cargoLock = fs.readFileSync(
    path.join(repoRoot, "src-tauri", "Cargo.lock"),
    "utf8",
  );
  const packageSections = cargoLock.matchAll(
    /(^|\r?\n)\[\[package\]\]\r?\n(?<body>[\s\S]*?)(?=\r?\n\[\[package\]\]|$)/g,
  );
  for (const section of packageSections) {
    const body = section.groups?.body ?? "";
    const name = body.match(/^name\s*=\s*"([^"]+)"/m)?.[1];
    if (name !== packageName) continue;
    const version = body.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
    if (version) return version;
  }
  throw new Error(`Could not find ${packageName} package version in src-tauri/Cargo.lock`);
}

function normalizeVersion(value) {
  return value?.replace(/^v/, "");
}

const versions = {
  "package.json": readJson("package.json").version,
  "src-tauri/tauri.conf.json": readJson("src-tauri/tauri.conf.json").version,
  "src-tauri/Cargo.toml": readCargoPackageVersion(),
  "src-tauri/Cargo.lock": readCargoLockPackageVersion("svard"),
};

const releaseVersion = normalizeVersion(process.env.RELEASE_VERSION);
const eventName = process.env.GITHUB_EVENT_NAME ?? "";
const refName = process.env.GITHUB_REF_NAME ?? "";
const expectedVersion =
  eventName === "push" && /^v\d+\.\d+\.\d+$/.test(refName)
    ? normalizeVersion(refName)
    : /^\d+\.\d+\.\d+$/.test(releaseVersion ?? "")
      ? releaseVersion
      : undefined;

const failures = [];
const uniqueVersions = new Set(Object.values(versions));
if (uniqueVersions.size !== 1) {
  failures.push("Repo version files do not match.");
}

if (expectedVersion) {
  for (const [source, version] of Object.entries(versions)) {
    if (version !== expectedVersion) {
      failures.push(
        `${source} version ${version} does not match expected ${expectedVersion}.`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error("Release version check failed:");
  for (const [source, version] of Object.entries(versions)) {
    console.error(`- ${source}: ${version}`);
  }
  if (expectedVersion) {
    console.error(`- expected: ${expectedVersion}`);
  }
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      outcome: "passed",
      expectedVersion: expectedVersion ?? null,
      versions,
    },
    null,
    2,
  ),
);
