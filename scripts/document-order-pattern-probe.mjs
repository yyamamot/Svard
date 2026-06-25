import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function analyzeDocumentOrderSources(sources) {
  const aggregate = emptyAggregate();
  for (const source of sources) {
    let content;
    try {
      content = await readSource(source);
    } catch {
      aggregate.readFailures += 1;
      continue;
    }
    const kind = detectKind(source, content);
    aggregate.sampleCount += 1;
    aggregate.byKind[kind] = (aggregate.byKind[kind] ?? 0) + 1;
    const summary = summarizeContent(kind, content);
    mergeCounts(aggregate.patterns, summary);
  }
  return aggregate;
}

function emptyAggregate() {
  return {
    sampleCount: 0,
    readFailures: 0,
    byKind: {},
    patterns: {},
  };
}

async function readSource(source) {
  if (/^https?:\/\//.test(source)) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`source could not be read: ${response.status}`);
    }
    return response.text();
  }
  return fs.readFileSync(source, "utf8");
}

function detectKind(source, content) {
  const basename = path.basename(source).toLowerCase();
  if (basename === "mkdocs.yml" || basename === "mkdocs.yaml") {
    return "mkdocs";
  }
  if (basename === "antora-playbook.yml" || basename === "antora-playbook.yaml") {
    return "antora-playbook";
  }
  if (basename === "antora.yml") {
    return "antora-descriptor";
  }
  if (basename === "nav.adoc") {
    return "antora-nav";
  }
  if (/^\s*nav\s*:/m.test(content) && /^\s*content\s*:/m.test(content)) {
    return "antora-playbook";
  }
  if (/^\s*nav\s*:/m.test(content)) {
    return "mkdocs";
  }
  return "unknown";
}

function summarizeContent(kind, content) {
  if (kind === "mkdocs") {
    return summarizeMkDocs(content);
  }
  if (kind === "antora-playbook") {
    return summarizeAntoraPlaybook(content);
  }
  if (kind === "antora-descriptor") {
    return summarizeAntoraDescriptor(content);
  }
  if (kind === "antora-nav") {
    return summarizeAntoraNav(content);
  }
  return { unknown: 1 };
}

function summarizeMkDocs(content) {
  return removeZeroCounts({
    mkdocsNavConfigured: countMatches(content, /^\s*nav\s*:/gm),
    mkdocsDocsDirConfigured: countMatches(content, /^\s*docs_dir\s*:/gm),
    mkdocsInheritConfigured: countMatches(content, /^\s*INHERIT\s*:/gm),
    mkdocsStringNavItems: countMatches(content, /^\s*-\s*['"]?[^:\n]+\.md['"]?\s*$/gm),
    mkdocsTitledNavItems: countMatches(content, /^\s*-\s*[^:\n]+:\s*[^[]/gm),
    mkdocsNestedSections: countMatches(content, /^\s*-\s*[^:\n]+:\s*$/gm),
    mkdocsCustomYamlTags: countMatches(content, /![A-Za-z][\w-]*/g),
  });
}

function summarizeAntoraPlaybook(content) {
  return removeZeroCounts({
    antoraContentSources: countMatches(content, /^\s*-\s*url\s*:/gm),
    antoraLocalSources: countMatches(content, /^\s*-\s*url\s*:\s*(\.|['"]\.)/gm),
    antoraRemoteSources: countMatches(content, /^\s*-\s*url\s*:\s*['"]?(?:https?:\/\/|git@)/gm),
    antoraStartPath: countMatches(content, /^\s*start_path\s*:/gm),
    antoraStartPaths: countMatches(content, /^\s*start_paths\s*:/gm),
    antoraCommaSeparatedStartPaths: countMatches(
      content,
      /^\s*start_paths?\s*:\s*[^[][^,\n]+,\s*[^,\n]+/gm,
    ),
    antoraWildcardStartPaths: countMatches(content, /^\s*start_paths?\s*:.*\*/gm),
    antoraExtensionConfigured: countMatches(content, /^\s*extensions\s*:/gm),
  });
}

function summarizeAntoraDescriptor(content) {
  return removeZeroCounts({
    antoraNavConfigured: countMatches(content, /^\s*nav\s*:/gm),
    antoraRegisteredNavFiles: countMatches(content, /^\s*-\s*modules\/[^/\s]+\/nav\.adoc/gm),
    antoraStartPageConfigured: countMatches(content, /^\s*start_page\s*:/gm),
  });
}

function summarizeAntoraNav(content) {
  return removeZeroCounts({
    antoraNavSectionHeadings: countMatches(content, /^\s*\.[^\s.].*$/gm),
    antoraNavListItems: countMatches(content, /^\s*\*{1,5}\s+/gm),
    antoraNavXrefs: countMatches(content, /xref:[^\[]+\[/g),
    antoraNavXrefsWithAnchor: countMatches(content, /xref:[^\[#]+\#[^\[]+\[/g),
    antoraNavIncludes: countMatches(content, /^\s*include::/gm),
    antoraNavExternalLinks: countMatches(content, /https?:\/\/[^\[]+\[/g),
  });
}

function countMatches(content, pattern) {
  return [...content.matchAll(pattern)].length;
}

function removeZeroCounts(counts) {
  return Object.fromEntries(
    Object.entries(counts).filter(([, value]) => Number(value) > 0),
  );
}

function mergeCounts(target, source) {
  for (const [key, value] of Object.entries(source)) {
    target[key] = (target[key] ?? 0) + value;
  }
}

async function runCli() {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf("--out");
  let outPath = null;
  if (outIndex !== -1) {
    outPath = args[outIndex + 1] ?? null;
    args.splice(outIndex, 2);
  }
  if (args.length === 0) {
    console.error("usage: node scripts/document-order-pattern-probe.mjs [--out report.json] <url-or-path>...");
    process.exitCode = 1;
    return;
  }
  const report = await analyzeDocumentOrderSources(args);
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (outPath) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, json);
  } else {
    process.stdout.write(json);
  }
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
