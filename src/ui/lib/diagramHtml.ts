import type {
  AppConfig,
  DiagramSlot,
  DocumentPayload,
  GraphvizDiagram,
  GraphvizRenderResult,
  KrokiDiagram,
  KrokiResult,
  MermaidDiagram,
  PlantUmlDiagram,
  PlantUmlRenderResult,
} from "../../core/types";
import { sanitizeSvg } from "./sanitizeHtml";
import { markSafeHtml, setElementSafeHtml, unwrapSafeHtml } from "./safeHtml";
import type { SafeHtml } from "./safeHtml";

function minimalDiagramMessage(
  message?: string,
  diagnostics?: string[],
): string {
  const text =
    diagnostics?.find(Boolean) ?? message ?? "Diagram render failed.";
  if (/failed to call Kroki endpoint/i.test(text)) {
    return "Kroki endpoint request failed. Check the endpoint URL and use http://127.0.0.1:8000 for a local Docker Kroki server.";
  }
  if (/Kroki endpoint returned HTTP/i.test(text)) {
    return text;
  }
  if (/Kroki endpoint URL is required/i.test(text)) {
    return "Kroki endpoint URL is required.";
  }
  if (/invalid Kroki endpoint URL/i.test(text)) {
    return "Kroki endpoint URL is invalid.";
  }
  if (/loopback endpoint/i.test(text)) {
    return "Kroki endpoint must be a valid trusted self-managed endpoint.";
  }
  if (/confirmation/i.test(text)) {
    return "Remote diagram rendering requires explicit confirmation.";
  }
  if (/disabled/i.test(text)) {
    return "Diagram rendering is disabled.";
  }
  if (/too large/i.test(text)) {
    return "Diagram too large.";
  }
  if (/timeout/i.test(text)) {
    return "Diagram render timed out.";
  }
  if (/PlantUML/i.test(text)) {
    return text;
  }
  if (/Graphviz/i.test(text)) {
    return text;
  }
  return "Diagram render failed.";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function svgSize(html: string): { width: number; height: number } | null {
  const viewBox = html.match(
    /viewBox=["']\s*[-.\d]+\s+[-.\d]+\s+([.\d]+)\s+([.\d]+)\s*["']/i,
  );
  if (viewBox?.[1] && viewBox[2]) {
    return {
      width: Number.parseFloat(viewBox[1]),
      height: Number.parseFloat(viewBox[2]),
    };
  }

  const width = html.match(/\swidth=["']([.\d]+)(?:px)?["']/i)?.[1];
  const height = html.match(/\sheight=["']([.\d]+)(?:px)?["']/i)?.[1];
  if (!width || !height) {
    return null;
  }
  return {
    width: Number.parseFloat(width),
    height: Number.parseFloat(height),
  };
}

export function svgScaleClass(
  html: string,
  options: { allowFitWidth?: boolean; preferNaturalSize?: boolean } = {},
): string {
  if (options.preferNaturalSize) {
    return "diagram-scale-natural";
  }
  const size = svgSize(html);
  if (!size || !size.width || !size.height) {
    return "diagram-scale-natural";
  }
  const aspectRatio = size.width / size.height;
  if (aspectRatio >= 0.9) {
    return options.allowFitWidth
      ? "diagram-scale-fit-width"
      : "diagram-scale-readable";
  }
  return "diagram-scale-natural";
}

export function normalizeSvgAspectRatio(html: SafeHtml): SafeHtml {
  const svgStart = html.match(/<svg\b[^>]*>/i)?.[0];
  if (!svgStart || !/preserveAspectRatio=["']none["']/i.test(svgStart)) {
    return html;
  }
  return markSafeHtml(
    unwrapSafeHtml(html).replace(
      /(<svg\b[^>]*\spreserveAspectRatio=)["']none["']/i,
      '$1"xMidYMid meet"',
    ),
  );
}

function inlineSvgHtml(
  html: string,
  options: {
    allowFitWidth?: boolean;
    normalizeAspectRatio?: boolean;
    preferNaturalSize?: boolean;
    sourceLine?: number;
    sourceReference?: string;
  } = {},
): SafeHtml {
  const sourceReference = options.sourceReference
    ? ` data-source-reference="${escapeHtml(options.sourceReference)}"`
    : "";
  const sourceLine = options.sourceLine
    ? ` data-source-line="${options.sourceLine}"`
    : "";
  const svg = options.normalizeAspectRatio
    ? normalizeSvgAspectRatio(sanitizeSvg(html))
    : sanitizeSvg(html);
  return markSafeHtml(
    `<div class="diagram-inline-image ${svgScaleClass(svg, options)}" data-review-id="diagram-inline-image"${sourceReference}${sourceLine}>${unwrapSafeHtml(svg)}</div>`,
  );
}

interface DiagramDiagnosticAction {
  label: string;
  reviewId: string;
  attributes: Record<string, string>;
}

function inlineDiagnosticHtml(
  message: string,
  options: {
    actions?: DiagramDiagnosticAction[];
    sourceLine?: number;
    sourceReference?: string;
  } = {},
): SafeHtml {
  const sourceReference = options.sourceReference
    ? ` data-source-reference="${escapeHtml(options.sourceReference)}"`
    : "";
  const sourceLine = options.sourceLine
    ? ` data-source-line="${options.sourceLine}"`
    : "";
  const actions = options.actions?.length
    ? `<div class="diagram-inline-actions">${options.actions
        .map((action) => {
          const attributes = Object.entries(action.attributes)
            .map(([name, value]) => ` ${name}="${escapeHtml(value)}"`)
            .join("");
          return `<button type="button" class="diagram-inline-action" data-review-id="${escapeHtml(action.reviewId)}"${attributes}>${escapeHtml(action.label)}</button>`;
        })
        .join("")}</div>`
    : "";
  return markSafeHtml(
    `<div class="diagram-inline-diagnostic" data-review-id="diagram-inline-diagnostic"${sourceReference}${sourceLine}><span>${escapeHtml(message)}</span>${actions}</div>`,
  );
}

function remoteConfirmationRequired(result?: KrokiResult): boolean {
  return /confirmation/i.test(result?.message ?? "");
}

function localRendererLabel(renderer: "plantuml" | "graphviz"): string {
  return renderer === "plantuml" ? "PlantUML" : "Graphviz / DOT";
}

function localRenderFailureMessage({
  renderer,
  result,
}: {
  renderer: "plantuml" | "graphviz";
  result?: PlantUmlRenderResult | GraphvizRenderResult;
}): string {
  const label = localRendererLabel(renderer);
  const detail = minimalDiagramMessage(undefined, result?.diagnostics);
  if (detail === "Diagram render failed." || detail.includes(label)) {
    return `Local ${label} render failed.`;
  }
  return `Local ${label} render failed. ${detail}`;
}

function krokiRenderFailureMessage(result?: KrokiResult): string {
  const detail = minimalDiagramMessage(result?.message);
  if (detail === "Diagram render failed.") {
    return "Kroki render failed.";
  }
  if (detail.startsWith("Kroki ")) {
    return detail;
  }
  return `Kroki render failed. ${detail}`;
}

function diagramRenderFailureMessage({
  renderer,
  result,
  fallbackResult,
}: {
  renderer: "plantuml" | "graphviz";
  result?: PlantUmlRenderResult | GraphvizRenderResult;
  fallbackResult?: KrokiResult;
}): string {
  if (fallbackResult && fallbackResult.status !== "rendered") {
    return krokiRenderFailureMessage(fallbackResult);
  }
  if (result && result.status !== "rendered") {
    return localRenderFailureMessage({ renderer, result });
  }
  return "Diagram render failed.";
}

function diagramKey(
  document: DocumentPayload,
  renderer: DiagramSlot["renderer"],
  id: string,
): string {
  return `${document.path}::${renderer}:${id}`;
}

function diagramPlaceholderLabel(renderer: DiagramSlot["renderer"]): string {
  if (renderer === "plantuml") {
    return "Rendering PlantUML diagram...";
  }
  if (renderer === "graphviz") {
    return "Rendering Graphviz diagram...";
  }
  if (renderer === "mermaid") {
    return "Rendering Mermaid diagram...";
  }
  return "Rendering Kroki diagram...";
}

function diagramPlaceholderHtml(slot: DiagramSlot): SafeHtml {
  const sourceLine = slot.sourceLocation?.line
    ? ` data-source-line="${slot.sourceLocation.line}"`
    : "";
  const sourceReference =
    slot.sourceLocation?.line && slot.sourceLocation.sourcePath
      ? ` data-source-reference="${escapeHtml(`${slot.sourceLocation.sourcePath}:${slot.sourceLocation.line}`)}"`
      : "";
  return markSafeHtml(
    `<div class="diagram-placeholder-card" data-review-id="diagram-placeholder"${sourceReference}${sourceLine}><span class="diagram-placeholder-label">${escapeHtml(diagramPlaceholderLabel(slot.renderer))}</span></div>`,
  );
}

function fallbackDiagramSlots(doc: Document): DiagramSlot[] {
  return Array.from(
    doc.querySelectorAll(".diagram-slot[data-diagram-id]"),
  ).map((element) => ({
    id: element.getAttribute("data-diagram-id") ?? "",
    diagramType: element.getAttribute("data-diagram-type") ?? "diagram",
    renderer:
      (element.getAttribute(
        "data-diagram-renderer",
      ) as DiagramSlot["renderer"]) ?? "kroki",
  }));
}

function clearDiagramPlaceholderState(element: Element) {
  element.classList.remove(
    "diagram-placeholder",
    "diagram-placeholder-mermaid",
    "diagram-placeholder-graphviz",
    "diagram-placeholder-plantuml",
    "diagram-placeholder-kroki",
  );
}

export function applyDiagramPlaceholdersToHtml({
  html,
  slots,
}: {
  html: SafeHtml;
  slots: DiagramSlot[];
}): SafeHtml {
  const parser = new DOMParser();
  const doc = parser.parseFromString(unwrapSafeHtml(html), "text/html");
  const nextSlots = slots.length > 0 ? slots : fallbackDiagramSlots(doc);
  for (const slot of nextSlots) {
    const element = doc.querySelector(
      `.diagram-slot[data-diagram-id="${CSS.escape(slot.id)}"]`,
    );
    if (element) {
      clearDiagramPlaceholderState(element);
      element.classList.add(
        "diagram-placeholder",
        `diagram-placeholder-${slot.renderer}`,
      );
      element.setAttribute("data-review-id", "diagram-placeholder-slot");
      setElementSafeHtml(element, diagramPlaceholderHtml(slot));
    }
  }
  return markSafeHtml(doc.body.innerHTML);
}

function krokiConfirmationAction(key: string): DiagramDiagnosticAction {
  return {
    label: "Render once",
    reviewId: "kroki-confirm",
    attributes: {
      "data-kroki-confirm-key": key,
    },
  };
}

function krokiFallbackAction({
  key,
  mode,
  renderer,
}: {
  key: string;
  mode: AppConfig["kroki"]["mode"];
  renderer: "plantuml" | "graphviz";
}): DiagramDiagnosticAction {
  if (mode === "disabled") {
    return {
      label: "Configure Kroki",
      reviewId: `${renderer}-configure-kroki`,
      attributes: {
        "data-kroki-open-preferences": "true",
      },
    };
  }
  return {
    label: "Try with Kroki",
    reviewId: `${renderer}-fallback-kroki`,
    attributes: {
      "data-kroki-fallback-key": key,
    },
  };
}

function inlineDiagramHtml({
  slot,
  document,
  mermaidDiagrams,
  plantUmlDiagrams,
  graphvizDiagrams,
  krokiMode,
  krokiDiagrams,
}: {
  slot: DiagramSlot;
  document: DocumentPayload;
  mermaidDiagrams: Array<MermaidDiagram & { svg?: string; error?: string }>;
  plantUmlDiagrams: Array<
    PlantUmlDiagram & {
      result?: PlantUmlRenderResult;
      fallbackResult?: KrokiResult;
    }
  >;
  graphvizDiagrams: Array<
    GraphvizDiagram & {
      result?: GraphvizRenderResult;
      fallbackResult?: KrokiResult;
    }
  >;
  krokiMode: AppConfig["kroki"]["mode"];
  krokiDiagrams: Array<KrokiDiagram & { result?: KrokiResult }>;
}): SafeHtml {
  const diagramReference = slot.sourceLocation?.line
    ? `${slot.sourceLocation.sourcePath ?? document.path}:${slot.sourceLocation.line}`
    : undefined;
  const sourceLine = slot.sourceLocation?.line;

  if (slot.renderer === "mermaid") {
    const diagram = mermaidDiagrams.find((item) => item.id === slot.id);
    const content = diagram?.svg
      ? inlineSvgHtml(diagram.svg, {
          allowFitWidth: true,
          sourceLine,
          sourceReference: diagramReference,
        })
      : inlineDiagnosticHtml(minimalDiagramMessage(diagram?.error), {
          sourceLine,
          sourceReference: diagramReference,
        });
    return markSafeHtml(
      `<div class="diagram-inline" data-review-id="mermaid-render">${unwrapSafeHtml(content)}</div>`,
    );
  }

  if (slot.renderer === "plantuml") {
    const diagram = plantUmlDiagrams.find((item) => item.id === slot.id);
    const key = diagramKey(document, "plantuml", slot.id);
    const svg =
      diagram?.result?.status === "rendered"
        ? diagram.result.svg
        : diagram?.fallbackResult?.status === "rendered" &&
            diagram.fallbackResult.mediaType === "image/svg+xml"
          ? diagram.fallbackResult.content
          : undefined;
    const content = svg
      ? inlineSvgHtml(svg, {
          normalizeAspectRatio: Boolean(diagram?.fallbackResult),
          preferNaturalSize: Boolean(diagram?.fallbackResult),
          sourceLine,
          sourceReference: diagramReference,
        })
      : inlineDiagnosticHtml(
          diagramRenderFailureMessage({
            renderer: "plantuml",
            result: diagram?.result,
            fallbackResult: diagram?.fallbackResult,
          }),
          {
            actions: remoteConfirmationRequired(diagram?.fallbackResult)
              ? [krokiConfirmationAction(key)]
              : diagram?.result &&
                  diagram.result.status !== "rendered" &&
                  !diagram.fallbackResult
                ? [
                    krokiFallbackAction({
                      key,
                      mode: krokiMode,
                      renderer: "plantuml",
                    }),
                  ]
                : undefined,
            sourceLine,
            sourceReference: diagramReference,
          },
        );
    return markSafeHtml(
      `<div class="diagram-inline" data-review-id="plantuml-render">${unwrapSafeHtml(content)}</div>`,
    );
  }

  if (slot.renderer === "graphviz") {
    const diagram = graphvizDiagrams.find((item) => item.id === slot.id);
    const key = diagramKey(document, "graphviz", slot.id);
    const svg =
      diagram?.result?.status === "rendered"
        ? diagram.result.svg
        : diagram?.fallbackResult?.status === "rendered" &&
            diagram.fallbackResult.mediaType === "image/svg+xml"
          ? diagram.fallbackResult.content
          : undefined;
    const content = svg
      ? inlineSvgHtml(svg, {
          normalizeAspectRatio: Boolean(diagram?.fallbackResult),
          preferNaturalSize: Boolean(diagram?.fallbackResult),
          sourceLine,
          sourceReference: diagramReference,
        })
      : inlineDiagnosticHtml(
          diagramRenderFailureMessage({
            renderer: "graphviz",
            result: diagram?.result,
            fallbackResult: diagram?.fallbackResult,
          }),
          {
            actions: remoteConfirmationRequired(diagram?.fallbackResult)
              ? [krokiConfirmationAction(key)]
              : diagram?.result &&
                  diagram.result.status !== "rendered" &&
                  !diagram.fallbackResult
                ? [
                    krokiFallbackAction({
                      key,
                      mode: krokiMode,
                      renderer: "graphviz",
                    }),
                  ]
                : undefined,
            sourceLine,
            sourceReference: diagramReference,
          },
        );
    return markSafeHtml(
      `<div class="diagram-inline" data-review-id="graphviz-render">${unwrapSafeHtml(content)}</div>`,
    );
  }

  const diagram = krokiDiagrams.find((item) => item.id === slot.id);
  const result = diagram?.result;
  const key = diagramKey(document, "kroki", slot.id);
  if (
    result?.status === "rendered" &&
    result.content &&
    result.mediaType === "image/svg+xml"
  ) {
    return markSafeHtml(
      `<div class="diagram-inline" data-review-id="kroki-render">${unwrapSafeHtml(
        inlineSvgHtml(result.content, {
          normalizeAspectRatio: true,
          preferNaturalSize: true,
          sourceLine,
          sourceReference: diagramReference,
        }),
      )}</div>`,
    );
  }
  if (
    result?.status === "rendered" &&
    result.content &&
    result.mediaType === "image/png"
  ) {
    return markSafeHtml(
      [
        '<div class="diagram-inline" data-review-id="kroki-render">',
        `<img class="diagram-inline-image" data-review-id="diagram-inline-image"${sourceLine ? ` data-source-line="${sourceLine}"` : ""} alt="${escapeHtml(slot.diagramType)} diagram" src="data:image/png;base64,${result.content}" />`,
        "</div>",
      ].join(""),
    );
  }
  return markSafeHtml(
    `<div class="diagram-inline" data-review-id="kroki-render">${unwrapSafeHtml(
      inlineDiagnosticHtml(minimalDiagramMessage(result?.message), {
        actions: remoteConfirmationRequired(result)
          ? [krokiConfirmationAction(key)]
          : undefined,
        sourceLine,
        sourceReference: diagramReference,
      }),
    )}</div>`,
  );
}

export function applyInlineDiagramsToHtml({
  html,
  document,
  slots,
  mermaidDiagrams,
  plantUmlDiagrams,
  graphvizDiagrams,
  krokiMode,
  krokiDiagrams,
}: {
  html: SafeHtml;
  document: DocumentPayload;
  slots: DiagramSlot[];
  mermaidDiagrams: Array<MermaidDiagram & { svg?: string; error?: string }>;
  plantUmlDiagrams: Array<
    PlantUmlDiagram & {
      result?: PlantUmlRenderResult;
      fallbackResult?: KrokiResult;
    }
  >;
  graphvizDiagrams: Array<
    GraphvizDiagram & {
      result?: GraphvizRenderResult;
      fallbackResult?: KrokiResult;
    }
  >;
  krokiMode: AppConfig["kroki"]["mode"];
  krokiDiagrams: Array<KrokiDiagram & { result?: KrokiResult }>;
}): SafeHtml {
  const parser = new DOMParser();
  const doc = parser.parseFromString(unwrapSafeHtml(html), "text/html");
  const nextSlots = slots.length > 0 ? slots : fallbackDiagramSlots(doc);
  for (const slot of nextSlots) {
    const element = doc.querySelector(
      `.diagram-slot[data-diagram-id="${CSS.escape(slot.id)}"]`,
    );
    if (element) {
      clearDiagramPlaceholderState(element);
      if (element.getAttribute("data-review-id") === "diagram-placeholder-slot") {
        element.removeAttribute("data-review-id");
      }
      setElementSafeHtml(
        element,
        inlineDiagramHtml({
          slot,
          document,
          mermaidDiagrams,
          plantUmlDiagrams,
          graphvizDiagrams,
          krokiMode,
          krokiDiagrams,
        }),
      );
    }
  }

  return markSafeHtml(doc.body.innerHTML);
}
