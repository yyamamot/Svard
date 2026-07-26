import type { CodexContextFormat } from "./types/codex";

export interface CodexContextPathClassification {
  format: CodexContextFormat;
  language: string;
}

const documentExtensions = new Map<string, CodexContextPathClassification>([
  ["md", { format: "markdown", language: "markdown" }],
  ["markdown", { format: "markdown", language: "markdown" }],
  ["adoc", { format: "asciidoc", language: "asciidoc" }],
  ["asciidoc", { format: "asciidoc", language: "asciidoc" }],
  ["asc", { format: "asciidoc", language: "asciidoc" }],
]);

const codeLanguages = new Map<string, string>([
  ["c", "c"],
  ["cc", "cpp"],
  ["cpp", "cpp"],
  ["cxx", "cpp"],
  ["h", "c"],
  ["hh", "cpp"],
  ["hpp", "cpp"],
  ["rs", "rust"],
  ["go", "go"],
  ["py", "python"],
  ["pyi", "python"],
  ["js", "javascript"],
  ["jsx", "javascript"],
  ["mjs", "javascript"],
  ["cjs", "javascript"],
  ["ts", "typescript"],
  ["tsx", "typescript"],
  ["java", "java"],
  ["kt", "kotlin"],
  ["kts", "kotlin"],
  ["swift", "swift"],
  ["rb", "ruby"],
  ["php", "php"],
  ["cs", "csharp"],
  ["sh", "shell"],
  ["bash", "shell"],
  ["zsh", "shell"],
  ["fish", "shell"],
  ["sql", "sql"],
  ["proto", "protobuf"],
  ["css", "css"],
  ["scss", "css"],
  ["less", "css"],
  ["html", "html"],
  ["htm", "html"],
  ["vue", "vue"],
  ["svelte", "svelte"],
]);

const configLanguages = new Map<string, string>([
  ["json", "json"],
  ["jsonc", "json"],
  ["yaml", "yaml"],
  ["yml", "yaml"],
  ["toml", "toml"],
  ["xml", "xml"],
  ["ini", "ini"],
  ["cfg", "cfg"],
  ["conf", "conf"],
  ["properties", "properties"],
]);

const deniedBasenames = new Set([".npmrc", ".pypirc", ".netrc"]);
const deniedExtensions = new Set(["pem", "key", "p12", "pfx"]);
const allowedEnvironmentTemplates = new Set([
  ".env.example",
  ".env.sample",
  ".env.template",
]);
function basenameForPath(path: string): string {
  return path.replaceAll("\\", "/").split("/").at(-1) ?? "";
}

function extensionForBasename(basename: string): string {
  const dot = basename.lastIndexOf(".");
  return dot >= 0 ? basename.slice(dot + 1).toLowerCase() : "";
}

export function classifyCodexContextPath(
  path: string,
): CodexContextPathClassification | null {
  const basename = basenameForPath(path);
  const lowerBasename = basename.toLowerCase();
  const extension = extensionForBasename(lowerBasename);

  if (
    deniedBasenames.has(lowerBasename) ||
    deniedExtensions.has(extension) ||
    lowerBasename.includes("credential") ||
    lowerBasename.includes("secret") ||
    (lowerBasename.startsWith(".env") &&
      !allowedEnvironmentTemplates.has(lowerBasename))
  ) {
    return null;
  }

  if (allowedEnvironmentTemplates.has(lowerBasename)) {
    return { format: "config", language: "dotenv" };
  }

  const document = documentExtensions.get(extension);
  if (document) {
    return document;
  }

  const codeLanguage = codeLanguages.get(extension);
  if (codeLanguage) {
    return { format: "code", language: codeLanguage };
  }

  const configLanguage = configLanguages.get(extension);
  if (configLanguage) {
    return { format: "config", language: configLanguage };
  }

  if (lowerBasename === "cmakelists.txt") {
    return { format: "config", language: "cmake" };
  }

  if (extension === "txt") {
    return { format: "text", language: "plaintext" };
  }

  switch (lowerBasename) {
    case "dockerfile":
      return { format: "config", language: "dockerfile" };
    case "makefile":
      return { format: "config", language: "makefile" };
    default:
      return null;
  }
}

export function isSupportedCodexContextPath(path: string): boolean {
  return classifyCodexContextPath(path) !== null;
}
