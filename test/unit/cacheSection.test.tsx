import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultConfig } from "../../src/core/defaultConfig";
import { CacheSection } from "../../src/ui/components/preferences/CacheSection";

describe("CacheSection", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  function renderSection({
    onClearKrokiCache = async () => undefined,
    onClearPlantUmlSvgCache = async () => undefined,
  }: {
    onClearKrokiCache?: () => Promise<void>;
    onClearPlantUmlSvgCache?: () => Promise<void>;
  } = {}) {
    act(() => {
      root.render(
        <CacheSection
          config={defaultConfig}
          onChange={() => undefined}
          onClearKrokiCache={onClearKrokiCache}
          onClearPlantUmlSvgCache={onClearPlantUmlSvgCache}
        />,
      );
    });
  }

  it("shows completion feedback on the Kroki cache clear button", async () => {
    const onClearKrokiCache = vi.fn(async () => undefined);
    renderSection({ onClearKrokiCache });

    const button = container.querySelector<HTMLButtonElement>(
      '[data-review-id="kroki-cache-clear"]',
    );

    await act(async () => {
      button?.click();
    });

    expect(onClearKrokiCache).toHaveBeenCalledOnce();
    expect(button?.textContent).toBe("Kroki cache cleared");

    act(() => {
      vi.advanceTimersByTime(1800);
    });

    expect(button?.textContent).toBe("Clear Kroki cache");
  });

  it("keeps button feedback scoped to the local diagram cache button", async () => {
    const onClearPlantUmlSvgCache = vi.fn(async () => undefined);
    renderSection({ onClearPlantUmlSvgCache });

    const krokiButton = container.querySelector<HTMLButtonElement>(
      '[data-review-id="kroki-cache-clear"]',
    );
    const localDiagramButton = container.querySelector<HTMLButtonElement>(
      '[data-review-id="plantuml-local-cache-clear"]',
    );

    await act(async () => {
      localDiagramButton?.click();
    });

    expect(onClearPlantUmlSvgCache).toHaveBeenCalledOnce();
    expect(krokiButton?.textContent).toBe("Clear Kroki cache");
    expect(localDiagramButton?.textContent).toBe("Local diagram cache cleared");
  });
});
