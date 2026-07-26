export type CodexCliState =
  | "notFound"
  | "broken"
  | "authenticationRequired"
  | "ready"
  | "unsupportedVersion";

export interface CodexCliProbe {
  state: CodexCliState;
  source: "env" | "path" | null;
  version?: string;
}

export type CodexResponseMode = "auto" | "visualize";

export type CodexSandboxMode =
  | "read-only"
  | "workspace-write"
  | "danger-full-access";

export interface CodexExecutionSettings {
  sandboxMode: CodexSandboxMode;
  commandNetworkAccess: boolean;
  webSearch: boolean;
}

export const defaultCodexExecutionSettings: CodexExecutionSettings = {
  sandboxMode: "read-only",
  commandNetworkAccess: false,
  webSearch: false,
};

export type CodexContextFormat =
  | "markdown"
  | "asciidoc"
  | "code"
  | "config"
  | "text";

export interface CodexContextSnapshot {
  contextId: string;
  displayLabel: string;
  format: CodexContextFormat;
  language: string;
  source: string;
}

export interface CodexContextFile extends CodexContextSnapshot {
  path: string;
  byteLength: number;
  updatedAt: string;
}

export interface CodexContextFileLoadInput {
  path: string;
  workspaceRoot?: string | null;
  contextId: string;
}

export interface CodexContextSearchInput {
  workspaceRoot: string;
  query: string;
  limit?: number;
}

export interface CodexContextSearchItem {
  path: string;
  displayLabel: string;
  format: CodexContextFormat;
  language: string;
  byteLength: number;
}

export interface CodexTurnInput {
  clientSessionId: string;
  runId: string;
  question: string;
  responseMode: CodexResponseMode;
  openUiPrompt?: string;
  contextAdditions: CodexContextSnapshot[];
  executionSettings: CodexExecutionSettings;
}

export type CodexUnexpectedToolCategory =
  | "command"
  | "mcp"
  | "webSearch"
  | "fileChange"
  | "unknown";

export type CodexTurnEvent =
  | { type: "sessionStarted" }
  | { type: "turnStarted" }
  | { type: "contextAccepted"; contextIds: string[] }
  | { type: "assistantDelta"; delta: string }
  | { type: "assistantCompleted"; text: string }
  | {
      type: "unexpectedToolUse";
      category: CodexUnexpectedToolCategory;
    }
  | { type: "completed" }
  | { type: "failed"; code: string; message: string }
  | { type: "cancelled" };

export type CodexTurnOutcome =
  | { status: "completed" }
  | { status: "cancelled" }
  | { status: "failed"; code: string; message: string };
