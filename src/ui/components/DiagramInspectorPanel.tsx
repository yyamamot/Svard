import { Copy, FileCode2, Image, MoreHorizontal, Save } from "lucide-react";
import type { DiagramInspectorItem } from "../lib/diagramInspector";
import { copySvgToClipboard } from "../lib/imageClipboard";
import { diagramSvgFileName } from "../lib/diagramFileName";

interface DiagramInspectorPanelProps {
  items: DiagramInspectorItem[];
  selectedDiagramId: string | null;
  onCopyText: (label: string, content?: string) => Promise<void>;
  onSaveSvg?: (fileName: string, svg: string) => Promise<boolean>;
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
  onSaveSvg,
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
          onSaveSvg={onSaveSvg}
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
  onSaveSvg,
  onOpenPreview,
  onShowNotice,
}: {
  item: DiagramInspectorItem;
  onCopyText: DiagramInspectorPanelProps["onCopyText"];
  onSaveSvg: DiagramInspectorPanelProps["onSaveSvg"];
  onOpenPreview: DiagramInspectorPanelProps["onOpenPreview"];
  onShowNotice: DiagramInspectorPanelProps["onShowNotice"];
}) {
  async function saveSvg() {
    if (!item.svg) {
      onShowNotice("Diagram SVG is not available", { tone: "warning" });
      return;
    }
    if (onSaveSvg) {
      try {
        if (
          await onSaveSvg(
            diagramSvgFileName({
              documentPath: item.sourceLocation?.sourcePath,
              diagramType: item.diagramType,
              sourceReference: item.sourceReference,
            }),
            item.svg,
          )
        ) {
          onShowNotice("Diagram SVG saved", { tone: "success" });
          return;
        }
      } catch {
        onShowNotice("Diagram SVG could not be saved", { tone: "warning" });
        return;
      }
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

  async function copyImage() {
    if (!item.svg) return;
    try {
      await copySvgToClipboard(item.svg);
      onShowNotice("Image copied", { tone: "success" });
    } catch {
      onShowNotice("Image could not be copied", { tone: "warning" });
    }
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
        {item.svg ? (
          <button
            type="button"
            data-review-id="diagram-inspector-copy-image"
            onClick={() => void copyImage()}
          >
            <Copy size={14} />
            Copy Image
          </button>
        ) : null}
        {item.sourceReference || item.source || item.svg ? (
          <details className="diagram-inspector-more">
            <summary aria-label="More diagram actions">
              <MoreHorizontal size={16} />
            </summary>
            <div>
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
                  data-review-id="diagram-inspector-save-svg"
                  onClick={() => void saveSvg()}
                >
                  <Save size={14} />
                  Save SVG
                </button>
              ) : null}
            </div>
          </details>
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
