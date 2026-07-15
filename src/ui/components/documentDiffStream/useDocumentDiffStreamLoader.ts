import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
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
import {
  isLineDiffTooComplex,
  normalizeGitDiffPreview,
} from "../../../core/types";
import { deriveGitRenderedDiffSummary } from "../../lib/gitRenderedDiff";
import type { DiffStreamLoadReason, SectionLoadState } from "./types";

export function useDocumentDiffStreamLoader({
  config,
  confirmedRemoteDiagramKeys,
  getGitDiffPreview,
  getGitBranchFileDiff,
  getGitFileCommitDiff,
  krokiFallbackDiagramKeys,
  loadDocumentContext,
  preview,
  renderDiagram,
  resolveLocalImage,
  streamBodyRef,
}: {
  config: AppConfig | null;
  confirmedRemoteDiagramKeys?: ReadonlySet<string>;
  getGitDiffPreview: (path: string) => Promise<DocumentDiffPreview>;
  getGitBranchFileDiff?: (
    path: string,
    input: {
      baseRef: string;
      headRef?: string | null;
      path: string;
      oldPath?: string | null;
    },
  ) => Promise<DocumentDiffPreview>;
  getGitFileCommitDiff?: (
    path: string,
    revision: string,
  ) => Promise<DocumentDiffPreview>;
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
  const [loadStateSnapshot, setLoadStateSnapshot] = useState<{
    items: DocumentDiffStreamPreview["items"];
    states: Record<string, SectionLoadState>;
  }>(() => ({ items: preview.items, states: {} }));
  const requestIds = useRef<Record<string, number>>({});
  const loadQueueRef = useRef<string[]>([]);
  const inFlightLoadsRef = useRef<Set<string>>(new Set());
  const loadStatesRef = useRef<Record<string, SectionLoadState>>({});
  const generationRef = useRef(0);
  const previewItemsRef = useRef(preview.items);
  const pumpLoadQueueRef = useRef<() => void>(() => undefined);

  const loadStates =
    loadStateSnapshot.items === preview.items ? loadStateSnapshot.states : {};

  useLayoutEffect(() => {
    if (previewItemsRef.current === preview.items) {
      return;
    }
    previewItemsRef.current = preview.items;
    generationRef.current += 1;
    requestIds.current = {};
    loadQueueRef.current = [];
    inFlightLoadsRef.current.clear();
    loadStatesRef.current = {};
  }, [preview.items]);

  const commitLoadStates = useCallback(
    (
      generation: number,
      items: DocumentDiffStreamPreview["items"],
      update: (
        current: Record<string, SectionLoadState>,
      ) => Record<string, SectionLoadState>,
    ) => {
      if (
        generationRef.current !== generation ||
        previewItemsRef.current !== items
      ) {
        return false;
      }
      const next = update(loadStatesRef.current);
      loadStatesRef.current = next;
      setLoadStateSnapshot((current) => {
        if (
          generationRef.current !== generation ||
          previewItemsRef.current !== items
        ) {
          return current;
        }
        return { items, states: next };
      });
      return true;
    },
    [],
  );

  const pumpLoadQueue = useCallback(() => {
    const items = preview.items;
    if (previewItemsRef.current !== items) {
      return;
    }
    const generation = generationRef.current;
    while (
      inFlightLoadsRef.current.size < 2 &&
      loadQueueRef.current.length > 0
    ) {
      const nextIndex = loadQueueRef.current.findIndex(
        (candidate) =>
          !inFlightLoadsRef.current.has(
            inFlightLoadToken(generation, candidate),
          ),
      );
      if (nextIndex < 0) {
        break;
      }
      const [key] = loadQueueRef.current.splice(nextIndex, 1);
      if (!key) continue;
      const perfEntryIndex = items.findIndex(
        (candidate) => (candidate.documentPath ?? candidate.path) === key,
      );
      const item = items[perfEntryIndex];
      if (item?.kind !== "document" || !item.documentPath) {
        continue;
      }
      const currentState = loadStatesRef.current[key];
      if (
        currentState?.status === "loading" ||
        currentState?.status === "ready" ||
        (currentState?.status === "blocked" &&
          currentState.reason === "too-complex")
      ) {
        continue;
      }
      const requestId = (requestIds.current[key] ?? 0) + 1;
      const documentPath = item.documentPath;
      const inFlightToken = inFlightLoadToken(generation, key);
      requestIds.current[key] = requestId;
      inFlightLoadsRef.current.add(inFlightToken);
      if (
        !commitLoadStates(generation, items, (current) => ({
          ...current,
          [key]: { status: "loading" } as SectionLoadState,
        }))
      ) {
        inFlightLoadsRef.current.delete(inFlightToken);
        continue;
      }
      loadDiffPreview({
        documentPath,
        getGitBranchFileDiff,
        getGitDiffPreview,
        getGitFileCommitDiff,
        item,
        preview,
      })
        .then(async (diffPreview) => {
          const normalizedPreview = normalizeGitDiffPreview({
            ...diffPreview,
            source: diffPreview.source ?? "git",
            leftPath: diffPreview.leftPath ?? documentPath,
            rightPath: diffPreview.rightPath ?? documentPath,
          });
          if (
            generationRef.current !== generation ||
            requestIds.current[key] !== requestId
          ) {
            return;
          }
          if (isLineDiffTooComplex(normalizedPreview)) {
            commitLoadStates(generation, items, (current) => ({
              ...current,
              [key]: {
                status: "blocked",
                reason: "too-complex",
                message:
                  "Highlighted diff is unavailable because this comparison exceeds the safe work limit.",
                preview: normalizedPreview,
              } as SectionLoadState,
            }));
            return;
          }
          const summary = await deriveGitRenderedDiffSummary(
            normalizedPreview,
            {
              config,
              loadDocumentContext,
              resolveLocalImage,
              renderDiagram,
              confirmedRemoteDiagramKeys,
              krokiFallbackDiagramKeys,
              perfOwner: "all-diffs",
              perfEntryIndex,
            },
          );
          if (
            generationRef.current !== generation ||
            requestIds.current[key] !== requestId
          ) {
            return;
          }
          commitLoadStates(generation, items, (current) => ({
            ...current,
            [key]: {
              status: "ready",
              preview: normalizedPreview,
              summary,
            } as SectionLoadState,
          }));
        })
        .catch((error) => {
          if (
            generationRef.current !== generation ||
            requestIds.current[key] !== requestId
          ) {
            return;
          }
          commitLoadStates(generation, items, (current) => ({
            ...current,
            [key]: {
              status: "blocked",
              message:
                error instanceof Error
                  ? "This file cannot be previewed right now."
                  : "Preview failed.",
            } as SectionLoadState,
          }));
        })
        .finally(() => {
          inFlightLoadsRef.current.delete(inFlightToken);
          pumpLoadQueueRef.current();
        });
    }
  }, [
    config,
    commitLoadStates,
    confirmedRemoteDiagramKeys,
    getGitDiffPreview,
    getGitBranchFileDiff,
    getGitFileCommitDiff,
    krokiFallbackDiagramKeys,
    loadDocumentContext,
    preview,
    preview.items,
    renderDiagram,
    resolveLocalImage,
  ]);
  pumpLoadQueueRef.current = pumpLoadQueue;

  const ensureSectionLoaded = useCallback(
    (key: string, _reason: DiffStreamLoadReason) => {
      if (previewItemsRef.current !== preview.items) {
        return false;
      }
      const item = preview.items.find(
        (candidate) => (candidate.documentPath ?? candidate.path) === key,
      );
      const currentState = loadStatesRef.current[key];
      if (
        item?.kind !== "document" ||
        !item.documentPath ||
        currentState?.status === "loading" ||
        currentState?.status === "ready" ||
        (currentState?.status === "blocked" &&
          currentState.reason === "too-complex") ||
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

function inFlightLoadToken(generation: number, key: string) {
  return `${generation}:${key}`;
}

function loadDiffPreview({
  documentPath,
  getGitBranchFileDiff,
  getGitDiffPreview,
  getGitFileCommitDiff,
  item,
  preview,
}: {
  documentPath: string;
  getGitBranchFileDiff?: (
    path: string,
    input: {
      baseRef: string;
      headRef?: string | null;
      path: string;
      oldPath?: string | null;
    },
  ) => Promise<DocumentDiffPreview>;
  getGitDiffPreview: (path: string) => Promise<DocumentDiffPreview>;
  getGitFileCommitDiff?: (
    path: string,
    revision: string,
  ) => Promise<DocumentDiffPreview>;
  item: DocumentDiffStreamPreview["items"][number];
  preview: DocumentDiffStreamPreview;
}) {
  if (
    preview.source === "git-branch-stream" &&
    preview.baseRef &&
    getGitBranchFileDiff
  ) {
    return getGitBranchFileDiff(preview.repositoryRoot ?? documentPath, {
      baseRef: preview.baseRef,
      headRef: preview.headRef,
      path: item.path,
      oldPath: item.oldPath,
    });
  }
  if (
    preview.source === "git-commit-stream" &&
    preview.revision &&
    getGitFileCommitDiff
  ) {
    return getGitFileCommitDiff(documentPath, preview.revision);
  }
  return getGitDiffPreview(documentPath);
}
