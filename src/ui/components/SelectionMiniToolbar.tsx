import { BotMessageSquare, Clipboard, MoreHorizontal } from "lucide-react";
import type { CSSProperties, RefObject } from "react";

export interface SelectionMiniToolbarAction {
  id: string;
  label: string;
  onSelect: () => void;
}

export function SelectionMiniToolbar({
  actions,
  canAsk = true,
  menuOpen,
  onAsk,
  onCopy,
  onToggleMenu,
  placement,
  toolbarRef,
}: {
  actions: SelectionMiniToolbarAction[];
  canAsk?: boolean;
  menuOpen: boolean;
  onAsk: () => void;
  onCopy: () => void;
  onToggleMenu: () => void;
  placement: {
    left: number;
    top: number;
    positioned: boolean;
    side: "above" | "below" | "right" | "left";
  };
  toolbarRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={toolbarRef}
      className="selection-mini-toolbar"
      data-review-id="selection-mini-toolbar"
      data-positioned={placement.positioned}
      data-placement={placement.side}
      style={
        {
          left: placement.left,
          top: placement.top,
          visibility: placement.positioned ? "visible" : "hidden",
        } satisfies CSSProperties
      }
      onPointerDown={(event) => event.preventDefault()}
      role="toolbar"
      aria-label="Selected text actions"
    >
      <button
        className="selection-mini-toolbar-primary"
        type="button"
        onClick={onAsk}
        disabled={!canAsk}
      >
        <BotMessageSquare size={13} />
        <span className="selection-mini-toolbar-label-full">Ask AI</span>
        <span className="selection-mini-toolbar-label-compact">Ask</span>
      </button>
      <button
        type="button"
        aria-label="Copy selected content"
        title="Copy"
        onClick={onCopy}
      >
        <Clipboard size={14} />
      </button>
      <span className="selection-mini-toolbar-separator" aria-hidden />
      <div className="selection-mini-toolbar-more">
        <button
          type="button"
          aria-label="More selection actions"
          title="More"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={onToggleMenu}
        >
          <MoreHorizontal size={15} />
        </button>
        {menuOpen ? (
          <div
            className="selection-mini-toolbar-menu"
            role="menu"
            onPointerDown={(event) => event.preventDefault()}
          >
            {actions.map((action) => (
              <button
                key={action.id}
                type="button"
                role="menuitem"
                onClick={action.onSelect}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
