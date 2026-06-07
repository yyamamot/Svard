import { useMemo } from "react";
import {
  commandDefinitions,
  type CommandDefinition,
} from "../../core/commands";
import { bookmarkName } from "../../core/bookmarks";
import { isSupportedDocumentPath } from "../../core/documentFormat";
import type {
  AppConfig,
  DirectoryEntry,
  DocumentPayload,
  Heading,
  RenderDiagnostic,
  RenderResult,
  SourceBlock,
} from "../../core/types";
import type { QuickOpenCandidate } from "../components/QuickOpen";
import { fileName } from "../lib/path";

interface UseQuickOpenCandidatesOptions {
  bookmarks: AppConfig["workspace"]["bookmarks"];
  childrenByDirectory: Record<string, DirectoryEntry[]>;
  commandEnabled: (commandId: CommandDefinition["id"]) => boolean;
  documentPayload: DocumentPayload | null;
  quickOpenQuery: string;
  recentDocuments: AppConfig["workspace"]["recentDocuments"];
  renderResult: RenderResult | null;
  tabs: DocumentPayload[];
}

interface BuildQuickOpenCandidatesOptions extends UseQuickOpenCandidatesOptions {
  commandList?: CommandDefinition[];
}

interface SourceLineTarget {
  id: string;
  label: string;
  line: number;
  targetKind: string;
}

function stripPrefix(query: string): string {
  return query.slice(1).trim().toLowerCase();
}

function matches(text: string, query: string): boolean {
  return !query || text.toLowerCase().includes(query);
}

const commandSearchAliases: Partial<Record<CommandDefinition["id"], string[]>> =
  {
    "help.openWebsite": [
      "website",
      "home page",
      "homepage",
      "docs",
      "svard website",
    ],
    "viewer.showShortcuts": [
      "help",
      "shortcuts",
      "keyboard shortcuts",
      "mouse gestures",
      "viewer help",
    ],
  };

function fileCandidates({
  bookmarks,
  childrenByDirectory,
  quickOpenQuery,
  recentDocuments,
  tabs,
}: BuildQuickOpenCandidatesOptions): QuickOpenCandidate[] {
  const byPath = new Map<string, QuickOpenCandidate>();

  for (const tab of tabs) {
    byPath.set(tab.path, {
      type: "file",
      path: tab.path,
      label: fileName(tab.path),
      source: "Open file",
      kind: "file",
    });
  }

  for (const bookmark of bookmarks) {
    byPath.set(bookmark.path, {
      type: "file",
      path: bookmark.path,
      label: bookmarkName(bookmark),
      source: "Bookmark",
      kind: bookmark.kind,
    });
  }

  for (const recent of recentDocuments) {
    if (!byPath.has(recent.path)) {
      byPath.set(recent.path, {
        type: "file",
        path: recent.path,
        label: recent.name ?? fileName(recent.path),
        source: "File tree",
        kind: "file",
      });
    }
  }

  for (const entries of Object.values(childrenByDirectory)) {
    for (const entry of entries) {
      if (entry.kind === "file" && isSupportedDocumentPath(entry.path)) {
        const existing = byPath.get(entry.path);
        byPath.set(entry.path, {
          type: "file",
          path: entry.path,
          label: existing?.label ?? entry.name,
          source: existing?.type === "file" ? existing.source : "File tree",
          kind: "file",
        });
      }
    }
  }

  const normalizedQuery = quickOpenQuery.trim().toLowerCase();
  return [...byPath.values()]
    .filter(
      (candidate) =>
        candidate.type === "file" &&
        (!normalizedQuery ||
          candidate.label.toLowerCase().includes(normalizedQuery) ||
          candidate.path.toLowerCase().includes(normalizedQuery)),
    )
    .sort((left, right) => left.label.localeCompare(right.label))
    .slice(0, 12);
}

function commandCandidates({
  commandEnabled,
  commandList = commandDefinitions,
  quickOpenQuery,
}: BuildQuickOpenCandidatesOptions): QuickOpenCandidate[] {
  const query = stripPrefix(quickOpenQuery);
  return commandList
    .filter(
      (command) =>
        matches(command.title, query) ||
        matches(command.id, query) ||
        (commandSearchAliases[command.id] ?? []).some((alias) =>
          matches(alias, query),
        ),
    )
    .map((command) => ({
      type: "command" as const,
      id: command.id,
      label: command.title,
      source: "Command" as const,
      context: command.context,
      enabled: commandEnabled(command.id),
    }))
    .slice(0, 12);
}

function headingCandidates({
  quickOpenQuery,
  renderResult,
}: BuildQuickOpenCandidatesOptions): QuickOpenCandidate[] {
  const query = stripPrefix(quickOpenQuery);
  return (renderResult?.headings ?? [])
    .filter(
      (heading) => matches(heading.text, query) || matches(heading.id, query),
    )
    .map((heading) => ({
      type: "heading" as const,
      id: heading.id,
      label: heading.text,
      source: "Heading" as const,
      level: heading.level,
      line: heading.sourceLocation?.line,
    }))
    .slice(0, 12);
}

function sourceLineTargets(
  renderResult: RenderResult | null,
): SourceLineTarget[] {
  const targets: SourceLineTarget[] = [];
  const add = (
    item: Heading | SourceBlock | RenderDiagnostic,
    targetKind: string,
    label: string,
  ) => {
    const line = item.sourceLocation?.line;
    if (!line) {
      return;
    }
    targets.push({
      id: `${targetKind}:${"id" in item ? item.id : line}`,
      label,
      line,
      targetKind,
    });
  };

  for (const heading of renderResult?.headings ?? []) {
    add(heading, "heading", heading.text);
  }
  for (const sourceBlock of renderResult?.sourceBlocks ?? []) {
    add(sourceBlock, "source block", sourceBlock.language ?? "Source block");
  }
  for (const diagnostic of renderResult?.diagnostics ?? []) {
    add(diagnostic, "diagnostic", diagnostic.message);
  }
  for (const slot of renderResult?.diagramSlots ?? []) {
    const line = slot.sourceLocation?.line;
    if (line) {
      targets.push({
        id: `diagram:${slot.id}`,
        label: `${slot.diagramType} diagram`,
        line,
        targetKind: "diagram",
      });
    }
  }
  return targets;
}

function sourceLineCandidate(
  options: BuildQuickOpenCandidatesOptions,
): QuickOpenCandidate[] {
  const requestedLine = Number.parseInt(
    stripPrefix(options.quickOpenQuery),
    10,
  );
  if (!Number.isInteger(requestedLine) || requestedLine <= 0) {
    return [];
  }

  const target = sourceLineTargets(options.renderResult)
    .sort(
      (left, right) =>
        Math.abs(left.line - requestedLine) -
        Math.abs(right.line - requestedLine),
    )
    .at(0);

  if (!target) {
    return [];
  }

  return [
    {
      type: "sourceLine",
      id: `line:${requestedLine}:${target.id}`,
      label: `Line ${requestedLine} -> ${target.label}`,
      source: "Source line",
      line: requestedLine,
      targetLine: target.line,
      targetKind: target.targetKind,
    },
  ];
}

export function buildQuickOpenCandidates(
  options: BuildQuickOpenCandidatesOptions,
): QuickOpenCandidate[] {
  if (options.quickOpenQuery.startsWith(">")) {
    return commandCandidates(options);
  }
  if (options.quickOpenQuery.startsWith("@")) {
    return headingCandidates(options);
  }
  if (options.quickOpenQuery.startsWith(":")) {
    return sourceLineCandidate(options);
  }
  return fileCandidates(options);
}

export function useQuickOpenCandidates(
  options: UseQuickOpenCandidatesOptions,
): QuickOpenCandidate[] {
  return useMemo(
    () => buildQuickOpenCandidates(options),
    [
      options.bookmarks,
      options.childrenByDirectory,
      options.commandEnabled,
      options.documentPayload,
      options.quickOpenQuery,
      options.recentDocuments,
      options.renderResult,
      options.tabs,
    ],
  );
}
