import { describe, expect, it } from "vitest";

import { pathBasename } from "../../src/core/pathDisplay";
import {
  fileName,
  isExternalUrl,
  isSafeExternalUrlToOpen,
  splitPathAndHash,
  uniquePaths,
} from "../../src/ui/lib/path";

describe("path display helpers", () => {
  it("extracts basenames from Windows and POSIX paths", () => {
    expect(pathBasename("C:\\Users\\me\\project")).toBe("project");
    expect(pathBasename("C:\\Users\\me\\docs\\a.md")).toBe("a.md");
    expect(pathBasename("/Users/me/project")).toBe("project");
    expect(pathBasename("/Users/me/docs/a.md")).toBe("a.md");
  });

  it("handles UNC paths and trailing separators", () => {
    expect(pathBasename("\\\\server\\share\\project")).toBe("project");
    expect(pathBasename("C:\\Users\\me\\project\\")).toBe("project");
    expect(pathBasename("/Users/me/project/")).toBe("project");
  });

  it("keeps root paths when no basename can be taken", () => {
    expect(pathBasename("C:\\")).toBe("C:\\");
    expect(pathBasename("\\\\server\\share")).toBe("\\\\server\\share");
    expect(pathBasename("/")).toBe("/");
  });

  it("keeps the UI fileName helper aligned with the shared helper", () => {
    expect(fileName("C:\\Users\\me\\project")).toBe("project");
  });

  it("keeps only UI-safe helpers in the frontend path module", () => {
    expect(uniquePaths(["/a", "", "/a", "/b"])).toEqual(["/a", "/b"]);
    expect(isExternalUrl("https://example.test/docs")).toBe(true);
    expect(isExternalUrl("HTTPS://example.test/docs")).toBe(true);
    expect(isExternalUrl(" https://example.test/docs ")).toBe(true);
    expect(isExternalUrl("mailto:team@example.test")).toBe(false);
    expect(splitPathAndHash("docs/guide.md#Overview")).toEqual({
      path: "docs/guide.md",
      hash: "Overview",
    });
  });

  it("keeps external URL detection aligned with opener safety", () => {
    for (const value of [
      "https://example.test/docs",
      "http://example.test/docs",
      "mailto:team@example.test",
      "javascript:alert(1)",
      "data:text/plain,hello",
      "file:///tmp/guide.adoc",
      "/workspace/docs/guide.md",
    ]) {
      expect(isExternalUrl(value)).toBe(isSafeExternalUrlToOpen(value));
    }
  });
});
