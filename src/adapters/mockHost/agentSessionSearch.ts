import type { AgentSessionListInput } from "../../core/types";
import type { MockAgentSessionRecord } from "./agentTitle";

function normalizeQuery(query: string | null | undefined): string[] {
  const normalized = (query ?? "").trim();
  if (
    Array.from(normalized).length > 120 ||
    Array.from(normalized).some(
      (character) => /\p{Cc}/u.test(character) && !/\s/u.test(character),
    )
  ) {
    throw new Error("The chat history search is invalid.");
  }
  return normalized
    .split(/\s+/u)
    .filter(Boolean)
    .map((term) => term.toLocaleLowerCase());
}

function searchScope(input: AgentSessionListInput, terms: string[]): string {
  const value = [
    input.providerId,
    input.workspaceRoot,
    input.archived ?? false,
    terms.join("\u0000"),
    input.updatedAtFrom ?? "",
    input.updatedAtBefore ?? "",
  ].join("\u0001");
  let hash = 0x811c9dc5;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function cursorOffset(
  cursor: string | null | undefined,
  scope: string,
): number {
  if (!cursor) return 0;
  const match = /^mock-search:([0-9a-f]{8}):([0-9]+)$/u.exec(cursor);
  if (!match || match[1] !== scope) {
    throw new Error("The chat history cursor is invalid.");
  }
  return Number.parseInt(match[2], 10);
}

export function searchMockAgentSessions(
  records: MockAgentSessionRecord[],
  input: AgentSessionListInput,
) {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const archived = input.archived ?? false;
  const terms = normalizeQuery(input.query);
  const searchSupported = !(
    globalThis as typeof globalThis & {
      __SVARD_AGENT_SESSION_SEARCH_UNSUPPORTED__?: boolean;
    }
  ).__SVARD_AGENT_SESSION_SEARCH_UNSUPPORTED__;
  if (
    !searchSupported &&
    (terms.length ||
      input.updatedAtFrom != null ||
      input.updatedAtBefore != null)
  ) {
    throw new Error("Chat history search is unavailable.");
  }
  if (
    input.updatedAtFrom != null &&
    input.updatedAtBefore != null &&
    input.updatedAtFrom >= input.updatedAtBefore
  ) {
    throw new Error("The chat history date filter is invalid.");
  }
  const scope = searchScope(input, terms);
  const offset = cursorOffset(input.cursor, scope);
  const matches = records
    .filter(
      (record) =>
        record.input.providerId === input.providerId &&
        record.input.workspaceRoot === input.workspaceRoot &&
        record.archived === archived &&
        (input.updatedAtFrom == null ||
          record.updatedAt >= input.updatedAtFrom) &&
        (input.updatedAtBefore == null ||
          record.updatedAt < input.updatedAtBefore) &&
        terms.every((term) => record.title.toLocaleLowerCase().includes(term)),
    )
    .sort(
      (left, right) =>
        right.updatedAt - left.updatedAt ||
        right.input.clientSessionId.localeCompare(left.input.clientSessionId),
    );
  const page = matches.slice(offset, offset + limit);
  return {
    page,
    searchSupported,
    nextCursor:
      offset + page.length < matches.length
        ? `mock-search:${scope}:${offset + page.length}`
        : null,
  };
}
