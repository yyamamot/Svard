export interface PaneAnchor {
  syncIndex: string;
  changeIndex: string | null;
  top: number;
  height: number;
}

export interface ResolveAnchoredScrollOptions {
  selector?: string;
  fallbackScrollTop: number;
  preferChangeAnchors?: boolean;
}

const defaultAnchorSelector = "[data-sync-index]";

export function collectPaneAnchors(
  container: HTMLElement,
  selector = defaultAnchorSelector,
): PaneAnchor[] {
  const containerRect = container.getBoundingClientRect();
  return Array.from(container.querySelectorAll<HTMLElement>(selector))
    .map((element) => {
      const syncIndex = element.dataset.syncIndex;
      if (!syncIndex) {
        return null;
      }
      const rect = element.getBoundingClientRect();
      return {
        syncIndex,
        changeIndex: element.dataset.changeIndex ?? null,
        top: rect.top - containerRect.top,
        height: rect.height,
      };
    })
    .filter((anchor): anchor is PaneAnchor => anchor !== null);
}

export function resolveAnchoredScrollTop(
  source: HTMLElement,
  target: HTMLElement,
  options: ResolveAnchoredScrollOptions,
): number {
  const sourceAnchors = collectPaneAnchors(source, options.selector);
  const targetAnchors = collectPaneAnchors(target, options.selector);
  const sourceAnchor = chooseSourceAnchor(source, sourceAnchors, {
    preferChangeAnchors: options.preferChangeAnchors ?? true,
  });
  if (!sourceAnchor) {
    return options.fallbackScrollTop;
  }

  const targetAnchor = targetAnchors.find(
    (anchor) => anchor.syncIndex === sourceAnchor.syncIndex,
  );
  if (!targetAnchor) {
    return options.fallbackScrollTop;
  }

  return clampScrollTop(
    target.scrollTop + targetAnchor.top - sourceAnchor.top,
    target,
  );
}

function chooseSourceAnchor(
  container: HTMLElement,
  anchors: PaneAnchor[],
  { preferChangeAnchors }: { preferChangeAnchors: boolean },
): PaneAnchor | null {
  if (anchors.length === 0) {
    return null;
  }

  const visible = anchors.filter(
    (anchor) =>
      anchor.top + anchor.height >= 0 && anchor.top <= container.clientHeight,
  );
  const visibleChanged = visible.filter(
    (anchor) => anchor.changeIndex !== null,
  );
  const ranked =
    preferChangeAnchors && visibleChanged.length > 0
      ? visibleChanged
      : visible.length > 0
        ? visible
        : anchors;
  return ranked.reduce((best, anchor) =>
    anchorScore(anchor) < anchorScore(best) ? anchor : best,
  );
}

function anchorScore(anchor: PaneAnchor): number {
  if (anchor.top >= 0) {
    return anchor.top;
  }
  return Math.abs(anchor.top) + 10000;
}

function clampScrollTop(value: number, container: HTMLElement): number {
  const maxScrollTop = Math.max(
    0,
    container.scrollHeight - container.clientHeight,
  );
  return Math.max(0, Math.min(value, maxScrollTop));
}
