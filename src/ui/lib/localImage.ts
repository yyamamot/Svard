export type LocalImageResolution =
  | { status: "passthrough"; src: string }
  | { status: "external-blocked" }
  | { status: "blocked"; placeholderText: string }
  | { status: "local"; source: string };

interface ResolveLocalImageOptions {
  allowLocalImages: boolean;
  showExternalImages?: boolean;
}

const externalImagePattern = /^https?:/i;
const dataImagePattern = /^data:image\//i;
const maxDataImageSourceLength = 256 * 1024;

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

  if (externalImagePattern.test(source)) {
    return options.showExternalImages
      ? { status: "passthrough", src: source }
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
