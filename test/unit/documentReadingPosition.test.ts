import { afterEach, describe, expect, it } from "vitest";
import {
  captureDocumentReadingPosition,
  restoreDocumentReadingPosition,
} from "../../src/ui/lib/documentReadingPosition";
import { readingSurface } from "./helpers/readingSurface";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("document reading position", () => {
  it("returns to the exact position inside a long section instead of its heading", () => {
    const { surface } = readingSurface();
    surface.viewer.scrollTop = 1242.5;
    const saved = captureDocumentReadingPosition(surface);
    surface.viewer.scrollTop = 0;
    restoreDocumentReadingPosition(surface, saved);
    expect(surface.viewer.scrollTop).toBe(1242.5);
  });

  it("keeps the paragraph's viewport offset after resizing and zoom", () => {
    const { surface, paragraph, geometry } = readingSurface();
    surface.viewer.scrollTop = 1242;
    const saved = captureDocumentReadingPosition(surface);
    geometry.width = 600;
    geometry.height = 6500;
    surface.zoom = 125;
    paragraph.position.y += 300;
    surface.viewer.scrollTop = 0;
    restoreDocumentReadingPosition(surface, saved);
    expect(surface.viewer.scrollTop).toBe(1542);
  });

  it("does not mistake a reused source line for the original paragraph after an edit", () => {
    const { surface, paragraph, heading } = readingSurface();
    surface.viewer.scrollTop = 1242;
    const saved = captureDocumentReadingPosition(surface);
    surface.payload = {
      ...surface.payload,
      source: "Changed source",
      updatedAt: "2",
    };
    paragraph.element.textContent = "Different paragraph";
    heading.position.y += 200;
    surface.viewer.scrollTop = 0;
    restoreDocumentReadingPosition(surface, saved);
    expect(surface.viewer.scrollTop).toBe(1442);
  });

  it.each(["hidden", "duplicate", "deleted"])(
    "skips a %s anchor without expanding a section",
    (kind) => {
      const { surface, paragraph, geometry, add } = readingSurface();
      surface.viewer.scrollTop = 1242;
      const saved = captureDocumentReadingPosition(surface);
      geometry.height = 5500;
      if (kind === "hidden") {
        paragraph.position.visible = false;
        paragraph.element.classList.add("section-collapsed-hidden");
      } else if (kind === "duplicate") {
        add("p", 1600, {
          "data-source-reference": paragraph.element.dataset.sourceReference!,
        });
      } else paragraph.element.remove();
      surface.viewer.scrollTop = 0;
      restoreDocumentReadingPosition(surface, saved);
      expect(surface.viewer.scrollTop).toBe(1242);
      if (kind === "hidden")
        expect(
          paragraph.element.classList.contains("section-collapsed-hidden"),
        ).toBe(true);
    },
  );

  it("clamps a shortened headingless document and starts an unvisited document at zero", () => {
    const { surface, geometry } = readingSurface();
    surface.article.innerHTML = "<p>Plain text</p>";
    surface.viewer.scrollTop = 2000;
    const saved = captureDocumentReadingPosition(surface);
    geometry.height = 900;
    restoreDocumentReadingPosition(surface, saved);
    expect(surface.viewer.scrollTop).toBe(400);
    restoreDocumentReadingPosition(surface);
    expect(surface.viewer.scrollTop).toBe(0);
  });
});
