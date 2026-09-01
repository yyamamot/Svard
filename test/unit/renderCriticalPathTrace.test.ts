import { afterEach, describe, expect, it, vi } from "vitest";

import { perfNow } from "../../src/ui/lib/perfTrace";
import { traceCommittedImageDecode } from "../../src/ui/lib/renderCriticalPathTrace";

function collectPerfEvents() {
  const events: Array<Record<string, unknown>> = [];
  const infoSpy = vi
    .spyOn(console, "info")
    .mockImplementation((label: unknown, payload: unknown) => {
      if (label === "[perf]" && payload && typeof payload === "object") {
        events.push(payload as Record<string, unknown>);
      }
    });
  return { events, infoSpy };
}

describe("render critical path trace", () => {
  afterEach(() => {
    localStorage.removeItem("SVARD_PERF_TRACE");
    vi.restoreAllMocks();
  });

  it("publishes aggregate image decode completion without image data", async () => {
    localStorage.setItem("SVARD_PERF_TRACE", "1");
    const { events } = collectPerfEvents();
    const article = document.createElement("article");
    article.innerHTML =
      '<img src="data:image/png;base64,private-one"><img src="data:image/png;base64,private-two">';
    const images = Array.from(article.querySelectorAll("img"));
    Object.defineProperty(images[0], "decode", {
      configurable: true,
      value: vi.fn(async () => undefined),
    });
    Object.defineProperty(images[1], "decode", {
      configurable: true,
      value: vi.fn(async () => {
        throw new Error("decode failed");
      }),
    });

    await traceCommittedImageDecode({
      article,
      commitCompletedAt: perfNow(),
      isCurrent: () => true,
    });

    const event = events.find(
      (candidate) => candidate.event === "render.imageDecode.complete",
    );
    expect(event).toEqual(
      expect.objectContaining({
        imageCount: 2,
        decodedCount: 1,
        errorCount: 1,
        status: "partial",
      }),
    );
    expect(typeof event?.durationMs).toBe("number");
    expect(JSON.stringify(event)).not.toContain("private-one");
    expect(JSON.stringify(event)).not.toContain("private-two");
  });

  it("does not enumerate or decode images when tracing is disabled", () => {
    const article = document.createElement("article");
    article.innerHTML = '<img src="data:image/png;base64,private">';
    const querySelectorAll = vi.spyOn(article, "querySelectorAll");

    const pending = traceCommittedImageDecode({
      article,
      commitCompletedAt: perfNow(),
      isCurrent: () => true,
    });

    expect(pending).toBeNull();
    expect(querySelectorAll).not.toHaveBeenCalled();
  });
});
