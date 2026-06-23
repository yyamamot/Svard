import { vi } from "vitest";

import { prepareDocumentHtml } from "../../../src/ui/lib/documentHtml";
import type { DocumentPayload, RenderResult } from "../../../src/core/types";

export const documentPayload: DocumentPayload = {
  path: "/workspace/docs/example.adoc",
  basePath: "/workspace/docs",
  format: "asciidoc",
  source: "",
  updatedAt: "2026-05-15T00:00:00.000Z",
};

export const renderResult: Pick<RenderResult, "headings" | "sourceBlocks"> = {
  headings: [
    {
      id: "overview",
      level: 2,
      text: "Overview",
      sourceLocation: { line: 4, column: 1 },
    },
  ],
  sourceBlocks: [
    {
      id: "source-1",
      language: "ts",
      sourceLocation: { line: 12, column: 1 },
    },
  ],
};

export async function collectPrepareDocumentEvents(
  html: string,
  payload: DocumentPayload,
  result: Pick<RenderResult, "headings" | "sourceBlocks">,
) {
  const events: Array<Record<string, unknown>> = [];
  localStorage.setItem("SVARD_PERF_TRACE", "1");
  const infoSpy = vi
    .spyOn(console, "info")
    .mockImplementation((label: unknown, payload: unknown) => {
      if (label === "[perf]" && payload && typeof payload === "object") {
        events.push(payload as Record<string, unknown>);
      }
    });

  try {
    const preparedHtml = await prepareDocumentHtml(
      html,
      payload,
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      result,
    );
    return { events, html: preparedHtml };
  } finally {
    infoSpy.mockRestore();
    localStorage.removeItem("SVARD_PERF_TRACE");
  }
}
