import { describe, expect, it } from "vitest";
import type {
  DocumentMediaSnapshot,
  DocumentSelectionSnapshot,
} from "../../src/core/types";
import { appendAgentQuotedContext } from "../../src/ui/agent/agentQuotedContext";

function selection(
  snapshotId: string,
  text = snapshotId,
): DocumentSelectionSnapshot {
  return {
    snapshotId,
    documentPath: "docs/guide.md",
    documentRevision: "revision",
    plainText: text,
    blocks: [
      {
        type: "prose",
        role: "paragraph",
        markdown: text,
        plainText: text,
      },
    ],
    imageResources: [],
    provenance: [],
    diagnostics: [],
  };
}

function media(snapshotId: string, byteLength = 3): DocumentMediaSnapshot {
  return {
    snapshotId,
    contextType: "media",
    documentPath: "docs/guide.md",
    documentRevision: "revision",
    displayLabel: snapshotId,
    mediaKind: "image",
    visual: {
      imageId: `${snapshotId}:image`,
      displayLabel: snapshotId,
      mediaType: "image/png",
      base64: "cG5n",
      byteLength,
    },
    defaultMode: "visual",
    diagnostics: [],
  };
}

describe("Agent quoted context transaction", () => {
  it("preserves selection and media insertion order", () => {
    const first = appendAgentQuotedContext([], selection("selection-1"));
    expect(first.ok).toBe(true);
    const second = appendAgentQuotedContext(
      first.ok ? first.contexts : [],
      media("media-1"),
    );
    const third = appendAgentQuotedContext(
      second.ok ? second.contexts : [],
      selection("selection-2"),
    );

    expect(third).toEqual({
      ok: true,
      contexts: [
        expect.objectContaining({ snapshotId: "selection-1" }),
        expect.objectContaining({ snapshotId: "media-1" }),
        expect.objectContaining({ snapshotId: "selection-2" }),
      ],
    });
  });

  it("rejects duplicates and leaves the previous collection unchanged", () => {
    const current = [selection("selection-1")];
    const result = appendAgentQuotedContext(current, selection("selection-1"));

    expect(result).toEqual({
      ok: false,
      message: "This content is already attached.",
    });
    expect(current).toHaveLength(1);
  });

  it("shares the eight item and four image limits", () => {
    const eight = Array.from({ length: 8 }, (_, index) =>
      selection(`selection-${index}`),
    );
    expect(
      appendAgentQuotedContext(eight, selection("selection-8")),
    ).toMatchObject({
      ok: false,
      message: "Add no more than 8 quoted items to one question.",
    });

    const fourImages = Array.from({ length: 4 }, (_, index) =>
      media(`media-${index}`),
    );
    expect(
      appendAgentQuotedContext(fourImages, media("media-4")),
    ).toMatchObject({
      ok: false,
      message: "Add no more than 4 images to one question.",
    });
  });

  it("rejects blocking diagnostics and oversized text before registration", () => {
    const blocked = selection("blocked");
    blocked.diagnostics.push({
      severity: "blocking",
      code: "imageUnavailable",
      message: "An image in the selection could not be prepared.",
    });
    expect(appendAgentQuotedContext([], blocked)).toMatchObject({
      ok: false,
      message: "An image in the selection could not be prepared.",
    });

    expect(
      appendAgentQuotedContext(
        [],
        selection("large", "x".repeat(1024 * 1024 + 1)),
      ),
    ).toMatchObject({
      ok: false,
      message: "The selected content for this question is larger than 1 MiB.",
    });
  });
});
