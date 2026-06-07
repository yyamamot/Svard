import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const tauriConfigPath = path.join(repoRoot, "src-tauri", "tauri.conf.json");
const cargoTomlPath = path.join(repoRoot, "src-tauri", "Cargo.toml");
const packageJsonPath = path.join(repoRoot, "package.json");
const capabilityPath = path.join(
  repoRoot,
  "src-tauri",
  "capabilities",
  "default.json",
);

const manualChecks = [
  {
    id: "native-window-launch",
    command: "pnpm run dev:tauri",
    expected:
      "Svard native window launches without a Rust or WebView error and a fresh config shows Start Page instead of an implicit fixture document.",
  },
  {
    id: "fresh-start-page",
    command: "Launch Svard with no saved session and no CLI file path.",
    expected:
      "The native window starts on Start Page; it does not open /workspace/docs/mvp-guide.adoc.",
  },
  {
    id: "native-file-dialog",
    command: "Click Open or Folder in the native window.",
    expected:
      "macOS file dialog opens and focus returns to Svard after cancel or open.",
  },
  {
    id: "native-file-compare-drop",
    command:
      "Open Compare Files... in the native window and drop one supported Markdown or AsciiDoc file from Finder onto each Base / Compare slot.",
    expected:
      "Each slot accepts only the dropped markup document, unsupported or multiple file drops show inline validation, and Compare opens the file diff preview.",
  },
  {
    id: "external-browser-open",
    command: "Open an external link after confirmation.",
    expected: "The link opens in the default browser only after confirmation.",
  },
  {
    id: "os-clipboard",
    command: "Use source, selection, and path copy actions.",
    expected: "Clipboard receives the expected text or path content.",
  },
  {
    id: "cli-single-instance",
    command:
      "Launch a second Svard instance with a supported file or directory path.",
    expected:
      "Existing window receives a real filesystem open request and returns focus.",
  },
];

const requiredIcons = [
  "icons/32x32.png",
  "icons/128x128.png",
  "icons/128x128@2x.png",
  "icons/icon.icns",
  "icons/icon.ico",
];

const requiredAssociations = [
  ["adoc", "asciidoc", "asc"],
  ["md", "markdown"],
];

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

function staticCheck(id, passed, details) {
  return {
    id,
    status: passed ? "passed" : "failed",
    details,
  };
}

async function main() {
  const [tauriConfig, packageJson, capability, cargoToml] = await Promise.all([
    readJson(tauriConfigPath),
    readJson(packageJsonPath),
    readJson(capabilityPath),
    fs.readFile(cargoTomlPath, "utf8"),
  ]);

  const configuredIcons = tauriConfig.bundle?.icon ?? [];
  const iconChecks = await Promise.all(
    requiredIcons.map(async (icon) => ({
      icon,
      configured: configuredIcons.includes(icon),
      exists: await fileExists(path.join(repoRoot, "src-tauri", icon)),
    })),
  );
  const associations = tauriConfig.bundle?.fileAssociations ?? [];
  const associationChecks = requiredAssociations.map((extensions) => ({
    extensions,
    present: associations.some((association) =>
      extensions.every((extension) => association.ext?.includes(extension)),
    ),
  }));
  const permissions = capability.permissions ?? [];

  const staticChecks = [
    staticCheck("bundle-active", tauriConfig.bundle?.active === true, {
      active: tauriConfig.bundle?.active,
    }),
    staticCheck(
      "app-icons",
      iconChecks.every((check) => check.configured && check.exists),
      { icons: iconChecks },
    ),
    staticCheck(
      "file-associations",
      associationChecks.every((check) => check.present),
      { associations: associationChecks },
    ),
    staticCheck(
      "single-instance-plugin",
      cargoToml.includes("tauri-plugin-single-instance"),
      { dependency: "tauri-plugin-single-instance" },
    ),
    staticCheck(
      "opener-plugin",
      cargoToml.includes("tauri-plugin-opener") &&
        Boolean(packageJson.dependencies?.["@tauri-apps/plugin-opener"]),
      {
        cargoDependency: "tauri-plugin-opener",
        npmDependency: "@tauri-apps/plugin-opener",
      },
    ),
    staticCheck(
      "opener-capability",
      permissions.some(
        (permission) =>
          typeof permission === "object" &&
          permission.identifier === "opener:allow-open-url" &&
          permission.allow?.some((scope) => scope.url === "http://*") &&
          permission.allow?.some((scope) => scope.url === "https://*"),
      ) &&
        !permissions.includes("opener:allow-open-path") &&
        !permissions.includes("opener:default"),
      { permissions },
    ),
  ];

  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const artifactRoot = path.join(".artifacts", "tauri-smoke", runId);
  await fs.mkdir(artifactRoot, { recursive: true });
  const staticPassed = staticChecks.every((check) => check.status === "passed");
  const report = {
    schemaVersion: 1,
    runId,
    outcome: staticPassed ? "manual-required" : "failed",
    artifactRoot: path.resolve(artifactRoot),
    staticChecks,
    manualRequired: manualChecks,
  };
  await fs.writeFile(
    path.join(artifactRoot, "tauri-smoke-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report, null, 2));
  if (!staticPassed) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
