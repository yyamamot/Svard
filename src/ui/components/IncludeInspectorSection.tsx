import { ChevronDown, ChevronRight, Copy } from "lucide-react";
import { useState } from "react";
import type { DocumentPayload } from "../../core/types";
import type { IncludeInspectorItem } from "../lib/includeInspector";

interface IncludeInspectorSectionProps {
  document: DocumentPayload | null;
  items: IncludeInspectorItem[];
  onCopyText: (label: string, content?: string) => Promise<void>;
  onNavigateSourceLine: (line: number) => void;
  onOpenInclude: (path: string) => void | Promise<void>;
  onShowNotice: (
    message: string,
    options?: { tone?: "info" | "success" | "warning" | "error" },
  ) => void;
}

export function IncludeInspectorSection({
  document,
  items,
  onCopyText,
  onNavigateSourceLine,
  onOpenInclude,
  onShowNotice,
}: IncludeInspectorSectionProps) {
  const [expanded, setExpanded] = useState(false);
  if (document?.format !== "asciidoc") {
    return null;
  }
  const currentDocument = document;
  const hasItems = items.length > 0;
  const bodyVisible = !hasItems || expanded;

  function handleActivate(item: IncludeInspectorItem) {
    if (item.status === "active" && item.path) {
      void onOpenInclude(item.path);
      return;
    }
    if (item.sourceLine && item.sourcePath === currentDocument.path) {
      onNavigateSourceLine(item.sourceLine);
      return;
    }
    copyReference(item);
  }

  function copyReference(item: IncludeInspectorItem) {
    if (!item.sourceReference) {
      onShowNotice("Include reference is unavailable.", { tone: "warning" });
      return;
    }
    void onCopyText("Include reference", item.sourceReference);
  }

  return (
    <section className="contents-section include-inspector-section">
      <button
        type="button"
        className="contents-section-header"
        data-review-id="include-inspector-toggle"
        aria-expanded={bodyVisible}
        onClick={() => {
          if (hasItems) {
            setExpanded((value) => !value);
          }
        }}
      >
        <span className="contents-section-title">
          {hasItems ? (
            expanded ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )
          ) : null}
          Includes
        </span>
        <span className="contents-section-count">{items.length}</span>
      </button>
      {bodyVisible ? (
        hasItems ? (
          <div className="include-inspector-list">
            {items.map((item) => (
              <div
                key={item.id}
                className="include-inspector-row"
                data-review-id="include-inspector-item"
                style={{ paddingLeft: `${8 + item.depth * 12}px` }}
              >
                <button
                  type="button"
                  className="include-inspector-main"
                  onClick={() => handleActivate(item)}
                >
                  <span className="include-inspector-label">{item.label}</span>
                  <span className="include-inspector-meta">
                    {item.displayPath}
                    {item.sourceLine ? ` · line ${item.sourceLine}` : ""}
                  </span>
                </button>
                <span className={`include-inspector-status ${item.status}`}>
                  {item.status}
                </span>
                <button
                  type="button"
                  className="include-inspector-copy"
                  aria-label="Copy include reference"
                  title="Copy include reference"
                  onClick={() => copyReference(item)}
                >
                  <Copy size={13} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="include-inspector-empty">No includes</p>
        )
      ) : null}
    </section>
  );
}
