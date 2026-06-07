import { describe, expect, it } from "vitest";
import { linkHoverDestination } from "../../src/ui/lib/linkHover";

function linkTarget(href: string): HTMLElement {
  const link = document.createElement("a");
  link.setAttribute("href", href);
  const child = document.createElement("span");
  link.append(child);
  return child;
}

describe("linkHoverDestination", () => {
  it("returns external URLs unchanged", () => {
    expect(
      linkHoverDestination(linkTarget("https://example.com/docs?q=1")),
    ).toBe("https://example.com/docs?q=1");
  });

  it("returns heading links unchanged", () => {
    expect(linkHoverDestination(linkTarget("#section-1"))).toBe("#section-1");
  });

  it("returns hydrated local document links without frontend path resolution", () => {
    expect(linkHoverDestination(linkTarget("/workspace/docs/guide.adoc"))).toBe(
      "/workspace/docs/guide.adoc",
    );
  });

  it("returns raw local document links when render hydration is unavailable", () => {
    expect(linkHoverDestination(linkTarget("./sample1.md"))).toBe(
      "./sample1.md",
    );
  });

  it("returns null for non-link targets", () => {
    expect(linkHoverDestination(document.createElement("span"))).toBe(null);
  });
});
