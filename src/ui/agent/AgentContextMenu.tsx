import { ChevronDown, Gauge, RefreshCw } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type {
  AgentProbe,
  AgentTokenUsageBreakdown,
  AgentTokenUsageDiagnostics,
} from "../../core/types";
import { calculateAgentAccessPopoverPosition } from "./AgentAccessMenu";
import type { AgentSessionController } from "./useAgentSessionController";

export type AgentContextPressure = "normal" | "gettingFull" | "nearlyFull";

export function agentContextPressure(
  remainingPercent: number,
): AgentContextPressure {
  if (remainingPercent <= 10) return "nearlyFull";
  if (remainingPercent <= 25) return "gettingFull";
  return "normal";
}

export function agentContextPressureLabel(
  pressure: AgentContextPressure,
): string {
  switch (pressure) {
    case "nearlyFull":
      return "Nearly full";
    case "gettingFull":
      return "Getting full";
    default:
      return "Normal";
  }
}

export function formatAgentContextTokens(value: number): string {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 1,
    notation: "compact",
  }).format(value);
}

export function formatAgentTokenCount(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(value);
}

export function nonCachedAgentInput(usage: AgentTokenUsageBreakdown): number {
  return usage.inputTokens - usage.cachedInputTokens;
}

const tokenMetrics: Array<{
  label: string;
  value: (usage: AgentTokenUsageBreakdown) => number;
}> = [
  { label: "Total", value: (usage) => usage.totalTokens },
  { label: "Input", value: (usage) => usage.inputTokens },
  { label: "Non-cached input", value: nonCachedAgentInput },
  { label: "Cached input", value: (usage) => usage.cachedInputTokens },
  { label: "Output", value: (usage) => usage.outputTokens },
  { label: "Reasoning output", value: (usage) => usage.reasoningOutputTokens },
];

function TokenUsageDetails({
  activeTurn,
  diagnostics,
}: {
  activeTurn: boolean;
  diagnostics: AgentTokenUsageDiagnostics;
}) {
  const columns = [
    diagnostics.latestRequest.usage,
    diagnostics.turn?.usage ?? null,
    diagnostics.conversation.usage,
  ];
  return (
    <div
      className="agent-token-details-content"
      data-review-id="agent-token-details-content"
    >
      <table>
        <thead>
          <tr>
            <th scope="col">Metric</th>
            <th scope="col">
              <span>Latest request</span>
              <small>Provider reported</small>
            </th>
            <th scope="col">
              <span>{activeTurn ? "Current turn" : "Latest turn"}</span>
              <small>Aggregated provider reports</small>
            </th>
            <th scope="col">
              <span>Conversation</span>
              <small>Provider reported</small>
            </th>
          </tr>
        </thead>
        <tbody>
          {tokenMetrics.map((metric) => (
            <tr key={metric.label}>
              <th scope="row">{metric.label}</th>
              {columns.map((usage, index) => (
                <td key={index}>
                  {usage ? formatAgentTokenCount(metric.value(usage)) : "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Cached input is included in Input. Reasoning output is included in
        Output; neither is added again to Total.
      </p>
    </div>
  );
}

export function AgentContextMenu({
  placement,
  probe,
  session,
  workspaceRoot,
}: {
  placement: string;
  probe: AgentProbe | null;
  session: AgentSessionController;
  workspaceRoot: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [tokenDetailsOpen, setTokenDetailsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLElement | null>(null);
  const [position, setPosition] = useState({
    left: 8,
    top: 8,
    ready: false,
  });
  const {
    activeTurnId,
    compactContext,
    contextCompactionStatus,
    contextUsage,
    lastCompaction,
    sessionReady,
    setAddMenuOpen,
    setHistoryOpen,
    setSettingsOpen,
    state,
    tokenUsageDiagnostics,
  } = session;
  const supported = Boolean(
    probe?.capabilities.contextUsage ||
    probe?.capabilities.manualCompaction ||
    probe?.capabilities.tokenUsageDiagnostics,
  );
  const pressure = contextUsage
    ? agentContextPressure(contextUsage.remainingPercent)
    : "normal";
  const closeAndRestoreFocus = useCallback(() => {
    setOpen(false);
    setTokenDetailsOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);
  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !popoverRef.current) return;
    const next = calculateAgentAccessPopoverPosition({
      trigger: triggerRef.current.getBoundingClientRect(),
      popover: popoverRef.current.getBoundingClientRect(),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    });
    setPosition({ ...next, ready: true });
  }, []);

  useLayoutEffect(() => {
    if (open) updatePosition();
  }, [open, tokenDetailsOpen, updatePosition]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (
        target instanceof Node &&
        (triggerRef.current?.contains(target) ||
          popoverRef.current?.contains(target))
      ) {
        return;
      }
      closeAndRestoreFocus();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAndRestoreFocus();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [closeAndRestoreFocus, open, updatePosition]);

  useEffect(() => {
    setOpen(false);
    setTokenDetailsOpen(false);
  }, [placement, workspaceRoot]);

  if (!supported) return null;
  const statusLabel =
    contextCompactionStatus === "running"
      ? "Compacting"
      : contextCompactionStatus === "updating"
        ? "Updating"
        : contextUsage
          ? `${contextUsage.remainingPercent}%`
          : "Context";
  const compactDisabled =
    !probe?.capabilities.manualCompaction ||
    !sessionReady ||
    Boolean(activeTurnId) ||
    contextCompactionStatus !== "idle" ||
    state.turns.length === 0;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`agent-context-trigger ${pressure} ${open ? "active" : ""}`}
        data-review-id="agent-context-trigger"
        aria-label={
          contextUsage
            ? `${contextUsage.remainingPercent}% context remaining`
            : "Context unavailable"
        }
        aria-expanded={open}
        aria-controls="agent-context-popover"
        onClick={() => {
          if (open) {
            closeAndRestoreFocus();
            return;
          }
          setAddMenuOpen(false);
          setHistoryOpen(false);
          setSettingsOpen(false);
          setPosition((current) => ({ ...current, ready: false }));
          setOpen(true);
        }}
      >
        <Gauge size={14} />
        <span>{statusLabel}</span>
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <section
              ref={popoverRef}
              id="agent-context-popover"
              role="dialog"
              aria-label="Context usage"
              className={`agent-context-popover ${
                tokenDetailsOpen ? "token-details-open" : ""
              }`}
              data-review-id="agent-context-popover"
              style={{
                left: position.left,
                top: position.top,
                visibility: position.ready ? "visible" : "hidden",
              }}
            >
              <div className="agent-context-popover-heading">
                <strong>Context</strong>
                {contextUsage ? (
                  <span className={pressure}>
                    {agentContextPressureLabel(pressure)}
                  </span>
                ) : null}
              </div>
              {contextUsage ? (
                <dl>
                  <div>
                    <dt>Remaining</dt>
                    <dd>{contextUsage.remainingPercent}%</dd>
                  </div>
                  <div>
                    <dt>Active context</dt>
                    <dd>
                      {formatAgentContextTokens(contextUsage.usedTokens)} /{" "}
                      {formatAgentContextTokens(
                        contextUsage.contextWindowTokens,
                      )}{" "}
                      tokens
                    </dd>
                  </div>
                </dl>
              ) : (
                <p>
                  {contextCompactionStatus === "running"
                    ? "Codex is compacting the conversation context."
                    : contextCompactionStatus === "updating"
                      ? "Waiting for updated context usage from Codex."
                      : "Context usage is unavailable until Codex reports it."}
                </p>
              )}
              {lastCompaction ? (
                <p className="agent-context-last-compaction">
                  Last compacted{" "}
                  {lastCompaction === "manual" ? "manually" : "automatically"}.
                </p>
              ) : null}
              <p>
                Values describe the active model context reported by Codex, not
                cumulative account usage or a compaction prediction.
              </p>
              {probe?.capabilities.tokenUsageDiagnostics &&
              tokenUsageDiagnostics ? (
                <details
                  className="agent-token-details"
                  data-review-id="agent-token-details"
                  open={tokenDetailsOpen}
                  onToggle={(event) => {
                    const nextOpen = event.currentTarget.open;
                    setTokenDetailsOpen(nextOpen);
                    requestAnimationFrame(updatePosition);
                  }}
                >
                  <summary>
                    <span>Token details</span>
                    <ChevronDown size={14} />
                  </summary>
                  <TokenUsageDetails
                    activeTurn={Boolean(activeTurnId)}
                    diagnostics={tokenUsageDiagnostics}
                  />
                </details>
              ) : null}
              {probe?.capabilities.manualCompaction ? (
                <button
                  type="button"
                  className="button"
                  disabled={compactDisabled}
                  onClick={() => void compactContext()}
                >
                  <RefreshCw
                    size={14}
                    className={
                      contextCompactionStatus === "running" ? "spin" : ""
                    }
                  />
                  Compact context
                </button>
              ) : null}
            </section>,
            document.querySelector<HTMLElement>(".app-shell") ?? document.body,
          )
        : null}
    </>
  );
}
