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
  GitDiffPreviewBatchEntry,
  GitBranchDiffPreviewBatchItem,
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
import {
  allDiffsUiPerformanceNow,
  useAllDiffsUiPerformance,
} from "../../lib/allDiffsUiPerformance";
import type { DiffStreamLoadReason, SectionLoadState } from "./types";

interface PendingDocumentLoad {
  documentPath: string;
  inFlightToken: string;
  item: DocumentDiffStreamPreview["items"][number];
  key: string;
  perfEntryIndex: number;
  requestId: number;
}

export function useDocumentDiffStreamLoader({
  config,
  confirmedRemoteDiagramKeys,
  getGitDiffPreview,
  getGitDiffPreviews,
  getGitBranchFileDiff,
  getGitBranchFileDiffs,
  getGitFileCommitDiff,
  getGitFileCommitDiffs,
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
  getGitDiffPreviews?: (
    repositoryRoot: string,
    relativePaths: string[],
  ) => Promise<GitDiffPreviewBatchEntry[]>;
  getGitBranchFileDiff?: (
    path: string,
    input: {
      baseRef: string;
      headRef?: string | null;
      path: string;
      oldPath?: string | null;
    },
  ) => Promise<DocumentDiffPreview>;
  getGitBranchFileDiffs?: (
    repositoryRoot: string,
    options: {
      baseRef: string;
      headRef?: string | null;
      items: GitBranchDiffPreviewBatchItem[];
    },
  ) => Promise<GitDiffPreviewBatchEntry[]>;
  getGitFileCommitDiff?: (
    path: string,
    revision: string,
  ) => Promise<DocumentDiffPreview>;
  getGitFileCommitDiffs?: (
    repositoryRoot: string,
    revision: string,
    relativePaths: string[],
  ) => Promise<GitDiffPreviewBatchEntry[]>;
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
  const measurement = useAllDiffsUiPerformance();
  const [loadStateSnapshot, setLoadStateSnapshot] = useState<{
    items: DocumentDiffStreamPreview["items"];
    states: Record<string, SectionLoadState>;
  }>(() => ({ items: preview.items, states: {} }));
  const requestIds = useRef<Record<string, number>>({});
  const loadQueueRef = useRef<string[]>([]);
  const inFlightLoadsRef = useRef<Set<string>>(new Set());
  const loadStatesRef = useRef<Record<string, SectionLoadState>>({});
  const generationRef = useRef(0);
  const queuedAtRef = useRef<Record<string, number>>({});
  const previewItemsRef = useRef(preview.items);
  const previewIdentityRef = useRef(previewIdentity(preview));
  const pumpLoadQueueRef = useRef<() => void>(() => undefined);
  const pumpScheduledRef = useRef(false);

  const loadStates =
    loadStateSnapshot.items === preview.items ? loadStateSnapshot.states : {};

  useLayoutEffect(() => {
    const identity = previewIdentity(preview);
    if (
      previewItemsRef.current === preview.items &&
      previewIdentityRef.current === identity
    ) {
      return;
    }
    previewItemsRef.current = preview.items;
    previewIdentityRef.current = identity;
    generationRef.current += 1;
    requestIds.current = {};
    loadQueueRef.current = [];
    inFlightLoadsRef.current.clear();
    loadStatesRef.current = {};
    queuedAtRef.current = {};
    setLoadStateSnapshot({ items: preview.items, states: {} });
  }, [preview]);

  useEffect(
    () => () => {
      generationRef.current += 1;
      loadQueueRef.current = [];
      inFlightLoadsRef.current.clear();
      queuedAtRef.current = {};
    },
    [],
  );

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

  const settlePreview = useCallback(
    async (
      load: PendingDocumentLoad,
      result: GitDiffPreviewBatchEntry,
      generation: number,
      items: DocumentDiffStreamPreview["items"],
    ) => {
      const { documentPath, inFlightToken, key, perfEntryIndex, requestId } =
        load;
      try {
        if (result.status === "error") {
          throw new Error(result.message);
        }
        const diffPreview = result.preview;
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
        const renderStartedAt = measurement.enabled
          ? allDiffsUiPerformanceNow()
          : 0;
        const summary = await deriveGitRenderedDiffSummary(normalizedPreview, {
          config,
          loadDocumentContext,
          resolveLocalImage,
          renderDiagram,
          confirmedRemoteDiagramKeys,
          krokiFallbackDiagramKeys,
          perfOwner: "all-diffs",
          perfEntryIndex,
        });
        if (measurement.enabled) {
          measurement.record({
            type: "render-summary",
            durationMs: allDiffsUiPerformanceNow() - renderStartedAt,
            itemCount: 1,
          });
        }
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
            measurementCommitStartedAt: measurement.enabled
              ? allDiffsUiPerformanceNow()
              : undefined,
          } as SectionLoadState,
        }));
      } catch {
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
            message: "This file cannot be previewed right now.",
          } as SectionLoadState,
        }));
      } finally {
        inFlightLoadsRef.current.delete(inFlightToken);
        pumpLoadQueueRef.current();
      }
    },
    [
      commitLoadStates,
      config,
      confirmedRemoteDiagramKeys,
      krokiFallbackDiagramKeys,
      loadDocumentContext,
      measurement,
      renderDiagram,
      resolveLocalImage,
    ],
  );

  const pumpLoadQueue = useCallback(() => {
    pumpScheduledRef.current = false;
    const items = preview.items;
    if (previewItemsRef.current !== items) {
      return;
    }
    const generation = generationRef.current;
    const pending: PendingDocumentLoad[] = [];
    while (
      inFlightLoadsRef.current.size + pending.length < 2 &&
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
      if (measurement.enabled) {
        const queuedAt = queuedAtRef.current[key];
        if (queuedAt !== undefined) {
          measurement.record({
            type: "loader-queue-wait",
            durationMs: allDiffsUiPerformanceNow() - queuedAt,
            itemCount: 1,
          });
        }
      }
      delete queuedAtRef.current[key];
      pending.push({
        documentPath,
        inFlightToken,
        item,
        key,
        perfEntryIndex,
        requestId,
      });
    }
    if (pending.length === 0) {
      return;
    }
    for (const load of pending) {
      inFlightLoadsRef.current.add(load.inFlightToken);
    }
    if (
      !commitLoadStates(generation, items, (current) => ({
        ...current,
        ...Object.fromEntries(
          pending.map(({ key }) => [key, { status: "loading" }]),
        ),
      }))
    ) {
      for (const load of pending) {
        inFlightLoadsRef.current.delete(load.inFlightToken);
      }
      return;
    }
    const previewStartedAt = measurement.enabled
      ? allDiffsUiPerformanceNow()
      : 0;
    const batchPromise =
      pending.length !== 2 || !preview.repositoryRoot
        ? null
        : preview.source === "git-changes-stream" && getGitDiffPreviews
          ? getGitDiffPreviews(
              preview.repositoryRoot,
              pending.map(({ item }) => item.path),
            )
          : preview.source === "git-branch-stream" &&
              preview.baseRef &&
              getGitBranchFileDiffs
            ? getGitBranchFileDiffs(preview.repositoryRoot, {
                baseRef: preview.baseRef,
                headRef: preview.headRef,
                items: pending.map(({ item }) => ({
                  path: item.path,
                  oldPath: item.oldPath,
                })),
              })
            : preview.source === "git-commit-stream" &&
                preview.revision &&
                getGitFileCommitDiffs
              ? getGitFileCommitDiffs(
                  preview.repositoryRoot,
                  preview.revision,
                  pending.map(({ item }) => item.path),
                )
              : null;
    if (batchPromise) {
      batchPromise
        .then((results) => {
          if (measurement.enabled) {
            measurement.record({
              type: "git-preview-wait",
              durationMs: allDiffsUiPerformanceNow() - previewStartedAt,
              itemCount: pending.length,
            });
          }
          pending.forEach((load, index) => {
            void settlePreview(
              load,
              results[index] ?? {
                status: "error",
                message: "Git diff preview batch result is incomplete.",
              },
              generation,
              items,
            );
          });
        })
        .catch(() => {
          pending.forEach((load) => {
            void settlePreview(
              load,
              { status: "error", message: "Git diff preview batch failed." },
              generation,
              items,
            );
          });
        });
      return;
    }
    for (const load of pending) {
      loadDiffPreview({
        documentPath: load.documentPath,
        getGitBranchFileDiff,
        getGitDiffPreview,
        getGitFileCommitDiff,
        item: load.item,
        preview,
      })
        .then((diffPreview) => {
          if (measurement.enabled) {
            measurement.record({
              type: "git-preview-wait",
              durationMs: allDiffsUiPerformanceNow() - previewStartedAt,
              itemCount: 1,
            });
          }
          return settlePreview(
            load,
            { status: "ready", preview: diffPreview },
            generation,
            items,
          );
        })
        .catch(() =>
          settlePreview(
            load,
            { status: "error", message: "Git diff preview failed." },
            generation,
            items,
          ),
        );
    }
  }, [
    commitLoadStates,
    getGitDiffPreview,
    getGitDiffPreviews,
    getGitBranchFileDiff,
    getGitBranchFileDiffs,
    getGitFileCommitDiff,
    getGitFileCommitDiffs,
    measurement,
    preview,
    preview.items,
    settlePreview,
  ]);
  pumpLoadQueueRef.current = pumpLoadQueue;

  const schedulePumpLoadQueue = useCallback(() => {
    if (pumpScheduledRef.current) {
      return;
    }
    pumpScheduledRef.current = true;
    queueMicrotask(() => {
      pumpScheduledRef.current = false;
      pumpLoadQueueRef.current();
    });
  }, []);

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
      if (measurement.enabled) {
        queuedAtRef.current[key] = allDiffsUiPerformanceNow();
      }
      if (preview.items.length === 1) {
        pumpLoadQueueRef.current();
      } else {
        schedulePumpLoadQueue();
      }
      return true;
    },
    [measurement, preview.items, schedulePumpLoadQueue],
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

function previewIdentity(preview: DocumentDiffStreamPreview) {
  return [
    preview.source,
    preview.repositoryRoot ?? "",
    preview.baseRef ?? "",
    preview.headRef ?? "",
    preview.revision ?? "",
    preview.parentRevision ?? "",
    preview.watchStatus === "refreshing" ? "refreshing" : "",
  ].join("\u0000");
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
