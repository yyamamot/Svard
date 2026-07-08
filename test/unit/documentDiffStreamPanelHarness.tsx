import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, vi } from "vitest";
import { DocumentDiffStreamPanel } from "../../src/ui/components/DocumentDiffStreamPanel";
import { deriveGitRenderedDiffSummary } from "../../src/ui/lib/gitRenderedDiff";
import { renderedDiffSummary } from "./documentDiffStreamTestUtils";

vi.mock("../../src/ui/lib/gitRenderedDiff", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/ui/lib/gitRenderedDiff")>();
  return {
    ...actual,
    deriveGitRenderedDiffSummary: vi.fn(),
  };
});

export const deriveGitRenderedDiffSummaryMock = vi.mocked(
  deriveGitRenderedDiffSummary,
);

export function setupDocumentDiffStreamPanelTest() {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    deriveGitRenderedDiffSummaryMock.mockReset();
    deriveGitRenderedDiffSummaryMock.mockResolvedValue(renderedDiffSummary());
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  return {
    get container() {
      return container;
    },
    render: async (props: ComponentProps<typeof DocumentDiffStreamPanel>) => {
      await act(async () => {
        root.render(<DocumentDiffStreamPanel {...props} />);
      });
    },
  };
}
