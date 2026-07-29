import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MockHostAdapter } from "../../src/adapters/mockHostAdapter";
import type { AgentEvent } from "../../src/core/types";
import {
  SvardOpenUiAnswer,
  validateOpenUiResponse,
} from "../../src/ui/codex/openUiLibrary";

describe("MockHostAdapter agent provider", () => {
  it("coalesces concurrent runtime requests", async () => {
    const host = new MockHostAdapter();
    const first = host.getAgentProviderRuntime("codex-app-server");
    const second = host.getAgentProviderRuntime("codex-app-server");
    await Promise.all([first, second]);
    expect(
      (
        globalThis as typeof globalThis & {
          __SVARD_AGENT_RUNTIME_LOAD_COUNT__?: number;
        }
      ).__SVARD_AGENT_RUNTIME_LOAD_COUNT__,
    ).toBe(1);
    delete (
      globalThis as typeof globalThis & {
        __SVARD_AGENT_RUNTIME_LOAD_COUNT__?: number;
      }
    ).__SVARD_AGENT_RUNTIME_LOAD_COUNT__;
  });

  it("keys runtime cache by executable preference", async () => {
    const host = new MockHostAdapter();
    await host.getAgentProviderRuntime("codex-app-server", {
      executablePreference: { mode: "auto", path: null },
    });
    await host.getAgentProviderRuntime("codex-app-server", {
      executablePreference: { mode: "custom", path: "/mock/custom/codex" },
    });
    await host.getAgentProviderRuntime("codex-app-server", {
      executablePreference: { mode: "auto", path: null },
    });
    expect(
      (
        globalThis as typeof globalThis & {
          __SVARD_AGENT_RUNTIME_LOAD_COUNT__?: number;
        }
      ).__SVARD_AGENT_RUNTIME_LOAD_COUNT__,
    ).toBe(2);
    delete (
      globalThis as typeof globalThis & {
        __SVARD_AGENT_RUNTIME_LOAD_COUNT__?: number;
      }
    ).__SVARD_AGENT_RUNTIME_LOAD_COUNT__;
  });

  it("returns a dynamic model catalog with model-specific capabilities", async () => {
    const runtime = await new MockHostAdapter().getAgentProviderRuntime(
      "codex-app-server",
    );
    const catalog = runtime.catalog;
    expect(catalog).not.toBeNull();
    if (!catalog) throw new Error("Expected a model catalog.");
    expect(catalog.providerId).toBe("codex-app-server");
    expect(catalog.models.find((model) => model.isDefault)?.model).toBe(
      "codex-balanced",
    );
    expect(
      catalog.models.find((model) => model.model === "codex-fast"),
    ).toMatchObject({
      supportsPersonality: false,
      inputModalities: ["text"],
    });
  });

  it("fails closed when focused context is unsupported or cannot be applied", async () => {
    const globals = globalThis as typeof globalThis & {
      __SVARD_AGENT_FOCUSED_CONTEXT__?: boolean;
      __SVARD_AGENT_FOCUSED_CONTEXT_START_FAILURE__?: boolean;
    };
    globals.__SVARD_AGENT_FOCUSED_CONTEXT__ = false;
    try {
      const unsupportedHost = new MockHostAdapter();
      const runtime =
        await unsupportedHost.getAgentProviderRuntime("codex-app-server");
      expect(runtime.probe.capabilities.focusedContext).toBe(false);
      await expect(
        unsupportedHost.startAgentSession(
          {
            providerId: "codex-app-server",
            executablePreference: { mode: "auto", path: null },
            clientSessionId: "unsupported-focused",
            workspaceRoot: "/workspace",
            permissionMode: "observe",
            networkAccess: false,
            webSearch: false,
            contextProfile: "focused",
          },
          () => undefined,
        ),
      ).rejects.toThrow("unavailable");
    } finally {
      delete globals.__SVARD_AGENT_FOCUSED_CONTEXT__;
    }

    globals.__SVARD_AGENT_FOCUSED_CONTEXT_START_FAILURE__ = true;
    try {
      await expect(
        new MockHostAdapter().startAgentSession(
          {
            providerId: "codex-app-server",
            executablePreference: { mode: "auto", path: null },
            clientSessionId: "failed-focused",
            workspaceRoot: "/workspace",
            permissionMode: "observe",
            networkAccess: false,
            webSearch: false,
            contextProfile: "focused",
          },
          () => undefined,
        ),
      ).rejects.toThrow("could not be applied");
    } finally {
      delete globals.__SVARD_AGENT_FOCUSED_CONTEXT_START_FAILURE__;
    }
  });

  it("rejects unavailable model settings and disables images for text-only models", async () => {
    const host = new MockHostAdapter();
    await expect(
      host.startAgentSession(
        {
          providerId: "codex-app-server",
          executablePreference: { mode: "auto", path: null },
          clientSessionId: "missing-model",
          workspaceRoot: "/workspace",
          permissionMode: "observe",
          networkAccess: false,
          webSearch: false,
          model: "missing",
        },
        () => undefined,
      ),
    ).rejects.toThrow("unavailable");

    const session = await host.startAgentSession(
      {
        providerId: "codex-app-server",
        executablePreference: { mode: "auto", path: null },
        clientSessionId: "text-only",
        workspaceRoot: "/workspace",
        permissionMode: "observe",
        networkAccess: false,
        webSearch: false,
        model: "codex-fast",
        reasoningEffort: "low",
      },
      () => undefined,
    );
    expect(session.capabilities.imageInput).toBe(false);
  });

  it("streams reasoning, tools and the final answer", async () => {
    const host = new MockHostAdapter();
    const events: AgentEvent[] = [];
    await host.startAgentSession(
      {
        providerId: "codex-app-server",
        executablePreference: { mode: "auto", path: null },
        clientSessionId: "session",
        workspaceRoot: "/workspace",
        permissionMode: "observe",
        networkAccess: false,
        webSearch: false,
      },
      (event) => events.push(event),
    );
    const outcome = await host.sendAgentTurn({
      clientSessionId: "session",
      clientTurnId: "turn",
      question: "Explain the relationship.",
      responseMode: "auto",
      activeFile: { path: "/workspace/docs/current.md" },
      focusFiles: [
        { path: "/workspace/docs/guide.md", displayLabel: "docs/guide.md" },
      ],
    });

    expect(outcome).toEqual({ status: "completed" });
    expect(events.map((event) => event.type)).toEqual(
      expect.arrayContaining([
        "sessionReady",
        "reasoningSummaryDelta",
        "planUpdated",
        "toolStarted",
        "toolCompleted",
        "finalAnswerDelta",
        "turnCompleted",
      ]),
    );
    expect(
      (
        globalThis as typeof globalThis & {
          __SVARD_AGENT_LAST_TURN_INPUT__?: {
            activeFile?: { path: string } | null;
            focusFiles: Array<{ path: string }>;
          };
        }
      ).__SVARD_AGENT_LAST_TURN_INPUT__,
    ).toMatchObject({
      activeFile: { path: "/workspace/docs/current.md" },
      focusFiles: [{ path: "/workspace/docs/guide.md" }],
    });
    delete (
      globalThis as typeof globalThis & {
        __SVARD_AGENT_LAST_TURN_INPUT__?: unknown;
      }
    ).__SVARD_AGENT_LAST_TURN_INPUT__;
  });

  it("fixtures context usage and automatic and manual compaction lifecycles", async () => {
    const host = new MockHostAdapter();
    const events: AgentEvent[] = [];
    await host.startAgentSession(
      {
        providerId: "codex-app-server",
        executablePreference: { mode: "auto", path: null },
        clientSessionId: "context-session",
        workspaceRoot: "/workspace",
        permissionMode: "observe",
        networkAccess: false,
        webSearch: false,
      },
      (event) => events.push(event),
    );
    await host.sendAgentTurn({
      clientSessionId: "context-session",
      clientTurnId: "context-turn",
      question: "Trigger automatic compaction.",
      responseMode: "auto",
      focusFiles: [],
      imageAttachmentIds: [],
    });
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "contextCompactionStarted",
          source: "automatic",
        }),
        expect.objectContaining({
          type: "contextCompactionCompleted",
          source: "automatic",
        }),
        expect.objectContaining({
          type: "contextUsageUpdated",
          usage: {
            usedTokens: 50_000,
            contextWindowTokens: 250_000,
            remainingPercent: 80,
          },
        }),
        expect.objectContaining({
          type: "tokenUsageDiagnosticsUpdated",
          diagnostics: expect.objectContaining({
            latestRequest: expect.objectContaining({
              provenance: "providerReported",
            }),
            turn: expect.objectContaining({
              provenance: "aggregatedProviderReports",
            }),
            conversation: expect.objectContaining({
              provenance: "providerReported",
            }),
          }),
        }),
      ]),
    );

    const outcome = await host.compactAgentSession("context-session");
    expect(outcome).toEqual({ status: "completed" });
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "contextCompactionStarted",
          source: "manual",
        }),
        expect.objectContaining({
          type: "contextCompactionCompleted",
          source: "manual",
        }),
      ]),
    );
  });

  it("omits invalid token diagnostics and does not restore them on resume", async () => {
    const globals = globalThis as typeof globalThis & {
      __SVARD_AGENT_TOKEN_USAGE_DIAGNOSTICS__?: "invalid";
    };
    globals.__SVARD_AGENT_TOKEN_USAGE_DIAGNOSTICS__ = "invalid";
    try {
      const host = new MockHostAdapter();
      const events: AgentEvent[] = [];
      await host.startAgentSession(
        {
          providerId: "codex-app-server",
          executablePreference: { mode: "auto", path: null },
          clientSessionId: "diagnostics-session",
          workspaceRoot: "/workspace",
          permissionMode: "observe",
          networkAccess: false,
          webSearch: false,
        },
        (event) => events.push(event),
      );
      await host.sendAgentTurn({
        clientSessionId: "diagnostics-session",
        clientTurnId: "diagnostics-turn",
        question: "Report context only.",
        responseMode: "auto",
        focusFiles: [],
      });
      expect(events.some((event) => event.type === "contextUsageUpdated")).toBe(
        true,
      );
      expect(
        events.some((event) => event.type === "tokenUsageDiagnosticsUpdated"),
      ).toBe(false);
      await host.closeAgentSession("diagnostics-session");

      delete globals.__SVARD_AGENT_TOKEN_USAGE_DIAGNOSTICS__;
      const resumedEvents: AgentEvent[] = [];
      await host.resumeAgentSession(
        {
          clientSessionId: "diagnostics-session",
          workspaceRoot: "/workspace",
          executablePreference: { mode: "auto", path: null },
          fullAccessConfirmed: false,
        },
        (event) => resumedEvents.push(event),
      );
      expect(
        resumedEvents.some(
          (event) => event.type === "tokenUsageDiagnosticsUpdated",
        ),
      ).toBe(false);
    } finally {
      delete globals.__SVARD_AGENT_TOKEN_USAGE_DIAGNOSTICS__;
    }
  });

  it("updates a new chat from fallback to a generated title once", async () => {
    const host = new MockHostAdapter();
    const events: AgentEvent[] = [];
    await host.startAgentSession(
      {
        providerId: "codex-app-server",
        executablePreference: { mode: "auto", path: null },
        clientSessionId: "title-session",
        workspaceRoot: "/workspace",
        permissionMode: "observe",
        networkAccess: false,
        webSearch: false,
      },
      (event) => events.push(event),
    );
    await host.sendAgentTurn({
      clientSessionId: "title-session",
      clientTurnId: "title-turn",
      question: "explain automatic chat titles for the history sidebar.",
      responseMode: "auto",
      focusFiles: [],
    });

    const titleEvents = events.filter(
      (event): event is Extract<AgentEvent, { type: "sessionTitleUpdated" }> =>
        event.type === "sessionTitleUpdated",
    );
    expect(titleEvents.map((event) => event.title)).toEqual([
      "explain automatic chat titles for the history sidebar.",
      "Explain automatic chat titles for the",
    ]);
    expect(
      events.findIndex((event) => event.type === "turnCompleted"),
    ).toBeLessThan(events.lastIndexOf(titleEvents[1]));

    await host.sendAgentTurn({
      clientSessionId: "title-session",
      clientTurnId: "second-turn",
      question: "This must not rename the chat again.",
      responseMode: "auto",
      focusFiles: [],
    });
    expect(
      events.filter((event) => event.type === "sessionTitleUpdated"),
    ).toHaveLength(2);
  });

  it("keeps a manual rename made while title generation is pending", async () => {
    const host = new MockHostAdapter();
    const events: AgentEvent[] = [];
    await host.startAgentSession(
      {
        providerId: "codex-app-server",
        executablePreference: { mode: "auto", path: null },
        clientSessionId: "manual-title-session",
        workspaceRoot: "/workspace",
        permissionMode: "observe",
        networkAccess: false,
        webSearch: false,
      },
      (event) => {
        events.push(event);
        if (event.type === "sessionTitleUpdated") {
          void host.renameAgentSession({
            clientSessionId: "manual-title-session",
            title: "My manual title",
            executablePreference: { mode: "auto", path: null },
          });
        }
      },
    );
    await host.sendAgentTurn({
      clientSessionId: "manual-title-session",
      clientTurnId: "manual-title-turn",
      question: "Generate a different title automatically.",
      responseMode: "auto",
      focusFiles: [],
    });

    const page = await host.listAgentSessions({
      providerId: "codex-app-server",
      workspaceRoot: "/workspace",
    });
    expect(page.sessions[0]?.title).toBe("My manual title");
    expect(
      events.filter((event) => event.type === "sessionTitleUpdated"),
    ).toHaveLength(1);
  });

  it("resolves an approval with allow once", async () => {
    const host = new MockHostAdapter();
    const events: AgentEvent[] = [];
    await host.startAgentSession(
      {
        providerId: "codex-app-server",
        executablePreference: { mode: "auto", path: null },
        clientSessionId: "approval-session",
        workspaceRoot: "/workspace",
        permissionMode: "agent",
        networkAccess: false,
        webSearch: false,
      },
      (event) => {
        events.push(event);
        if (event.type === "permissionRequested") {
          void host.respondToAgentApproval({
            clientSessionId: "approval-session",
            requestId: event.request.requestId,
            decision: "allowOnce",
          });
        }
      },
    );
    const outcome = await host.sendAgentTurn({
      clientSessionId: "approval-session",
      clientTurnId: "approval-turn",
      question: "Approval is required.",
      responseMode: "auto",
      focusFiles: [],
    });

    expect(outcome).toEqual({ status: "completed" });
    expect(events.some((event) => event.type === "permissionRequested")).toBe(
      true,
    );
    expect(events.some((event) => event.type === "permissionResolved")).toBe(
      true,
    );
  });

  it("streams an allowlisted OpenUI final answer in visualize mode", async () => {
    const host = new MockHostAdapter();
    const events: AgentEvent[] = [];
    await host.startAgentSession(
      {
        providerId: "codex-app-server",
        executablePreference: { mode: "auto", path: null },
        clientSessionId: "visual-session",
        workspaceRoot: "/workspace",
        permissionMode: "observe",
        networkAccess: false,
        webSearch: false,
      },
      (event) => events.push(event),
    );
    await host.sendAgentTurn({
      clientSessionId: "visual-session",
      clientTurnId: "visual-turn",
      question: "Visualize the workspace boundaries.",
      responseMode: "visualize",
      focusFiles: [],
    });

    const answer = events
      .filter(
        (event): event is Extract<AgentEvent, { type: "finalAnswerDelta" }> =>
          event.type === "finalAnswerDelta",
      )
      .map((event) => event.delta)
      .join("");
    const parsed = validateOpenUiResponse(answer);
    expect(parsed.valid, JSON.stringify(parsed.meta)).toBe(true);
    await expect(
      host.readAgentSessionHistory({ clientSessionId: "visual-session" }),
    ).resolves.toMatchObject({
      turns: [{ responseMode: "visualize" }],
    });
    const html = renderToStaticMarkup(
      createElement(SvardOpenUiAnswer, { content: answer }),
    );
    expect(html, html).toContain("codex-openui-answer");
  });

  it("accepts an image-only turn once and emits input acceptance", async () => {
    const host = new MockHostAdapter();
    const events: AgentEvent[] = [];
    await host.startAgentSession(
      {
        providerId: "codex-app-server",
        executablePreference: { mode: "auto", path: null },
        clientSessionId: "image-session",
        workspaceRoot: "/workspace",
        permissionMode: "observe",
        networkAccess: false,
        webSearch: false,
      },
      (event) => events.push(event),
    );
    const image = await host.stageAgentImage({
      clientSessionId: "image-session",
      source: {
        kind: "selectedPath",
        path: "/workspace/assets/diagram.png",
      },
    });
    const outcome = await host.sendAgentTurn({
      clientSessionId: "image-session",
      clientTurnId: "image-turn",
      question: "",
      responseMode: "auto",
      focusFiles: [],
      imageAttachmentIds: [image.attachmentId],
    });

    expect(outcome).toEqual({ status: "completed" });
    expect(events).toContainEqual({
      type: "turnInputAccepted",
      clientTurnId: "image-turn",
      imageAttachmentIds: [image.attachmentId],
    });
    expect(image.thumbnailDataUrl).toMatch(/^data:image\/png;base64,/u);
  });

  it("lists only Svard sessions for the selected workspace and manages their lifecycle", async () => {
    const host = new MockHostAdapter();
    const start = async (clientSessionId: string, workspaceRoot: string) => {
      await host.startAgentSession(
        {
          providerId: "codex-app-server",
          executablePreference: { mode: "auto", path: null },
          clientSessionId,
          workspaceRoot,
          permissionMode: "observe",
          networkAccess: false,
          webSearch: false,
        },
        () => undefined,
      );
    };

    await start("older-session", "/workspace");
    await host.closeAgentSession("older-session");
    await start("other-workspace-session", "/other");
    await host.closeAgentSession("other-workspace-session");
    await start("active-session", "/workspace");

    const firstPage = await host.listAgentSessions({
      providerId: "codex-app-server",
      workspaceRoot: "/workspace",
      limit: 1,
    });
    expect(firstPage.sessions).toMatchObject([
      {
        clientSessionId: "active-session",
        availability: "active",
        archived: false,
      },
    ]);
    expect(firstPage.nextCursor).toBe("1");
    expect(firstPage.managementCapabilities).toMatchObject({
      list: true,
      resume: true,
      archive: true,
      delete: true,
      fork: false,
    });

    const secondPage = await host.listAgentSessions({
      providerId: "codex-app-server",
      workspaceRoot: "/workspace",
      cursor: firstPage.nextCursor,
      limit: 1,
    });
    expect(
      secondPage.sessions.map((session) => session.clientSessionId),
    ).toEqual(["older-session"]);
    expect(secondPage.nextCursor).toBeNull();

    const renamed = await host.renameAgentSession({
      clientSessionId: "active-session",
      title: "  Review the workspace  ",
      executablePreference: { mode: "auto", path: null },
    });
    expect(renamed.title).toBe("Review the workspace");
    await expect(
      host.renameAgentSession({
        clientSessionId: "active-session",
        title: "Invalid executable",
        executablePreference: { mode: "custom", path: "" },
      }),
    ).rejects.toThrow("executable path");
    await host.closeAgentSession("active-session");
    await host.setAgentSessionArchived({
      clientSessionId: "active-session",
      archived: true,
      executablePreference: { mode: "auto", path: null },
    });
    const archived = await host.listAgentSessions({
      providerId: "codex-app-server",
      workspaceRoot: "/workspace",
      archived: true,
    });
    expect(archived.sessions).toMatchObject([
      {
        clientSessionId: "active-session",
        title: "Review the workspace",
        availability: "available",
      },
    ]);
    await host.setAgentSessionArchived({
      clientSessionId: "active-session",
      archived: false,
      executablePreference: { mode: "auto", path: null },
    });
    await host.deleteAgentSession({
      clientSessionId: "active-session",
      executablePreference: { mode: "auto", path: null },
    });
    await expect(
      host.readAgentSessionHistory({ clientSessionId: "active-session" }),
    ).rejects.toThrow("not found");
  });

  it("paginates static history and revalidates a saved session before resume", async () => {
    const host = new MockHostAdapter();
    const events: AgentEvent[] = [];
    await host.startAgentSession(
      {
        providerId: "codex-app-server",
        executablePreference: { mode: "auto", path: null },
        clientSessionId: "saved-full-access",
        workspaceRoot: "/workspace",
        permissionMode: "fullAccess",
        networkAccess: true,
        webSearch: true,
        model: "codex-balanced",
        reasoningEffort: "medium",
        personality: "pragmatic",
      },
      (event) => events.push(event),
    );
    for (const index of [1, 2, 3]) {
      await host.sendAgentTurn({
        clientSessionId: "saved-full-access",
        clientTurnId: `turn-${index}`,
        question: `Question ${index}`,
        responseMode: "auto",
        focusFiles:
          index === 1
            ? [
                {
                  path: "/workspace/docs/private.md",
                  displayLabel: "docs/private.md",
                },
              ]
            : [],
      });
    }
    await host.closeAgentSession("saved-full-access");

    const recent = await host.readAgentSessionHistory({
      clientSessionId: "saved-full-access",
      limit: 2,
    });
    expect(recent.turns.map((turn) => turn.id)).toEqual(["turn-2", "turn-3"]);
    expect(recent.nextCursor).toBe("1");
    expect(recent.turns[0]).not.toHaveProperty("reasoningSummary");
    expect(JSON.stringify(recent.turns)).not.toContain(
      "/workspace/docs/private.md",
    );
    const older = await host.readAgentSessionHistory({
      clientSessionId: "saved-full-access",
      cursor: recent.nextCursor,
      limit: 2,
    });
    expect(older.turns).toMatchObject([
      {
        id: "turn-1",
        question: "Question 1",
        status: "completed",
        contextOmitted: true,
      },
    ]);
    expect(older.nextCursor).toBeNull();

    await expect(
      host.resumeAgentSession(
        {
          clientSessionId: "saved-full-access",
          workspaceRoot: "/workspace",
          executablePreference: { mode: "auto", path: null },
          fullAccessConfirmed: false,
        },
        () => undefined,
      ),
    ).rejects.toThrow("Full Access");
    const resumedEvents: AgentEvent[] = [];
    const resumed = await host.resumeAgentSession(
      {
        clientSessionId: "saved-full-access",
        workspaceRoot: "/workspace",
        executablePreference: { mode: "auto", path: null },
        fullAccessConfirmed: true,
      },
      (event) => resumedEvents.push(event),
    );
    expect(resumed.clientSessionId).toBe("saved-full-access");
    expect(resumedEvents[0]?.type).toBe("sessionReady");
    await host.closeAgentSession("saved-full-access");

    const globals = globalThis as typeof globalThis & {
      __SVARD_AGENT_SESSION_RESUME_FAILURE__?: true | string;
    };
    globals.__SVARD_AGENT_SESSION_RESUME_FAILURE__ = "saved-full-access";
    try {
      await expect(
        host.resumeAgentSession(
          {
            clientSessionId: "saved-full-access",
            workspaceRoot: "/workspace",
            executablePreference: { mode: "auto", path: null },
            fullAccessConfirmed: true,
          },
          () => undefined,
        ),
      ).rejects.toThrow("could not be resumed");
    } finally {
      delete globals.__SVARD_AGENT_SESSION_RESUME_FAILURE__;
    }
  });
});
