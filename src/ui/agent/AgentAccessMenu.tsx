import { ChevronDown, ShieldCheck } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { AgentProbe } from "../../core/types";
import { permissionLabel } from "./agentPanelModel";
import type { AgentSessionController } from "./useAgentSessionController";

const popoverGap = 8;
const viewportGap = 8;

interface AgentAccessPopoverPositionInput {
  trigger: Pick<DOMRect, "left" | "top">;
  popover: Pick<DOMRect, "width" | "height">;
  viewportWidth: number;
  viewportHeight: number;
}

export function calculateAgentAccessPopoverPosition({
  trigger,
  popover,
  viewportWidth,
  viewportHeight,
}: AgentAccessPopoverPositionInput) {
  const maxLeft = Math.max(
    viewportGap,
    viewportWidth - popover.width - viewportGap,
  );
  const maxTop = Math.max(
    viewportGap,
    viewportHeight - popover.height - viewportGap,
  );
  return {
    left: Math.min(Math.max(trigger.left, viewportGap), maxLeft),
    top: Math.min(
      Math.max(trigger.top - popover.height - popoverGap, viewportGap),
      maxTop,
    ),
  };
}

export function AgentAccessMenu({
  onBeforeOpen,
  placement,
  probe,
  session,
  workspaceRoot,
}: {
  onBeforeOpen: () => void;
  placement: string;
  probe: AgentProbe | null;
  session: AgentSessionController;
  workspaceRoot: string | null;
}) {
  const {
    contextProfile,
    networkAccess,
    permissionMode,
    selectContextProfile,
    selectNetworkAccess,
    selectPermissionMode,
    selectWebSearch,
    sessionStarting,
    setHistoryOpen,
    setSettingsOpen,
    settingsOpen,
    webSearch,
  } = session;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLElement | null>(null);
  const [position, setPosition] = useState({
    left: viewportGap,
    top: viewportGap,
    ready: false,
  });

  const closeAndRestoreFocus = useCallback(() => {
    setSettingsOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, [setSettingsOpen]);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const popover = popoverRef.current;
    if (!trigger || !popover) {
      return;
    }
    const next = calculateAgentAccessPopoverPosition({
      trigger: trigger.getBoundingClientRect(),
      popover: popover.getBoundingClientRect(),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    });
    setPosition({ ...next, ready: true });
  }, []);

  useLayoutEffect(() => {
    if (settingsOpen) {
      updatePosition();
    }
  }, [settingsOpen, updatePosition]);

  useEffect(() => {
    if (!settingsOpen) {
      return;
    }
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
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      closeAndRestoreFocus();
    }
    function handleViewportChange() {
      updatePosition();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    requestAnimationFrame(() => {
      popoverRef.current
        ?.querySelector<HTMLInputElement>("input:not(:disabled)")
        ?.focus();
    });
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [closeAndRestoreFocus, settingsOpen, updatePosition]);

  useEffect(() => {
    setSettingsOpen(false);
  }, [placement, setSettingsOpen, workspaceRoot]);

  useEffect(
    () => () => {
      setSettingsOpen(false);
    },
    [setSettingsOpen],
  );

  const label = permissionLabel(permissionMode);
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`agent-access-trigger ${settingsOpen ? "active" : ""}`}
        data-review-id="agent-access-trigger"
        aria-label={`Agent access: ${label}`}
        aria-expanded={settingsOpen}
        aria-controls="agent-access-popover"
        onClick={() => {
          if (settingsOpen) {
            closeAndRestoreFocus();
            return;
          }
          onBeforeOpen();
          setHistoryOpen(false);
          setPosition((current) => ({ ...current, ready: false }));
          setSettingsOpen(true);
        }}
      >
        <ShieldCheck size={14} />
        <span>{label}</span>
        <ChevronDown size={13} />
      </button>
      {settingsOpen && typeof document !== "undefined"
        ? createPortal(
            <section
              ref={popoverRef}
              id="agent-access-popover"
              role="dialog"
              aria-label="Agent access"
              className="agent-access-popover"
              data-review-id="agent-access-popover"
              style={{
                left: position.left,
                top: position.top,
                visibility: position.ready ? "visible" : "hidden",
              }}
            >
              <div className="agent-access-popover-heading">
                <strong>Agent access</strong>
                <span>New chat</span>
              </div>
              <fieldset>
                <legend>Permission mode</legend>
                {(["observe", "agent", "fullAccess"] as const).map((mode) => (
                  <label key={mode}>
                    <input
                      type="radio"
                      name="agent-access-mode"
                      checked={permissionMode === mode}
                      disabled={sessionStarting}
                      onChange={() => void selectPermissionMode(mode)}
                    />
                    <span>{permissionLabel(mode)}</span>
                  </label>
                ))}
              </fieldset>
              {probe?.capabilities.networkAccess ? (
                <label className="agent-access-toggle">
                  <input
                    type="checkbox"
                    checked={networkAccess}
                    disabled={sessionStarting}
                    onChange={(event) =>
                      void selectNetworkAccess(event.target.checked)
                    }
                  />
                  <span>Network access</span>
                  <small>Allow commands to connect to the network.</small>
                </label>
              ) : null}
              {probe?.capabilities.webSearch ? (
                <label className="agent-access-toggle">
                  <input
                    type="checkbox"
                    checked={webSearch}
                    disabled={sessionStarting}
                    onChange={(event) =>
                      void selectWebSearch(event.target.checked)
                    }
                  />
                  <span>Web search</span>
                  <small>Allow the provider to search the web.</small>
                </label>
              ) : null}
              {probe === null || probe.capabilities.focusedContext ? (
                <fieldset data-review-id="agent-context-profile">
                  <legend>Context profile</legend>
                  {(["focused", "providerDefaults"] as const).map((profile) => (
                    <label key={profile}>
                      <input
                        type="radio"
                        name="agent-context-profile"
                        checked={contextProfile === profile}
                        disabled={sessionStarting || probe === null}
                        onChange={() => void selectContextProfile(profile)}
                      />
                      <span>
                        {profile === "focused"
                          ? "Focused"
                          : "Provider extensions"}
                      </span>
                    </label>
                  ))}
                  <small className="agent-context-profile-help">
                    Focused excludes provider Memory, Skills catalog, Plugins,
                    and Apps. Workspace instructions remain; this is not full
                    MCP or global-instruction isolation.
                  </small>
                </fieldset>
              ) : null}
              <p>
                Changing access or context profile starts a new chat. Your draft
                and document references stay in the composer.
              </p>
            </section>,
            document.querySelector<HTMLElement>(".app-shell") ?? document.body,
          )
        : null}
    </>
  );
}
