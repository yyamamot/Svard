import { afterEach, describe, expect, it } from "vitest";

import type { RenderResult } from "../../src/core/types";
import {
  countInlineRasterDataUrls,
  createLocalRasterPayloadSlot,
  hydrateResolvedLocalRasterPayloads,
  isResolvedLocalRasterMediaType,
  localRasterPayloadSlotAttribute,
  removeUntrustedLocalRasterSlots,
  retainResolvedLocalRasterPayloads,
  shouldUseMainViewerRasterSidecar,
} from "../../src/ui/lib/resolvedLocalRasterPayloads";

function renderResult(): RenderResult {
  return {
    html: "",
    headings: [],
    sourceBlocks: [],
    diagnostics: [],
    diagramSlots: [],
    mermaidDiagrams: [],
    plantUmlDiagrams: [],
    graphvizDiagrams: [],
    krokiDiagrams: [],
  };
}

function sidecarFixture(owner = renderResult()) {
  const source = new DOMParser().parseFromString(
    "<p><img alt='one'><img alt='two'></p>",
    "text/html",
  );
  const images = Array.from(source.querySelectorAll("img"));
  const slots = images.map(() => {
    const slot = createLocalRasterPayloadSlot();
    if (!slot) throw new Error("Secure slot generation unavailable in test");
    return slot;
  });
  images.forEach((image, index) =>
    image.setAttribute(localRasterPayloadSlotAttribute, slots[index] ?? ""),
  );
  retainResolvedLocalRasterPayloads(
    owner,
    source.body,
    images.map((image, index) => ({
      dataUrl: `data:image/png;base64,payload-${index}`,
      image,
      slot: slots[index] ?? "",
    })),
  );
  return { owner, source, slots };
}

describe("resolved local raster payload sidecar", () => {
  afterEach(() => {
    window.history.replaceState({}, "", "/");
    delete window.__SVARD_MAIN_VIEWER_RASTER_SIDECAR_VARIANT__;
  });

  it("allows only backend raster media types", () => {
    expect(isResolvedLocalRasterMediaType("image/png")).toBe(true);
    expect(isResolvedLocalRasterMediaType("IMAGE/JPEG")).toBe(true);
    expect(isResolvedLocalRasterMediaType("image/webp")).toBe(true);
    expect(isResolvedLocalRasterMediaType("image/svg+xml")).toBe(false);
    expect(isResolvedLocalRasterMediaType("text/html")).toBe(false);
  });

  it("hydrates an immutable owner payload into each pane root", () => {
    const { owner, source } = sidecarFixture();
    const compactHtml = source.body.innerHTML;
    expect(compactHtml).not.toContain("data:image/png;base64");

    for (const pane of ["left", "right"]) {
      const target = new DOMParser().parseFromString(compactHtml, "text/html");
      expect(hydrateResolvedLocalRasterPayloads(target.body, owner)).toEqual({
        hydratedCount: 2,
        status: "applied",
      });
      expect(
        Array.from(target.querySelectorAll("img")).map((image) =>
          image.getAttribute("src"),
        ),
      ).toEqual([
        "data:image/png;base64,payload-0",
        "data:image/png;base64,payload-1",
      ]);
      expect(
        target.querySelector(`[${localRasterPayloadSlotAttribute}]`),
        pane,
      ).toBeNull();
    }
  });

  it("fails closed for another owner, duplicate, missing, or reordered slots", () => {
    const { owner, source } = sidecarFixture();
    const compactHtml = source.body.innerHTML;
    const slotImages = Array.from(source.querySelectorAll("img"));
    const firstSlot = slotImages[0]?.getAttribute(
      localRasterPayloadSlotAttribute,
    );
    const secondSlot = slotImages[1]?.getAttribute(
      localRasterPayloadSlotAttribute,
    );
    expect(firstSlot).toBeTruthy();
    expect(secondSlot).toBeTruthy();
    const mismatches = [
      compactHtml,
      compactHtml.replace(secondSlot ?? "unavailable", firstSlot ?? ""),
      compactHtml.replace(/<img[^>]+>/u, ""),
      compactHtml.replace(/(<img[^>]+>)(<img[^>]+>)/u, "$2$1"),
      `${compactHtml}<img ${localRasterPayloadSlotAttribute}="extra">`,
    ];

    mismatches.forEach((html, index) => {
      const target = new DOMParser().parseFromString(html, "text/html");
      const selectedOwner = index === 0 ? renderResult() : owner;
      expect(
        hydrateResolvedLocalRasterPayloads(target.body, selectedOwner),
      ).toEqual({ hydratedCount: 0, status: "invalid" });
      expect(target.querySelector("img[src]"), String(index)).toBeNull();
      expect(
        target.querySelectorAll(".image-placeholder").length,
      ).toBeGreaterThan(0);
      expect(
        target.querySelector(`[${localRasterPayloadSlotAttribute}]`),
      ).toBeNull();
    });
  });

  it("rejects non-raster payloads before SafeHtml serialization", () => {
    for (const dataUrl of [
      "javascript:alert(1)",
      "https://example.test/image.png",
      "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
    ]) {
      const owner = renderResult();
      const source = new DOMParser().parseFromString("<img>", "text/html");
      const image = source.querySelector("img");
      const slot = createLocalRasterPayloadSlot();
      expect(image).not.toBeNull();
      expect(slot).not.toBeNull();
      image?.setAttribute(localRasterPayloadSlotAttribute, slot ?? "");
      retainResolvedLocalRasterPayloads(owner, source.body, [
        {
          dataUrl,
          image: image as HTMLImageElement,
          slot: slot ?? "",
        },
      ]);

      expect(source.querySelector("img"), dataUrl).toBeNull();
      expect(
        source.querySelector(".image-placeholder")?.textContent,
        dataUrl,
      ).toBe("Local image unavailable.");
      expect(hydrateResolvedLocalRasterPayloads(source.body, owner)).toEqual({
        hydratedCount: 0,
        status: "unused",
      });
    }
  });

  it("removes author-provided slots before they can bind to a payload", () => {
    const doc = new DOMParser().parseFromString(
      `<img src="javascript:alert(1)" ${localRasterPayloadSlotAttribute}="forged">`,
      "text/html",
    );
    removeUntrustedLocalRasterSlots(doc.body);
    expect(
      doc.querySelector(`[${localRasterPayloadSlotAttribute}]`),
    ).toBeNull();
  });

  it("counts inline raster data URLs without counting SVG or external images", () => {
    const doc = new DOMParser().parseFromString(
      '<img src="data:image/png;base64,AA=="><img src="data:image/svg+xml,x"><img src="https://example.test/a.png">',
      "text/html",
    );
    expect(countInlineRasterDataUrls(doc.body)).toBe(1);
  });

  it("enables the sidecar by default and limits baseline override to the benchmark", () => {
    window.__SVARD_MAIN_VIEWER_RASTER_SIDECAR_VARIANT__ = "baseline";
    expect(shouldUseMainViewerRasterSidecar()).toBe(true);
    window.history.replaceState(
      {},
      "",
      "/?scenario=imp-560-main-viewer-render",
    );
    expect(shouldUseMainViewerRasterSidecar()).toBe(false);
    window.__SVARD_MAIN_VIEWER_RASTER_SIDECAR_VARIANT__ = "candidate";
    expect(shouldUseMainViewerRasterSidecar()).toBe(true);
  });
});
