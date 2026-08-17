import type {
  AgentEvent,
  AgentImageAttachment,
  AgentSessionHistoryTurn,
  AgentSessionStartInput,
  AgentTurnInput,
  AgentTurnOutcome,
} from "../../core/types";
import { emitMockContextUsage } from "./agentContext";
import {
  mockFallbackSessionTitle,
  mockGeneratedSessionTitle,
  mockChangedPaths,
  type MockAgentSessionRecord,
} from "./agentTitle";
import {
  isOpenUiProfileComparisonQuestion,
  mockOpenUiEvaluationAnswer,
} from "./openUiEvaluationFixtures";

export interface MockAgentTurnSession {
  input: AgentSessionStartInput;
  onEvent: (event: AgentEvent) => void;
  cancelledTurns: Set<string>;
  pendingApprovals: Map<string, () => void>;
  images: Map<string, AgentImageAttachment>;
  automaticTitlePending: boolean;
  activeTurnId: string | null;
  compacting: boolean;
  steeringMessages: string[];
}

interface MockAgentTurnContext {
  getSession(clientSessionId: string): MockAgentTurnSession | undefined;
  nextTimestamp(): number;
  requireRecord(clientSessionId: string): MockAgentSessionRecord;
  recordTurn(
    input: AgentTurnInput,
    answer: string,
    status: AgentSessionHistoryTurn["status"],
    steeringMessages?: string[],
  ): void;
}

export async function runMockAgentTurn(
  input: AgentTurnInput,
  context: MockAgentTurnContext,
): Promise<AgentTurnOutcome> {
  (
    globalThis as typeof globalThis & {
      __SVARD_AGENT_LAST_TURN_INPUT__?: AgentTurnInput;
    }
  ).__SVARD_AGENT_LAST_TURN_INPUT__ = structuredClone(input);
  const session = context.getSession(input.clientSessionId);
  if (!session) {
    return {
      status: "failed",
      code: "session-not-found",
      message: "Start the agent chat before sending a question.",
    };
  }
  const emit = session.onEvent;
  if (session.activeTurnId) {
    return {
      status: "failed",
      code: "turn-already-active",
      message: "Wait for the active response to finish.",
    };
  }
  if (session.compacting) {
    return {
      status: "failed",
      code: "compaction-active",
      message: "Wait for context compaction to finish before sending.",
    };
  }
  emit({ type: "turnStarted", clientTurnId: input.clientTurnId });
  const imageAttachmentIds = input.imageAttachmentIds ?? [];
  if (
    imageAttachmentIds.some((attachmentId) => !session.images.has(attachmentId))
  ) {
    return {
      status: "failed",
      code: "image-not-found",
      message: "An attached image is no longer available.",
    };
  }
  session.activeTurnId = input.clientTurnId;
  session.steeringMessages = [];
  emit({
    type: "turnInputAccepted",
    clientTurnId: input.clientTurnId,
    imageAttachmentIds,
  });
  if (input.question.toLowerCase().includes("unexpected disconnect")) {
    emit({
      type: "toolStarted",
      toolId: "mock-disconnected-command",
      kind: "command",
      category: "command",
      title: "Running a workspace command",
      visibility: "user",
    });
    if (input.question.toLowerCase().includes("approval")) {
      emit({
        type: "permissionRequested",
        request: {
          requestId: `approval-${input.clientTurnId}`,
          kind: "command",
          title: "Run a workspace command?",
          detail: "The agent requested a workspace command.",
          impact: "This command can inspect workspace files.",
        },
      });
    }
    emit({
      type: "providerDisconnected",
      code: "provider-disconnected",
      message: "Codex app-server disconnected.",
    });
    session.activeTurnId = null;
    return {
      status: "failed",
      code: "provider-disconnected",
      message: "Codex app-server disconnected.",
    };
  }
  let expectedAutomaticTitle: string | null = null;
  if (session.automaticTitlePending) {
    session.automaticTitlePending = false;
    const record = context.requireRecord(input.clientSessionId);
    const fallback = mockFallbackSessionTitle(
      input.question,
      imageAttachmentIds.length > 0,
      (input.contentParts ?? []).some(
        (part) => part.type === "text" && part.text.trim().length > 0,
      ) || (input.attachments?.length ?? 0) > 0,
    );
    record.title = fallback;
    record.updatedAt = context.nextTimestamp();
    expectedAutomaticTitle = fallback;
    emit({
      type: "sessionTitleUpdated",
      clientSessionId: input.clientSessionId,
      title: fallback,
    });
  }
  if (input.question.toLowerCase().includes("output hygiene")) {
    for (const delta of [
      "r",
      "oot = ",
      'SvardExperience("Preparing", "Checking the workspace.", [])',
    ]) {
      emit({ type: "assistantCommentaryDelta", delta });
    }
    emit({
      type: "toolStarted",
      toolId: "mock-provider-memory",
      kind: "search",
      category: "search",
      title: "Running a provider operation",
      visibility: "internal",
    });
    emit({
      type: "toolCompleted",
      toolId: "mock-provider-memory",
      status: "completed",
      durationMs: 0,
    });
  }
  emit({
    type: "reasoningSummaryDelta",
    delta: "**Inspecting the focused files**",
  });
  emit({
    type: "reasoningSummaryDelta",
    delta: "**Relating them to the workspace**",
  });
  emit({
    type: "planUpdated",
    steps: [
      {
        id: "inspect",
        title: "Inspect relevant files",
        status: "inProgress",
      },
      { id: "answer", title: "Prepare the answer", status: "pending" },
    ],
  });
  const changedPaths = mockChangedPaths(input.question);
  if (changedPaths.length > 0) {
    emit({
      type: "filesChanged",
      paths: [...changedPaths, changedPaths[0]!],
    });
  }
  emit({
    type: "toolStarted",
    toolId: "mock-read",
    kind: "read",
    category: "read",
    title: "Inspecting files",
    visibility: "user",
    target: input.focusFiles[0]?.displayLabel,
  });
  await new Promise((resolve) =>
    globalThis.setTimeout(
      resolve,
      /current implementation/iu.test(input.question) ? 500 : 80,
    ),
  );
  if (session.cancelledTurns.delete(input.clientTurnId)) {
    emit({ type: "turnCancelled", clientTurnId: input.clientTurnId });
    context.recordTurn(input, "", "cancelled", session.steeringMessages);
    session.activeTurnId = null;
    return { status: "cancelled" };
  }
  emit({
    type: "toolCompleted",
    toolId: "mock-read",
    status: "completed",
    summary: `${Math.max(input.focusFiles.length, 1)} relevant file inspected`,
    durationMs: 80,
  });
  emit({
    type: "toolStarted",
    toolId: "mock-read-related",
    kind: "read",
    category: "read",
    title: "Inspecting files",
    visibility: "user",
  });
  emit({
    type: "toolCompleted",
    toolId: "mock-read-related",
    status: "completed",
    summary: "Related file inspected",
    durationMs: 18,
  });
  emit({
    type: "toolStarted",
    toolId: "mock-search",
    kind: "search",
    category: "search",
    title: "Searching the workspace",
    visibility: "user",
  });
  emit({
    type: "toolCompleted",
    toolId: "mock-search",
    status: "completed",
    summary: "Relevant references found",
    durationMs: 24,
  });
  emit({
    type: "toolStarted",
    toolId: "mock-empty-command",
    kind: "command",
    category: "command",
    title: "Running a workspace command",
    visibility: "user",
  });
  emit({
    type: "toolCompleted",
    toolId: "mock-empty-command",
    status: "completed",
  });

  if (input.question.toLowerCase().includes("activity failure")) {
    emit({
      type: "toolStarted",
      toolId: "mock-failed-command",
      kind: "command",
      category: "command",
      title: "Running a workspace command",
      visibility: "user",
    });
    emit({
      type: "toolCompleted",
      toolId: "mock-failed-command",
      status: "failed",
      summary: "Failed with exit code 1",
      durationMs: 12,
    });
  }

  if (input.question.toLowerCase().includes("approval")) {
    const requestId = `approval-${input.clientTurnId}`;
    const approvalResolved = new Promise<void>((resolve) => {
      session.pendingApprovals.set(requestId, resolve);
    });
    emit({
      type: "permissionRequested",
      request: {
        requestId,
        kind: "command",
        title: "Run the requested workspace check",
        impact: "This command can read files in the open workspace.",
      },
    });
    await approvalResolved;
    if (session.cancelledTurns.delete(input.clientTurnId)) {
      emit({ type: "turnCancelled", clientTurnId: input.clientTurnId });
      context.recordTurn(input, "", "cancelled", session.steeringMessages);
      session.activeTurnId = null;
      return { status: "cancelled" };
    }
  }

  emit({
    type: "planUpdated",
    steps: [
      { id: "inspect", title: "Inspect relevant files", status: "completed" },
      { id: "answer", title: "Prepare the answer", status: "completed" },
    ],
  });
  const wantsInterface = input.responseMode === "visualize";
  const wantsMarkdownAnswer = /markdown answer/iu.test(input.question);
  const wantsPublicSiteAnswer = /verify before this release/iu.test(
    input.question,
  );
  const evaluationAnswer = wantsInterface
    ? mockOpenUiEvaluationAnswer(input.question)
    : null;
  const answer = evaluationAnswer
    ? evaluationAnswer
    : wantsInterface
      ? 'root = SvardExperience("Workspace answer", "The selected files are connected through the same workspace contract.", [stats, flow, files, followup])\nstats = Grid([{title:"Documents",value:"12",detail:"Markdown and AsciiDoc"},{title:"Code",value:"8",detail:"TypeScript and Rust"}], 2)\nflow = Timeline([{label:"1",title:"Inspect files",detail:"Read workspace context",status:"completed"},{label:"2",title:"Relate findings",detail:"Build the final answer",status:"completed"}])\nfiles = FileList("Key files", [{path:"src/ui/App.tsx",role:"UI shell"},{path:"src-tauri/src/lib.rs",role:"Tauri backend"}])\nfollowup = FollowUpButton("Compare responsibilities", "Compare the responsibilities of the UI shell and Tauri backend.", "Starts a new Agent turn")'
      : wantsPublicSiteAnswer
        ? [
            "## Release review summary",
            "",
            "Verify these items before publishing:",
            "",
            "- Confirm the supported platforms and installer behavior.",
            "- Review the rendered Markdown and AsciiDoc samples.",
            "- Assign an owner to every unresolved follow-up check.",
            "",
            "The selected passage keeps the review focused on the documented release scope.",
          ].join("\n")
        : wantsMarkdownAnswer
          ? [
              "## Workspace answer",
              "",
              "Use `docs/guide.md` with **Markdown formatting**.",
              "",
              "- Inspect the document",
              "- Compare the implementation",
              "",
              "| Area | Status |",
              "| --- | --- |",
              "| Agent Chat | Ready |",
              "",
              "```ts",
              'const response = "safe";',
              "```",
              "",
              "[Open workspace document](docs/guide.md)",
              "[Open external documentation](https://example.com/docs)",
            ].join("\n")
          : "The focused files are related through the workspace-native agent session. No internal session or protocol identifiers are exposed.";
  for (const part of answer.match(/[\s\S]{1,28}/gu) ?? [answer]) {
    emit({ type: "finalAnswerDelta", delta: part });
    await new Promise((resolve) => globalThis.setTimeout(resolve, 12));
  }
  if (isOpenUiProfileComparisonQuestion(input.question)) {
    // Profile evaluation artifacts intentionally omit unrelated Mock context
    // usage so the composer reports Context unavailable.
  } else if (/automatic compaction/iu.test(input.question)) {
    emit({ type: "contextCompactionStarted", source: "automatic" });
    emit({ type: "contextCompactionCompleted", source: "automatic" });
    emitMockContextUsage(session, 50_000, 250_000);
  } else {
    emitMockContextUsage(session);
  }
  emit({ type: "turnCompleted", clientTurnId: input.clientTurnId });
  for (const attachmentId of imageAttachmentIds) {
    session.images.delete(attachmentId);
  }
  context.recordTurn(input, answer, "completed", session.steeringMessages);
  session.activeTurnId = null;
  const generatedTitle = mockGeneratedSessionTitle(input.question);
  if (expectedAutomaticTitle && generatedTitle) {
    const record = context.requireRecord(input.clientSessionId);
    if (record.title === expectedAutomaticTitle) {
      record.title = generatedTitle;
      record.updatedAt = context.nextTimestamp();
      emit({
        type: "sessionTitleUpdated",
        clientSessionId: input.clientSessionId,
        title: generatedTitle,
      });
    }
  }
  return { status: "completed" };
}
