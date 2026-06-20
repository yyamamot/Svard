import { useEffect } from "react";
import { renderDocument } from "../../core/renderDocument";
import {
  renderGraphvizDiagrams,
  warmGraphvizRenderer,
} from "../../core/renderGraphviz";
import { renderMermaidDiagrams } from "../../core/renderMermaid";
import {
  normalizePlantUmlRenderSource,
  renderPlantUmlDiagrams,
  warmPlantUmlRenderer,
} from "../../core/renderPlantUml";
import type {
  AppConfig,
  DocumentPayload,
  KrokiRequest,
  KrokiResult,
  DocumentLinkResolution,
  LocalImageResult,
  RenderResult,
  PlantUmlSvgCacheReadResult,
  PlantUmlSvgCacheWriteResult,
} from "../../core/types";
import {
  applyDiagramPlaceholdersToHtml,
  applyInlineDiagramsToHtml,
} from "../lib/diagramHtml";
import type { DiagramRenderSnapshot } from "../lib/diagramInspector";
import { prepareDocumentHtml } from "../lib/documentHtml";
import {
  perfBasename,
  perfDuration,
  perfNow,
  tracePerf,
} from "../lib/perfTrace";
import type { SafeHtml } from "../lib/safeHtml";

interface RenderHost {
  renderDiagram(request: KrokiRequest): Promise<KrokiResult>;
  resolveLocalImage(
    path: string,
    documentPath: string,
    context?: DocumentPayload["asciidocContext"],
  ): Promise<LocalImageResult>;
  resolveDocumentLink(input: {
    href: string;
    documentPath: string;
    kind?: "local" | "wikilink";
    target?: string | null;
    label?: string | null;
  }): Promise<DocumentLinkResolution>;
  readPlantUmlSvgCache?(input: {
    key: string;
  }): Promise<PlantUmlSvgCacheReadResult>;
  writePlantUmlSvgCache?(input: {
    key: string;
    svg: string;
    metadata: {
      renderer: "plantuml";
      theme: "light" | "dark";
      version: string;
    };
  }): Promise<PlantUmlSvgCacheWriteResult>;
}

interface UseDocumentRenderOptions {
  confirmedRemoteDiagramKeys: ReadonlySet<string>;
  config: AppConfig | null;
  documentPayload: DocumentPayload | null;
  host: RenderHost;
  krokiFallbackDiagramKeys: ReadonlySet<string>;
  setError: (message: string | null) => void;
  setDocumentHtml: (html: SafeHtml) => void;
  setDiagramRenderSnapshot: (snapshot: DiagramRenderSnapshot | null) => void;
  setRenderResult: (result: RenderResult | null) => void;
}

async function yieldAfterPlaceholderCommit(): Promise<void> {
  await new Promise<void>((resolve) => {
    if (typeof window !== "undefined" && "requestAnimationFrame" in window) {
      window.requestAnimationFrame(() => resolve());
      return;
    }
    globalThis.setTimeout(resolve, 0);
  });
}

export function documentRenderSetSignature(
  values: ReadonlySet<string>,
): string {
  return [...values].sort().join("\u001f");
}

function safeJsonSignature(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function documentRenderConfigSignature(
  config: AppConfig | null,
): string {
  return safeJsonSignature({
    diagram: config?.diagram,
    diagramPlaceholderRendering:
      config?.experimental.diagramPlaceholderRendering === true,
    kroki: config?.kroki,
    security: config?.security,
    theme: config?.theme,
  });
}

export function documentPayloadRenderSignature(
  documentPayload: DocumentPayload | null,
): string {
  return safeJsonSignature({
    asciidocContext: documentPayload?.asciidocContext ?? null,
    format: documentPayload?.format ?? null,
    includeFiles:
      documentPayload?.includeFiles?.map((file) => ({
        path: file.path,
        source: file.source,
      })) ?? [],
    path: documentPayload?.path ?? null,
    source: documentPayload?.source ?? null,
  });
}

export function useDocumentRender({
  confirmedRemoteDiagramKeys,
  config,
  documentPayload,
  host,
  krokiFallbackDiagramKeys,
  setError,
  setDocumentHtml,
  setDiagramRenderSnapshot,
  setRenderResult,
}: UseDocumentRenderOptions) {
  const theme = config?.theme;
  const diagramConfig = config?.diagram;
  const diagramPlaceholderRendering =
    config?.experimental.diagramPlaceholderRendering === true;
  const krokiConfig = config?.kroki;
  const securityConfig = config?.security;
  const confirmedRemoteDiagramKeysSignature = documentRenderSetSignature(
    confirmedRemoteDiagramKeys,
  );
  const krokiFallbackDiagramKeysSignature = documentRenderSetSignature(
    krokiFallbackDiagramKeys,
  );
  const renderConfigSignature = documentRenderConfigSignature(config);
  const documentPayloadSignature =
    documentPayloadRenderSignature(documentPayload);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function render() {
      if (
        !documentPayload ||
        !theme ||
        !diagramConfig ||
        !krokiConfig ||
        !securityConfig
      ) {
        return;
      }

      try {
        const totalStartedAt = perfNow();
        const basename = perfBasename(documentPayload.path);
        tracePerf("render.effect.start", {
          basename,
          format: documentPayload.format,
          durationMs: 0,
        });
        setDiagramRenderSnapshot(null);
        const diagramKey = (renderer: string, id: string) =>
          `${documentPayload.path}::${renderer}:${id}`;
        const renderDocumentStartedAt = perfNow();
        const result = await renderDocument(documentPayload, {
          signal: controller.signal,
        });
        const diagramCounts = {
          mermaid: result.mermaidDiagrams.length,
          graphviz: result.graphvizDiagrams.length,
          plantuml: result.plantUmlDiagrams.length,
          kroki: result.krokiDiagrams.length,
        };
        tracePerf("render.renderDocument", {
          basename,
          format: documentPayload.format,
          diagramCounts,
          durationMs: perfDuration(renderDocumentStartedAt),
        });
        for (const { event, ...stage } of result.perf ?? []) {
          tracePerf(`render.${event}`, {
            basename,
            format: documentPayload.format,
            ...stage,
          });
        }

        const prepareStartedAt = perfNow();
        const preparedHtml = await prepareDocumentHtml(
          result.html,
          documentPayload,
          { security: securityConfig },
          result,
          {
            resolveLocalImage: (path, documentPath, context) =>
              host.resolveLocalImage(path, documentPath, context),
            resolveDocumentLink: (href, documentPath, linkOptions) =>
              host.resolveDocumentLink({
                href,
                documentPath,
                kind: linkOptions?.kind,
                target: linkOptions?.target,
                label: linkOptions?.label,
              }),
          },
        );
        tracePerf("render.prepareDocumentHtml", {
          basename,
          format: documentPayload.format,
          durationMs: perfDuration(prepareStartedAt),
        });

        if (cancelled || controller.signal.aborted) {
          return;
        }

        if (diagramPlaceholderRendering) {
          const placeholderApplyStartedAt = perfNow();
          const placeholderHtml =
            result.diagramSlots.length === 0
              ? preparedHtml
              : applyDiagramPlaceholdersToHtml({
                  html: preparedHtml,
                  slots: result.diagramSlots,
                });
          tracePerf("render.applyDiagramPlaceholdersToHtml", {
            basename,
            format: documentPayload.format,
            skipped: result.diagramSlots.length === 0,
            durationMs: perfDuration(placeholderApplyStartedAt),
          });
          tracePerf("render.beforeHtmlStateSet", {
            basename,
            format: documentPayload.format,
            durationMs: perfDuration(totalStartedAt),
          });
          const placeholderCommitStartedAt = perfNow();
          tracePerf("render.stateCommit.start", {
            basename,
            format: documentPayload.format,
            durationMs: perfDuration(totalStartedAt),
          });
          setRenderResult(result);
          setDocumentHtml(placeholderHtml);
          if (
            result.graphvizDiagrams.length > 0 &&
            diagramConfig.graphvizRenderer === "local"
          ) {
            void warmGraphvizRenderer().catch(() => undefined);
          }
          if (
            result.plantUmlDiagrams.length > 0 &&
            diagramConfig.plantumlRenderer === "local"
          ) {
            void warmPlantUmlRenderer().catch(() => undefined);
          }
          tracePerf("render.stateCommit.queued", {
            basename,
            format: documentPayload.format,
            durationMs: perfDuration(placeholderCommitStartedAt),
          });
          tracePerf("render.afterHtmlStateSetQueued", {
            basename,
            format: documentPayload.format,
            durationMs: perfDuration(totalStartedAt),
          });
          tracePerf("render.firstDocumentHtmlSet", {
            basename,
            format: documentPayload.format,
            durationMs: perfDuration(totalStartedAt),
          });
          tracePerf("render.placeholderHtmlSet", {
            basename,
            format: documentPayload.format,
            skipped: result.diagramSlots.length === 0,
            durationMs: perfDuration(totalStartedAt),
          });
          if (result.diagramSlots.length > 0) {
            await yieldAfterPlaceholderCommit();
          }
          if (cancelled || controller.signal.aborted) {
            return;
          }
        }

        const mermaidStartedAt = perfNow();
        const renderedMermaid =
          result.mermaidDiagrams.length === 0
            ? []
            : await Promise.all(
                (
                  await renderMermaidDiagrams(result.mermaidDiagrams, theme)
                ).map((diagram) => ({
                  ...result.mermaidDiagrams.find(
                    (item) => item.id === diagram.id,
                  )!,
                  svg: diagram.svg,
                })),
              ).catch((mermaidError) =>
                result.mermaidDiagrams.map((diagram) => ({
                  ...diagram,
                  error:
                    mermaidError instanceof Error
                      ? mermaidError.message
                      : "Mermaid render failed",
                })),
              );
        tracePerf("render.renderMermaidDiagrams", {
          basename,
          format: documentPayload.format,
          count: result.mermaidDiagrams.length,
          skipped: result.mermaidDiagrams.length === 0,
          durationMs: perfDuration(mermaidStartedAt),
        });
        const krokiStartedAt = perfNow();
        const renderedKroki =
          result.krokiDiagrams.length === 0
            ? []
            : await Promise.all(
                result.krokiDiagrams.map(async (diagram) => ({
                  ...diagram,
                  result: await host.renderDiagram({
                    diagramType: diagram.diagramType,
                    source: diagram.source,
                    config: krokiConfig,
                    confirmedRemoteSend: confirmedRemoteDiagramKeys.has(
                      diagramKey("kroki", diagram.id),
                    ),
                  }),
                })),
              ).catch((krokiError) =>
                result.krokiDiagrams.map((diagram) => ({
                  ...diagram,
                  result: {
                    status: "error" as const,
                    message:
                      krokiError instanceof Error
                        ? krokiError.message
                        : "Kroki render failed",
                  },
                })),
              );
        tracePerf("render.renderKrokiDiagrams", {
          basename,
          format: documentPayload.format,
          count: result.krokiDiagrams.length,
          skipped: result.krokiDiagrams.length === 0,
          durationMs: perfDuration(krokiStartedAt),
        });
        const renderedGraphvizPromise = (async () => {
          const graphvizStartedAt = perfNow();
          try {
            const localGraphvizResults =
              result.graphvizDiagrams.length > 0 &&
              diagramConfig.graphvizRenderer === "local"
                ? await renderGraphvizDiagrams(result.graphvizDiagrams, {
                    timeoutMs: diagramConfig.graphvizTimeoutMs,
                  })
                : [];
            return await Promise.all(
              result.graphvizDiagrams.map(async (diagram) => {
                const localResult = localGraphvizResults.find(
                  (item) => item.id === diagram.id,
                )?.result;
                const shouldUseKroki =
                  diagramConfig.graphvizRenderer === "kroki";
                const key = diagramKey("graphviz", diagram.id);
                const shouldTryKroki =
                  shouldUseKroki || krokiFallbackDiagramKeys.has(key);
                const fallbackResult = shouldTryKroki
                  ? await host.renderDiagram({
                      diagramType: "graphviz",
                      source: diagram.source,
                      config: krokiConfig,
                      confirmedRemoteSend: confirmedRemoteDiagramKeys.has(key),
                    })
                  : undefined;

                return {
                  ...diagram,
                  result: localResult,
                  fallbackResult,
                };
              }),
            );
          } catch (graphvizError) {
            return result.graphvizDiagrams.map((diagram) => ({
              ...diagram,
              result: {
                status: "error" as const,
                diagnostics: [
                  graphvizError instanceof Error
                    ? graphvizError.message
                    : "Graphviz render failed",
                ],
              },
            }));
          } finally {
            tracePerf("render.renderGraphvizDiagrams", {
              basename,
              format: documentPayload.format,
              count: result.graphvizDiagrams.length,
              skipped: result.graphvizDiagrams.length === 0,
              durationMs: perfDuration(graphvizStartedAt),
            });
          }
        })();
        const renderedPlantUmlPromise = (async () => {
          const plantUmlStartedAt = perfNow();
          try {
            const localPlantUmlResults =
              result.plantUmlDiagrams.length > 0 &&
              diagramConfig.plantumlRenderer === "local"
                ? await renderPlantUmlDiagrams(result.plantUmlDiagrams, {
                    cache:
                      host.readPlantUmlSvgCache && host.writePlantUmlSvgCache
                        ? {
                            readPlantUmlSvgCache: (input) =>
                              host.readPlantUmlSvgCache?.(input) ??
                              Promise.resolve({ status: "miss" }),
                            writePlantUmlSvgCache: (input) =>
                              host.writePlantUmlSvgCache?.(input) ??
                              Promise.resolve({ status: "skipped" }),
                          }
                        : null,
                    theme,
                    timeoutMs: diagramConfig.plantumlTimeoutMs,
                  })
                : [];
            return await Promise.all(
              result.plantUmlDiagrams.map(async (diagram) => {
                const localResult = localPlantUmlResults.find(
                  (item) => item.id === diagram.id,
                )?.result;
                const shouldUseKroki =
                  diagramConfig.plantumlRenderer === "kroki";
                const key = diagramKey("plantuml", diagram.id);
                const shouldTryKroki =
                  shouldUseKroki || krokiFallbackDiagramKeys.has(key);
                const fallbackResult = shouldTryKroki
                  ? await host.renderDiagram({
                      diagramType: "plantuml",
                      source: normalizePlantUmlRenderSource(diagram.source),
                      config: krokiConfig,
                      confirmedRemoteSend: confirmedRemoteDiagramKeys.has(key),
                    })
                  : undefined;

                return {
                  ...diagram,
                  result: localResult,
                  fallbackResult,
                };
              }),
            );
          } catch (plantUmlError) {
            return result.plantUmlDiagrams.map((diagram) => ({
              ...diagram,
              result: {
                status: "error" as const,
                diagnostics: [
                  plantUmlError instanceof Error
                    ? plantUmlError.message
                    : "PlantUML render failed",
                ],
              },
            }));
          } finally {
            tracePerf("render.renderPlantUmlDiagrams", {
              basename,
              format: documentPayload.format,
              count: result.plantUmlDiagrams.length,
              skipped: result.plantUmlDiagrams.length === 0,
              durationMs: perfDuration(plantUmlStartedAt),
            });
          }
        })();
        const [renderedGraphviz, renderedPlantUml] = await Promise.all([
          renderedGraphvizPromise,
          renderedPlantUmlPromise,
        ]);
        tracePerf("render.diagramsAsyncDone", {
          basename,
          format: documentPayload.format,
          diagramCounts,
          durationMs: perfDuration(totalStartedAt),
        });

        if (!cancelled && !controller.signal.aborted) {
          const diagramRenderSnapshot: DiagramRenderSnapshot = {
            graphvizDiagrams: renderedGraphviz,
            krokiDiagrams: renderedKroki,
            mermaidDiagrams: renderedMermaid,
            plantUmlDiagrams: renderedPlantUml,
          };
          const applyStartedAt = perfNow();
          const finalHtml =
            result.diagramSlots.length === 0
              ? preparedHtml
              : applyInlineDiagramsToHtml({
                  html: preparedHtml,
                  document: documentPayload,
                  slots: result.diagramSlots,
                  mermaidDiagrams: renderedMermaid,
                  graphvizDiagrams: renderedGraphviz,
                  plantUmlDiagrams: renderedPlantUml,
                  krokiDiagrams: renderedKroki,
                  krokiMode: krokiConfig.mode,
                });
          tracePerf("render.applyInlineDiagramsToHtml", {
            basename,
            format: documentPayload.format,
            skipped: result.diagramSlots.length === 0,
            durationMs: perfDuration(applyStartedAt),
          });
          if (diagramPlaceholderRendering) {
            const diagramSvgApplyStartedAt = perfNow();
            setDiagramRenderSnapshot(diagramRenderSnapshot);
            setDocumentHtml(finalHtml);
            tracePerf("render.diagramSvgApply", {
              basename,
              format: documentPayload.format,
              skipped: result.diagramSlots.length === 0,
              durationMs: perfDuration(diagramSvgApplyStartedAt),
              totalDurationMs: perfDuration(totalStartedAt),
            });
          } else {
            tracePerf("render.beforeHtmlStateSet", {
              basename,
              format: documentPayload.format,
              durationMs: perfDuration(totalStartedAt),
            });
            const stateCommitStartedAt = perfNow();
            tracePerf("render.stateCommit.start", {
              basename,
              format: documentPayload.format,
              durationMs: perfDuration(totalStartedAt),
            });
            setRenderResult(result);
            setDiagramRenderSnapshot(diagramRenderSnapshot);
            setDocumentHtml(finalHtml);
            tracePerf("render.stateCommit.queued", {
              basename,
              format: documentPayload.format,
              durationMs: perfDuration(stateCommitStartedAt),
            });
            tracePerf("render.afterHtmlStateSetQueued", {
              basename,
              format: documentPayload.format,
              durationMs: perfDuration(totalStartedAt),
            });
            tracePerf("render.firstDocumentHtmlSet", {
              basename,
              format: documentPayload.format,
              durationMs: perfDuration(totalStartedAt),
            });
          }
        }
      } catch (renderError) {
        if (cancelled || controller.signal.aborted) {
          return;
        }
        setError(
          renderError instanceof Error ? renderError.message : "Render failed",
        );
      }
    }

    void render();

    return () => {
      tracePerf("render.effect.cleanup", {
        basename: perfBasename(documentPayload?.path),
        format: documentPayload?.format ?? null,
        durationMs: 0,
      });
      cancelled = true;
      controller.abort();
    };
  }, [
    confirmedRemoteDiagramKeysSignature,
    documentPayloadSignature,
    host,
    krokiFallbackDiagramKeysSignature,
    renderConfigSignature,
    setDocumentHtml,
    setDiagramRenderSnapshot,
    setError,
    setRenderResult,
  ]);
}
