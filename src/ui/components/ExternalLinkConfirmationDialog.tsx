interface ExternalLinkConfirmationDialogProps {
  url: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ExternalLinkConfirmationDialog({
  url,
  onCancel,
  onConfirm,
}: ExternalLinkConfirmationDialogProps) {
  return (
    <div
      className="modal-backdrop external-link-confirmation-backdrop"
      data-review-id="external-link-confirmation-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <section
        className="external-link-confirmation-dialog"
        data-review-id="external-link-confirmation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="external-link-confirmation-title"
      >
        <header>
          <p>External Link</p>
          <h2 id="external-link-confirmation-title">Open external link?</h2>
        </header>
        <div className="external-link-confirmation-body">
          <p>This document wants to open an external URL.</p>
          <code data-review-id="external-link-confirmation-url">{url}</code>
        </div>
        <footer>
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            data-review-id="external-link-confirmation-open"
            onClick={onConfirm}
          >
            Open Link
          </button>
        </footer>
      </section>
    </div>
  );
}
