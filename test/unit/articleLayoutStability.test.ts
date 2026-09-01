import { describe, expect, it, vi } from "vitest";

import {
  setArticleLayoutState,
  waitForArticleLayoutStability,
  type ArticleLayoutGeometry,
} from "../../src/ui/lib/articleLayoutStability";

const stableGeometry: ArticleLayoutGeometry = {
  articleClientHeight: 480,
  articleScrollHeight: 960,
  sourceBlocks: [
    {
      frameBottom: 320,
      frameHeight: 180,
      nextTop: 336,
      preClientHeight: 178,
      preClientWidth: 720,
      preScrollHeight: 178,
      preScrollWidth: 1280,
    },
  ],
};

function frameQueue() {
  const callbacks: FrameRequestCallback[] = [];
  return {
    callbacks,
    requestFrame: (callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    },
    runNext: () => callbacks.shift()?.(0),
  };
}

describe("article layout stability", () => {
  it("reports ready after two consecutive stable layout frames", () => {
    const article = document.createElement("article");
    const frames = frameQueue();
    const onComplete = vi.fn();
    const onFrame = vi.fn();
    waitForArticleLayoutStability({
      article,
      isCurrent: () => true,
      measure: () => stableGeometry,
      onComplete,
      onFrame,
      requestFrame: frames.requestFrame,
    });

    frames.runNext();
    expect(onComplete).not.toHaveBeenCalled();
    frames.runNext();
    expect(onComplete).toHaveBeenCalledWith("ready", stableGeometry);
    expect(onFrame).toHaveBeenNthCalledWith(1, 1, stableGeometry, 1);
    expect(onFrame).toHaveBeenNthCalledWith(2, 2, stableGeometry, 2);
  });

  it("times out without hiding the article when geometry keeps changing", () => {
    const article = document.createElement("article");
    const frames = frameQueue();
    const onComplete = vi.fn();
    let height = 100;
    waitForArticleLayoutStability({
      article,
      isCurrent: () => true,
      maxFrames: 3,
      measure: () => ({
        ...stableGeometry,
        articleScrollHeight: height++,
      }),
      onComplete,
      requestFrame: frames.requestFrame,
    });

    frames.runNext();
    frames.runNext();
    frames.runNext();
    expect(onComplete).toHaveBeenCalledWith(
      "timeout",
      expect.objectContaining({ articleScrollHeight: 102 }),
    );
    expect(article.style.visibility).toBe("");
  });

  it("drops a stale wait and emits only terminal layout states", () => {
    const article = document.createElement("article");
    const frames = frameQueue();
    const onComplete = vi.fn();
    const listener = vi.fn();
    article.addEventListener("svard:article-layout-state", listener);
    setArticleLayoutState(article, "4", "pending");
    let current = true;
    waitForArticleLayoutStability({
      article,
      isCurrent: () => current,
      measure: () => stableGeometry,
      onComplete,
      requestFrame: frames.requestFrame,
    });
    current = false;
    frames.runNext();

    expect(onComplete).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
    expect(article.dataset.layoutState).toBe("pending");
  });
});
