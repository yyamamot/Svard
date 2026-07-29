import { describe, expect, it } from "vitest";
import {
  agentActivityHasExpandableDetail,
  agentActivityItems,
  agentErrorMessage,
  classifyAgentCommentary,
  currentAgentActivity,
  initialAgentChatState,
  latestReasoningSummary,
  redactAgentWorkspacePaths,
  reduceAgentChat,
  shouldShowAgentWorkSummary,
} from "../../src/ui/agent/agentChatState";
import {
  createAgentSessionSettingsSnapshot,
  resolveAgentWorkspacePath,
} from "../../src/ui/agent/AgentPanelHost";
import { defaultConfig } from "../../src/core/defaultConfig";
import { codexAppServerCapabilities } from "../../src/core/types";

describe("agent chat state", () => {
  it("keeps a session model snapshot independent from later preferences changes", () => {
    const codex = structuredClone(defaultConfig.agentProviders.codex);
    codex.model = "codex-balanced";
    const runtime = {
      providerId: "codex-app-server" as const,
      probe: {
        providerId: "codex-app-server" as const,
        state: "ready" as const,
        source: "path" as const,
        capabilities: codexAppServerCapabilities,
      },
      installation: {
        source: "path" as const,
        displayName: "PATH installation",
        version: "mock",
      },
      catalog: {
        providerId: "codex-app-server" as const,
        models: [
          {
            id: "balanced",
            model: "codex-balanced",
            displayName: "Codex Balanced",
            description: "",
            isDefault: true,
            defaultReasoningEffort: "medium",
            supportedReasoningEfforts: [{ value: "medium" }],
            supportsPersonality: true,
            inputModalities: ["text" as const],
          },
        ],
      },
      issue: null,
    };
    const snapshot = createAgentSessionSettingsSnapshot(codex, runtime);
    codex.model = "codex-fast";
    expect(snapshot).toMatchObject({
      model: "codex-balanced",
      modelDisplayName: "Codex Balanced",
      contextProfile: "focused",
    });
  });

  it("uses provider defaults when focused context is unsupported", () => {
    const codex = structuredClone(defaultConfig.agentProviders.codex);
    const runtime = {
      providerId: "codex-app-server" as const,
      probe: {
        providerId: "codex-app-server" as const,
        state: "ready" as const,
        source: "path" as const,
        capabilities: {
          ...codexAppServerCapabilities,
          focusedContext: false,
        },
      },
      installation: null,
      catalog: null,
      issue: null,
    };
    expect(
      createAgentSessionSettingsSnapshot(codex, runtime).contextProfile,
    ).toBe("providerDefaults");
    expect(codex.contextProfile).toBe("focused");
  });

  it("builds a natural streaming turn without provider ids", () => {
    let state = reduceAgentChat(initialAgentChatState, {
      type: "userTurn",
      turnId: "client-turn",
      question: "How are these files related?",
      images: [],
      responseMode: "auto",
    });
    state = reduceAgentChat(state, {
      type: "event",
      event: {
        type: "reasoningSummaryDelta",
        delta: "Inspecting the workspace.",
      },
    });
    state = reduceAgentChat(state, {
      type: "event",
      event: {
        type: "toolStarted",
        toolId: "internal-tool",
        kind: "search",
        category: "search",
        title: "Searching workspace files",
        visibility: "user",
      },
    });
    state = reduceAgentChat(state, {
      type: "event",
      event: { type: "finalAnswerDelta", delta: "They share one contract." },
    });
    state = reduceAgentChat(state, {
      type: "event",
      event: { type: "turnCompleted", clientTurnId: "client-turn" },
    });

    expect(state.turns[0]).toMatchObject({
      question: "How are these files related?",
      reasoningSummary: "Inspecting the workspace.",
      answer: "They share one contract.",
      status: "completed",
    });
    expect(JSON.stringify(state.turns[0])).not.toContain("threadId");
    expect(JSON.stringify(state.turns[0])).not.toContain("requestId");
  });

  it("tracks whether the provider accepted the active turn input", () => {
    let state = reduceAgentChat(initialAgentChatState, {
      type: "userTurn",
      turnId: "accepted-turn",
      question: "Review this.",
      images: [],
      responseMode: "auto",
    });
    expect(state.turns[0]?.inputAccepted).toBe(false);

    state = reduceAgentChat(state, {
      type: "event",
      event: {
        type: "turnInputAccepted",
        clientTurnId: "accepted-turn",
        imageAttachmentIds: [],
      },
    });

    expect(state.turns[0]?.inputAccepted).toBe(true);
  });

  it("shows only the latest normalized reasoning summary", () => {
    expect(
      latestReasoningSummary(
        "**Preparing file inspection****Preparing file inspection****Reviewing references**",
      ),
    ).toBe("Reviewing references");
  });

  it("prefers a running tool over reasoning and plan text", () => {
    let state = reduceAgentChat(initialAgentChatState, {
      type: "userTurn",
      turnId: "turn",
      question: "Inspect this.",
      images: [],
      responseMode: "auto",
    });
    state = reduceAgentChat(state, {
      type: "event",
      event: { type: "reasoningSummaryDelta", delta: "**Thinking**" },
    });
    state = reduceAgentChat(state, {
      type: "event",
      event: {
        type: "planUpdated",
        steps: [{ id: "one", title: "Plan the answer", status: "inProgress" }],
      },
    });
    state = reduceAgentChat(state, {
      type: "event",
      event: {
        type: "toolStarted",
        toolId: "search",
        kind: "search",
        category: "search",
        title: "Searching the workspace",
        visibility: "user",
        target: "docs",
      },
    });

    expect(currentAgentActivity(state.turns[0]!)).toBe(
      "Searching the workspace · docs",
    );
  });

  it("groups completed read and search activity and hides empty commands", () => {
    const activities = agentActivityItems([
      {
        id: "read-1",
        kind: "read",
        category: "read",
        title: "Inspecting files",
        status: "completed",
        visibility: "user",
        summary: "File inspected",
      },
      {
        id: "read-2",
        kind: "read",
        category: "read",
        title: "Inspecting files",
        status: "completed",
        visibility: "user",
        summary: "File inspected",
      },
      {
        id: "empty",
        kind: "command",
        category: "command",
        title: "Running a workspace command",
        status: "completed",
        visibility: "user",
      },
      {
        id: "failed",
        kind: "command",
        category: "command",
        title: "Running a workspace command",
        status: "failed",
        visibility: "user",
        summary: "Failed with exit code 1",
      },
    ]);

    expect(activities).toHaveLength(2);
    expect(activities[0]).toMatchObject({
      category: "read",
      count: 2,
      title: "Inspected files · 2 operations",
    });
    expect(activities[1]).toMatchObject({
      id: "failed",
      status: "failed",
    });
  });

  it("buffers split OpenUI commentary without exposing protocol text", () => {
    let state = reduceAgentChat(initialAgentChatState, {
      type: "userTurn",
      turnId: "openui-turn",
      question: "Visualize this.",
      images: [],
      responseMode: "visualize",
    });
    for (const delta of [
      "r",
      "oot = ",
      'SvardExperience("Summary", "Description", [])',
    ]) {
      state = reduceAgentChat(state, {
        type: "event",
        event: { type: "assistantCommentaryDelta", delta },
      });
      expect(state.turns[0]?.commentary).toBe("");
    }
    state = reduceAgentChat(state, {
      type: "event",
      event: { type: "turnCompleted", clientTurnId: "openui-turn" },
    });
    expect(state.turns[0]?.commentary).toBe("");
    expect(state.turns[0]?.commentaryBuffer).toBe("");
    expect(state.turns[0]?.commentaryClassification).toBe("suppressed");
  });

  it("releases ordinary Japanese commentary as soon as it is identifiable", () => {
    let state = reduceAgentChat(initialAgentChatState, {
      type: "userTurn",
      turnId: "plain-turn",
      question: "Explain this.",
      images: [],
      responseMode: "auto",
    });
    state = reduceAgentChat(state, {
      type: "event",
      event: { type: "assistantCommentaryDelta", delta: "関連" },
    });
    expect(state.turns[0]?.commentary).toBe("関連");
    state = reduceAgentChat(state, {
      type: "event",
      event: { type: "assistantCommentaryDelta", delta: "を確認します。" },
    });
    expect(state.turns[0]?.commentary).toBe("関連を確認します。");
    expect(classifyAgentCommentary("```openui")).toBe("suppressed");
  });

  it("hides successful internal and empty grouped activity but preserves failures", () => {
    const activities = agentActivityItems([
      {
        id: "internal",
        kind: "search",
        category: "search",
        title: "Running a provider operation",
        status: "completed",
        visibility: "internal",
        durationMs: 0,
      },
      {
        id: "empty-search",
        kind: "search",
        category: "search",
        title: "Searching the workspace",
        status: "completed",
        visibility: "user",
        durationMs: 0,
      },
      {
        id: "internal-failure",
        kind: "search",
        category: "search",
        title: "Running a provider operation",
        status: "failed",
        visibility: "internal",
        summary: "A provider operation failed",
      },
      {
        id: "file-change",
        kind: "fileChange",
        category: "fileChange",
        title: "Updating workspace files",
        status: "completed",
        visibility: "user",
      },
    ]);

    expect(activities).toHaveLength(2);
    expect(activities[0]).toMatchObject({
      id: "internal-failure",
      status: "failed",
    });
    expect(activities[1]).toMatchObject({
      id: "file-change",
      category: "fileChange",
    });
  });

  it("does not make a target-only or zero-duration activity expandable", () => {
    expect(
      agentActivityHasExpandableDetail({
        durationMs: 0,
      }),
    ).toBe(false);
    expect(agentActivityHasExpandableDetail({ durationMs: 12 })).toBe(true);
    expect(agentActivityHasExpandableDetail({ detail: "Safe output" })).toBe(
      true,
    );
  });

  it("hides Work summary after filtering the only internal success", () => {
    let state = reduceAgentChat(initialAgentChatState, {
      type: "userTurn",
      turnId: "internal-only",
      question: "Check this.",
      images: [],
      responseMode: "auto",
    });
    state = reduceAgentChat(state, {
      type: "event",
      event: {
        type: "toolStarted",
        toolId: "memory",
        kind: "search",
        category: "search",
        title: "Running a provider operation",
        visibility: "internal",
      },
    });
    state = reduceAgentChat(state, {
      type: "event",
      event: {
        type: "toolCompleted",
        toolId: "memory",
        status: "completed",
        durationMs: 0,
      },
    });
    state = reduceAgentChat(state, {
      type: "event",
      event: { type: "turnCompleted", clientTurnId: "internal-only" },
    });

    expect(shouldShowAgentWorkSummary(state.turns[0]!)).toBe(false);
  });

  it("keeps approval waiting until the user decides", () => {
    let state = reduceAgentChat(initialAgentChatState, {
      type: "userTurn",
      turnId: "turn",
      question: "Run the checks.",
      images: [],
      responseMode: "auto",
    });
    state = reduceAgentChat(state, {
      type: "event",
      event: {
        type: "permissionRequested",
        request: {
          requestId: "approval",
          kind: "command",
          title: "Run a workspace command",
          impact: "The command may read workspace files.",
        },
      },
    });
    expect(state.turns[0]?.approval?.title).toBe("Run a workspace command");

    state = reduceAgentChat(state, {
      type: "event",
      event: {
        type: "permissionResolved",
        requestId: "approval",
        decision: "deny",
      },
    });
    expect(state.turns[0]?.approval).toBeNull();
  });

  it("keeps turn-local image thumbnails in conversation history", () => {
    const image = {
      attachmentId: "image",
      displayLabel: "diagram.png",
      mediaType: "image/png" as const,
      width: 320,
      height: 180,
      byteLength: 1024,
      thumbnailDataUrl: "data:image/png;base64,preview",
    };
    let state = reduceAgentChat(initialAgentChatState, {
      type: "userTurn",
      turnId: "image-turn",
      question: "",
      images: [image],
      responseMode: "auto",
    });
    state = reduceAgentChat(state, {
      type: "event",
      event: {
        type: "turnInputAccepted",
        clientTurnId: "image-turn",
        imageAttachmentIds: ["image"],
      },
    });
    state = reduceAgentChat(state, {
      type: "event",
      event: { type: "turnCompleted", clientTurnId: "image-turn" },
    });

    expect(state.turns[0]?.images).toEqual([image]);
    expect(state.turns[0]?.question).toBe("");
  });

  it("redacts workspace absolute paths from provider-visible text", () => {
    expect(
      redactAgentWorkspacePaths(
        "Read /Users/test/workspace/docs/guide.md and C:\\repo\\src\\main.rs.",
        "/Users/test/workspace",
      ),
    ).toBe("Read ./docs/guide.md and C:\\repo\\src\\main.rs.");
    expect(
      redactAgentWorkspacePaths("Read C:\\repo\\src\\main.rs.", "C:\\repo"),
    ).toBe("Read .\\src\\main.rs.");
  });

  it("resolves only workspace-relative OpenUI file actions", () => {
    expect(resolveAgentWorkspacePath("/workspace", "docs/guide.md")).toBe(
      "/workspace/docs/guide.md",
    );
    expect(resolveAgentWorkspacePath("/workspace", "../secret.md")).toBeNull();
    expect(
      resolveAgentWorkspacePath("/workspace", "/private/secret.md"),
    ).toBeNull();
    expect(
      resolveAgentWorkspacePath("/workspace", "https://example.com/file.md"),
    ).toBeNull();
  });

  it("preserves string errors returned across the Tauri boundary", () => {
    expect(agentErrorMessage("Wait for the current answer.", "Fallback")).toBe(
      "Wait for the current answer.",
    );
    expect(agentErrorMessage({ message: "Invalid image." }, "Fallback")).toBe(
      "Invalid image.",
    );
  });

  it("hydrates completed static history without creating an active turn", () => {
    const restored = {
      id: "restored",
      question: "Review this document.",
      images: [],
      quotedContexts: [],
      responseMode: "auto" as const,
      steeringMessages: [],
      changedPaths: [],
      inputAccepted: true,
      restoreEligible: false,
      commentary: "",
      commentaryBuffer: "",
      commentaryClassification: "plain" as const,
      reasoningSummary: "",
      plan: [],
      tools: [],
      approval: null,
      answer: "The heading hierarchy is inconsistent.",
      status: "completed" as const,
      restored: true,
      restoredContextOmitted: true,
    };

    const state = reduceAgentChat(initialAgentChatState, {
      type: "hydrate",
      turns: [restored],
    });

    expect(state.activeTurnId).toBeNull();
    expect(state.turns).toEqual([restored]);
    expect(state.disconnectedMessage).toBeNull();
  });
});
