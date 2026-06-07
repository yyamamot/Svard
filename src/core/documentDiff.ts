import { structuredPatch } from "diff";
import {
  documentFormatForPath,
  isSupportedDocumentPath,
} from "./documentFormat";
import type { DocumentDiffPreview, GitDiffHunk, GitDiffLine } from "./types";

function fileName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}

function lineCount(source: string): number {
  if (!source) {
    return 0;
  }
  return source.split(/\r?\n/).length;
}

export function diffHunksFromText(
  leftText: string,
  rightText: string,
): GitDiffHunk[] {
  const patch = structuredPatch("left", "right", leftText, rightText, "", "", {
    context: 3,
  });

  return patch.hunks.map((hunk) => {
    let oldLine = hunk.oldStart;
    let newLine = hunk.newStart;
    const lines: GitDiffLine[] = [];

    for (const rawLine of hunk.lines) {
      if (rawLine.startsWith("\\")) {
        continue;
      }
      const prefix = rawLine.at(0);
      const text = rawLine.slice(1);
      if (prefix === "+") {
        lines.push({
          kind: "added",
          oldLine: null,
          newLine,
          text,
        });
        newLine += 1;
      } else if (prefix === "-") {
        lines.push({
          kind: "removed",
          oldLine,
          newLine: null,
          text,
        });
        oldLine += 1;
      } else {
        lines.push({
          kind: "context",
          oldLine,
          newLine,
          text,
        });
        oldLine += 1;
        newLine += 1;
      }
    }

    return {
      oldStart: hunk.oldStart,
      oldLines: hunk.oldLines,
      newStart: hunk.newStart,
      newLines: hunk.newLines,
      lines,
    };
  });
}

export function buildFileDocumentDiffPreview({
  leftPath,
  leftText,
  rightPath,
  rightText,
}: {
  leftPath: string;
  leftText: string;
  rightPath: string;
  rightText: string;
}): DocumentDiffPreview {
  const leftFormat = documentFormatForPath(leftPath);
  const rightFormat = documentFormatForPath(rightPath);
  if (leftPath === rightPath) {
    throw new Error("Choose a different document to compare.");
  }
  if (
    !isSupportedDocumentPath(leftPath) ||
    !isSupportedDocumentPath(rightPath)
  ) {
    throw new Error("File diff is available for markup documents only.");
  }
  if (leftFormat !== rightFormat) {
    throw new Error("File diff requires documents with the same format.");
  }

  const hunks = diffHunksFromText(leftText, rightText);
  const same = hunks.length === 0;
  return {
    source: "file",
    repositoryRoot: null,
    relativePath: `${fileName(leftPath)} ↔ ${fileName(rightPath)}`,
    leftPath,
    rightPath,
    status: same ? "clean" : "modified",
    leftLabel: fileName(leftPath),
    rightLabel: fileName(rightPath),
    hunks,
    message: same
      ? `No differences between ${fileName(leftPath)} and ${fileName(
          rightPath,
        )}.`
      : null,
    leftText,
    rightText,
  };
}

export function buildUntrackedDocumentDiffPreview({
  path,
  text,
}: {
  path: string;
  text: string;
}): DocumentDiffPreview {
  return {
    source: "git",
    repositoryRoot: null,
    relativePath: path.replace(/^\/workspace\//, ""),
    leftPath: null,
    rightPath: path,
    status: "untracked",
    leftLabel: "HEAD",
    rightLabel: "Working Tree",
    hunks: [
      {
        oldStart: 0,
        oldLines: 0,
        newStart: 1,
        newLines: lineCount(text),
        lines: text.split(/\r?\n/).map((line, index) => ({
          kind: "added",
          oldLine: null,
          newLine: index + 1,
          text: line,
        })),
      },
    ],
    message: null,
    leftText: null,
    rightText: text,
  };
}
