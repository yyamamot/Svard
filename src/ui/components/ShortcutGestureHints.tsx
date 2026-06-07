import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AppConfig } from "../../core/types";
import { buildShortcutGestureHintModel } from "../lib/shortcutGestureHints";
import type { ShortcutGestureHintContext } from "../lib/shortcutGestureHints";

interface ShortcutGestureHintsProps {
  config: AppConfig | null;
  context: ShortcutGestureHintContext;
  openReviewId: string;
  panelReviewId: string;
  title: string;
  placement: "toolbar" | "viewer-command";
  open?: boolean;
  showTrigger?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ShortcutGestureHints({
  config,
  context,
  openReviewId,
  panelReviewId,
  title,
  placement,
  open,
  showTrigger = true,
  onOpenChange,
}: ShortcutGestureHintsProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelOpen = open ?? internalOpen;
  const setPanelOpen = (nextOpen: boolean) => {
    onOpenChange?.(nextOpen);
    if (open === undefined) {
      setInternalOpen(nextOpen);
    }
  };
  const model = useMemo(
    () => buildShortcutGestureHintModel({ config, context }),
    [config, context],
  );
  const mouseRows = [...model.mouseGestures, ...model.mouseActions];

  useEffect(() => {
    if (!panelOpen) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPanelOpen(false);
      }
    }
    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        rootRef.current &&
        !rootRef.current.contains(event.target)
      ) {
        setPanelOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [panelOpen]);

  if (!showTrigger && !panelOpen) {
    return null;
  }

  return (
    <div
      ref={rootRef}
      className={`shortcut-gesture-hints shortcut-gesture-hints-${placement}`}
    >
      {showTrigger && (
        <button
          type="button"
          className="icon-button shortcut-gesture-hints-open"
          data-review-id={openReviewId}
          aria-label={title}
          aria-expanded={panelOpen}
          title={title}
          onClick={() => setPanelOpen(!panelOpen)}
        >
          <span aria-hidden="true">?</span>
        </button>
      )}
      {panelOpen && (
        <section
          className="shortcut-gesture-hints-panel"
          data-review-id={panelReviewId}
          aria-label={title}
        >
          <header>
            <strong>{title}</strong>
            <button
              type="button"
              className="shortcut-gesture-hints-close"
              data-review-id="shortcut-gesture-hints-close"
              aria-label="Close shortcut and gesture hints"
              onClick={() => setPanelOpen(false)}
            >
              <X size={13} />
            </button>
          </header>
          <HintSection title="Keyboard" rows={model.keyboard} />
          <section className="shortcut-gesture-hints-section">
            <h4>Mouse Gestures</h4>
            {!model.mouseGesturesEnabled ? (
              <p
                className="shortcut-gesture-hints-empty"
                data-review-id="shortcut-gesture-hints-gestures-disabled"
              >
                Mouse Gestures disabled. Enable them in Preferences.
              </p>
            ) : (
              <HintRows rows={mouseRows} />
            )}
          </section>
        </section>
      )}
    </div>
  );
}

function HintSection({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: string }>;
}) {
  return (
    <section className="shortcut-gesture-hints-section">
      <h4>{title}</h4>
      <HintRows rows={rows} />
    </section>
  );
}

function HintRows({ rows }: { rows: Array<{ label: string; value: string }> }) {
  if (rows.length === 0) {
    return <p className="shortcut-gesture-hints-empty">No assignments</p>;
  }
  return (
    <dl>
      {rows.map((row) => (
        <div key={`${row.label}:${row.value}`}>
          <dt>{row.label}</dt>
          <dd>
            <kbd>{row.value}</kbd>
          </dd>
        </div>
      ))}
    </dl>
  );
}
