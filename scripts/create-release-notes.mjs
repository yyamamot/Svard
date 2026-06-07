import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const args = parseArgs(process.argv.slice(2));
const version = requiredArg("version").replace(/^v/, "");
const outPath = path.resolve(repoRoot, args.out ?? ".artifacts/release-notes.md");
const changelogPath = path.resolve(repoRoot, args.changelog ?? "CHANGELOG.md");
const checksumsPath = path.resolve(repoRoot, args.checksums ?? "SHA256SUMS.txt");

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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractChangelogSection(markdown, sectionVersion) {
  const pattern = new RegExp(
    `^##\\s+v?${escapeRegExp(sectionVersion)}\\s*$([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`,
    "m",
  );
  const match = markdown.match(pattern);
  const section = match?.[1]?.trim();
  if (!section) {
    throw new Error(`CHANGELOG.md does not contain a non-empty ## ${sectionVersion} section`);
  }
  return section;
}

function readChecksumFileNames(filePath) {
  const text = fs.readFileSync(filePath, "utf8").trim();
  if (!text) {
    throw new Error(`${filePath} is empty`);
  }
  return text
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/).slice(1).join(" "))
    .filter(Boolean);
}

const changelog = fs.readFileSync(changelogPath, "utf8");
const changes = extractChangelogSection(changelog, version);
const downloads = readChecksumFileNames(checksumsPath);

const notes = [
  `# Svard v${version}`,
  "",
  "## Changes",
  "",
  changes,
  "",
  "## Downloads",
  "",
  ...downloads.map((fileName) => `- \`${fileName}\``),
  "",
  "## Notes",
  "",
  "- macOS and Windows builds are currently unsigned.",
  "- Linux builds are not supported yet.",
  "- Verify downloaded files with `SHA256SUMS.txt` if needed.",
  "",
].join("\n");

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, notes);
console.log(JSON.stringify({ outcome: "created", version, outPath }));
