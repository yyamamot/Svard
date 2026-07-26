import {
  EventType,
  type AGUIEvent,
  type ChatLLM,
  type Message,
  type StreamProtocolAdapter,
} from "@openuidev/react-headless";
import type {
  CodexContextSnapshot,
  CodexExecutionSettings,
  CodexTurnEvent,
  CodexTurnInput,
  HostAdapter,
} from "../../core/types";

const encoder = new TextEncoder();

function userText(messages: Message[]): string {
  const message = [...messages].reverse().find((item) => item.role === "user");
  if (!message || message.role !== "user") {
    return "";
  }
  if (typeof message.content === "string") {
    return message.content.trim();
  }
  return message.content
    .map((item) => (item.type === "text" ? item.text : ""))
    .join("")
    .trim();
}

async function* parseCodexEvents(response: Response): AsyncIterable<AGUIEvent> {
  if (!response.body) {
    throw new Error("Codex response stream is unavailable.");
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  const messageId = crypto.randomUUID();
  const runId = crypto.randomUUID();
  let started = false;
  yield {
    type: EventType.RUN_STARTED,
    threadId: "svard-codex",
    runId,
  } as AGUIEvent;

  while (true) {
    const result = await reader.read();
    if (result.done) {
      break;
    }
    buffer += result.value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }
      const event = JSON.parse(line) as CodexTurnEvent;
      if (event.type === "assistantDelta") {
        if (!started) {
          started = true;
          yield {
            type: EventType.TEXT_MESSAGE_START,
            messageId,
            role: "assistant",
          } as AGUIEvent;
        }
        yield {
          type: EventType.TEXT_MESSAGE_CONTENT,
          messageId,
          delta: event.delta,
        } as AGUIEvent;
      } else if (event.type === "assistantCompleted") {
        if (!started) {
          started = true;
          yield {
            type: EventType.TEXT_MESSAGE_START,
            messageId,
            role: "assistant",
          } as AGUIEvent;
          yield {
            type: EventType.TEXT_MESSAGE_CONTENT,
            messageId,
            delta: event.text,
          } as AGUIEvent;
        }
      } else if (event.type === "failed") {
        throw new Error(event.message);
      } else if (event.type === "unexpectedToolUse") {
        throw new Error(
          `Codex attempted a blocked ${event.category} operation.`,
        );
      } else if (event.type === "cancelled") {
        throw new DOMException("Codex turn cancelled.", "AbortError");
      }
    }
  }

  if (started) {
    yield { type: EventType.TEXT_MESSAGE_END, messageId } as AGUIEvent;
  }
  yield {
    type: EventType.RUN_FINISHED,
    threadId: "svard-codex",
    runId,
  } as AGUIEvent;
}

export const codexStreamProtocol: StreamProtocolAdapter = {
  parse: parseCodexEvents,
};

interface CreateCodexLlmOptions {
  clientSessionId: string;
  contextAdditions: () => CodexContextSnapshot[];
  host: HostAdapter;
  onContextAccepted?: (contextIds: string[]) => void;
  onRunChange?: (runId: string | null) => void;
  openUiPrompt: string;
  responseMode: () => CodexTurnInput["responseMode"];
  executionSettings: CodexExecutionSettings;
}

export function createCodexLlm({
  clientSessionId,
  contextAdditions,
  host,
  onContextAccepted,
  onRunChange,
  openUiPrompt,
  responseMode,
  executionSettings,
}: CreateCodexLlmOptions): ChatLLM {
  let promptSent = false;
  return {
    streamProtocol: codexStreamProtocol,
    async send({ messages, signal }) {
      const runId = crypto.randomUUID();
      onRunChange?.(runId);
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const emit = (event: CodexTurnEvent) => {
            if (event.type === "contextAccepted") {
              promptSent = true;
              onContextAccepted?.(event.contextIds);
            }
            controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
          };
          const abort = () => {
            void host.cancelCodexTurn(runId);
          };
          signal.addEventListener("abort", abort, { once: true });
          void host
            .runCodexTurn(
              {
                clientSessionId,
                runId,
                question: userText(messages),
                responseMode: responseMode(),
                openUiPrompt: promptSent ? undefined : openUiPrompt,
                contextAdditions: contextAdditions(),
                executionSettings,
              },
              emit,
            )
            .then(() => {
              promptSent = true;
              controller.close();
            })
            .catch((error: unknown) => controller.error(error))
            .finally(() => {
              signal.removeEventListener("abort", abort);
              onRunChange?.(null);
            });
        },
      });
      return new Response(stream, {
        headers: { "content-type": "application/x-ndjson" },
      });
    },
  };
}
