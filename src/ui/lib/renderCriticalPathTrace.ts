import { perfDuration, perfTraceEnabled, tracePerf } from "./perfTrace";

interface TraceCommittedImageDecodeOptions {
  article: HTMLElement;
  commitCompletedAt: number;
  isCurrent: () => boolean;
}

/**
 * Observe image decode completion without joining it to the render commit.
 * The probe is entirely disabled outside explicit performance tracing so the
 * normal viewer path does not enumerate images or create decode promises.
 */
export function traceCommittedImageDecode({
  article,
  commitCompletedAt,
  isCurrent,
}: TraceCommittedImageDecodeOptions): Promise<void> | null {
  if (!perfTraceEnabled()) {
    return null;
  }

  const images = Array.from(article.querySelectorAll("img"));
  if (images.length === 0) {
    tracePerf("render.imageDecode.complete", {
      durationMs: perfDuration(commitCompletedAt),
      imageCount: 0,
      decodedCount: 0,
      errorCount: 0,
      status: isCurrent() ? "empty" : "stale",
    });
    return Promise.resolve();
  }

  return Promise.all(
    images.map(async (image) => {
      if (typeof image.decode !== "function") {
        return image.complete;
      }
      try {
        await image.decode();
        return true;
      } catch {
        return false;
      }
    }),
  ).then((results) => {
    const decodedCount = results.filter(Boolean).length;
    const errorCount = results.length - decodedCount;
    const status = !isCurrent()
      ? "stale"
      : errorCount === 0
        ? "ready"
        : "partial";
    tracePerf("render.imageDecode.complete", {
      durationMs: perfDuration(commitCompletedAt),
      imageCount: images.length,
      decodedCount,
      errorCount,
      status,
    });
  });
}
