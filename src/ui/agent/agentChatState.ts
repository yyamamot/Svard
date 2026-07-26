import type {
  AgentActivityCategory,
  AgentActivityVisibility,
  AgentApprovalRequest,
  AgentEvent,
  AgentImageAttachment,
  AgentQuotedContext,
  AgentPlanStep,
  AgentToolKind,
  AgentToolStatus,
} from "../../core/types";

export interface AgentToolActivity {
  id: string;
  kind: AgentToolKind;
  category: AgentActivityCategory;
  title: string;
  status: AgentToolStatus;
  visibility: AgentActivityVisibility;
  target?: string;
  detail?: string;
  summary?: string;
  durationMs?: number;
}

export interface AgentConversationTurn {
  id: string;
  question: string;
  images: AgentImageAttachment[];
  quotedContexts: AgentQuotedContext[];
  responseMode: "auto" | "visualize";
  steeringMessages: string[];
  changedPaths: string[];
  inputAccepted: boolean;
  restoreEligible: boolean;
  commentary: string;
  commentaryBuffer: string;
  commentaryClassification: "pending" | "plain" | "suppressed";
  reasoningSummary: string;
  plan: AgentPlanStep[];
  tools: AgentToolActivity[];
  approval: AgentApprovalRequest | null;
  answer: string;
  status: "running" | "completed" | "failed" | "cancelled";
  error?: string;
  restored?: boolean;
  restoredContextOmitted?: boolean;
}

export interface AgentChatState {
  activeTurnId: string | null;
  turns: AgentConversationTurn[];
  disconnectedMessage: string | null;
}

export const initialAgentChatState: AgentChatState = {
  activeTurnId: null,
  turns: [],
  disconnectedMessage: null,
};

export interface AgentActivityItem {
  id: string;
  category: AgentActivityCategory;
  title: string;
  status: AgentToolStatus;
  visibility: AgentActivityVisibility;
  count: number;
  target?: string;
  detail?: string;
  summary?: string;
  durationMs?: number;
}

const groupedActivityCategories = new Set<AgentActivityCategory>([
  "read",
  "list",
  "search",
]);

function activityGroupTitle(
  category: AgentActivityCategory,
  count: number,
): string {
  const suffix = count > 1 ? ` · ${count} operations` : "";
  switch (category) {
    case "read":
      return `Inspected files${suffix}`;
    case "list":
      return `Listed workspace files${suffix}`;
    case "search":
      return `Searched the workspace${suffix}`;
    default:
      return `Completed workspace activity${suffix}`;
  }
}

export function reasoningSummarySegments(value: string): string[] {
  const chunks = value
    .replace(/\r/gu, "\n")
    .replace(/(?:\*{2,}|_{2,}|`+)/gu, "\n")
    .split(/\n+|(?<=[。！？.!?])\s+/u)
    .map((segment) =>
      segment
        .replace(/^[#>*_\s-]+|[#>*_\s-]+$/gu, "")
        .replace(/\s+/gu, " ")
        .trim(),
    )
    .filter((segment) => segment.length >= 3);
  return chunks.filter(
    (segment, index) => index === 0 || segment !== chunks[index - 1],
  );
}

export function latestReasoningSummary(value: string): string | null {
  const latest = reasoningSummarySegments(value).at(-1);
  if (!latest) return null;
  return latest.length > 180 ? `${latest.slice(0, 177).trimEnd()}…` : latest;
}

function meaningfulCompletedTool(tool: AgentToolActivity): boolean {
  if (tool.visibility === "internal" && tool.status === "completed") {
    return false;
  }
  if (tool.status !== "completed") return true;
  if (tool.category === "fileChange") return true;
  return Boolean(tool.target || tool.detail || tool.summary);
}

export function agentActivityItems(
  tools: AgentToolActivity[],
): AgentActivityItem[] {
  const result: AgentActivityItem[] = [];
  for (const tool of tools.filter(meaningfulCompletedTool)) {
    const previous = result.at(-1);
    if (
      tool.status === "completed" &&
      previous?.status === "completed" &&
      previous.category === tool.category &&
      groupedActivityCategories.has(tool.category)
    ) {
      previous.count += 1;
      previous.title = activityGroupTitle(tool.category, previous.count);
      previous.durationMs =
        (previous.durationMs ?? 0) + (tool.durationMs ?? 0) || undefined;
      continue;
    }
    result.push({
      id: tool.id,
      category: tool.category,
      title: tool.title,
      status: tool.status,
      visibility: tool.visibility,
      count: 1,
      target: tool.target,
      detail: tool.detail,
      summary: tool.summary,
      durationMs: tool.durationMs,
    });
  }
  return result;
}

export function agentActivityHasExpandableDetail(
  activity: Pick<AgentActivityItem, "detail" | "summary" | "durationMs">,
): boolean {
  return Boolean(
    activity.detail ||
    activity.summary ||
    (typeof activity.durationMs === "number" && activity.durationMs > 0),
  );
}

export function shouldShowAgentWorkSummary(
  turn: AgentConversationTurn,
): boolean {
  return (
    turn.status !== "running" &&
    (turn.plan.length > 0 || agentActivityItems(turn.tools).length > 0)
  );
}

export function currentAgentActivity(
  turn: AgentConversationTurn,
): string | null {
  const activeTool = [...turn.tools]
    .reverse()
    .find(
      (tool) =>
        ["running", "waitingForApproval"].includes(tool.status) &&
        (tool.visibility === "user" || tool.status === "waitingForApproval"),
    );
  if (activeTool) {
    return activeTool.target
      ? `${activeTool.title} · ${activeTool.target}`
      : activeTool.title;
  }
  const inProgressStep = turn.plan.find((step) => step.status === "inProgress");
  return (
    latestReasoningSummary(turn.reasoningSummary) ??
    inProgressStep?.title ??
    null
  );
}

export function redactAgentWorkspacePaths(
  value: string,
  workspaceRoot: string | null,
): string {
  const root = workspaceRoot?.replace(/[\\/]+$/u, "");
  if (!root || root.length < 2) {
    return value;
  }
  const variants = new Set([
    root,
    root.replaceAll("\\", "/"),
    root.replaceAll("/", "\\"),
  ]);
  return [...variants].reduce(
    (redacted, variant) =>
      variant.length >= 2 ? redacted.split(variant).join(".") : redacted,
    value,
  );
}

export function agentErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim()
  ) {
    return error.message;
  }
  return fallback;
}

export type AgentChatAction =
  | {
      type: "userTurn";
      turnId: string;
      question: string;
      images: AgentImageAttachment[];
      quotedContexts?: AgentQuotedContext[];
      responseMode: "auto" | "visualize";
    }
  | {
      type: "hydrate";
      turns: AgentConversationTurn[];
    }
  | { type: "steerAccepted"; turnId: string; question: string }
  | { type: "suppressRestore"; turnId: string }
  | { type: "event"; event: AgentEvent }
  | { type: "reset" };

function updateActiveTurn(
  state: AgentChatState,
  update: (turn: AgentConversationTurn) => AgentConversationTurn,
): AgentChatState {
  if (!state.activeTurnId) {
    return state;
  }
  return {
    ...state,
    turns: state.turns.map((turn) =>
      turn.id === state.activeTurnId ? update(turn) : turn,
    ),
  };
}

const openUiCommentaryPrefixes = [
  "root =",
  "SvardExperience(",
  "```openui",
  "```openui-lang",
] as const;

export function classifyAgentCommentary(
  value: string,
  final = false,
): "pending" | "plain" | "suppressed" {
  const candidate = value.trimStart();
  if (!candidate) return final ? "plain" : "pending";
  if (openUiCommentaryPrefixes.some((prefix) => candidate.startsWith(prefix))) {
    return "suppressed";
  }
  if (openUiCommentaryPrefixes.some((prefix) => prefix.startsWith(candidate))) {
    return final ? "suppressed" : "pending";
  }
  return "plain";
}

function appendCommentaryDelta(
  turn: AgentConversationTurn,
  delta: string,
): AgentConversationTurn {
  if (turn.commentaryClassification === "suppressed") return turn;
  if (turn.commentaryClassification === "plain") {
    return { ...turn, commentary: turn.commentary + delta };
  }
  const commentaryBuffer = turn.commentaryBuffer + delta;
  const commentaryClassification = classifyAgentCommentary(commentaryBuffer);
  if (commentaryClassification === "pending") {
    return { ...turn, commentaryBuffer };
  }
  if (commentaryClassification === "suppressed") {
    return {
      ...turn,
      commentaryBuffer: "",
      commentaryClassification,
    };
  }
  return {
    ...turn,
    commentary: turn.commentary + commentaryBuffer,
    commentaryBuffer: "",
    commentaryClassification,
  };
}

function finalizeCommentary(
  turn: AgentConversationTurn,
): AgentConversationTurn {
  if (turn.commentaryClassification !== "pending" || !turn.commentaryBuffer) {
    return turn;
  }
  const commentaryClassification = classifyAgentCommentary(
    turn.commentaryBuffer,
    true,
  );
  return {
    ...turn,
    commentary:
      commentaryClassification === "plain"
        ? turn.commentary + turn.commentaryBuffer
        : turn.commentary,
    commentaryBuffer: "",
    commentaryClassification,
  };
}

export function reduceAgentChat(
  state: AgentChatState,
  action: AgentChatAction,
): AgentChatState {
  if (action.type === "reset") {
    return initialAgentChatState;
  }
  if (action.type === "hydrate") {
    return {
      activeTurnId: null,
      turns: action.turns,
      disconnectedMessage: null,
    };
  }
  if (action.type === "steerAccepted") {
    return {
      ...state,
      turns: state.turns.map((turn) =>
        turn.id === action.turnId
          ? {
              ...turn,
              steeringMessages: [...turn.steeringMessages, action.question],
            }
          : turn,
      ),
    };
  }
  if (action.type === "suppressRestore") {
    return {
      ...state,
      turns: state.turns.map((turn) =>
        turn.id === action.turnId ? { ...turn, restoreEligible: false } : turn,
      ),
    };
  }
  if (action.type === "userTurn") {
    return {
      ...state,
      activeTurnId: action.turnId,
      disconnectedMessage: null,
      turns: [
        ...state.turns,
        {
          id: action.turnId,
          question: action.question,
          images: action.images,
          quotedContexts: action.quotedContexts ?? [],
          responseMode: action.responseMode,
          steeringMessages: [],
          changedPaths: [],
          inputAccepted: false,
          restoreEligible: true,
          commentary: "",
          commentaryBuffer: "",
          commentaryClassification: "pending",
          reasoningSummary: "",
          plan: [],
          tools: [],
          approval: null,
          answer: "",
          status: "running",
        },
      ],
    };
  }

  const { event } = action;
  switch (event.type) {
    case "turnInputAccepted":
      return updateActiveTurn(state, (turn) => ({
        ...turn,
        inputAccepted: true,
      }));
    case "providerDisconnected":
      return {
        ...state,
        activeTurnId: null,
        disconnectedMessage: event.message,
      };
    case "reasoningSummaryDelta":
      return updateActiveTurn(state, (turn) => ({
        ...turn,
        reasoningSummary: turn.reasoningSummary + event.delta,
      }));
    case "assistantCommentaryDelta":
      return updateActiveTurn(state, (turn) =>
        appendCommentaryDelta(turn, event.delta),
      );
    case "planUpdated":
      return updateActiveTurn(state, (turn) => ({
        ...turn,
        plan: event.steps,
      }));
    case "toolStarted":
      return updateActiveTurn(state, (turn) => ({
        ...turn,
        tools: [
          ...turn.tools.filter((tool) => tool.id !== event.toolId),
          {
            id: event.toolId,
            kind: event.kind,
            category: event.category,
            title: event.title,
            status: "running",
            visibility: event.visibility,
            target: event.target,
            detail: event.detail,
          },
        ],
      }));
    case "toolUpdated":
      return updateActiveTurn(state, (turn) => ({
        ...turn,
        tools: turn.tools.map((tool) =>
          tool.id === event.toolId
            ? { ...tool, status: event.status, detail: event.detail }
            : tool,
        ),
      }));
    case "toolCompleted":
      return updateActiveTurn(state, (turn) => ({
        ...turn,
        tools: turn.tools.map((tool) =>
          tool.id === event.toolId
            ? {
                ...tool,
                status: event.status,
                summary: event.summary,
                detail: event.detail ?? tool.detail,
                durationMs: event.durationMs,
              }
            : tool,
        ),
      }));
    case "permissionRequested":
      return updateActiveTurn(state, (turn) => ({
        ...turn,
        approval: event.request,
        tools: turn.tools.map((tool) =>
          tool.status === "running"
            ? { ...tool, status: "waitingForApproval" }
            : tool,
        ),
      }));
    case "permissionResolved":
      return updateActiveTurn(state, (turn) => ({
        ...turn,
        approval: null,
        tools: turn.tools.map((tool) =>
          tool.status === "waitingForApproval"
            ? {
                ...tool,
                status: event.decision === "allowOnce" ? "running" : "denied",
              }
            : tool,
        ),
      }));
    case "filesChanged":
      return updateActiveTurn(state, (turn) => ({
        ...turn,
        changedPaths: [...new Set([...turn.changedPaths, ...event.paths])],
      }));
    case "finalAnswerDelta":
      return updateActiveTurn(state, (turn) => ({
        ...turn,
        answer: turn.answer + event.delta,
      }));
    case "turnCompleted":
      return {
        ...updateActiveTurn(state, (turn) => ({
          ...finalizeCommentary(turn),
          approval: null,
          status: "completed",
        })),
        activeTurnId: null,
      };
    case "turnFailed":
      return {
        ...updateActiveTurn(state, (turn) => ({
          ...finalizeCommentary(turn),
          approval: null,
          status: "failed",
          error: event.message,
        })),
        activeTurnId: null,
      };
    case "turnCancelled":
      return {
        ...updateActiveTurn(state, (turn) => ({
          ...finalizeCommentary(turn),
          approval: null,
          status: "cancelled",
        })),
        activeTurnId: null,
      };
    default:
      return state;
  }
}
