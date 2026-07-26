import type {
  AgentApprovalResponseInput,
  AgentEvent,
  AgentExecutablePreference,
  AgentImageAttachment,
  AgentImageDiscardInput,
  AgentImageStageInput,
  AgentModelCatalog,
  AgentProviderId,
  AgentProviderRuntimeOptions,
  AgentProviderRuntimeSnapshot,
  AgentSessionArchiveInput,
  AgentSessionDeleteInput,
  AgentSessionHistoryInput,
  AgentSessionHistoryPage,
  AgentSessionHistoryTurn,
  AgentSessionInfo,
  AgentSessionListInput,
  AgentSessionPage,
  AgentSessionRenameInput,
  AgentSessionResumeInput,
  AgentSessionStartInput,
  AgentSessionSummary,
  AgentSteerInput,
  AgentSteerOutcome,
  AgentTurnInput,
  AgentTurnOutcome,
} from "../../core/types";
import { codexAppServerCapabilities } from "../../core/types";
import {
  mockFallbackSessionTitle,
  mockGeneratedSessionTitle,
  mockAgentModelCatalog,
  mockAgentSessionManagementCapabilities,
  mockAgentSessionSummary,
  mockChangedPaths,
  applyMockAgentSteer,
  recordMockAgentSessionTurn,
  validateMockAgentExecutablePreference,
  type MockAgentSessionRecord,
} from "./agentTitle";

function agentRuntimeKey(
  providerId: AgentProviderId,
  preference: AgentExecutablePreference,
) {
  return `${providerId}:${preference.mode}:${preference.path ?? ""}`;
}

export class MockAgentFacade {
  private readonly agentSessions = new Map<
    string,
    {
      input: AgentSessionStartInput;
      onEvent: (event: AgentEvent) => void;
      cancelledTurns: Set<string>;
      pendingApprovals: Map<string, () => void>;
      images: Map<string, AgentImageAttachment>;
      automaticTitlePending: boolean;
      activeTurnId: string | null;
      steeringMessages: string[];
    }
  >();
  private readonly agentSessionRecords = new Map<
    string,
    MockAgentSessionRecord
  >();
  private agentSessionTimestamp = Math.floor(Date.now() / 1_000);
  private agentImageCounter = 0;
  private readonly agentProviderRuntime = new Map<
    string,
    AgentProviderRuntimeSnapshot
  >();
  private readonly agentProviderRuntimeRequests = new Map<
    string,
    Promise<AgentProviderRuntimeSnapshot>
  >();

  peekAgentProviderRuntime(
    providerId: AgentProviderId,
    executablePreference: AgentExecutablePreference = {
      mode: "auto",
      path: null,
    },
  ): AgentProviderRuntimeSnapshot | null {
    return (
      this.agentProviderRuntime.get(
        agentRuntimeKey(providerId, executablePreference),
      ) ?? null
    );
  }

  getAgentProviderRuntime(
    providerId: AgentProviderId,
    options: AgentProviderRuntimeOptions = {
      executablePreference: { mode: "auto", path: null },
    },
  ): Promise<AgentProviderRuntimeSnapshot> {
    const key = agentRuntimeKey(providerId, options.executablePreference);
    const pending = this.agentProviderRuntimeRequests.get(key);
    if (pending) return pending;
    if (!options.refresh) {
      const cached = this.agentProviderRuntime.get(key);
      if (cached) return Promise.resolve(cached);
    }
    const overrides = globalThis as typeof globalThis & {
      __SVARD_AGENT_MODEL_CATALOG__?: AgentModelCatalog;
      __SVARD_AGENT_MODEL_CATALOG_ERROR__?: string;
      __SVARD_AGENT_RUNTIME_LOAD_COUNT__?: number;
    };
    overrides.__SVARD_AGENT_RUNTIME_LOAD_COUNT__ =
      (overrides.__SVARD_AGENT_RUNTIME_LOAD_COUNT__ ?? 0) + 1;
    const request = Promise.resolve().then(() => {
      const catalogError = overrides.__SVARD_AGENT_MODEL_CATALOG_ERROR__;
      const invalidCustom =
        options.executablePreference.mode === "custom" &&
        (!options.executablePreference.path ||
          options.executablePreference.path.includes("missing"));
      const runtime: AgentProviderRuntimeSnapshot = {
        providerId,
        probe: {
          providerId,
          state: invalidCustom ? "broken" : "ready",
          source:
            options.executablePreference.mode === "custom" ? "custom" : "path",
          version: "codex-app-server mock",
          capabilities: codexAppServerCapabilities,
        },
        installation: invalidCustom
          ? null
          : {
              source:
                options.executablePreference.mode === "custom"
                  ? "custom"
                  : "path",
              displayName:
                options.executablePreference.mode === "custom"
                  ? "Custom executable"
                  : "PATH installation",
              version: "codex-app-server mock",
            },
        catalog:
          catalogError || invalidCustom
            ? null
            : (overrides.__SVARD_AGENT_MODEL_CATALOG__ ??
              mockAgentModelCatalog(providerId)),
        issue: invalidCustom
          ? {
              code: "providerUnavailable",
              message:
                "The selected Codex executable is unavailable. Choose another executable or reset to Automatic.",
            }
          : catalogError
            ? { code: "catalogUnavailable", message: catalogError }
            : null,
      };
      this.agentProviderRuntime.set(key, runtime);
      return runtime;
    });
    this.agentProviderRuntimeRequests.set(key, request);
    return request.finally(() => {
      if (this.agentProviderRuntimeRequests.get(key) === request) {
        this.agentProviderRuntimeRequests.delete(key);
      }
    });
  }

  async pickAgentExecutable(
    providerId: AgentProviderId,
  ): Promise<AgentExecutablePreference | null> {
    if (providerId !== "codex-app-server") return null;
    const path = (
      globalThis as typeof globalThis & {
        __SVARD_AGENT_EXECUTABLE_PICK__?: string | null;
      }
    ).__SVARD_AGENT_EXECUTABLE_PICK__;
    return path ? { mode: "custom", path } : null;
  }

  async startAgentSession(
    input: AgentSessionStartInput,
    onEvent: (event: AgentEvent) => void,
  ): Promise<AgentSessionInfo> {
    const runtime = await this.getAgentProviderRuntime(input.providerId, {
      executablePreference: input.executablePreference,
    });
    const catalog = runtime.catalog;
    if (
      !catalog &&
      (input.model || input.reasoningEffort || input.personality)
    ) {
      throw new Error(
        "Codex model settings could not be verified. Refresh Codex in AI Providers.",
      );
    }
    const selected = input.model
      ? catalog?.models.find((model) => model.model === input.model)
      : catalog?.models.find((model) => model.isDefault);
    if (input.model && !selected) {
      throw new Error(
        "The saved Codex model is unavailable. Choose another model in AI Providers.",
      );
    }
    if (
      input.reasoningEffort &&
      selected &&
      !selected.supportedReasoningEfforts.some(
        (effort) => effort.value === input.reasoningEffort,
      )
    ) {
      throw new Error(
        "The selected reasoning effort is unavailable for this Codex model.",
      );
    }
    if (input.personality && selected && !selected.supportsPersonality) {
      throw new Error("Response styles are unavailable for this Codex model.");
    }
    const capabilities = {
      ...codexAppServerCapabilities,
      imageInput: selected
        ? selected.inputModalities.includes("image")
        : codexAppServerCapabilities.imageInput,
    };
    this.agentSessions.set(input.clientSessionId, {
      input,
      onEvent,
      cancelledTurns: new Set(),
      pendingApprovals: new Map(),
      images: new Map(),
      automaticTitlePending: true,
      activeTurnId: null,
      steeringMessages: [],
    });
    const previous = this.agentSessionRecords.get(input.clientSessionId);
    const timestamp = this.nextAgentSessionTimestamp();
    this.agentSessionRecords.set(input.clientSessionId, {
      input: structuredClone(input),
      title: previous?.title ?? "New chat",
      createdAt: previous?.createdAt ?? timestamp,
      updatedAt: timestamp,
      archived: false,
      availability: "available",
      turns: previous?.turns ?? [],
    });
    onEvent({
      type: "sessionReady",
      clientSessionId: input.clientSessionId,
      capabilities,
    });
    return {
      clientSessionId: input.clientSessionId,
      providerId: input.providerId,
      capabilities,
    };
  }

  async listAgentSessions(
    input: AgentSessionListInput,
  ): Promise<AgentSessionPage> {
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
    const offset = this.parseAgentSessionCursor(input.cursor);
    const archived = input.archived ?? false;
    const sessions = [...this.agentSessionRecords.values()]
      .filter(
        (record) =>
          record.input.providerId === input.providerId &&
          record.input.workspaceRoot === input.workspaceRoot &&
          record.archived === archived,
      )
      .sort(
        (left, right) =>
          right.updatedAt - left.updatedAt ||
          left.input.clientSessionId.localeCompare(right.input.clientSessionId),
      );
    const page = sessions.slice(offset, offset + limit);
    return {
      sessions: page.map((record) => this.agentSessionSummary(record)),
      nextCursor:
        offset + page.length < sessions.length
          ? String(offset + page.length)
          : null,
      managementCapabilities: mockAgentSessionManagementCapabilities,
    };
  }

  async resumeAgentSession(
    input: AgentSessionResumeInput,
    onEvent: (event: AgentEvent) => void,
  ): Promise<AgentSessionInfo> {
    const record = this.requireAgentSessionRecord(input.clientSessionId);
    const overrides = globalThis as typeof globalThis & {
      __SVARD_AGENT_SESSION_RESUME_FAILURE__?: true | string;
    };
    if (
      overrides.__SVARD_AGENT_SESSION_RESUME_FAILURE__ === true ||
      overrides.__SVARD_AGENT_SESSION_RESUME_FAILURE__ === input.clientSessionId
    ) {
      throw new Error("The saved agent session could not be resumed.");
    }
    if (record.availability === "unavailable") {
      throw new Error("The saved agent session is unavailable.");
    }
    if (record.archived) {
      throw new Error("Restore the saved agent session before resuming it.");
    }
    if (record.input.workspaceRoot !== input.workspaceRoot) {
      throw new Error("The saved agent session belongs to another workspace.");
    }
    if (
      record.input.permissionMode === "fullAccess" &&
      !input.fullAccessConfirmed
    ) {
      throw new Error("Full Access must be confirmed before resuming.");
    }
    const runtime = await this.getAgentProviderRuntime(
      record.input.providerId,
      {
        executablePreference: input.executablePreference,
        refresh: true,
      },
    );
    if (runtime.probe.state !== "ready") {
      throw new Error("The saved agent provider is unavailable.");
    }
    const selected = record.input.model
      ? runtime.catalog?.models.find(
          (model) => model.model === record.input.model,
        )
      : runtime.catalog?.models.find((model) => model.isDefault);
    if (record.input.model && !selected) {
      throw new Error(
        "The saved Codex model is unavailable. Choose another model in AI Providers.",
      );
    }
    const capabilities = {
      ...codexAppServerCapabilities,
      imageInput: selected
        ? selected.inputModalities.includes("image")
        : codexAppServerCapabilities.imageInput,
    };
    record.input = {
      ...record.input,
      executablePreference: structuredClone(input.executablePreference),
    };
    record.updatedAt = this.nextAgentSessionTimestamp();
    this.agentSessions.set(input.clientSessionId, {
      input: structuredClone(record.input),
      onEvent,
      cancelledTurns: new Set(),
      pendingApprovals: new Map(),
      images: new Map(),
      automaticTitlePending: false,
      activeTurnId: null,
      steeringMessages: [],
    });
    onEvent({
      type: "sessionReady",
      clientSessionId: input.clientSessionId,
      capabilities,
    });
    return {
      clientSessionId: input.clientSessionId,
      providerId: record.input.providerId,
      capabilities,
    };
  }

  async readAgentSessionHistory(
    input: AgentSessionHistoryInput,
  ): Promise<AgentSessionHistoryPage> {
    const record = this.requireAgentSessionRecord(input.clientSessionId);
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
    const end =
      input.cursor == null
        ? record.turns.length
        : Math.min(
            this.parseAgentSessionCursor(input.cursor),
            record.turns.length,
          );
    const start = Math.max(end - limit, 0);
    return {
      turns: structuredClone(record.turns.slice(start, end)),
      nextCursor: start > 0 ? String(start) : null,
    };
  }

  async renameAgentSession(
    input: AgentSessionRenameInput,
  ): Promise<AgentSessionSummary> {
    validateMockAgentExecutablePreference(input.executablePreference);
    const record = this.requireAgentSessionRecord(input.clientSessionId);
    const title = input.title.trim();
    if (!title) throw new Error("Session title cannot be empty.");
    record.title = title;
    record.updatedAt = this.nextAgentSessionTimestamp();
    return this.agentSessionSummary(record);
  }

  async setAgentSessionArchived(
    input: AgentSessionArchiveInput,
  ): Promise<AgentSessionSummary> {
    validateMockAgentExecutablePreference(input.executablePreference);
    const record = this.requireAgentSessionRecord(input.clientSessionId);
    if (this.agentSessions.has(input.clientSessionId)) {
      throw new Error("Close the active agent session before archiving it.");
    }
    record.archived = input.archived;
    record.updatedAt = this.nextAgentSessionTimestamp();
    return this.agentSessionSummary(record);
  }

  async deleteAgentSession(input: AgentSessionDeleteInput): Promise<void> {
    validateMockAgentExecutablePreference(input.executablePreference);
    if (this.agentSessions.has(input.clientSessionId)) {
      throw new Error("Close the active agent session before deleting it.");
    }
    if (!this.agentSessionRecords.delete(input.clientSessionId)) {
      throw new Error("The saved agent session was not found.");
    }
  }

  async sendAgentTurn(input: AgentTurnInput): Promise<AgentTurnOutcome> {
    (
      globalThis as typeof globalThis & {
        __SVARD_AGENT_LAST_TURN_INPUT__?: AgentTurnInput;
      }
    ).__SVARD_AGENT_LAST_TURN_INPUT__ = structuredClone(input);
    const session = this.agentSessions.get(input.clientSessionId);
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
    emit({ type: "turnStarted", clientTurnId: input.clientTurnId });
    const imageAttachmentIds = input.imageAttachmentIds ?? [];
    if (
      imageAttachmentIds.some(
        (attachmentId) => !session.images.has(attachmentId),
      )
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
    let expectedAutomaticTitle: string | null = null;
    if (session.automaticTitlePending) {
      session.automaticTitlePending = false;
      const record = this.requireAgentSessionRecord(input.clientSessionId);
      const fallback = mockFallbackSessionTitle(
        input.question,
        imageAttachmentIds.length > 0,
        (input.contentParts ?? []).some(
          (part) => part.type === "text" && part.text.trim().length > 0,
        ) || (input.attachments?.length ?? 0) > 0,
      );
      record.title = fallback;
      record.updatedAt = this.nextAgentSessionTimestamp();
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
      this.recordAgentSessionTurn(
        input,
        "",
        "cancelled",
        session.steeringMessages,
      );
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
        this.recordAgentSessionTurn(
          input,
          "",
          "cancelled",
          session.steeringMessages,
        );
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
    const answer = wantsInterface
      ? 'root = SvardExperience("Workspace answer", "The selected files are connected through the same workspace contract.", [stats, flow, files, followup])\nstats = Grid([{title:"Documents",value:"12",detail:"Markdown and AsciiDoc"},{title:"Code",value:"8",detail:"TypeScript and Rust"}], 2)\nflow = Timeline([{label:"1",title:"Inspect files",detail:"Read workspace context",status:"completed"},{label:"2",title:"Relate findings",detail:"Build the final answer",status:"completed"}])\nfiles = FileList("Key files", [{path:"src/ui/App.tsx",role:"UI shell"},{path:"src-tauri/src/lib.rs",role:"Tauri backend"}])\nfollowup = FollowUpButton("Compare responsibilities", "Compare the responsibilities of the UI shell and Tauri backend.", "Starts a new Agent turn")'
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
    emit({ type: "turnCompleted", clientTurnId: input.clientTurnId });
    for (const attachmentId of imageAttachmentIds) {
      session.images.delete(attachmentId);
    }
    this.recordAgentSessionTurn(
      input,
      answer,
      "completed",
      session.steeringMessages,
    );
    session.activeTurnId = null;
    const generatedTitle = mockGeneratedSessionTitle(input.question);
    if (expectedAutomaticTitle && generatedTitle) {
      const record = this.requireAgentSessionRecord(input.clientSessionId);
      if (record.title === expectedAutomaticTitle) {
        record.title = generatedTitle;
        record.updatedAt = this.nextAgentSessionTimestamp();
        emit({
          type: "sessionTitleUpdated",
          clientSessionId: input.clientSessionId,
          title: generatedTitle,
        });
      }
    }
    return { status: "completed" };
  }

  async steerAgentTurn(input: AgentSteerInput): Promise<AgentSteerOutcome> {
    return applyMockAgentSteer(
      input,
      this.agentSessions.get(input.clientSessionId),
    );
  }

  stageAgentImage(input: AgentImageStageInput): Promise<AgentImageAttachment> {
    const session = this.agentSessions.get(input.clientSessionId);
    if (!session) {
      return Promise.reject(
        new Error("Start the agent chat before attaching an image."),
      );
    }
    if (session.images.size >= 4) {
      return Promise.reject(
        new Error("You can attach up to 4 images to one question."),
      );
    }
    const attachmentId = `mock-image-${++this.agentImageCounter}`;
    const displayLabel =
      input.source.kind === "selectedPath"
        ? (input.source.path.split(/[\\/]/u).pop() ?? "image.png")
        : input.source.displayLabel;
    const attachment: AgentImageAttachment = {
      attachmentId,
      displayLabel,
      mediaType: "image/png",
      width: 64,
      height: 48,
      byteLength: 68,
      thumbnailDataUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    };
    session.images.set(attachmentId, attachment);
    return Promise.resolve(attachment);
  }

  pickAgentImages(clientSessionId: string): Promise<AgentImageAttachment[]> {
    return Promise.all([
      this.stageAgentImage({
        clientSessionId,
        source: {
          kind: "selectedPath",
          path: "/workspace/assets/mock-screenshot.png",
        },
      }),
    ]);
  }

  discardAgentImage(input: AgentImageDiscardInput): Promise<void> {
    this.agentSessions
      .get(input.clientSessionId)
      ?.images.delete(input.attachmentId);
    return Promise.resolve();
  }

  respondToAgentApproval(input: AgentApprovalResponseInput): Promise<void> {
    const session = this.agentSessions.get(input.clientSessionId);
    const resolve = session?.pendingApprovals.get(input.requestId);
    if (session && resolve) {
      session.pendingApprovals.delete(input.requestId);
      session.onEvent({
        type: "permissionResolved",
        requestId: input.requestId,
        decision: input.decision,
      });
      resolve();
    }
    return Promise.resolve();
  }

  cancelAgentTurn(
    clientSessionId: string,
    clientTurnId: string,
  ): Promise<void> {
    const session = this.agentSessions.get(clientSessionId);
    session?.cancelledTurns.add(clientTurnId);
    for (const resolve of session?.pendingApprovals.values() ?? []) {
      resolve();
    }
    session?.pendingApprovals.clear();
    return Promise.resolve();
  }

  closeAgentSession(clientSessionId: string): Promise<void> {
    const session = this.agentSessions.get(clientSessionId);
    for (const resolve of session?.pendingApprovals.values() ?? []) {
      resolve();
    }
    this.agentSessions.delete(clientSessionId);
    return Promise.resolve();
  }

  private nextAgentSessionTimestamp(): number {
    this.agentSessionTimestamp = Math.max(
      this.agentSessionTimestamp + 1,
      Math.floor(Date.now() / 1_000),
    );
    return this.agentSessionTimestamp;
  }

  private parseAgentSessionCursor(cursor?: string | null): number {
    if (cursor == null) return 0;
    if (!/^\d+$/u.test(cursor)) {
      throw new Error("The agent session cursor is invalid.");
    }
    return Number(cursor);
  }

  private requireAgentSessionRecord(
    clientSessionId: string,
  ): MockAgentSessionRecord {
    const record = this.agentSessionRecords.get(clientSessionId);
    if (!record) throw new Error("The saved agent session was not found.");
    return record;
  }

  private agentSessionSummary(
    record: MockAgentSessionRecord,
  ): AgentSessionSummary {
    return mockAgentSessionSummary(
      record,
      this.agentSessions.has(record.input.clientSessionId),
    );
  }

  private recordAgentSessionTurn(
    input: AgentTurnInput,
    answer: string,
    status: AgentSessionHistoryTurn["status"],
    steeringMessages: string[] = [],
  ): void {
    const record = this.agentSessionRecords.get(input.clientSessionId);
    if (!record) return;
    const timestamp = this.nextAgentSessionTimestamp();
    recordMockAgentSessionTurn({
      answer,
      input,
      record,
      status,
      steeringMessages,
      timestamp,
    });
  }
}
