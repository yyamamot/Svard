import { Renderer, type OpenUIError } from "@openuidev/react-lang";
import type { AssistantMessage } from "@openuidev/react-headless";
import {
  Component,
  useEffect,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { AgentMarkdownAnswer } from "./openUiMarkdown";
import {
  svardOpenUiLibraries,
  type SvardOpenUiProfile,
} from "./openUiRegistry";
import {
  SvardOpenUiRuntimeContext,
  type SvardOpenUiRuntime,
} from "./openUiRuntime";
import {
  agentMessageFromOpenUiAction,
  openUiLooksLikeCandidate,
  validateOpenUiResponse,
  type OpenUiFailureReason,
  type OpenUiLimitDiagnostic,
} from "./openUiValidation";

interface OpenUiErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

class OpenUiErrorBoundary extends Component<
  OpenUiErrorBoundaryProps,
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // The renderer error is intentionally contained in this answer.
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export interface SvardOpenUiAnswerProps extends SvardOpenUiRuntime {
  allowStructured?: boolean;
  content: string;
  isStreaming?: boolean;
  profile?: SvardOpenUiProfile;
  preferUi?: boolean;
}

function plainTextFallback(content: string) {
  const withoutStructuredBlocks = content
    .replace(/```(?:openui|openui-lang)?\s*[\s\S]*?```/giu, "")
    .trim();
  return withoutStructuredBlocks &&
    !openUiLooksLikeCandidate(withoutStructuredBlocks)
    ? withoutStructuredBlocks
    : "The structured answer could not be displayed.";
}

type DisplayFailureReason = OpenUiFailureReason | "modeMismatch";

const openUiFailureMessages: Record<DisplayFailureReason, string> = {
  sourceLimit: "The generated interface exceeded the response size limit.",
  missingRoot:
    "The response did not use the required Svard OpenUI interface format.",
  incomplete: "The generated interface was incomplete.",
  forbiddenContent:
    "The response contained HTML, a remote resource, or another forbidden expression.",
  syntax: "The generated interface contained invalid OpenUI syntax.",
  unsupportedComponent:
    "The response used a component that is not available in Svard.",
  forbiddenOperation:
    "The response attempted an operation that OpenUI is not allowed to run.",
  resourceBoundary:
    "The response referenced a file or image outside the allowed workspace boundary.",
  complexityLimit: "The generated interface exceeded a rendering limit.",
  renderer: "The interface passed validation but failed while rendering.",
  modeMismatch:
    "A structured interface was returned while this turn was using Auto mode.",
};

function StructuredAnswerUnavailable({
  content,
  limitDiagnostic,
  reason,
}: {
  content: string;
  limitDiagnostic?: OpenUiLimitDiagnostic | null;
  reason: DisplayFailureReason;
}) {
  return (
    <div className="agent-final-answer" data-review-id="agent-openui-fallback">
      <p>{plainTextFallback(content)}</p>
      <details className="agent-openui-diagnostic" data-openui-failure={reason}>
        <summary>Why wasn’t this displayed?</summary>
        <p>{openUiFailureMessages[reason]}</p>
        {limitDiagnostic ? (
          <table className="agent-openui-limit-table">
            <thead>
              <tr>
                <th>Limit</th>
                <th>Generated</th>
                <th>Allowed</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{limitDiagnostic.label}</td>
                <td>{limitDiagnostic.actual.toLocaleString()}</td>
                <td>{limitDiagnostic.limit.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        ) : null}
      </details>
    </div>
  );
}

export function SvardOpenUiAnswer({
  allowStructured = true,
  content,
  disabled,
  images,
  isStreaming = false,
  onAgentAction,
  onOpenExternalLink,
  onOpenFile,
  profile = "full",
  preferUi = false,
  readOnly = false,
  resolveWorkspaceImage,
}: SvardOpenUiAnswerProps) {
  const [rendererFailed, setRendererFailed] = useState(false);
  const library = svardOpenUiLibraries[profile];
  const parsed = validateOpenUiResponse(content, profile);
  useEffect(() => {
    setRendererFailed(false);
  }, [content, profile]);
  if (!parsed.candidate) {
    if (isStreaming && (preferUi || parsed.incomplete)) {
      return (
        <div
          className="codex-openui-building"
          data-review-id="agent-openui-building"
        >
          Building interface…
        </div>
      );
    }
    if (parsed.incomplete || (preferUi && !isStreaming)) {
      return (
        <StructuredAnswerUnavailable
          content={content}
          limitDiagnostic={parsed.limitDiagnostic}
          reason={parsed.reason ?? "missingRoot"}
        />
      );
    }
    return (
      <AgentMarkdownAnswer
        content={content}
        isStreaming={isStreaming}
        onOpenExternalLink={onOpenExternalLink}
        onOpenFile={onOpenFile}
      />
    );
  }
  if (!allowStructured) {
    return (
      <StructuredAnswerUnavailable content={content} reason="modeMismatch" />
    );
  }
  if ((!parsed.valid && !isStreaming) || rendererFailed) {
    return (
      <StructuredAnswerUnavailable
        content={content}
        limitDiagnostic={parsed.limitDiagnostic}
        reason={rendererFailed ? "renderer" : (parsed.reason ?? "syntax")}
      />
    );
  }
  if (!parsed.valid) {
    return (
      <div
        className="codex-openui-building"
        data-review-id="agent-openui-building"
      >
        Building interface…
      </div>
    );
  }
  const runtime = {
    disabled: disabled || readOnly,
    readOnly,
    images: readOnly ? undefined : images,
    onAgentAction: readOnly ? undefined : onAgentAction,
    onOpenExternalLink: readOnly ? undefined : onOpenExternalLink,
    onOpenFile: readOnly ? undefined : onOpenFile,
    resolveWorkspaceImage: readOnly ? undefined : resolveWorkspaceImage,
  };
  const onError = (errors: OpenUIError[]) =>
    setRendererFailed(errors.length > 0);
  return (
    <div
      className="codex-openui-response"
      data-review-id="agent-openui-response"
      data-read-only={readOnly ? "true" : undefined}
      inert={readOnly || undefined}
    >
      <OpenUiErrorBoundary
        fallback={
          <StructuredAnswerUnavailable content={content} reason="renderer" />
        }
      >
        <SvardOpenUiRuntimeContext.Provider value={runtime}>
          <Renderer
            response={parsed.candidate}
            library={library}
            isStreaming={isStreaming}
            onAction={(event) => {
              if (readOnly) return;
              const message = agentMessageFromOpenUiAction(event);
              if (message) onAgentAction?.(message);
            }}
            onError={onError}
            toolProvider={null}
          />
        </SvardOpenUiRuntimeContext.Provider>
      </OpenUiErrorBoundary>
    </div>
  );
}

export function CodexAssistantMessage({
  message,
}: {
  message: AssistantMessage;
}) {
  const content = message.content ?? "";
  if (!openUiLooksLikeCandidate(content)) {
    return (
      <div
        className="codex-plain-response"
        data-review-id="codex-text-response"
      >
        <pre>{content}</pre>
      </div>
    );
  }
  return <SvardOpenUiAnswer content={content} />;
}
