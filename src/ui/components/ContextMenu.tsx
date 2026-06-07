import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { clampContextMenuPosition } from "../lib/contextMenu";
import type { ContextMenuState } from "../types";

interface ContextMenuProps {
  menu: ContextMenuState;
  onClose: () => void;
}

const viewportGap = 8;

export function ContextMenu({ menu, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ left: menu.x, top: menu.y });

  useLayoutEffect(() => {
    const element = menuRef.current;
    if (!element) {
      return;
    }
    const rect = element.getBoundingClientRect();
    setPosition({
      ...clampContextMenuPosition({
        x: menu.x,
        y: menu.y,
        width: rect.width,
        height: rect.height,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        gap: viewportGap,
      }),
    });
  }, [menu]);

  useEffect(() => {
    function close() {
      onClose();
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    document.addEventListener("pointerdown", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("keydown", handleKeyDown);
    requestAnimationFrame(() => {
      menuRef.current
        ?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')
        ?.focus();
    });

    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  function focusItem(index: number) {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]',
      ) ?? [],
    );
    items.at(index)?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]',
      ) ?? [],
    );
    const currentIndex = items.findIndex(
      (item) => item === document.activeElement,
    );

    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItem((currentIndex + 1 + items.length) % items.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItem((currentIndex - 1 + items.length) % items.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusItem(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusItem(items.length - 1);
    }
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      className="context-menu"
      data-review-id="context-menu"
      data-source-review-id={menu.sourceReviewId}
      style={{ left: position.left, top: position.top }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={handleKeyDown}
    >
      {menu.items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          className={[
            "context-menu-item",
            item.danger ? "danger" : "",
            item.separatorBefore ? "with-separator" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          data-review-id={`context-menu-item-${item.id}`}
          title={item.title}
          disabled={item.enabled === false}
          aria-disabled={item.enabled === false ? "true" : undefined}
          onClick={() => {
            if (item.enabled === false) {
              return;
            }
            onClose();
            void item.onSelect();
          }}
        >
          <span className="context-menu-icon" aria-hidden="true">
            {item.icon}
          </span>
          <span className="context-menu-label">{item.label}</span>
          {item.shortcut && (
            <span className="context-menu-shortcut">{item.shortcut}</span>
          )}
        </button>
      ))}
    </div>
  );
}
