import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultConfig } from "../../src/core/defaultConfig";
import type { AppConfig } from "../../src/core/types";
import { KrokiSection } from "../../src/ui/components/preferences/KrokiSection";

describe("KrokiSection", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onChange = vi.fn();
  const onRunKrokiTest = vi.fn();
  const onUpdateKrokiMode = vi.fn();

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function renderSection(config: AppConfig = defaultConfig) {
    act(() => {
      root.render(
        <KrokiSection
          config={config}
          krokiModeHelpText="Use a trusted endpoint."
          krokiTest={{ status: "idle" }}
          onChange={onChange}
          onRunKrokiTest={onRunKrokiTest}
          onUpdateKrokiMode={onUpdateKrokiMode}
        />,
      );
    });
  }

  it("keeps remote confirmation enabled by default", () => {
    renderSection({
      ...defaultConfig,
      kroki: {
        ...defaultConfig.kroki,
        mode: "remote",
        endpointUrl: "http://127.0.0.1:8000",
      },
    });

    const confirmation = container.querySelector<HTMLInputElement>(
      '[data-review-id="kroki-remote-confirmation-control"]',
    );
    expect(confirmation?.checked).toBe(true);
    expect(confirmation?.disabled).toBe(false);
    expect(container.textContent).toContain(
      "Remote sends diagram source to the configured endpoint.",
    );
  });

  it("allows self-managed remote confirmation opt-out", () => {
    renderSection({
      ...defaultConfig,
      kroki: {
        ...defaultConfig.kroki,
        mode: "remote",
        endpointUrl: "http://127.0.0.1:8000",
      },
    });

    const confirmation = container.querySelector<HTMLInputElement>(
      '[data-review-id="kroki-remote-confirmation-control"]',
    );
    act(() => {
      confirmation?.click();
      confirmation?.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        kroki: expect.objectContaining({
          requireRemoteConfirmation: false,
        }),
      }),
    );
  });

  it("forces public Kroki confirmation on", () => {
    renderSection({
      ...defaultConfig,
      kroki: {
        ...defaultConfig.kroki,
        mode: "public",
        endpointUrl: "https://kroki.io",
        requireRemoteConfirmation: false,
      },
    });

    const confirmation = container.querySelector<HTMLInputElement>(
      '[data-review-id="kroki-remote-confirmation-control"]',
    );
    expect(confirmation?.checked).toBe(true);
    expect(confirmation?.disabled).toBe(true);
  });
});
