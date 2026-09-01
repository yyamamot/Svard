import type { RenderResult } from "../../core/types";

export const localRasterPayloadSlotAttribute = "data-svard-local-raster-slot";

interface ResolvedLocalRasterPayload {
  dataUrl: string;
  slot: string;
}

export interface ResolvedLocalRasterPayloadInput {
  dataUrl: string;
  image: HTMLImageElement;
  slot: string;
}

export interface ResolvedLocalRasterHydrationResult {
  hydratedCount: number;
  status: "applied" | "invalid" | "unused";
}

const payloadsByRenderResult = new WeakMap<
  RenderResult,
  readonly ResolvedLocalRasterPayload[]
>();

const rasterMediaTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export function createLocalRasterPayloadSlot(): string | null {
  const crypto = globalThis.crypto;
  const randomUuid = crypto?.randomUUID?.();
  if (randomUuid) return randomUuid;
  if (!crypto?.getRandomValues) return null;
  const values = crypto.getRandomValues(new Uint32Array(4));
  return Array.from(values, (value) =>
    value.toString(16).padStart(8, "0"),
  ).join("");
}

export function isResolvedLocalRasterMediaType(mediaType: string): boolean {
  return rasterMediaTypes.has(mediaType.toLowerCase());
}

function isResolvedLocalRasterDataUrl(dataUrl: string): boolean {
  const prefix = dataUrl.slice(0, 48).toLowerCase();
  return [...rasterMediaTypes].some((mediaType) =>
    prefix.startsWith(`data:${mediaType};base64,`),
  );
}

export function removeUntrustedLocalRasterSlots(root: ParentNode): void {
  root
    .querySelectorAll<HTMLElement>(`[${localRasterPayloadSlotAttribute}]`)
    .forEach((element) =>
      element.removeAttribute(localRasterPayloadSlotAttribute),
    );
}

export function retainResolvedLocalRasterPayloads(
  renderResult: RenderResult,
  body: HTMLElement,
  inputs: readonly ResolvedLocalRasterPayloadInput[],
): void {
  if (inputs.length === 0) {
    payloadsByRenderResult.delete(renderResult);
    return;
  }

  const slotImages = Array.from(
    body.querySelectorAll<HTMLImageElement>(
      `img[${localRasterPayloadSlotAttribute}]`,
    ),
  );
  const seenSlots = new Set<string>();
  const valid =
    slotImages.length === inputs.length &&
    inputs.every((input, index) => {
      const slotImage = slotImages[index];
      if (
        !slotImage ||
        slotImage !== input.image ||
        !body.contains(input.image) ||
        !input.slot ||
        !isResolvedLocalRasterDataUrl(input.dataUrl) ||
        input.image.getAttribute(localRasterPayloadSlotAttribute) !==
          input.slot ||
        seenSlots.has(input.slot)
      ) {
        return false;
      }
      seenSlots.add(input.slot);
      return true;
    });

  if (!valid) {
    payloadsByRenderResult.delete(renderResult);
    slotImages.forEach((image) => {
      const placeholder = image.ownerDocument.createElement("span");
      placeholder.className = "image-placeholder";
      placeholder.textContent = "Local image unavailable.";
      image.replaceWith(placeholder);
    });
    return;
  }
  const retained = inputs.map((input) =>
    Object.freeze({ dataUrl: input.dataUrl, slot: input.slot }),
  );
  payloadsByRenderResult.set(renderResult, Object.freeze(retained));
}

export function clearResolvedLocalRasterPayloads(
  renderResult: RenderResult,
): void {
  payloadsByRenderResult.delete(renderResult);
}

export function hydrateResolvedLocalRasterPayloads(
  root: ParentNode,
  renderResult: RenderResult,
): ResolvedLocalRasterHydrationResult {
  const payloads = payloadsByRenderResult.get(renderResult) ?? [];
  const slotImages = Array.from(
    root.querySelectorAll<HTMLImageElement>(
      `img[${localRasterPayloadSlotAttribute}]`,
    ),
  );

  if (payloads.length === 0 && slotImages.length === 0) {
    return { hydratedCount: 0, status: "unused" };
  }

  const imagesBySlot = new Map<string, HTMLImageElement>();
  let valid = payloads.length === slotImages.length;
  slotImages.forEach((image, index) => {
    const slot = image.getAttribute(localRasterPayloadSlotAttribute) ?? "";
    if (!slot || imagesBySlot.has(slot)) {
      valid = false;
      return;
    }
    imagesBySlot.set(slot, image);
    if (payloads[index]?.slot !== slot) {
      valid = false;
    }
  });
  payloads.forEach((payload) => {
    if (!imagesBySlot.has(payload.slot)) valid = false;
  });

  if (!valid) {
    slotImages.forEach((image) => {
      const placeholder = image.ownerDocument.createElement("span");
      placeholder.className = "image-placeholder";
      placeholder.textContent = "Local image unavailable.";
      image.replaceWith(placeholder);
    });
    return { hydratedCount: 0, status: "invalid" };
  }

  for (const payload of payloads) {
    const image = imagesBySlot.get(payload.slot);
    if (!image) continue;
    image.setAttribute("src", payload.dataUrl);
    image.removeAttribute(localRasterPayloadSlotAttribute);
  }

  return { hydratedCount: payloads.length, status: "applied" };
}

export function countInlineRasterDataUrls(root: ParentNode): number {
  return Array.from(root.querySelectorAll<HTMLImageElement>("img[src]")).filter(
    (image) => isResolvedLocalRasterDataUrl(image.getAttribute("src") ?? ""),
  ).length;
}

declare global {
  interface Window {
    __SVARD_MAIN_VIEWER_RASTER_SIDECAR_VARIANT__?: "baseline" | "candidate";
  }
}

export function shouldUseMainViewerRasterSidecar(): boolean {
  if (typeof window === "undefined") return false;
  const scenario = new URLSearchParams(window.location.search).get("scenario");
  return !(
    scenario === "imp-560-main-viewer-render" &&
    window.__SVARD_MAIN_VIEWER_RASTER_SIDECAR_VARIANT__ === "baseline"
  );
}
