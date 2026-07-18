import type { GitCommitDetails } from "../../core/types";
import { buildDocumentDiffStreamItems } from "../lib/documentDiffStream";
import type { DocumentDiffStreamPreview } from "../../core/types";

export function GitCommitDetailsPanel({
  details,
  onClose,
  onOpenFile,
  onOpenAllDiffs,
}: {
  details: GitCommitDetails;
  onClose: () => void;
  onOpenFile: (path: string) => void;
  onOpenAllDiffs: (preview: DocumentDiffStreamPreview) => void;
}) {
  return (
    <div className="modal-backdrop git-commit-details-backdrop">
      <section
        className="git-commit-details-panel"
        data-review-id="git-commit-details-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Git commit details"
      >
        <header className="git-commit-details-header">
          <div>
            <p>Commit</p>
            <h2>{details.summary}</h2>
            <span>
              {details.shortHash} · {details.author} ·{" "}
              {formatCommitDetailsDate(details.date)}
            </span>
          </div>
          <button
            type="button"
            data-review-id="git-commit-details-all-diffs"
            onClick={() => {
              onOpenAllDiffs({
                source: "git-commit-stream",
                repositoryRoot: details.repositoryRoot,
                items: buildDocumentDiffStreamItems(details.files, {
                  repositoryRoot: details.repositoryRoot,
                }),
                revision: details.revision,
                comparisonLabel: `Parent → ${details.shortHash}`,
              });
              onClose();
            }}
          >
            All diffs
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Close commit details"
            onClick={onClose}
          >
            X
          </button>
        </header>
        <div className="git-commit-details-body">
          <h3>Changed Files</h3>
          {details.files.length > 0 ? (
            <div className="git-commit-file-list">
              {details.files.map((file) => (
                <button
                  type="button"
                  key={`${file.path}:${file.status}`}
                  className="git-commit-file-row"
                  data-review-id="git-commit-details-file"
                  disabled={!file.documentPath}
                  onClick={() => {
                    if (file.documentPath) {
                      onOpenFile(file.documentPath);
                    }
                  }}
                  title={
                    file.documentPath
                      ? "Open changes for this file"
                      : "Preview diff is available for markup documents only"
                  }
                >
                  <span>{file.path}</span>
                  <span className={`git-commit-file-status ${file.status}`}>
                    {file.status}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="git-commit-details-empty">No changed files found.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function formatCommitDetailsDate(value: string): string {
  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return new Date(seconds * 1000).toLocaleString();
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleString();
  }
  return value;
}
