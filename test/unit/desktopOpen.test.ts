import { describe, expect, it } from "vitest";

import {
  desktopOpenDisplayName,
  planDesktopOpenRequest,
} from "../../src/core/desktopOpen";
import type { DesktopOpenRequest } from "../../src/core/types";

function request(
  paths: string[],
  diagnostics: string[] = [],
): DesktopOpenRequest {
  return {
    source: "initial",
    paths,
    diagnostics,
  };
}

describe("desktop open request planning", () => {
  it("emits warning actions when no supported path is present", () => {
    expect(
      planDesktopOpenRequest(
        request(
          [],
          [
            "Unsupported desktop open path ignored: missing.adoc",
            "Unsupported desktop open option ignored: --new-window",
          ],
        ),
      ),
    ).toEqual([
      {
        kind: "warning",
        message: "Unsupported desktop open path ignored: missing.adoc",
      },
      {
        kind: "warning",
        message: "Unsupported desktop open option ignored: --new-window",
      },
    ]);
  });

  it("opens one supported document as a document tab", () => {
    expect(
      planDesktopOpenRequest(request(["/workspace/docs/guide.adoc"])),
    ).toEqual([{ kind: "openDocument", path: "/workspace/docs/guide.adoc" }]);
  });

  it("opens one directory as a workspace root", () => {
    expect(planDesktopOpenRequest(request(["/workspace/docs"]))).toEqual([
      { kind: "openDirectory", path: "/workspace/docs" },
    ]);
  });

  it("opens exactly two supported documents as a file compare preview", () => {
    expect(
      planDesktopOpenRequest(
        request([
          "/workspace/docs/file-diff-left.md",
          "/workspace/docs/file-diff-right.md",
        ]),
      ),
    ).toEqual([
      {
        kind: "compareDocuments",
        leftPath: "/workspace/docs/file-diff-left.md",
        rightPath: "/workspace/docs/file-diff-right.md",
      },
    ]);
  });

  it("keeps three or more supported documents as sequential document opens", () => {
    expect(
      planDesktopOpenRequest(
        request([
          "/workspace/docs/one.md",
          "/workspace/docs/two.md",
          "/workspace/docs/three.adoc",
        ]),
      ),
    ).toEqual([
      { kind: "openDocument", path: "/workspace/docs/one.md" },
      { kind: "openDocument", path: "/workspace/docs/two.md" },
      { kind: "openDocument", path: "/workspace/docs/three.adoc" },
    ]);
  });

  it("keeps mixed file and directory requests in request order", () => {
    expect(
      planDesktopOpenRequest(
        request(
          [
            "/workspace/docs/one.md",
            "/workspace/project",
            "/workspace/docs/two.adoc",
          ],
          ["Unsupported desktop open path ignored: missing.adoc"],
        ),
      ),
    ).toEqual([
      { kind: "openDocument", path: "/workspace/docs/one.md" },
      { kind: "openDirectory", path: "/workspace/project" },
      { kind: "openDocument", path: "/workspace/docs/two.adoc" },
      {
        kind: "warning",
        message: "Unsupported desktop open path ignored: missing.adoc",
      },
    ]);
  });

  it("uses a basename for user-visible unsupported path labels", () => {
    expect(desktopOpenDisplayName("/workspace/private/missing.adoc")).toBe(
      "missing.adoc",
    );
    expect(desktopOpenDisplayName("C:\\workspace\\private\\notes.md")).toBe(
      "notes.md",
    );
  });
});
