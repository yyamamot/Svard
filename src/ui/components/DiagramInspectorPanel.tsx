import { Copy, ExternalLink, FileCode2, Image, Save } from "lucide-react";
import type { DiagramInspectorItem } from "../lib/diagramInspector";

interface DiagramInspectorPanelProps {
  items: DiagramInspectorItem[];
  selectedDiagramId: string | null;
  onCopyText: (label: string, content?: string) => Promise<void>;
  onNavigateSourceLine: (line: number) => void;
  onOpenPreview: (item: DiagramInspectorItem) => void;
  onSelectDiagram: (id: string) => void;
  onShowNotice: (
    message: string,
    options?: { tone?: "info" | "success" | "warning" | "error" },
  ) => void;
}

export function DiagramInspectorPanel({
  items,
  selectedDiagramId,
  onCopyText,
  onNavigateSourceLine,
  onOpenPreview,
  onSelectDiagram,
  onShowNotice,
}: DiagramInspectorPanelProps) {
  const selectedItem =
    items.find((item) => item.id === selectedDiagramId) ?? items[0] ?? null;

  if (items.length === 0) {
    return (
      <div data-review-id="diagram-inspector">
        <div className="panel-heading-row">
          <h2>Diagram Inspector</h2>
        </div>
        <p className="diagram-inspector-empty">No diagrams in this file</p>
      </div>
    );
  }

  return (
    <div data-review-id="diagram-inspector">
      <div className="panel-heading-row">
        <h2>Diagram Inspector</h2>
        <span className="diagram-inspector-count">{items.length}</span>
      </div>
      <div
        className="diagram-inspector-list"
        data-review-id="diagram-inspector-list"
      >
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`diagram-inspector-item${
              item.id === selectedItem?.id ? " active" : ""
            }`}
            data-review-id="diagram-inspector-item"
            onClick={() => onSelectDiagram(item.id)}
          >
            <span className="diagram-inspector-item-main">
              <span className="diagram-inspector-type">{item.diagramType}</span>
              <span className={`diagram-inspector-status ${item.status}`}>
                {item.status}
              </span>
            </span>
            <span className="diagram-inspector-item-meta">
              <span>{item.renderer}</span>
              {item.sourceLocation?.line ? (
                <span>line {item.sourceLocation.line}</span>
              ) : null}
            </span>
          </button>
        ))}
      </div>
      {selectedItem ? (
        <DiagramInspectorDetails
          item={selectedItem}
          onCopyText={onCopyText}
          onNavigateSourceLine={onNavigateSourceLine}
          onOpenPreview={onOpenPreview}
          onShowNotice={onShowNotice}
        />
      ) : null}
    </div>
  );
}

function DiagramInspectorDetails({
  item,
  onCopyText,
  onNavigateSourceLine,
  onOpenPreview,
  onShowNotice,
}: {
  item: DiagramInspectorItem;
  onCopyText: DiagramInspectorPanelProps["onCopyText"];
  onNavigateSourceLine: DiagramInspectorPanelProps["onNavigateSourceLine"];
  onOpenPreview: DiagramInspectorPanelProps["onOpenPreview"];
  onShowNotice: DiagramInspectorPanelProps["onShowNotice"];
}) {
  async function saveSvg() {
    if (!item.svg) {
      onShowNotice("Diagram SVG is not available", { tone: "warning" });
      return;
    }
    const blob = new Blob([item.svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${item.id}.svg`;
    anchor.rel = "noopener";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    onShowNotice("Diagram SVG saved", { tone: "success" });
  }

  return (
    <div
      className="diagram-inspector-details"
      data-review-id="diagram-inspector-details"
    >
      <dl className="diagram-inspector-facts">
        <InspectorFact label="Renderer" value={item.renderer} />
        <InspectorFact label="Type" value={item.diagramType} />
        <InspectorFact label="Render path" value={item.renderPath} />
        <InspectorFact label="Status" value={item.status} />
        <InspectorFact label="Cache" value={item.cacheStatus} />
        <InspectorFact label="Source" value={item.sourceReference} />
      </dl>
      {item.message ? (
        <p className="diagram-inspector-message">{item.message}</p>
      ) : null}
      {item.metrics ? (
        <div className="diagram-inspector-metrics">
          {Object.entries(item.metrics).map(([key, value]) => (
            <span key={key}>
              {key}: {formatMetricValue(value)}
            </span>
          ))}
        </div>
      ) : null}
      <div className="diagram-inspector-actions">
        {item.svg ? (
          <button
            type="button"
            data-review-id="diagram-inspector-open-preview"
            onClick={() => onOpenPreview(item)}
          >
            <Image size={14} />
            Open Preview
          </button>
        ) : null}
        {item.sourceReference ? (
          <button
            type="button"
            onClick={() =>
              onCopyText("Diagram reference", item.sourceReference)
            }
          >
            <Copy size={14} />
            Copy Reference
          </button>
        ) : null}
        {item.source ? (
          <button
            type="button"
            onClick={() => onCopyText("Diagram source", item.source)}
          >
            <FileCode2 size={14} />
            Copy Source
          </button>
        ) : null}
        {item.svg ? (
          <button
            type="button"
            onClick={() => onCopyText("Diagram SVG", item.svg)}
          >
            <Copy size={14} />
            Copy SVG
          </button>
        ) : null}
        {item.svg ? (
          <button
            type="button"
            data-review-id="diagram-inspector-save-svg"
            onClick={() => void saveSvg()}
          >
            <Save size={14} />
            Save SVG
          </button>
        ) : null}
        {item.sourceLocation?.line ? (
          <button
            type="button"
            onClick={() => {
              if (item.sourceLocation?.sourcePath) {
                void onCopyText("Diagram reference", item.sourceReference);
                onShowNotice("Diagram source reference copied", {
                  tone: "info",
                });
                return;
              }
              onNavigateSourceLine(item.sourceLocation!.line!);
            }}
          >
            <ExternalLink size={14} />
            Open Source Line
          </button>
        ) : null}
      </div>
    </div>
  );
}

function InspectorFact({ label, value }: { label: string; value?: string }) {
  if (!value) {
    return null;
  }
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

function formatMetricValue(value: number | string): string {
  if (typeof value === "string") {
    return value;
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
