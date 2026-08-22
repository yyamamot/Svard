export type LocalImageResolution =
  | { status: "passthrough"; src: string }
  | { status: "external-blocked" }
  | { status: "blocked"; placeholderText: string }
  | { status: "local"; source: string };

export type MarkdownAuthorImageIntent =
  | { kind: "external"; url: string }
  | { kind: "local"; source: string }
  | {
      kind: "blocked";
      reason:
        | "empty"
        | "malformed"
        | "unsupported"
        | "protocol-relative"
        | "absolute-path";
    };

interface ResolveLocalImageOptions {
  allowLocalImages: boolean;
  showExternalImages?: boolean;
}

const externalImagePattern = /^https?:/i;
const dataImagePattern = /^data:image\//i;
const maxDataImageSourceLength = 256 * 1024;
const asciiEdgeWhitespace = /^[\t\n\f\r ]+|[\t\n\f\r ]+$/gu;
const schemePrefix = /^[A-Za-z][A-Za-z0-9+.-]*:/u;
const windowsAbsolutePath = /^[A-Za-z]:[\\/]/u;

function containsAsciiControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x1f || codePoint === 0x7f;
  });
}

export function classifyMarkdownAuthorImageSource(
  rawSource: string,
): MarkdownAuthorImageIntent {
  const source = rawSource.replace(asciiEdgeWhitespace, "");
  if (!source) return { kind: "blocked", reason: "empty" };
  if (containsAsciiControlCharacter(source)) {
    return { kind: "blocked", reason: "malformed" };
  }
  if (source.startsWith("//") || source.startsWith("\\\\")) {
    return { kind: "blocked", reason: "protocol-relative" };
  }
  if (windowsAbsolutePath.test(source)) {
    return { kind: "blocked", reason: "absolute-path" };
  }
  try {
    decodeURI(source);
  } catch {
    return { kind: "blocked", reason: "malformed" };
  }
  if (schemePrefix.test(source)) {
    try {
      const url = new URL(source);
      return url.protocol === "http:" || url.protocol === "https:"
        ? { kind: "external", url: url.href }
        : { kind: "blocked", reason: "unsupported" };
    } catch {
      return { kind: "blocked", reason: "malformed" };
    }
  }
  if (source.startsWith("#")) {
    return { kind: "blocked", reason: "unsupported" };
  }
  return { kind: "local", source };
}

export function resolveLocalImageSource(
  source: string,
  options: ResolveLocalImageOptions,
): LocalImageResolution {
  if (dataImagePattern.test(source)) {
    if (source.length > maxDataImageSourceLength) {
      return {
        status: "blocked",
        placeholderText: "Data image blocked: image is too large",
      };
    }
    return { status: "passthrough", src: source };
  }

  if (/^data:/i.test(source)) {
    return {
      status: "blocked",
      placeholderText: "Data image blocked: unsupported media type",
    };
  }

  const normalizedSource = source.replace(asciiEdgeWhitespace, "");
  if (externalImagePattern.test(normalizedSource)) {
    const intent = classifyMarkdownAuthorImageSource(normalizedSource);
    if (intent.kind !== "external") {
      return {
        status: "blocked",
        placeholderText: "External image blocked",
      };
    }
    return options.showExternalImages
      ? { status: "passthrough", src: intent.url }
      : { status: "external-blocked" };
  }

  if (!options.allowLocalImages) {
    return {
      status: "blocked",
      placeholderText: `Local image blocked: ${source}`,
    };
  }

  return {
    status: "local",
    source,
  };
}
