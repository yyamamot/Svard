import { diffWords } from "diff";
import type { InlineDiffRange, WordDiffPart } from "./types";

export function normalizedText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function wordDiffParts(left = "", right = ""): WordDiffPart[] {
  return diffWords(left, right).map((part) => ({
    kind: part.added ? "added" : part.removed ? "removed" : "unchanged",
    value: part.value,
  }));
}

export function renderedInlineDiffRanges(
  leftText = "",
  rightText = "",
  side: "left" | "right",
): InlineDiffRange[] {
  const parts = wordDiffParts(leftText, rightText);
  const ranges: InlineDiffRange[] = [];
  let leftOffset = 0;
  let rightOffset = 0;

  for (const part of parts) {
    if (part.kind === "removed") {
      const start = leftOffset;
      leftOffset += part.value.length;
      if (side === "left" && start < leftOffset) {
        ranges.push({ kind: "removed", start, end: leftOffset });
      }
      continue;
    }

    if (part.kind === "added") {
      const start = rightOffset;
      rightOffset += part.value.length;
      if (side === "right" && start < rightOffset) {
        ranges.push({ kind: "added", start, end: rightOffset });
      }
      continue;
    }

    leftOffset += part.value.length;
    rightOffset += part.value.length;
  }

  return ranges.filter((range) => range.end > range.start);
}

export function renderedTextOverlap(
  leftText: string,
  rightText: string,
): number {
  const leftTokens = renderedTextTokens(leftText);
  const rightTokens = renderedTextTokens(rightText);
  const tokenOverlap = jaccardOverlap(leftTokens, rightTokens);
  if (tokenOverlap > 0 || hasWhitespaceSeparatedText(leftText, rightText)) {
    return tokenOverlap;
  }

  return jaccardOverlap(
    renderedCharacterNgrams(leftText),
    renderedCharacterNgrams(rightText),
  );
}

function jaccardOverlap(leftTokens: string[], rightTokens: string[]): number {
  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return 0;
  }
  const rightSet = new Set(rightTokens);
  const shared = new Set(leftTokens.filter((token) => rightSet.has(token)));
  const union = new Set([...leftTokens, ...rightTokens]);
  return shared.size / union.size;
}

function hasWhitespaceSeparatedText(
  leftText: string,
  rightText: string,
): boolean {
  return /\s/.test(leftText) || /\s/.test(rightText);
}

function renderedTextTokens(value: string): string[] {
  return normalizedText(value)
    .toLowerCase()
    .split(/[\s、。,.():/|`*_+\-[\]{}]+/u)
    .filter(Boolean);
}

function renderedCharacterNgrams(value: string): string[] {
  const normalized = normalizedText(value).toLowerCase();
  const compact = Array.from(normalized).filter((char) => !/\s/u.test(char));
  if (compact.length <= 2) {
    return compact.join("") ? [compact.join("")] : [];
  }
  const grams: string[] = [];
  for (let index = 0; index <= compact.length - 2; index += 1) {
    grams.push(`${compact[index]}${compact[index + 1]}`);
  }
  return grams;
}
