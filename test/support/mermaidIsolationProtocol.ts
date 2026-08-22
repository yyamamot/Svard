export const MERMAID_ISOLATION_PROTOCOL_VERSION = 1;
export const MERMAID_ISOLATION_MAX_COUNT = 16;
export const MERMAID_ISOLATION_MAX_SOURCE_BYTES = 16 * 1024;
export const MERMAID_ISOLATION_MAX_AGGREGATE_SOURCE_BYTES = 64 * 1024;
export const MERMAID_ISOLATION_MAX_SVG_BYTES = 2 * 1024 * 1024;
export const MERMAID_ISOLATION_MAX_AGGREGATE_SVG_BYTES = 8 * 1024 * 1024;
export const MERMAID_ISOLATION_DEADLINE_MS = 5_000;

export type RendererRequest =
  | {
      type: "render";
      protocolVersion: 1;
      requestId: string;
      scope: string;
      source: string;
    }
  | {
      type: "busy";
      protocolVersion: 1;
      requestId: string;
      scope: string;
      durationMs: number;
    };

export type RendererResponse =
  | {
      type: "ready";
      protocolVersion: 1;
      scope: string;
    }
  | {
      type: "started";
      protocolVersion: 1;
      requestId: string;
      scope: string;
    }
  | {
      type: "result";
      protocolVersion: 1;
      requestId: string;
      scope: string;
      status: "rendered" | "blocked" | "error";
      svg?: string;
    };

export function createProbeScope(cryptoSource: Crypto = crypto) {
  const bytes = new Uint8Array(16);
  cryptoSource.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join(
    "",
  );
}

export function isRendererResponse(
  value: unknown,
  scope: string,
): value is RendererResponse {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (
    record.protocolVersion !== MERMAID_ISOLATION_PROTOCOL_VERSION ||
    record.scope !== scope
  ) {
    return false;
  }
  if (record.type === "ready") {
    return Object.keys(record).length === 3;
  }
  if (
    (record.type !== "started" && record.type !== "result") ||
    typeof record.requestId !== "string" ||
    record.requestId.length === 0 ||
    record.requestId.length > 96
  ) {
    return false;
  }
  if (record.type === "started") {
    return Object.keys(record).length === 4;
  }
  if (
    record.status !== "rendered" &&
    record.status !== "blocked" &&
    record.status !== "error"
  ) {
    return false;
  }
  if (record.svg !== undefined && typeof record.svg !== "string") {
    return false;
  }
  if (record.status === "rendered" && typeof record.svg !== "string") {
    return false;
  }
  if (record.status !== "rendered" && record.svg !== undefined) {
    return false;
  }
  return Object.keys(record).every((key) =>
    ["type", "protocolVersion", "requestId", "scope", "status", "svg"].includes(
      key,
    ),
  );
}

export function utf8Bytes(value: string, stopAfter = Number.MAX_SAFE_INTEGER) {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const current = value.charCodeAt(index);
    if (current <= 0x7f) bytes += 1;
    else if (current <= 0x7ff) bytes += 2;
    else if (current >= 0xd800 && current <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else bytes += 3;
    } else bytes += 3;
    if (bytes > stopAfter) return stopAfter + 1;
  }
  return bytes;
}
