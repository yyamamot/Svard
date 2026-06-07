import { isSupportedDocumentPath } from "./documentFormat";

export interface FileCompareSlots {
  leftPath: string | null;
  rightPath: string | null;
}

export type FileCompareSlotSide = "left" | "right";

export interface FileCompareDropResult {
  slots: FileCompareSlots;
  message: string | null;
}

export function setFileCompareSlot(
  slots: FileCompareSlots,
  side: FileCompareSlotSide,
  path: string | null,
): FileCompareSlots {
  return side === "left"
    ? { ...slots, leftPath: path }
    : { ...slots, rightPath: path };
}

export function swapFileCompareSlots(
  slots: FileCompareSlots,
): FileCompareSlots {
  return {
    leftPath: slots.rightPath,
    rightPath: slots.leftPath,
  };
}

export function validateFileCompareSlots(
  slots: FileCompareSlots,
): string | null {
  if (!slots.leftPath || !slots.rightPath) {
    return "Choose a base file and a compare file.";
  }
  if (
    !isSupportedDocumentPath(slots.leftPath) ||
    !isSupportedDocumentPath(slots.rightPath)
  ) {
    return "File compare is available for markup documents only.";
  }
  if (slots.leftPath === slots.rightPath) {
    return "Choose two different markup documents to compare.";
  }
  return null;
}

export async function applyFileCompareDroppedPaths({
  slots,
  side,
  paths,
  resolvePath,
}: {
  slots: FileCompareSlots;
  side: FileCompareSlotSide;
  paths: string[];
  resolvePath: (path: string) => Promise<string>;
}): Promise<FileCompareDropResult> {
  if (paths.length !== 1) {
    return {
      slots,
      message: "Drop one markup document at a time.",
    };
  }

  let resolvedPath: string;
  try {
    resolvedPath = await resolvePath(paths[0]);
  } catch (error) {
    return {
      slots,
      message:
        error instanceof Error && error.message
          ? error.message
          : "File compare is available for markup documents only.",
    };
  }

  if (!isSupportedDocumentPath(resolvedPath)) {
    return {
      slots,
      message: "File compare is available for markup documents only.",
    };
  }

  const oppositePath = side === "left" ? slots.rightPath : slots.leftPath;
  if (oppositePath === resolvedPath) {
    return {
      slots,
      message: "Choose two different markup documents to compare.",
    };
  }

  return {
    slots: setFileCompareSlot(slots, side, resolvedPath),
    message: null,
  };
}
