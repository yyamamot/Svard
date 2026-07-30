import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Check, ChevronDown } from "lucide-react";
import type {
  AgentChatDisplayAction,
  AgentChatDisplayMenuItem,
} from "./agentChatDisplay";

export function AgentChatDisplayMenu({
  active = false,
  busy = false,
  disabled = false,
  items,
  onBeforeOpen,
  onSelect,
  reviewId,
  triggerClassName = "icon-button",
  triggerIcon,
  triggerLabel = "AI Chat display options",
}: {
  active?: boolean;
  busy?: boolean;
  disabled?: boolean;
  items: AgentChatDisplayMenuItem[];
  onBeforeOpen?: () => boolean | Promise<boolean>;
  onSelect: (action: AgentChatDisplayAction) => void | Promise<void>;
  reviewId?: string;
  triggerClassName?: string;
  triggerIcon: ReactNode;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const guardPendingRef = useRef(false);

  function close({ restoreFocus = false } = {}) {
    setOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }

  function focusItem(index: number, direction: 1 | -1) {
    if (items.length === 0) return;
    let next = index;
    for (let attempts = 0; attempts < items.length; attempts += 1) {
      next = (next + direction + items.length) % items.length;
      if (!items[next]?.disabled) {
        itemRefs.current[next]?.focus();
        return;
      }
    }
  }

  async function requestOpen() {
    if (open) {
      close();
      return;
    }
    if (disabled || busy) return;
    if (guardPendingRef.current) return;
    guardPendingRef.current = true;
    try {
      if (onBeforeOpen && !(await onBeforeOpen())) return;
      setOpen(true);
    } finally {
      guardPendingRef.current = false;
    }
  }

  useEffect(() => {
    if (!open) return;
    const firstEnabled = items.findIndex((item) => !item.disabled);
    const frame = window.requestAnimationFrame(() => {
      if (firstEnabled >= 0) itemRefs.current[firstEnabled]?.focus();
    });
    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        close();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [items, open]);

  function handleItemKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItem(index, 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItem(index, -1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusItem(-1, 1);
    } else if (event.key === "End") {
      event.preventDefault();
      focusItem(0, -1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close({ restoreFocus: true });
    } else if (event.key === "Tab") {
      close();
    }
  }

  return (
    <div className="agent-display-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`${triggerClassName} ${active ? "active" : ""}`}
        data-review-id={reviewId}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-busy={busy || undefined}
        aria-label={triggerLabel}
        title={triggerLabel}
        disabled={disabled || busy}
        onClick={() => void requestOpen()}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            void requestOpen();
          } else if (event.key === "Escape" && open) {
            event.preventDefault();
            close({ restoreFocus: true });
          }
        }}
      >
        {triggerIcon}
        <ChevronDown size={12} aria-hidden="true" />
      </button>
      {open ? (
        <div
          className="agent-display-menu-popover"
          data-review-id="agent-display-menu"
          role="menu"
          aria-label="AI Chat display location"
        >
          {items.map((item, index) => (
            <button
              key={item.action}
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              type="button"
              className="agent-display-menu-item"
              role={item.checked === undefined ? "menuitem" : "menuitemradio"}
              aria-checked={
                item.checked === undefined ? undefined : item.checked
              }
              disabled={item.disabled}
              onClick={() => {
                close({ restoreFocus: true });
                void onSelect(item.action);
              }}
              onKeyDown={(event) => handleItemKeyDown(event, index)}
            >
              <span className="agent-display-menu-check" aria-hidden="true">
                {item.checked ? <Check size={14} /> : null}
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
