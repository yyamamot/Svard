import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const repoRoot = process.cwd();
const args = parseArgs(process.argv.slice(2));
const platform = requiredArg("platform");
const version = requiredArg("version").replace(/^v/, "");
const outputRoot = path.resolve(repoRoot, args.out ?? ".artifacts/release");
const platformRoot = path.join(outputRoot, platform);

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function requiredArg(name) {
  const value = args[name];
  if (!value) {
    throw new Error(`Missing required --${name}`);
  }
  return value;
}

async function findFirstFile(directory, predicate) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
  const match = files.find(predicate);
  if (!match) {
    throw new Error(`No matching file found in ${directory}`);
  }
  return path.join(directory, match);
}

async function sha256(filePath) {
  const data = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(data).digest("hex");
}

async function copyAsset(source, fileName) {
  await fs.mkdir(platformRoot, { recursive: true });
  const target = path.join(platformRoot, fileName);
  await fs.copyFile(source, target);
  return target;
}

async function main() {
  await fs.rm(platformRoot, { recursive: true, force: true });
  const assets = [];
  if (platform === "windows-x86_64") {
    const nsisRoot = path.resolve(
      repoRoot,
      args.source ??
        path.join(
          "src-tauri",
          "target",
          "x86_64-pc-windows-msvc",
          "release",
          "bundle",
          "nsis",
        ),
    );
    const installerSource = await findFirstFile(nsisRoot, (name) =>
      /\.exe$/i.test(name),
    );
    const portableSource = path.resolve(
      repoRoot,
      args.portableSource ??
        path.join(
          "src-tauri",
          "target",
          "x86_64-pc-windows-msvc",
          "release",
          "svard.exe",
        ),
    );
    assets.push(
      {
        kind: "installer",
        source: installerSource,
        outputName: `Svard-${version}-windows-x86_64-setup.exe`,
      },
      {
        kind: "portable-exe",
        source: portableSource,
        outputName: `Svard-${version}-windows-x86_64.exe`,
      },
    );
  } else if (platform === "macos-apple-silicon") {
    const dmgRoot = path.resolve(
      repoRoot,
      args.source ??
        path.join(
          "src-tauri",
          "target",
          "aarch64-apple-darwin",
          "release",
          "bundle",
          "dmg",
        ),
    );
    const source = await findFirstFile(dmgRoot, (name) => /\.dmg$/i.test(name));
    assets.push({
      kind: "dmg",
      source,
      outputName: `Svard-${version}-macos-apple-silicon.dmg`,
    });
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  const copiedAssets = [];
  for (const asset of assets) {
    const target = await copyAsset(asset.source, asset.outputName);
    const digest = await sha256(target);
    copiedAssets.push({ ...asset, target, sha256: digest });
  }
  const checksumLines = copiedAssets
    .map((asset) => `${asset.sha256}  ${asset.outputName}\n`)
    .join("");
  await fs.writeFile(path.join(platformRoot, "SHA256SUMS.txt"), checksumLines);
  await fs.writeFile(
    path.join(platformRoot, "manifest.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        platform,
        version,
        assets: copiedAssets.map((asset) => ({
          kind: asset.kind,
          source: asset.source,
          asset: asset.target,
          fileName: asset.outputName,
          sha256: asset.sha256,
        })),
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );
  console.log(JSON.stringify({ platform, assets: copiedAssets }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
