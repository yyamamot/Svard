import { describe, expect, it } from "vitest";

import { buildQuickOpenCandidates } from "../../src/ui/hooks/useQuickOpenCandidates";
import type { RenderResult } from "../../src/core/types";

const baseOptions = {
  bookmarks: [],
  childrenByDirectory: {},
  commandEnabled: () => true,
  documentPayload: null,
  quickOpenQuery: "",
  recentDocuments: [],
  renderResult: null,
  tabs: [],
};

const renderResult: RenderResult = {
  html: "",
  headings: [
    {
      id: "overview",
      level: 2,
      text: "Overview",
      sourceLocation: { line: 10, column: 1 },
    },
    {
      id: "details",
      level: 2,
      text: "Details",
      sourceLocation: { line: 30, column: 1 },
    },
  ],
  sourceBlocks: [
    {
      id: "source-1",
      language: "ts",
      sourceLocation: { line: 18, column: 1 },
    },
  ],
  diagnostics: [
    {
      id: "diagnostic-1",
      severity: "warning",
      message: "Unsupported diagram",
      sourceLocation: { line: 42, column: 1 },
    },
  ],
  diagramSlots: [
    {
      id: "diagram-1",
      diagramType: "plantuml",
      renderer: "plantuml",
      sourceLocation: { line: 38, column: 1 },
    },
  ],
  mermaidDiagrams: [],
  plantUmlDiagrams: [],
  graphvizDiagrams: [],
  krokiDiagrams: [],
};

describe("quick open candidates", () => {
  it("keeps file candidates for prefix-free queries", () => {
    const candidates = buildQuickOpenCandidates({
      ...baseOptions,
      quickOpenQuery: "guide",
      tabs: [
        {
          path: "/workspace/docs/guide.adoc",
          basePath: "/workspace/docs",
          format: "asciidoc",
          source: "",
          updatedAt: "2026-05-15T00:00:00.000Z",
        },
      ],
    });

    expect(candidates).toMatchObject([
      {
        type: "file",
        path: "/workspace/docs/guide.adoc",
        source: "Open file",
      },
    ]);
  });

  it("filters command palette candidates by title and id", () => {
    const candidates = buildQuickOpenCandidates({
      ...baseOptions,
      quickOpenQuery: ">search",
      commandEnabled: (commandId) => commandId !== "search.next",
    });

    expect(candidates.some((candidate) => candidate.type === "command")).toBe(
      true,
    );
    expect(candidates).toContainEqual(
      expect.objectContaining({
        type: "command",
        id: "search.next",
        enabled: false,
      }),
    );
  });

  it("includes Show Git Diff in command palette with command enabled state", () => {
    const candidates = buildQuickOpenCandidates({
      ...baseOptions,
      quickOpenQuery: ">git",
      commandEnabled: (commandId) =>
        commandId === "git.showDiff" || commandId === "git.showFileHistory",
    });

    expect(candidates).toContainEqual(
      expect.objectContaining({
        type: "command",
        id: "git.showDiff",
        label: "Show Git Diff",
        enabled: true,
      }),
    );
    expect(candidates).toContainEqual(
      expect.objectContaining({
        type: "command",
        id: "git.showFileHistory",
        label: "Show File History",
        enabled: true,
      }),
    );
  });

  it("includes viewer shortcut help in command palette aliases", () => {
    const candidates = buildQuickOpenCandidates({
      ...baseOptions,
      quickOpenQuery: ">help",
      commandEnabled: (commandId) => commandId === "viewer.showShortcuts",
    });

    expect(candidates).toContainEqual(
      expect.objectContaining({
        type: "command",
        id: "viewer.showShortcuts",
        label: "Shortcuts and Gestures",
        enabled: true,
      }),
    );
  });

  it("includes the Svard website command in command palette aliases", () => {
    const candidates = buildQuickOpenCandidates({
      ...baseOptions,
      quickOpenQuery: ">homepage",
      commandEnabled: (commandId) => commandId === "help.openWebsite",
    });

    expect(candidates).toContainEqual(
      expect.objectContaining({
        type: "command",
        id: "help.openWebsite",
        label: "Website",
        enabled: true,
      }),
    );
  });

  it("includes file compare command in command palette", () => {
    const candidates = buildQuickOpenCandidates({
      ...baseOptions,
      quickOpenQuery: ">compare",
      commandEnabled: (commandId) =>
        commandId === "file.compareWithActive" ||
        commandId === "file.compareFiles",
    });

    expect(candidates).toContainEqual(
      expect.objectContaining({
        type: "command",
        id: "file.compareWithActive",
        label: "Compare Active File With...",
        enabled: true,
      }),
    );
    expect(candidates).toContainEqual(
      expect.objectContaining({
        type: "command",
        id: "file.compareFiles",
        label: "Compare Files...",
        enabled: true,
      }),
    );
  });

  it("includes Reveal Current Document in Docs Order in command palette", () => {
    const candidates = buildQuickOpenCandidates({
      ...baseOptions,
      quickOpenQuery: ">reveal",
      commandEnabled: (commandId) => commandId === "documents.revealCurrent",
    });

    expect(candidates).toContainEqual(
      expect.objectContaining({
        type: "command",
        id: "documents.revealCurrent",
        label: "Reveal Current Document in Docs Order",
        enabled: true,
      }),
    );
  });

  it("includes New Window, Duplicate Window, and Switch to Recent Tab commands with enabled state", () => {
    const candidates = buildQuickOpenCandidates({
      ...baseOptions,
      quickOpenQuery: ">window",
      commandEnabled: (commandId) =>
        commandId === "window.new" ||
        commandId === "window.duplicate" ||
        commandId === "tab.switchToRecent",
    });

    expect(candidates).toContainEqual(
      expect.objectContaining({
        type: "command",
        id: "window.duplicate",
        label: "Duplicate Window",
        enabled: true,
      }),
    );
    expect(candidates).toContainEqual(
      expect.objectContaining({
        type: "command",
        id: "window.new",
        label: "New Window",
        enabled: true,
      }),
    );
    const recentCandidates = buildQuickOpenCandidates({
      ...baseOptions,
      quickOpenQuery: ">recent",
      commandEnabled: (commandId) => commandId === "tab.switchToRecent",
    });

    expect(recentCandidates).toContainEqual(
      expect.objectContaining({
        type: "command",
        id: "tab.switchToRecent",
        label: "Switch to Recent Tab",
        enabled: true,
      }),
    );
    expect(candidates).not.toContainEqual(
      expect.objectContaining({
        id: "file.openCurrentInNewWindow",
      }),
    );
    expect(candidates).not.toContainEqual(
      expect.objectContaining({
        id: "tab.moveToNewWindow",
      }),
    );
  });

  it("filters heading candidates from the active render result", () => {
    const candidates = buildQuickOpenCandidates({
      ...baseOptions,
      quickOpenQuery: "@detail",
      renderResult,
    });

    expect(candidates).toEqual([
      expect.objectContaining({
        type: "heading",
        id: "details",
        line: 30,
      }),
    ]);
  });

  it("returns the nearest mapped source line target", () => {
    const candidates = buildQuickOpenCandidates({
      ...baseOptions,
      quickOpenQuery: ":37",
      renderResult,
    });

    expect(candidates).toEqual([
      expect.objectContaining({
        type: "sourceLine",
        line: 37,
        targetLine: 38,
        targetKind: "diagram",
      }),
    ]);
  });

  it("returns no line candidate for invalid source line input", () => {
    expect(
      buildQuickOpenCandidates({
        ...baseOptions,
        quickOpenQuery: ":abc",
        renderResult,
      }),
    ).toEqual([]);
  });
});
