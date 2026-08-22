import type { MouseEvent } from "react";
import type { DocumentLinkResolution } from "../../core/types";
import { isSupportedDocumentPath } from "../../core/documentFormat";
import { splitPathAndHash } from "./path";

export type DocumentLinkBlockedReason =
  | "empty"
  | "malformed"
  | "unsupported"
  | "protocol-relative"
  | "disallowed-gesture";

export type DocumentLinkIntent =
  | { kind: "fragment"; fragment: string }
  | { kind: "document"; href: string }
  | { kind: "external"; url: string }
  | { kind: "blocked"; reason: DocumentLinkBlockedReason };

const asciiEdgeWhitespace = /^[\t\n\f\r ]+|[\t\n\f\r ]+$/gu;
const schemePrefix = /^[A-Za-z][A-Za-z0-9+.-]*:/u;
const windowsAbsolutePath = /^[A-Za-z]:[\\/]/u;

function trimAsciiWhitespace(value: string): string {
  return value.replace(asciiEdgeWhitespace, "");
}

function hasValidPercentEncoding(value: string): boolean {
  try {
    decodeURI(value);
    return true;
  } catch {
    return false;
  }
}

export function classifyDocumentLinkHref(rawHref: string): DocumentLinkIntent {
  const href = trimAsciiWhitespace(rawHref);
  if (!href) {
    return { kind: "blocked", reason: "empty" };
  }
  if (href.startsWith("//") || href.startsWith("\\\\")) {
    return { kind: "blocked", reason: "protocol-relative" };
  }
  if (href.startsWith("#")) {
    if (href.length === 1) {
      return { kind: "blocked", reason: "empty" };
    }
    try {
      const fragment = decodeURIComponent(href.slice(1));
      encodeURIComponent(fragment);
      return {
        kind: "fragment",
        fragment,
      };
    } catch {
      return { kind: "blocked", reason: "malformed" };
    }
  }
  if (!hasValidPercentEncoding(href)) {
    return { kind: "blocked", reason: "malformed" };
  }
  if (schemePrefix.test(href) && !windowsAbsolutePath.test(href)) {
    try {
      const url = new URL(href);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return { kind: "blocked", reason: "unsupported" };
      }
      return { kind: "external", url: url.href };
    } catch {
      return { kind: "blocked", reason: "malformed" };
    }
  }
  if (isSupportedDocumentPath(splitPathAndHash(href).path)) {
    return { kind: "document", href };
  }
  return { kind: "blocked", reason: "unsupported" };
}

export function canonicalDocumentLinkHref(
  intent: Exclude<DocumentLinkIntent, { kind: "blocked" }>,
): string {
  if (intent.kind === "fragment") {
    return `#${encodeURIComponent(intent.fragment)}`;
  }
  if (intent.kind === "external") {
    return intent.url;
  }
  return /^(?:\.{0,2}[\\/]|[A-Za-z]:[\\/])/u.test(intent.href)
    ? intent.href
    : `./${intent.href}`;
}

function absolutePathParts(path: string): {
  root: string;
  parts: string[];
} | null {
  const normalized = path.replaceAll("\\", "/");
  const drive = normalized.match(/^([A-Za-z]:)\//u);
  if (drive) {
    return {
      root: drive[1]!.toLowerCase(),
      parts: normalized.slice(drive[0].length).split("/").filter(Boolean),
    };
  }
  if (!normalized.startsWith("/")) {
    return null;
  }
  return {
    root: "/",
    parts: normalized.slice(1).split("/").filter(Boolean),
  };
}

export function relativeResolvedDocumentHref(
  documentPath: string,
  resolvedPath: string,
  fragment: string | null | undefined,
): string | null {
  const source = absolutePathParts(documentPath);
  const target = absolutePathParts(resolvedPath);
  if (!source || !target || source.root !== target.root) {
    return null;
  }
  const sourceDirectory = source.parts.slice(0, -1);
  let commonLength = 0;
  while (
    commonLength < sourceDirectory.length &&
    commonLength < target.parts.length &&
    sourceDirectory[commonLength] === target.parts[commonLength]
  ) {
    commonLength += 1;
  }
  const relativeParts = [
    ...Array(sourceDirectory.length - commonLength).fill(".."),
    ...target.parts.slice(commonLength),
  ];
  const relativePath = relativeParts.join("/");
  if (!relativePath || !isSupportedDocumentPath(relativePath)) {
    return null;
  }
  const href = fragment
    ? `${relativePath}#${encodeURIComponent(fragment)}`
    : relativePath;
  return canonicalDocumentLinkHref({ kind: "document", href });
}

function isUnmodifiedPrimaryActivation(event: MouseEvent<HTMLElement>) {
  return (
    event.button === 0 &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey
  );
}

export interface CapturedDocumentLinkActivation {
  link: HTMLAnchorElement;
  intent: DocumentLinkIntent;
}

export function captureDocumentLinkActivation(
  event: MouseEvent<HTMLElement>,
): CapturedDocumentLinkActivation | null {
  const target = event.target;
  if (!(target instanceof Element)) {
    return null;
  }
  const link = target.closest<HTMLAnchorElement>("a[href]");
  if (!link || !event.currentTarget.contains(link)) {
    return null;
  }
  event.preventDefault();
  event.stopPropagation();
  if (!isUnmodifiedPrimaryActivation(event)) {
    return {
      link,
      intent: { kind: "blocked", reason: "disallowed-gesture" },
    };
  }
  return {
    link,
    intent: classifyDocumentLinkHref(link.getAttribute("href") ?? ""),
  };
}

export interface ActivateDocumentLinkOptions {
  documentPath: string | null;
  confirmExternalLink: (url: string) => Promise<boolean>;
  openDocument: (path: string) => Promise<void>;
  openExternalUrl: (url: string) => Promise<void>;
  resolveDocumentLink: (
    href: string,
    documentPath: string,
  ) => Promise<DocumentLinkResolution>;
  navigateFragment: (
    fragment: string,
    context: { afterDocumentOpen: boolean },
  ) => void;
  showInlineNotice: (
    message: string,
    options?: { tone?: "info" | "success" | "warning" | "error" },
  ) => void;
}

export async function activateDocumentLinkIntent(
  intent: DocumentLinkIntent,
  options: ActivateDocumentLinkOptions,
): Promise<void> {
  if (intent.kind === "blocked") {
    return;
  }
  if (intent.kind === "fragment") {
    options.navigateFragment(intent.fragment, { afterDocumentOpen: false });
    return;
  }
  if (intent.kind === "external") {
    if (!(await options.confirmExternalLink(intent.url))) {
      return;
    }
    try {
      await options.openExternalUrl(intent.url);
    } catch (error) {
      options.showInlineNotice(
        error instanceof Error ? error.message : "External link open failed",
        { tone: "error" },
      );
    }
    return;
  }
  if (!options.documentPath) {
    options.showInlineNotice("Document link is not available", {
      tone: "warning",
    });
    return;
  }
  const target = splitPathAndHash(intent.href);
  const resolved = await options.resolveDocumentLink(
    intent.href,
    options.documentPath,
  );
  if (resolved.status !== "resolved" || !resolved.path) {
    options.showInlineNotice(
      resolved.message ?? "Document link is not available",
      { tone: "warning" },
    );
    return;
  }
  await options.openDocument(resolved.path);
  const fragment = resolved.hash ?? target.hash;
  if (fragment) {
    window.setTimeout(
      () => options.navigateFragment(fragment, { afterDocumentOpen: true }),
      50,
    );
  }
}

export function deactivateUnresolvedDocumentLinksInPlace(root: ParentNode) {
  for (const link of root.querySelectorAll<HTMLAnchorElement>("a")) {
    link.removeAttribute("target");
    link.removeAttribute("download");
    link.removeAttribute("ping");
    link.removeAttribute("referrerpolicy");
    const rawHref = link.getAttribute("href");
    if (rawHref === null) {
      continue;
    }
    const intent = classifyDocumentLinkHref(rawHref);
    if (intent.kind === "fragment" || intent.kind === "external") {
      link.setAttribute("href", canonicalDocumentLinkHref(intent));
    } else {
      link.removeAttribute("href");
    }
  }
}
