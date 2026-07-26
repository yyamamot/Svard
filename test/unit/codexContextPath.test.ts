import { describe, expect, it } from "vitest";
import {
  classifyCodexContextPath,
  isSupportedCodexContextPath,
} from "../../src/core/codexContextPath";

describe("Codex context path classification", () => {
  it.each([
    ["guide.md", "markdown", "markdown"],
    ["guide.adoc", "asciidoc", "asciidoc"],
    ["src/config.ts", "code", "typescript"],
    ["settings.yaml", "config", "yaml"],
    ["notes.txt", "text", "plaintext"],
    ["Dockerfile", "config", "dockerfile"],
    ["Makefile", "config", "makefile"],
    ["CMakeLists.txt", "config", "cmake"],
    [".env.example", "config", "dotenv"],
  ] as const)("accepts %s", (path, format, language) => {
    expect(classifyCodexContextPath(path)).toEqual({ format, language });
  });

  it.each([
    ".env",
    ".env.local",
    ".npmrc",
    ".pypirc",
    ".netrc",
    "service-credentials.json",
    "client_secret.json",
    "certificate.pem",
    "private.key",
    "archive.zip",
  ])("rejects sensitive or unsupported path %s", (path) => {
    expect(isSupportedCodexContextPath(path)).toBe(false);
  });
});
