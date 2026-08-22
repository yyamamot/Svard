import { describe, expect, it } from "vitest";

import {
  MERMAID_ISOLATION_PROTOCOL_VERSION,
  createProbeScope,
  isRendererResponse,
  utf8Bytes,
} from "../support/mermaidIsolationProtocol";

describe("Mermaid isolation research protocol", () => {
  it("creates a 128-bit opaque scope from cryptographic bytes", () => {
    const cryptoSource = {
      getRandomValues<T extends ArrayBufferView | null>(array: T): T {
        const bytes = array as Uint8Array;
        bytes.forEach((_, index) => {
          bytes[index] = index;
        });
        return array;
      },
    } as Crypto;

    expect(createProbeScope(cryptoSource)).toBe(
      "000102030405060708090a0b0c0d0e0f",
    );
  });

  it("accepts only exact response shapes for the current scope", () => {
    const scope = "0".repeat(32);
    expect(
      isRendererResponse(
        {
          type: "result",
          protocolVersion: MERMAID_ISOLATION_PROTOCOL_VERSION,
          requestId: "request-1",
          scope,
          status: "rendered",
          svg: "<svg></svg>",
        },
        scope,
      ),
    ).toBe(true);

    for (const value of [
      null,
      { type: "ready", protocolVersion: 2, scope },
      { type: "ready", protocolVersion: 1, scope: "1".repeat(32) },
      { type: "ready", protocolVersion: 1, scope, extra: true },
      {
        type: "result",
        protocolVersion: 1,
        requestId: "request-1",
        scope,
        status: "blocked",
        svg: "<svg></svg>",
      },
      {
        type: "result",
        protocolVersion: 1,
        requestId: "request-1",
        scope,
        status: "rendered",
      },
    ]) {
      expect(isRendererResponse(value, scope)).toBe(false);
    }
  });

  it("counts UTF-8 bytes and stops immediately beyond the limit", () => {
    expect(utf8Bytes("abc\r\n")).toBe(5);
    expect(utf8Bytes("🙂")).toBe(4);
    expect(utf8Bytes("\ud800")).toBe(3);
    expect(utf8Bytes("🙂", 3)).toBe(4);
  });
});
