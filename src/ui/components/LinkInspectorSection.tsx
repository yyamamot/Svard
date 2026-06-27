import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type {
  DocumentBacklinkInspectorRow,
  DocumentLinkInspectorModel,
  DocumentLinkInspectorRow,
} from "../lib/documentLinkInspector";

interface LinkInspectorSectionProps {
  model: DocumentLinkInspectorModel;
  onOpenDocument: (path: string) => void | Promise<void>;
}

export function LinkInspectorSection({
  model,
  onOpenDocument,
}: LinkInspectorSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const count = model.outgoing.length + model.backlinks.length;
  const bodyVisible = expanded;

  return (
    <section
      className="contents-section link-inspector-section"
      data-review-id="link-inspector-section"
    >
      <button
        type="button"
        className="contents-section-header"
        data-review-id="link-inspector-toggle"
        aria-expanded={bodyVisible}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="contents-section-title">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Links
        </span>
        <span className="contents-section-count">{count}</span>
      </button>
      {bodyVisible ? (
        <div className="link-inspector-body">
          <LinkGroup
            emptyText="No document links"
            label="Outgoing"
            reviewId="link-inspector-outgoing"
            rows={model.outgoing}
            onOpenDocument={onOpenDocument}
          />
          <BacklinkGroup
            rows={model.backlinks}
            onOpenDocument={onOpenDocument}
          />
        </div>
      ) : null}
    </section>
  );
}

function LinkGroup({
  emptyText,
  label,
  reviewId,
  rows,
  onOpenDocument,
}: {
  emptyText: string;
  label: string;
  reviewId: string;
  rows: DocumentLinkInspectorRow[];
  onOpenDocument: (path: string) => void | Promise<void>;
}) {
  return (
    <div className="link-inspector-group" data-review-id={reviewId}>
      <div className="link-inspector-group-title">{label}</div>
      {rows.length > 0 ? (
        <div className="link-inspector-list">
          {rows.map((row) => (
            <LinkRow
              key={row.id}
              row={row}
              onOpenDocument={onOpenDocument}
            />
          ))}
        </div>
      ) : (
        <p className="link-inspector-empty">{emptyText}</p>
      )}
    </div>
  );
}

function BacklinkGroup({
  rows,
  onOpenDocument,
}: {
  rows: DocumentBacklinkInspectorRow[];
  onOpenDocument: (path: string) => void | Promise<void>;
}) {
  return (
    <LinkGroup
      emptyText="No loaded documents link here"
      label="Backlinks from loaded docs"
      reviewId="link-inspector-backlinks"
      rows={rows}
      onOpenDocument={onOpenDocument}
    />
  );
}

function LinkRow({
  row,
  onOpenDocument,
}: {
  row: DocumentLinkInspectorRow;
  onOpenDocument: (path: string) => void | Promise<void>;
}) {
  return (
    <button
      type="button"
      className="link-inspector-row"
      data-review-id="link-inspector-item"
      onClick={() => void onOpenDocument(row.path)}
    >
      <span className="link-inspector-label">
        {row.label}
        {row.count > 1 ? (
          <span className="link-inspector-count">×{row.count}</span>
        ) : null}
      </span>
      <span className="link-inspector-meta">{row.displayPath}</span>
    </button>
  );
}
