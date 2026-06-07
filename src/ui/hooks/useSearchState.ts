import { useEffect, useRef } from "react";
import type {
  Dispatch,
  KeyboardEvent as ReactKeyboardEvent,
  RefObject,
  SetStateAction,
} from "react";
import type { AppConfig, DocumentPayload } from "../../core/types";
import type { RightSidebarTab, SearchHitSummary } from "../types";
import {
  previousHeadingLabel,
  sameSearchHits,
  searchSnippet,
} from "../lib/search";
import { expandCollapsedSectionsContaining } from "../lib/sectionCollapse";
import type { SafeHtml } from "../lib/safeHtml";

interface UseSearchStateOptions {
  articleRef: RefObject<HTMLElement | null>;
  config: AppConfig | null;
  documentPayload: DocumentPayload | null;
  documentHtml: SafeHtml;
  matchCount: number;
  persistWorkspace: (partial: Partial<AppConfig["workspace"]>) => Promise<void>;
  query: string;
  searchIndex: number;
  setQuery: (query: string) => void;
  setRightSidebarTab: (tab: RightSidebarTab) => void;
  setSearchHits: Dispatch<SetStateAction<SearchHitSummary[]>>;
  setSearchIndex: Dispatch<SetStateAction<number>>;
  setTabQueries: Dispatch<SetStateAction<Record<string, string>>>;
  showLightweightActionFeedback: (message: string) => void;
}

export function useSearchState({
  articleRef,
  config,
  documentPayload,
  documentHtml,
  matchCount,
  persistWorkspace,
  query,
  searchIndex,
  setQuery,
  setRightSidebarTab,
  setSearchHits,
  setSearchIndex,
  setTabQueries,
  showLightweightActionFeedback,
}: UseSearchStateOptions) {
  const shouldScrollSearchHitRef = useRef(false);
  const documentPath = documentPayload?.path ?? null;

  useEffect(() => {
    const article = articleRef.current;
    if (!article) {
      return;
    }

    // The viewer owns sanitized rendered HTML outside React's virtual DOM.
    // Search marks must be removed before each new highlight pass so html
    // updates and query changes never stack nested <mark> elements.
    article.querySelectorAll("mark.search-hit").forEach((mark) => {
      mark.replaceWith(document.createTextNode(mark.textContent ?? ""));
    });
    article.normalize();

    if (documentPath && article.dataset.renderedDocumentPath !== documentPath) {
      setSearchHits((currentHits) =>
        currentHits.length === 0 ? currentHits : [],
      );
      return;
    }

    if (!query.trim()) {
      setSearchHits((currentHits) =>
        currentHits.length === 0 ? currentHits : [],
      );
      return;
    }

    const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      if (node.nodeValue?.toLowerCase().includes(query.toLowerCase())) {
        textNodes.push(node);
      }
    }

    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(escaped, "gi");
    textNodes.forEach((node) => {
      const fragment = document.createDocumentFragment();
      const source = node.nodeValue ?? "";
      let cursor = 0;
      for (const match of source.matchAll(pattern)) {
        const index = match.index ?? 0;
        fragment.append(document.createTextNode(source.slice(cursor, index)));
        const mark = document.createElement("mark");
        mark.className = "search-hit";
        mark.setAttribute("data-review-id", "search-hit");
        mark.textContent = match[0];
        fragment.append(mark);
        cursor = index + match[0].length;
      }
      fragment.append(document.createTextNode(source.slice(cursor)));
      node.replaceWith(fragment);
    });

    const hits = article.querySelectorAll("mark.search-hit");
    if (hits.length === 0) {
      setSearchHits((currentHits) =>
        currentHits.length === 0 ? currentHits : [],
      );
      return;
    }
    const activeIndex = searchIndex % hits.length;
    const nextHits = [...hits].map((hit, index) => {
      hit.setAttribute("data-search-hit-index", String(index));
      return {
        index,
        heading: previousHeadingLabel(hit, article),
        snippet: searchSnippet(hit),
      };
    });
    setSearchHits((currentHits) =>
      sameSearchHits(currentHits, nextHits) ? currentHits : nextHits,
    );
    hits.forEach((hit, index) => {
      hit.classList.toggle("active", index === activeIndex);
    });
    if (shouldScrollSearchHitRef.current) {
      shouldScrollSearchHitRef.current = false;
      expandCollapsedSectionsContaining(hits[activeIndex] ?? null);
      hits[activeIndex]?.scrollIntoView({
        block: "center",
        behavior: "auto",
      });
    }
  }, [
    articleRef,
    documentHtml,
    documentPath,
    query,
    searchIndex,
    setSearchHits,
  ]);

  function updateQuery(value: string) {
    shouldScrollSearchHitRef.current = true;
    setQuery(value);
    setSearchIndex(0);
    if (documentPayload) {
      setTabQueries((current) => {
        if (value.trim()) {
          return {
            ...current,
            [documentPayload.path]: value,
          };
        }
        const next = { ...current };
        delete next[documentPayload.path];
        return next;
      });
    }
  }

  async function pinQuery() {
    await persistWorkspace({ pinnedSearch: query || null });
    showLightweightActionFeedback(
      query ? "Search pinned" : "Pinned search cleared",
    );
  }

  async function clearSearch() {
    updateQuery("");
    if (config?.workspace.pinnedSearch) {
      await persistWorkspace({ pinnedSearch: null });
      showLightweightActionFeedback("Pinned search cleared");
    }
  }

  function updateSearchIndex(delta: number) {
    shouldScrollSearchHitRef.current = true;
    setSearchIndex((current) =>
      matchCount > 0 ? (current + delta + matchCount) % matchCount : 0,
    );
  }

  function handleSearchInputKeyDown(
    event: ReactKeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    updateSearchIndex(event.shiftKey ? -1 : 1);
  }

  function activateSearchHit(index: number) {
    if (matchCount === 0) {
      return;
    }

    const nextIndex = (index + matchCount) % matchCount;
    shouldScrollSearchHitRef.current = true;
    setSearchIndex(nextIndex);
    setRightSidebarTab("search");
    requestAnimationFrame(() => {
      const target = articleRef.current?.querySelector(
        `mark.search-hit[data-search-hit-index="${nextIndex}"]`,
      );
      expandCollapsedSectionsContaining(target ?? null);
      target?.scrollIntoView({ block: "center", behavior: "auto" });
    });
  }

  return {
    activateSearchHit,
    clearSearch,
    handleSearchInputKeyDown,
    pinQuery,
    updateQuery,
    updateSearchIndex,
  };
}
