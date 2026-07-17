import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RenderedDiffMarginMarkers } from "../../src/ui/components/gitDiffPreview/RenderedDiffMarginMarkers";
import { RenderedDiffPane } from "../../src/ui/components/gitDiffPreview/renderedView";
import {
  AllDiffsUiPerformanceProvider,
  useAllDiffsUiPerformance,
  type AllDiffsUiPerformanceEvent,
  type AllDiffsUiPerformanceVariant,
} from "../../src/ui/lib/allDiffsUiPerformance";

function ContextProbe() {
  const measurement = useAllDiffsUiPerformance();
  return (
    <output
      data-enabled={String(measurement.enabled)}
      data-margin-markers={String(measurement.marginMarkersEnabled)}
      data-rendered-ruler={String(measurement.renderedRulerEnabled)}
      data-variant={measurement.variant}
    />
  );
}

describe("All diffs UI performance measurement", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("is disabled and leaves the production UI enabled by default", () => {
    act(() => root.render(<ContextProbe />));

    expect(container.querySelector("output")).toMatchObject({
      dataset: {
        enabled: "false",
        marginMarkers: "true",
        renderedRuler: "true",
        variant: "production",
      },
    });
  });

  it.each<[AllDiffsUiPerformanceVariant, boolean, boolean]>([
    ["production", true, true],
    ["without-margin-markers", false, true],
    ["without-rendered-rulers", false, false],
  ])(
    "applies the %s counterfactual only inside the provider",
    (variant, marginMarkersEnabled, renderedRulerEnabled) => {
      act(() =>
        root.render(
          <AllDiffsUiPerformanceProvider onEvent={vi.fn()} variant={variant}>
            <ContextProbe />
          </AllDiffsUiPerformanceProvider>,
        ),
      );

      expect(container.querySelector("output")).toMatchObject({
        dataset: {
          enabled: "true",
          marginMarkers: String(marginMarkersEnabled),
          renderedRuler: String(renderedRulerEnabled),
          variant,
        },
      });
    },
  );

  it("does not mount rendered margin markers in counterfactual variants", () => {
    const paneRef = createRef<HTMLDivElement>();
    const renderPane = (variant: AllDiffsUiPerformanceVariant) =>
      root.render(
        <AllDiffsUiPerformanceProvider onEvent={vi.fn()} variant={variant}>
          <RenderedDiffPane
            label="Working Tree"
            entries={[]}
            side="right"
            reviewId="test-pane"
            blockReviewId="test-block"
            documentClassName="markdown-body"
            changeIndexForEntry={() => null}
            changeIndexForListItem={() => null}
            changeIndexForStructuredChild={() => null}
            changeIndexForTableRow={() => null}
            syncIndexForEntry={() => 0}
            paneRef={paneRef}
            onScroll={() => undefined}
          />
        </AllDiffsUiPerformanceProvider>,
      );

    act(() => renderPane("production"));
    expect(
      container.querySelector('[data-review-id="git-rendered-margin-markers"]'),
    ).not.toBeNull();

    act(() => renderPane("without-margin-markers"));
    expect(
      container.querySelector('[data-review-id="git-rendered-margin-markers"]'),
    ).toBeNull();

    act(() => renderPane("without-rendered-rulers"));
    expect(
      container.querySelector('[data-review-id="git-rendered-margin-markers"]'),
    ).toBeNull();
  });

  it("records numeric-only margin measurement payloads", () => {
    const events: AllDiffsUiPerformanceEvent[] = [];

    act(() =>
      root.render(
        <AllDiffsUiPerformanceProvider
          onEvent={(event) => events.push(event)}
          variant="production"
        >
          <section>
            <div
              className="git-rendered-block change-target"
              data-change-index="0"
            />
            <RenderedDiffMarginMarkers layoutIdentity={{}} side="right" />
          </section>
        </AllDiffsUiPerformanceProvider>,
      ),
    );

    const event = events.find(
      (
        candidate,
      ): candidate is Extract<
        AllDiffsUiPerformanceEvent,
        { type: "margin-measure" }
      > => candidate.type === "margin-measure",
    );
    expect(event).toMatchObject({ rectCount: 2, targetCount: 1 });
    expect(event?.durationMs).toEqual(expect.any(Number));
    expect(
      Object.entries(event ?? {})
        .filter(([key]) => key !== "type")
        .every(([, value]) => typeof value === "number"),
    ).toBe(true);
  });
});
