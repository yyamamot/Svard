import { describe, expect, it } from "vitest";

import {
  filterOpenFiles,
  getOpenFilesFilterMode,
  matchesOpenFilesFilter,
} from "../../src/core/openFilesFilter";

const files = [
  { path: "/workspace/docs/preferences.adoc" },
  { path: "/workspace/docs/render-fixtures.adoc" },
  { path: "/workspace/docs/math-rendering.md" },
  { path: "/workspace/docs/copy-actions.adoc" },
  { path: "/workspace/docs/samples/a+b[1].md" },
  { path: "/workspace/docs/samples/ab.md" },
  { path: "/workspace/docs/samples/acb.md" },
];

describe("open files filter", () => {
  it("keeps empty filters as all open files", () => {
    expect(filterOpenFiles(files, "")).toEqual(files);
    expect(filterOpenFiles(files, "   ")).toEqual(files);
  });

  it("uses substring mode when no wildcard is present", () => {
    expect(getOpenFilesFilterMode("pref")).toBe("substring");
    expect(filterOpenFiles(files, "pref").map((file) => file.path)).toEqual([
      "/workspace/docs/preferences.adoc",
    ]);
  });

  it("matches markdown files with a star wildcard", () => {
    expect(getOpenFilesFilterMode("*.md")).toBe("glob");
    expect(filterOpenFiles(files, "*.md").map((file) => file.path)).toEqual([
      "/workspace/docs/math-rendering.md",
      "/workspace/docs/samples/a+b[1].md",
      "/workspace/docs/samples/ab.md",
      "/workspace/docs/samples/acb.md",
    ]);
  });

  it("matches Windows path filenames with glob wildcards", () => {
    expect(
      matchesOpenFilesFilter("C:\\Users\\me\\docs\\notes.md", "*.md"),
    ).toBe(true);
    expect(
      matchesOpenFilesFilter("C:\\Users\\me\\docs\\notes.adoc", "*.md"),
    ).toBe(false);
    expect(
      matchesOpenFilesFilter(
        "C:\\Users\\me\\docs\\render-fixtures.adoc",
        "docs/*fixture*.adoc",
      ),
    ).toBe(true);
    expect(
      matchesOpenFilesFilter("C:\\Users\\me\\docs\\notes.md", "docs/notes"),
    ).toBe(true);
  });

  it("matches filename and full path with glob wildcards", () => {
    expect(
      matchesOpenFilesFilter(
        "/workspace/docs/render-fixtures.adoc",
        "*fixture*.adoc",
      ),
    ).toBe(true);
    expect(
      matchesOpenFilesFilter(
        "/workspace/docs/render-fixtures.adoc",
        "docs/*fixture*.adoc",
      ),
    ).toBe(true);
    expect(
      matchesOpenFilesFilter(
        "/workspace/docs/math-rendering.md",
        "docs/*fixture*.adoc",
      ),
    ).toBe(false);
  });

  it("treats question mark as one character wildcard", () => {
    expect(filterOpenFiles(files, "a?.md").map((file) => file.path)).toEqual([
      "/workspace/docs/samples/ab.md",
    ]);
    expect(
      matchesOpenFilesFilter("/workspace/docs/samples/acb.md", "a?.md"),
    ).toBe(false);
  });

  it("treats regex special characters as literals", () => {
    expect(() => filterOpenFiles(files, "a+b[1].md")).not.toThrow();
    expect(
      filterOpenFiles(files, "a+b[1].md").map((file) => file.path),
    ).toEqual(["/workspace/docs/samples/a+b[1].md"]);
    expect(
      filterOpenFiles(files, "{missing}+file").map((file) => file.path),
    ).toEqual([]);
  });
});
