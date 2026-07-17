import { useLayoutEffect, useState } from "react";
import type { CSSProperties, RefObject } from "react";
import type { SearchHitSummary } from "../types";
import {
  activeSearchRulerIndex,
  collectSearchRulerMarkers,
} from "../lib/searchRuler";
import type { SearchRulerMarker } from "../lib/searchRuler";

interface SearchHitRulerProps {
  articleRef: RefObject<HTMLElement | null>;
  query: string;
  searchHits: SearchHitSummary[];
  searchIndex: number;
  onActivateSearchHit: (index: number) => void;
}

export function SearchHitRuler({
  articleRef,
  query,
  searchHits,
  searchIndex,
  onActivateSearchHit,
}: SearchHitRulerProps) {
  const [markers, setMarkers] = useState<SearchRulerMarker[]>([]);
  const [overlayStyle, setOverlayStyle] = useState<CSSProperties | null>(null);
  const trimmedQuery = query.trim();
  const hitCount = searchHits.length;
  const activeIndex = activeSearchRulerIndex(searchIndex, hitCount);

  useLayoutEffect(() => {
    if (!trimmedQuery || hitCount === 0) {
      setMarkers([]);
      return;
    }

    let animationFrame = 0;
    const updateMarkers = () => {
      const article = articleRef.current;
      const pane = article?.closest<HTMLElement>(".viewer-pane") ?? null;
      if (!article || !pane) {
        setMarkers([]);
        setOverlayStyle(null);
        return;
      }

      const paneRect = pane.getBoundingClientRect();
      const scrollbarWidth = Math.max(0, pane.offsetWidth - pane.clientWidth);
      const hitAreaWidth = 24;
      setOverlayStyle({
        top: `${paneRect.top + 10}px`,
        left: `${paneRect.right - scrollbarWidth - hitAreaWidth}px`,
        height: `${Math.max(220, paneRect.height - 20)}px`,
      });
      setMarkers(collectSearchRulerMarkers(article, hitCount));
    };
    animationFrame = window.requestAnimationFrame(updateMarkers);
    const pane = articleRef.current?.closest<HTMLElement>(".viewer-pane");
    pane?.addEventListener("scroll", updateMarkers, { passive: true });
    window.addEventListener("resize", updateMarkers);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      pane?.removeEventListener("scroll", updateMarkers);
      window.removeEventListener("resize", updateMarkers);
    };
  }, [articleRef, hitCount, searchIndex, trimmedQuery]);

  if (
    !trimmedQuery ||
    hitCount === 0 ||
    markers.length === 0 ||
    !overlayStyle
  ) {
    return null;
  }

  return (
    <nav
      className="search-hit-ruler"
      data-review-id="search-hit-ruler"
      aria-label="Search hit ruler"
      style={overlayStyle}
    >
      {markers.map((marker) => {
        const active = marker.index === activeIndex;
        return (
          <button
            key={marker.index}
            type="button"
            className={`search-hit-ruler-marker${active ? " active" : ""}`}
            data-review-id={
              active
                ? "search-hit-ruler-active-marker"
                : "search-hit-ruler-marker"
            }
            aria-label={`Go to search result ${marker.index + 1} of ${hitCount}`}
            aria-current={active ? "true" : undefined}
            style={{ top: `${marker.topPercent}%` }}
            onClick={() => onActivateSearchHit(marker.index)}
          />
        );
      })}
    </nav>
  );
}
