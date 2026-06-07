import type { CSSProperties } from "react";
import type { LinkPreviewState } from "../lib/linkPreview";

interface LinkPreviewPopoverProps {
  preview: LinkPreviewState | null;
}

const popoverWidth = 320;
const viewportPadding = 12;

export function LinkPreviewPopover({ preview }: LinkPreviewPopoverProps) {
  if (!preview) {
    return null;
  }

  const style: CSSProperties = {
    left: Math.max(
      viewportPadding,
      Math.min(preview.x, window.innerWidth - popoverWidth - viewportPadding),
    ),
    top: Math.max(
      viewportPadding,
      Math.min(preview.y + 8, window.innerHeight - 180),
    ),
  };

  return (
    <div
      className={`link-preview-popover ${preview.status}`}
      data-review-id="link-preview-popover"
      role="status"
      style={style}
    >
      {preview.status === "loading" ? (
        <div data-review-id="link-preview-status">Loading preview…</div>
      ) : (
        <>
          {preview.title && (
            <div
              className="link-preview-title"
              data-review-id="link-preview-title"
            >
              {preview.title}
            </div>
          )}
          {preview.heading && (
            <div
              className="link-preview-heading"
              data-review-id="link-preview-heading"
            >
              {preview.heading}
            </div>
          )}
          {preview.snippet && (
            <p
              className="link-preview-snippet"
              data-review-id="link-preview-snippet"
            >
              {preview.snippet}
            </p>
          )}
          {preview.message && (
            <div
              className="link-preview-status"
              data-review-id="link-preview-status"
            >
              {preview.message}
            </div>
          )}
        </>
      )}
    </div>
  );
}
