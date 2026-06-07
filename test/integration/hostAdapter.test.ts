import { afterEach, describe, expect, it, vi } from "vitest";

import { MockHostAdapter } from "../../src/adapters/mockHostAdapter";
import { fixturePath } from "../../src/core/fixtures";

afterEach(() => {
  delete (
    window as unknown as {
      __SVARD_DOCUMENT_OVERRIDES__?: unknown;
      __SVARD_OPEN_DOCUMENT_ERRORS__?: unknown;
    }
  ).__SVARD_DOCUMENT_OVERRIDES__;
  delete (
    window as unknown as {
      __SVARD_DOCUMENT_OVERRIDES__?: unknown;
      __SVARD_OPEN_DOCUMENT_ERRORS__?: unknown;
    }
  ).__SVARD_OPEN_DOCUMENT_ERRORS__;
});

describe("MockHostAdapter", () => {
  it("opens fixture documents and keeps Kroki disabled by default", async () => {
    const host = new MockHostAdapter();
    const config = await host.loadConfig();
    const document = await host.openDocument(fixturePath);
    const diagram = await host.renderDiagram({
      diagramType: "plantuml",
      source: "@startuml\n@enduml",
      config: config.kroki,
    });

    expect(document.source).toContain("Svard MVP Guide");
    expect(document.format).toBe("asciidoc");
    expect(config.kroki.mode).toBe("disabled");
    expect(config.diagram.plantumlRenderer).toBe("local");
    expect(config.diagram.plantumlTimeoutMs).toBe(10000);
    expect(config.diagram.graphvizRenderer).toBe("local");
    expect(config.diagram.graphvizTimeoutMs).toBe(10000);
    expect(config.workspace.expandedDirectories).toEqual([]);
    expect(config.workspace.sidebarTab).toBe("files");
    expect(config.workspace.bookmarks).toEqual([]);
    expect(config.workspace.activePath).toBe(fixturePath);
    expect(config.workspace.openTabs).toEqual([fixturePath]);
    expect(config.workspace.recentDocuments).toEqual([]);
    expect(config.workspace.recentDirectories).toEqual([]);
    expect(config.workspace.pinnedTabs).toEqual([]);
    expect(config.workspace.scrollPositions).toEqual({});
    expect(config.workspace.activeHeadingByPath).toEqual({});
    expect(config.workspace.splitSession).toBeNull();
    expect(config.kroki.outputFormat).toBe("svg");
    expect(diagram.status).toBe("disabled");
  });

  it("lists nested fixture directories for lazy tree scenarios", async () => {
    const host = new MockHostAdapter();
    const rootEntries = await host.listDirectory("/workspace");
    const docsEntries = await host.listDirectory("/workspace/docs");
    const guideEntries = await host.listDirectory("/workspace/docs/guides");

    expect(rootEntries.some((entry) => entry.path === "/workspace/docs")).toBe(
      true,
    );
    expect(
      docsEntries.some((entry) => entry.path === "/workspace/docs/guides"),
    ).toBe(true);
    expect(guideEntries.map((entry) => entry.name)).toContain(
      "quick-start.adoc",
    );
    expect(docsEntries.map((entry) => entry.name)).toContain(
      "markdown-sample.md",
    );
  });

  it("opens Markdown fixture documents", async () => {
    const host = new MockHostAdapter();
    const document = await host.openDocument(
      "/workspace/docs/markdown-sample.md",
    );

    expect(document.format).toBe("markdown");
    expect(document.source).toContain("Markdown Sample");
  });

  it("requires confirmation before public Kroki rendering", async () => {
    const host = new MockHostAdapter();
    const config = await host.loadConfig();
    const diagram = await host.renderDiagram({
      diagramType: "plantuml",
      source: "@startuml\n@enduml",
      config: {
        ...config.kroki,
        mode: "public",
        endpointUrl: "https://kroki.io",
      },
    });

    expect(diagram.status).toBe("error");
    expect(diagram.message).toContain("confirmation");
  });

  it("renders remote self-managed Kroki diagrams without per-request confirmation", async () => {
    const host = new MockHostAdapter();
    const config = await host.loadConfig();
    const diagram = await host.renderDiagram({
      diagramType: "plantuml",
      source: "@startuml\n@enduml",
      config: {
        ...config.kroki,
        mode: "remote",
        endpointUrl: "http://192.168.1.10:8000",
      },
      confirmedRemoteSend: false,
    });

    expect(diagram.status).toBe("rendered");
    expect(diagram.cacheStatus).toBe("miss");
  });

  it("renders localhost self-managed Kroki diagrams in the browser harness", async () => {
    const host = new MockHostAdapter();
    const config = await host.loadConfig();
    const diagram = await host.renderDiagram({
      diagramType: "plantuml",
      source: "@startuml\n@enduml",
      config: {
        ...config.kroki,
        mode: "remote",
        endpointUrl: "http://127.0.0.1:8000",
      },
    });

    expect(diagram.status).toBe("rendered");
    expect(diagram.cacheStatus).toBe("miss");
  });

  it("exposes a deterministic watch boundary in the browser harness", async () => {
    const host = new MockHostAdapter();
    const onChange = vi.fn();
    const handle = await host.watchDocument(fixturePath, onChange);

    expect(typeof handle.dispose).toBe("function");
    (
      window as unknown as {
        __SVARD_TRIGGER_DOCUMENT_CHANGE__?: (path: string) => void;
      }
    ).__SVARD_TRIGGER_DOCUMENT_CHANGE__?.(fixturePath);
    expect(onChange).toHaveBeenCalledTimes(1);
    handle.dispose();
    (
      window as unknown as {
        __SVARD_TRIGGER_DOCUMENT_CHANGE__?: (path: string) => void;
      }
    ).__SVARD_TRIGGER_DOCUMENT_CHANGE__?.(fixturePath);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("opens deterministic override documents for reload scenarios", async () => {
    const host = new MockHostAdapter();
    (
      window as unknown as {
        __SVARD_DOCUMENT_OVERRIDES__?: Record<
          string,
          { source: string; updatedAt?: string }
        >;
      }
    ).__SVARD_DOCUMENT_OVERRIDES__ = {
      [fixturePath]: {
        source: "# Reloaded Fixture",
        updatedAt: "2026-05-12T00:02:00.000Z",
      },
    };

    const document = await host.openDocument(fixturePath);

    expect(document.source).toContain("Reloaded Fixture");
    expect(document.updatedAt).toBe("2026-05-12T00:02:00.000Z");
  });

  it("exposes no-op desktop open request boundaries in the browser harness", async () => {
    const host = new MockHostAdapter();
    const requests = await host.takePendingOpenRequests();
    const handle = await host.watchOpenRequests(() => {
      throw new Error("fixture desktop open watch should not emit changes");
    });

    expect(requests).toEqual([]);
    expect(typeof handle.dispose).toBe("function");
    handle.dispose();
  });

  it("drains browser harness desktop open requests once", async () => {
    const host = new MockHostAdapter();
    (
      window as unknown as {
        __SVARD_PENDING_OPEN_REQUESTS__?: Array<{
          paths: string[];
          source: "initial";
        }>;
      }
    ).__SVARD_PENDING_OPEN_REQUESTS__ = [
      {
        source: "initial",
        paths: [
          "/workspace/docs/file-diff-left.md",
          "/workspace/docs/file-diff-right.md",
        ],
      },
    ];

    expect(await host.takePendingOpenRequests()).toEqual([
      {
        source: "initial",
        paths: [
          "/workspace/docs/file-diff-left.md",
          "/workspace/docs/file-diff-right.md",
        ],
      },
    ]);
    expect(await host.takePendingOpenRequests()).toEqual([]);
  });

  it("records editor open requests in the browser harness", async () => {
    const host = new MockHostAdapter();
    await host.openPathInEditor("/workspace/docs/copy-actions.adoc");

    expect(
      (
        window as unknown as {
          __SVARD_EDITOR_OPEN_REQUESTS__?: string[];
        }
      ).__SVARD_EDITOR_OPEN_REQUESTS__,
    ).toContain("/workspace/docs/copy-actions.adoc");
  });

  it("returns deterministic Git diff preview fixtures in the browser harness", async () => {
    const host = new MockHostAdapter();
    const modified = await host.getGitDiffPreview(
      "/workspace/docs/git-modified.md",
    );
    const clean = await host.getGitDiffPreview("/workspace/docs/git-clean.md");
    const untracked = await host.getGitDiffPreview(
      "/workspace/docs/git-untracked.md",
    );

    expect(modified.status).toBe("modified");
    expect(modified.relativePath).toBe("docs/git-modified.md");
    expect(modified.hunks[0]?.lines.some((line) => line.kind === "added")).toBe(
      true,
    );
    expect(clean.status).toBe("clean");
    expect(clean.hunks).toEqual([]);
    expect(untracked.status).toBe("untracked");
    expect(
      untracked.hunks[0]?.lines.every((line) => line.kind === "added"),
    ).toBe(true);
  });

  it("returns deterministic Git status hints in the browser harness", async () => {
    const host = new MockHostAdapter();
    const summary = await host.getGitStatusSummary([
      "/workspace/docs/git-modified.md",
      "/workspace/docs/git-clean.md",
      "/workspace/docs/git-untracked.md",
      "/workspace/docs/git-modified.md",
    ]);

    expect(summary).toEqual([
      { path: "/workspace/docs/git-modified.md", status: "modified" },
      { path: "/workspace/docs/git-clean.md", status: "clean" },
      { path: "/workspace/docs/git-untracked.md", status: "untracked" },
    ]);
  });

  it("keeps deterministic remote provider token status in the browser harness", async () => {
    const host = new MockHostAdapter();
    const provider = "github";
    const hostUrl = "https://github.com";

    expect(await host.getProviderTokenStatus(provider, hostUrl)).toEqual({
      stored: false,
    });
    expect(await host.testProviderConnection(provider, hostUrl)).toEqual({
      status: "error",
      message: "Token is not configured.",
    });

    await expect(
      host.saveProviderToken(provider, hostUrl, "  "),
    ).rejects.toThrow("Provider token cannot be empty.");
    expect(await host.saveProviderToken(provider, hostUrl, " token ")).toEqual({
      stored: true,
      message: "Token stored in OS credential store.",
    });
    expect(await host.getProviderTokenStatus(provider, hostUrl)).toEqual({
      stored: true,
    });
    expect(await host.testProviderConnection(provider, hostUrl)).toEqual({
      status: "ok",
      message: "Connection test succeeded.",
    });
    expect(await host.deleteProviderToken(provider, hostUrl)).toEqual({
      stored: false,
      message: "Token removed from OS credential store.",
    });
  });

  it("returns deterministic file-to-file diff previews in the browser harness", async () => {
    const host = new MockHostAdapter();
    const preview = await host.compareDocuments(
      "/workspace/docs/file-diff-left.md",
      "/workspace/docs/file-diff-right.md",
    );

    expect(preview.source).toBe("file");
    expect(preview.status).toBe("modified");
    expect(preview.leftLabel).toBe("file-diff-left.md");
    expect(preview.rightLabel).toBe("file-diff-right.md");
    expect(preview.hunks[0]?.lines.some((line) => line.kind === "added")).toBe(
      true,
    );
  });
});
