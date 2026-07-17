export interface SearchRulerMarker {
  index: number;
  topPercent: number;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, value));
}

export function activeSearchRulerIndex(
  searchIndex: number,
  hitCount: number,
): number | null {
  if (hitCount <= 0) {
    return null;
  }
  return ((searchIndex % hitCount) + hitCount) % hitCount;
}

export function collectSearchRulerMarkers(
  article: HTMLElement | null,
  hitCount: number,
): SearchRulerMarker[] {
  if (!article || hitCount <= 0) {
    return [];
  }

  const articleRect = article.getBoundingClientRect();
  const documentHeight = Math.max(article.scrollHeight, articleRect.height, 1);
  return Array.from(
    article.querySelectorAll<HTMLElement>(
      "mark.search-hit[data-search-hit-index]",
    ),
  )
    .map((hit) => {
      const rawIndex = Number(hit.dataset.searchHitIndex);
      if (!Number.isInteger(rawIndex) || rawIndex < 0 || rawIndex >= hitCount) {
        return null;
      }
      const rect = hit.getBoundingClientRect();
      const center = rect.top - articleRect.top + rect.height / 2;
      return {
        index: rawIndex,
        topPercent: clampPercent((center / documentHeight) * 100),
      };
    })
    .filter((marker): marker is SearchRulerMarker => marker !== null)
    .sort((left, right) => left.index - right.index);
}
