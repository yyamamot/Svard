import {
  FileText,
  FolderOpen,
  Hash,
  ListTree,
  Search,
  TerminalSquare,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from "react";
import type { CommandId } from "../../core/commands";

interface QuickOpenFileCandidate {
  type: "file";
  path: string;
  label: string;
  source: "Open file" | "File tree" | "Bookmark";
  kind?: "file" | "directory";
}

export interface QuickOpenCommandCandidate {
  type: "command";
  id: CommandId;
  label: string;
  source: "Command";
  context: string;
  enabled: boolean;
}

export interface QuickOpenHeadingCandidate {
  type: "heading";
  id: string;
  label: string;
  source: "Heading";
  level: number;
  line?: number;
}

export interface QuickOpenSourceLineCandidate {
  type: "sourceLine";
  id: string;
  label: string;
  source: "Source line";
  line: number;
  targetLine: number;
  targetKind: string;
}

export type QuickOpenCandidate =
  | QuickOpenFileCandidate
  | QuickOpenCommandCandidate
  | QuickOpenHeadingCandidate
  | QuickOpenSourceLineCandidate;

export function quickOpenMode(query: string) {
  if (query.startsWith(">")) {
    return {
      placeholder: "Run command",
      empty: "No matching commands",
      label: "Commands",
    };
  }
  if (query.startsWith("@")) {
    return {
      placeholder: "Go to heading",
      empty: "No matching headings",
      label: "Headings",
    };
  }
  if (query.startsWith(":")) {
    return {
      placeholder: "Go to source line",
      empty: "No mapped source line",
      label: "Source line",
    };
  }
  return {
    placeholder: "Open file",
    empty: "No loaded markup files",
    label: "Files",
  };
}

function candidateKey(candidate: QuickOpenCandidate): string {
  if (candidate.type === "file") {
    return `file:${candidate.path}`;
  }
  if (candidate.type === "command") {
    return `command:${candidate.id}`;
  }
  return `${candidate.type}:${candidate.id}`;
}

function candidateTitle(candidate: QuickOpenCandidate): string {
  if (candidate.type === "file") {
    return candidate.path;
  }
  if (candidate.type === "command") {
    return candidate.id;
  }
  if (candidate.type === "sourceLine") {
    return `Line ${candidate.targetLine}`;
  }
  return candidate.id;
}

function candidateMeta(candidate: QuickOpenCandidate): string {
  if (candidate.type === "command") {
    return candidate.enabled
      ? `${candidate.source} · ${candidate.context}`
      : `${candidate.source} · disabled`;
  }
  if (candidate.type === "heading") {
    return candidate.line
      ? `${candidate.source} · h${candidate.level} · line ${candidate.line}`
      : `${candidate.source} · h${candidate.level}`;
  }
  if (candidate.type === "sourceLine") {
    return `${candidate.source} · ${candidate.targetKind}`;
  }
  return candidate.source;
}

function CandidateIcon({ candidate }: { candidate: QuickOpenCandidate }) {
  if (candidate.type === "command") {
    return <TerminalSquare size={15} />;
  }
  if (candidate.type === "heading") {
    return <ListTree size={15} />;
  }
  if (candidate.type === "sourceLine") {
    return <Hash size={15} />;
  }
  return candidate.kind === "directory" ? (
    <FolderOpen size={15} />
  ) : (
    <FileText size={15} />
  );
}

export function QuickOpen({
  candidates,
  query,
  inputRef,
  onChange,
  onClose,
  onOpen,
}: {
  candidates: QuickOpenCandidate[];
  query: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onClose: () => void;
  onOpen: (candidate: QuickOpenCandidate) => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const mode = quickOpenMode(query);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  function openSelected() {
    const selected = candidates[selectedIndex] ?? candidates[0];
    if (selected && (selected.type !== "command" || selected.enabled)) {
      onOpen(selected);
    }
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      openSelected();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((current) =>
        candidates.length > 0 ? (current + 1) % candidates.length : 0,
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((current) =>
        candidates.length > 0
          ? (current - 1 + candidates.length) % candidates.length
          : 0,
      );
    }
  }

  return (
    <div className="modal-backdrop quick-open-backdrop" onClick={onClose}>
      <section
        className="quick-open"
        data-review-id="quick-open"
        aria-label="Quick Open"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="quick-open-header">
          <label className="quick-open-search">
            <Search size={16} />
            <input
              ref={inputRef}
              data-review-id="quick-open-input"
              value={query}
              placeholder={mode.placeholder}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={handleKeyDown}
            />
            <span className="quick-open-mode" data-review-id="quick-open-mode">
              {mode.label}
            </span>
          </label>
          <button
            type="button"
            className="quick-open-close"
            data-review-id="quick-open-close"
            aria-label="Close Quick Open"
            title="Close Quick Open"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        {query.trim() === "" && (
          <div className="quick-open-hints" data-review-id="quick-open-hints">
            <span>Type to open a file</span>
            <span>
              <kbd>&gt;</kbd> Commands
            </span>
            <span>
              <kbd>@</kbd> Headings
            </span>
            <span>
              <kbd>:</kbd> Source line
            </span>
          </div>
        )}
        <div className="quick-open-results">
          {candidates.length > 0 ? (
            candidates.map((candidate, index) => (
              <button
                type="button"
                key={candidateKey(candidate)}
                className={`quick-open-result ${
                  index === selectedIndex ? "active" : ""
                } ${candidate.type === "command" && !candidate.enabled ? "disabled" : ""}`}
                data-review-id="quick-open-result"
                title={candidateTitle(candidate)}
                disabled={candidate.type === "command" && !candidate.enabled}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => onOpen(candidate)}
              >
                <CandidateIcon candidate={candidate} />
                <span>{candidate.label}</span>
                <small>{candidateMeta(candidate)}</small>
              </button>
            ))
          ) : (
            <div className="quick-open-empty">{mode.empty}</div>
          )}
        </div>
      </section>
    </div>
  );
}
