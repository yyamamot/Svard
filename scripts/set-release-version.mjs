import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const version = process.argv
  .slice(2)
  .find((arg) => arg !== "--")
  ?.replace(/^v/, "");

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("Usage: pnpm run version:set -- <major.minor.patch>");
  console.error("Example: pnpm run version:set -- 0.3.2");
  process.exit(1);
}

function readText(filePath) {
  return fs.readFileSync(path.join(repoRoot, filePath), "utf8");
}

function writeText(filePath, content) {
  fs.writeFileSync(path.join(repoRoot, filePath), content);
}

function updateJsonVersion(filePath) {
  const fullPath = path.join(repoRoot, filePath);
  const data = JSON.parse(fs.readFileSync(fullPath, "utf8"));
  data.version = version;
  fs.writeFileSync(fullPath, `${JSON.stringify(data, null, 2)}\n`);
}

function updateCargoTomlVersion() {
  const filePath = "src-tauri/Cargo.toml";
  const text = readText(filePath);
  let matched = false;
  const next = text.replace(
    /(^\[package\]\n[\s\S]*?^version\s*=\s*")[^"]+(")/m,
    (_match, prefix, suffix) => {
      matched = true;
      return `${prefix}${version}${suffix}`;
    },
  );
  if (!matched) {
    throw new Error("Could not update [package] version in src-tauri/Cargo.toml");
  }
  writeText(filePath, next);
}

function updateCargoLockVersion() {
  const filePath = "src-tauri/Cargo.lock";
  const text = readText(filePath);
  let matched = false;
  const next = text.replace(
    /(\[\[package\]\]\nname = "svard"\nversion = ")[^"]+(")/,
    (_match, prefix, suffix) => {
      matched = true;
      return `${prefix}${version}${suffix}`;
    },
  );
  if (!matched) {
    throw new Error("Could not update svard version in src-tauri/Cargo.lock");
  }
  writeText(filePath, next);
}

updateJsonVersion("package.json");
updateJsonVersion("src-tauri/tauri.conf.json");
updateCargoTomlVersion();
updateCargoLockVersion();

console.log(
  JSON.stringify(
    {
      outcome: "updated",
      version,
      files: [
        "package.json",
        "src-tauri/tauri.conf.json",
        "src-tauri/Cargo.toml",
        "src-tauri/Cargo.lock",
      ],
    },
    null,
    2,
  ),
);
