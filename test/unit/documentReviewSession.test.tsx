import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DocumentReviewSessionControls } from "../../src/ui/lib/documentReviewSession";
import { useDocumentReviewSession } from "../../src/ui/hooks/useDocumentReviewSession";

describe("document review session", () => {
  let container: HTMLDivElement;
  let root: Root;
  let api: DocumentReviewSessionControls | null = null;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    api = null;
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function Harness({ paths }: { paths: string[] }) {
    api = useDocumentReviewSession(paths);
    return null;
  }

  async function render(paths: string[]) {
    await act(async () => {
      root.render(<Harness paths={paths} />);
    });
  }

  it("tracks runtime review state for changed supported documents", async () => {
    await render(["/workspace/a.md", "/workspace/b.adoc"]);

    expect(api?.stateByPath["/workspace/a.md"]).toBe("unreviewed");
    expect(api?.summary).toEqual({
      total: 2,
      reviewed: 0,
      needsAttention: 0,
    });

    await act(async () => {
      api?.markViewed("/workspace/a.md");
    });
    expect(api?.stateByPath["/workspace/a.md"]).toBe("viewed");
    expect(api?.summary.reviewed).toBe(1);

    await act(async () => {
      api?.markNeedsAttention("/workspace/b.adoc");
    });
    expect(api?.stateByPath["/workspace/b.adoc"]).toBe("needs-attention");
    expect(api?.summary.reviewed).toBe(2);
    expect(api?.summary.needsAttention).toBe(1);

    await act(async () => {
      api?.reset("/workspace/b.adoc");
    });
    expect(api?.stateByPath["/workspace/b.adoc"]).toBe("unreviewed");
  });

  it("removes paths that leave the changed target set", async () => {
    await render(["/workspace/a.md", "/workspace/b.adoc"]);
    await act(async () => {
      api?.markViewed("/workspace/a.md");
    });

    await render(["/workspace/b.adoc"]);

    expect(api?.stateByPath["/workspace/a.md"]).toBeUndefined();
    expect(api?.stateByPath["/workspace/b.adoc"]).toBe("unreviewed");
    expect(api?.summary.total).toBe(1);
  });
});
