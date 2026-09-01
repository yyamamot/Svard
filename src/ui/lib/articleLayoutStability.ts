export const articleLayoutStateEvent = "svard:article-layout-state";
export const articleLayoutStableFrames = 2;
export const articleLayoutMaxFrames = 12;

export type ArticleLayoutState = "pending" | "ready" | "timeout";

export interface ArticleLayoutGeometry {
  articleClientHeight: number;
  articleScrollHeight: number;
  sourceBlocks: Array<{
    frameBottom: number;
    frameHeight: number;
    nextTop: number | null;
    preClientHeight: number;
    preClientWidth: number;
    preScrollHeight: number;
    preScrollWidth: number;
  }>;
}

interface WaitForArticleLayoutOptions {
  article: HTMLElement;
  isCurrent: () => boolean;
  maxFrames?: number;
  requestFrame?: (callback: FrameRequestCallback) => number;
  cancelFrame?: (handle: number) => void;
  measure?: (article: HTMLElement) => ArticleLayoutGeometry;
  onComplete: (
    state: Exclude<ArticleLayoutState, "pending">,
    geometry: ArticleLayoutGeometry,
  ) => void;
  onFrame?: (
    frameCount: number,
    geometry: ArticleLayoutGeometry,
    stableCount: number,
  ) => void;
  stableFrames?: number;
}

export function measureArticleLayout(
  article: HTMLElement,
): ArticleLayoutGeometry {
  const sourceBlocks = Array.from(
    article.querySelectorAll<HTMLElement>(".source-block-frame"),
  ).map((frame) => {
    const pre = frame.querySelector<HTMLElement>("pre");
    const outerBlock =
      frame.closest<HTMLElement>(".listingblock,.literalblock") ?? frame;
    const next = outerBlock.nextElementSibling;
    const frameRect = frame.getBoundingClientRect();
    return {
      frameBottom: frameRect.bottom,
      frameHeight: frameRect.height,
      nextTop:
        next instanceof HTMLElement ? next.getBoundingClientRect().top : null,
      preClientHeight: pre?.clientHeight ?? 0,
      preClientWidth: pre?.clientWidth ?? 0,
      preScrollHeight: pre?.scrollHeight ?? 0,
      preScrollWidth: pre?.scrollWidth ?? 0,
    };
  });
  return {
    articleClientHeight: article.clientHeight,
    articleScrollHeight: article.scrollHeight,
    sourceBlocks,
  };
}

export function waitForArticleLayoutStability({
  article,
  isCurrent,
  maxFrames = articleLayoutMaxFrames,
  requestFrame = window.requestAnimationFrame.bind(window),
  cancelFrame = window.cancelAnimationFrame.bind(window),
  measure = measureArticleLayout,
  onComplete,
  onFrame,
  stableFrames = articleLayoutStableFrames,
}: WaitForArticleLayoutOptions) {
  let cancelled = false;
  let frameCount = 0;
  let stableCount = 0;
  let previous: ArticleLayoutGeometry | null = null;
  let handle = 0;

  const check = () => {
    if (cancelled || !isCurrent()) return;
    frameCount += 1;
    const geometry = measure(article);
    stableCount =
      previous && sameGeometry(previous, geometry) ? stableCount + 1 : 1;
    previous = geometry;
    onFrame?.(frameCount, geometry, stableCount);
    if (stableCount >= stableFrames) {
      onComplete("ready", geometry);
      return;
    }
    if (frameCount >= maxFrames) {
      onComplete("timeout", geometry);
      return;
    }
    handle = requestFrame(check);
  };

  handle = requestFrame(check);
  return () => {
    cancelled = true;
    cancelFrame(handle);
  };
}

export function setArticleLayoutState(
  article: HTMLElement,
  revision: string,
  state: ArticleLayoutState,
) {
  article.dataset.layoutRevision = revision;
  article.dataset.layoutState = state;
  if (state !== "pending") {
    article.dispatchEvent(
      new CustomEvent(articleLayoutStateEvent, {
        detail: { revision, state },
      }),
    );
  }
}

function sameGeometry(
  left: ArticleLayoutGeometry,
  right: ArticleLayoutGeometry,
) {
  if (
    left.articleClientHeight !== right.articleClientHeight ||
    left.articleScrollHeight !== right.articleScrollHeight ||
    left.sourceBlocks.length !== right.sourceBlocks.length
  ) {
    return false;
  }
  return left.sourceBlocks.every((block, index) => {
    const other = right.sourceBlocks[index];
    return (
      near(block.frameBottom, other.frameBottom) &&
      near(block.frameHeight, other.frameHeight) &&
      nullableNear(block.nextTop, other.nextTop) &&
      block.preClientHeight === other.preClientHeight &&
      block.preClientWidth === other.preClientWidth &&
      block.preScrollHeight === other.preScrollHeight &&
      block.preScrollWidth === other.preScrollWidth
    );
  });
}

function near(left: number, right: number) {
  return Math.abs(left - right) <= 0.5;
}

function nullableNear(left: number | null, right: number | null) {
  return left === null || right === null ? left === right : near(left, right);
}
