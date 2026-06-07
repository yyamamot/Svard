import { describe, expect, it } from "vitest";

import {
  expandCollapsedSectionsContaining,
  toggleSectionCollapse,
} from "../../src/ui/lib/sectionCollapse";

describe("sectionCollapse", () => {
  it("collapses until the next same-or-higher heading", () => {
    document.body.innerHTML = `<article>
      <h2 data-section-collapse-heading="true" data-section-collapsed="false"><button data-section-collapse-toggle="true" aria-expanded="true"></button>Intro</h2>
      <p id="intro-body">Intro body</p>
      <h3 id="nested">Nested</h3>
      <p id="nested-body">Nested body</p>
      <h2 id="next">Next</h2>
      <p id="next-body">Next body</p>
    </article>`;
    const button = document.querySelector("button") as HTMLElement;

    toggleSectionCollapse(button);

    expect(
      document.querySelector("h2")?.getAttribute("data-section-collapsed"),
    ).toBe("true");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById("intro-body")?.classList).toContain(
      "section-collapsed-hidden",
    );
    expect(document.getElementById("nested")?.classList).toContain(
      "section-collapsed-hidden",
    );
    expect(document.getElementById("nested-body")?.classList).toContain(
      "section-collapsed-hidden",
    );
    expect(document.getElementById("next")?.classList).not.toContain(
      "section-collapsed-hidden",
    );
  });

  it("expands collapsed sections that contain a jump target", () => {
    document.body.innerHTML = `<article>
      <h2 data-section-collapse-heading="true" data-section-collapsed="false"><button data-section-collapse-toggle="true" aria-expanded="true"></button>Intro</h2>
      <p><mark id="hit">Svard</mark></p>
      <h2>Next</h2>
    </article>`;
    const button = document.querySelector("button") as HTMLElement;

    toggleSectionCollapse(button);
    expandCollapsedSectionsContaining(document.getElementById("hit"));

    expect(
      document.querySelector("h2")?.getAttribute("data-section-collapsed"),
    ).toBe("false");
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(
      document
        .querySelector("p")
        ?.classList.contains("section-collapsed-hidden"),
    ).toBe(false);
  });
});
