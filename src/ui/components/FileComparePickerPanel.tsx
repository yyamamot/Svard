import { ArrowLeftRight, FileText, FolderInput, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { documentFormatForPath } from "../../core/documentFormat";
import {
  applyFileCompareDroppedPaths,
  setFileCompareSlot,
  swapFileCompareSlots,
  validateFileCompareSlots,
  type FileCompareSlots,
  type FileCompareSlotSide,
} from "../../core/fileComparePicker";
import type { HostAdapter, NativeFileDropEvent } from "../../core/types";
import { fileName } from "../lib/path";
import {
  clearFileCompareDragData,
  isRecentFileCompareDragSession,
  readCurrentFileCompareDragData,
  readFileCompareDragData,
} from "../lib/fileCompareDrag";

const emptyInternalDropMessage =
  "Drop a markup document from Files, Open Files, or Bookmarks.";

interface FileComparePickerPanelProps {
  initialLeftPath?: string | null;
  host: HostAdapter;
  onChooseDocument: () => Promise<string | null>;
  onClose: () => void;
  onCompare: (leftPath: string, rightPath: string) => Promise<void>;
}

function slotLabel(side: "left" | "right") {
  return side === "left" ? "Base" : "Compare";
}

export function findNativeDropSlot(
  position: NativeFileDropEvent["position"],
): FileCompareSlotSide | null {
  if (!position || typeof document === "undefined") {
    return null;
  }

  const devicePixelRatio =
    typeof window === "undefined" || window.devicePixelRatio <= 0
      ? 1
      : window.devicePixelRatio;
  const candidates = [
    position,
    { x: position.x * devicePixelRatio, y: position.y * devicePixelRatio },
    { x: position.x / devicePixelRatio, y: position.y / devicePixelRatio },
  ];

  for (const candidate of candidates) {
    const element =
      typeof document.elementFromPoint === "function"
        ? document.elementFromPoint(candidate.x, candidate.y)
        : null;
    const slot = element?.closest<HTMLElement>("[data-file-compare-slot]");
    const side = slot?.dataset.fileCompareSlot;
    if (side === "left" || side === "right") {
      return side;
    }
  }

  return nearestNativeDropSlot(candidates);
}

function nearestNativeDropSlot(
  positions: Array<{ x: number; y: number }>,
): FileCompareSlotSide | null {
  const picker = document.querySelector<HTMLElement>(".file-compare-picker");
  const pickerRect = picker?.getBoundingClientRect();
  if (
    pickerRect &&
    !positions.some(
      (position) =>
        position.x >= pickerRect.left &&
        position.x <= pickerRect.right &&
        position.y >= pickerRect.top &&
        position.y <= pickerRect.bottom,
    )
  ) {
    return null;
  }

  const slots = Array.from(
    document.querySelectorAll<HTMLElement>("[data-file-compare-slot]"),
  );
  let best: { side: FileCompareSlotSide; distance: number } | null = null;

  for (const slot of slots) {
    const side = slot.dataset.fileCompareSlot;
    if (side !== "left" && side !== "right") {
      continue;
    }
    const rect = slot.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    for (const position of positions) {
      const distance = Math.hypot(position.x - centerX, position.y - centerY);
      if (!best || distance < best.distance) {
        best = { side, distance };
      }
    }
  }

  return best?.side ?? null;
}

function SlotCard({
  side,
  path,
  isDragOver,
  onChoose,
  onClear,
  onDragOverSlot,
  onDropPath,
  onDropMissing,
}: {
  side: "left" | "right";
  path: string | null;
  isDragOver: boolean;
  onChoose: () => void;
  onClear: () => void;
  onDragOverSlot: (side: "left" | "right" | null) => void;
  onDropPath: (path: string) => void;
  onDropMissing: () => void;
}) {
  return (
    <section
      className={`file-compare-slot ${isDragOver ? "drag-over" : ""}`}
      data-review-id={`file-compare-${side}-slot`}
      data-file-compare-slot={side}
      onDragEnter={(event) => {
        event.preventDefault();
        onDragOverSlot(side);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        onDragOverSlot(side);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          onDragOverSlot(null);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDragOverSlot(null);
        try {
          const nextPath = readFileCompareDragData(event.dataTransfer);
          if (nextPath) {
            onDropPath(nextPath);
          } else {
            onDropMissing();
          }
        } finally {
          clearFileCompareDragData();
        }
      }}
    >
      <div className="file-compare-slot-header">
        <div>
          <h3>{slotLabel(side)}</h3>
        </div>
        <button
          type="button"
          className="button subtle"
          data-review-id={`file-compare-${side}-choose`}
          onClick={onChoose}
        >
          <FolderInput size={15} />
          Choose...
        </button>
      </div>
      {path ? (
        <div className="file-compare-selected">
          <FileText size={18} />
          <div>
            <strong>{fileName(path)}</strong>
            <span>{path}</span>
            <small>{documentFormatForPath(path)}</small>
          </div>
          <button
            type="button"
            className="icon-button compact"
            data-review-id={`file-compare-${side}-clear`}
            aria-label={`Clear ${slotLabel(side)} file`}
            onClick={onClear}
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="file-compare-empty">
          Drop a file here or choose a markup document.
        </div>
      )}
    </section>
  );
}

export function FileComparePickerPanel({
  initialLeftPath = null,
  host,
  onChooseDocument,
  onClose,
  onCompare,
}: FileComparePickerPanelProps) {
  const slotsRef = useRef<FileCompareSlots>({
    leftPath: initialLeftPath,
    rightPath: null,
  });
  const [slots, setSlots] = useState<FileCompareSlots>({
    leftPath: initialLeftPath,
    rightPath: null,
  });
  const [dragOverSide, setDragOverSide] = useState<"left" | "right" | null>(
    null,
  );
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const validation = useMemo(() => validateFileCompareSlots(slots), [slots]);

  useEffect(() => {
    slotsRef.current = slots;
  }, [slots]);

  useEffect(() => {
    let disposed = false;
    let handle: { dispose(): void } | null = null;

    host
      .watchNativeFileDrop((event) => {
        if (disposed) {
          return;
        }
        void handleNativeFileDropEvent(event);
      })
      .then((nextHandle) => {
        if (disposed) {
          nextHandle.dispose();
          return;
        }
        handle = nextHandle;
      })
      .catch((error) => {
        if (!disposed) {
          setValidationMessage(
            error instanceof Error && error.message
              ? error.message
              : "Native file drop is not available.",
          );
        }
      });

    return () => {
      disposed = true;
      handle?.dispose();
    };
  }, [host]);

  async function choose(side: "left" | "right") {
    const path = await onChooseDocument();
    if (!path) {
      return;
    }
    setSlots((current) => setFileCompareSlot(current, side, path));
    setValidationMessage(null);
  }

  async function compare() {
    const nextValidation = validateFileCompareSlots(slots);
    if (nextValidation) {
      setValidationMessage(nextValidation);
      return;
    }
    await onCompare(slots.leftPath!, slots.rightPath!);
  }

  async function handleNativeFileDropEvent(event: NativeFileDropEvent) {
    if (event.type === "leave") {
      setDragOverSide(null);
      return;
    }

    const side = findNativeDropSlot(event.position);
    if (event.type === "enter" || event.type === "over") {
      setDragOverSide(side);
      return;
    }

    setDragOverSide(null);
    if (event.type !== "drop" || !side) {
      return;
    }

    const internalDragPath = readCurrentFileCompareDragData();
    if (!internalDragPath && isRecentFileCompareDragSession()) {
      return;
    }

    const result = await applyFileCompareDroppedPaths({
      slots: slotsRef.current,
      side,
      paths: internalDragPath ? [internalDragPath] : (event.paths ?? []),
      resolvePath: internalDragPath
        ? async (path) => path
        : (path) => host.resolveDroppedDocumentPath(path),
    });
    slotsRef.current = result.slots;
    setSlots(result.slots);
    setValidationMessage(result.message);
    if (internalDragPath) {
      clearFileCompareDragData();
    }
  }

  return (
    <div className="modal-backdrop file-compare-backdrop">
      <section
        className="file-compare-picker"
        data-review-id="file-compare-picker"
        role="dialog"
        aria-label="Compare Files"
      >
        <header className="file-compare-header">
          <div>
            <p className="eyebrow">File Compare</p>
            <h2>Compare Files...</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            data-review-id="file-compare-close"
            aria-label="Close file compare picker"
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </header>
        <div className="file-compare-slots">
          <SlotCard
            side="left"
            path={slots.leftPath}
            isDragOver={dragOverSide === "left"}
            onChoose={() => void choose("left")}
            onClear={() =>
              setSlots((current) => setFileCompareSlot(current, "left", null))
            }
            onDragOverSlot={setDragOverSide}
            onDropPath={(path) => {
              setSlots((current) => setFileCompareSlot(current, "left", path));
              setValidationMessage(null);
            }}
            onDropMissing={() => setValidationMessage(emptyInternalDropMessage)}
          />
          <button
            type="button"
            className="file-compare-swap"
            data-review-id="file-compare-swap"
            aria-label="Swap compare files"
            onClick={() => {
              setSlots((current) => swapFileCompareSlots(current));
              setValidationMessage(null);
            }}
          >
            <ArrowLeftRight size={18} />
          </button>
          <SlotCard
            side="right"
            path={slots.rightPath}
            isDragOver={dragOverSide === "right"}
            onChoose={() => void choose("right")}
            onClear={() =>
              setSlots((current) => setFileCompareSlot(current, "right", null))
            }
            onDragOverSlot={setDragOverSide}
            onDropPath={(path) => {
              setSlots((current) => setFileCompareSlot(current, "right", path));
              setValidationMessage(null);
            }}
            onDropMissing={() => setValidationMessage(emptyInternalDropMessage)}
          />
        </div>
        <footer className="file-compare-footer">
          <p data-review-id="file-compare-validation">
            {validationMessage ?? validation ?? "Ready to compare."}
          </p>
          <div>
            <button type="button" className="button subtle" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="button primary"
              data-review-id="file-compare-run"
              onClick={() => void compare()}
            >
              Compare
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
