import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type {
  AppConfig,
  DocumentDiffPreview,
  DocumentDiffStreamPreview,
  DocumentPayload,
  KrokiRequest,
  KrokiResult,
  LocalImageResolveContext,
  LocalImageResult,
} from "../../../core/types";
import type { DocumentReviewSessionControls } from "../../lib/documentReviewSession";
import { deriveGitRenderedDiffSummary } from "../../lib/gitRenderedDiff";
import type { DiffStreamLoadReason, SectionLoadState } from "./types";

export function useDocumentDiffStreamLoader({
  config,
  confirmedRemoteDiagramKeys,
  documentReviewSession,
  getGitDiffPreview,
  krokiFallbackDiagramKeys,
  loadDocumentContext,
  preview,
  renderDiagram,
  resolveLocalImage,
  streamBodyRef,
}: {
  config: AppConfig | null;
  confirmedRemoteDiagramKeys?: ReadonlySet<string>;
  documentReviewSession: DocumentReviewSessionControls;
  getGitDiffPreview: (path: string) => Promise<DocumentDiffPreview>;
  krokiFallbackDiagramKeys?: ReadonlySet<string>;
  loadDocumentContext?: (
    documentPath: string,
  ) => Promise<Pick<
    DocumentPayload,
    "includeFiles" | "resourceContext" | "asciidocContext"
  > | null>;
  preview: DocumentDiffStreamPreview;
  renderDiagram?: (request: KrokiRequest) => Promise<KrokiResult>;
  resolveLocalImage?: (
    source: string,
    documentPath: string,
    context: LocalImageResolveContext | null | undefined,
  ) => Promise<LocalImageResult>;
  streamBodyRef: RefObject<HTMLDivElement | null>;
}) {
  const [loadStates, setLoadStates] = useState<Record<string, SectionLoadState>>(
    {},
  );
  const requestIds = useRef<Record<string, number>>({});
  const loadQueueRef = useRef<string[]>([]);
  const inFlightLoadsRef = useRef<Set<string>>(new Set());
  const loadStatesRef = useRef<Record<string, SectionLoadState>>({});

  useEffect(() => {
    loadStatesRef.current = loadStates;
  }, [loadStates]);

  const pumpLoadQueue = useCallback(() => {
    while (inFlightLoadsRef.current.size < 2 && loadQueueRef.current.length > 0) {
      const key = loadQueueRef.current.shift();
      if (!key || inFlightLoadsRef.current.has(key)) {
        continue;
      }
      const item = preview.items.find(
        (candidate) => (candidate.documentPath ?? candidate.path) === key,
      );
      if (item?.kind !== "document" || !item.documentPath) {
        continue;
      }
      const currentState = loadStatesRef.current[key];
      if (
        currentState?.status === "loading" ||
        currentState?.status === "ready"
      ) {
        continue;
      }
      const requestId = (requestIds.current[key] ?? 0) + 1;
      const documentPath = item.documentPath;
      requestIds.current[key] = requestId;
      inFlightLoadsRef.current.add(key);
      setLoadStates((current) => {
        const next = {
          ...current,
          [key]: { status: "loading" } as SectionLoadState,
        };
        loadStatesRef.current = next;
        return next;
      });
      getGitDiffPreview(documentPath)
        .then(async (diffPreview) => {
          const normalizedPreview = {
            ...diffPreview,
            source: diffPreview.source ?? "git",
            leftPath: diffPreview.leftPath ?? documentPath,
            rightPath: diffPreview.rightPath ?? documentPath,
          };
          const summary = await deriveGitRenderedDiffSummary(normalizedPreview, {
            config,
            loadDocumentContext,
            resolveLocalImage,
            renderDiagram,
            confirmedRemoteDiagramKeys,
            krokiFallbackDiagramKeys,
          });
          if (requestIds.current[key] !== requestId) {
            return;
          }
          setLoadStates((current) => {
            const next = {
              ...current,
              [key]: {
                status: "ready",
                preview: normalizedPreview,
                summary,
              } as SectionLoadState,
            };
            loadStatesRef.current = next;
            return next;
          });
          documentReviewSession.markViewed(documentPath);
        })
        .catch((error) => {
          if (requestIds.current[key] !== requestId) {
            return;
          }
          setLoadStates((current) => {
            const next = {
              ...current,
              [key]: {
                status: "blocked",
                message:
                  error instanceof Error
                    ? "This file cannot be previewed right now."
                    : "Preview failed.",
              } as SectionLoadState,
            };
            loadStatesRef.current = next;
            return next;
          });
        })
        .finally(() => {
          inFlightLoadsRef.current.delete(key);
          pumpLoadQueue();
        });
    }
  }, [
    config,
    confirmedRemoteDiagramKeys,
    documentReviewSession,
    getGitDiffPreview,
    krokiFallbackDiagramKeys,
    loadDocumentContext,
    preview.items,
    renderDiagram,
    resolveLocalImage,
  ]);

  const ensureSectionLoaded = useCallback(
    (key: string, _reason: DiffStreamLoadReason) => {
      const item = preview.items.find(
        (candidate) => (candidate.documentPath ?? candidate.path) === key,
      );
      const currentState = loadStatesRef.current[key];
      if (
        item?.kind !== "document" ||
        !item.documentPath ||
        currentState?.status === "loading" ||
        currentState?.status === "ready" ||
        loadQueueRef.current.includes(key)
      ) {
        return false;
      }
      loadQueueRef.current.push(key);
      pumpLoadQueue();
      return true;
    },
    [preview.items, pumpLoadQueue],
  );

  useEffect(() => {
    const streamBody = streamBodyRef.current;
    if (!streamBody) {
      return;
    }
    const documentKeys = preview.items
      .filter((item) => item.kind === "document" && item.documentPath)
      .map((item) => item.documentPath ?? item.path);
    if (documentKeys.length === 0) {
      return;
    }
    if (typeof IntersectionObserver === "undefined") {
      for (const key of documentKeys.slice(0, 2)) {
        ensureSectionLoaded(key, "visible");
      }
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }
          const key = (entry.target as HTMLElement).dataset.streamKey;
          if (key) {
            ensureSectionLoaded(key, "visible");
          }
        }
      },
      { root: streamBody, rootMargin: "800px 0px" },
    );
    const sections = Array.from(
      streamBody.querySelectorAll<HTMLElement>(
        '[data-review-id="diff-stream-file-section"]',
      ),
    );
    for (const section of sections) {
      observer.observe(section);
    }
    return () => observer.disconnect();
  }, [ensureSectionLoaded, preview.items, streamBodyRef]);

  return {
    ensureSectionLoaded,
    loadStates,
    loadStatesRef,
  };
}
