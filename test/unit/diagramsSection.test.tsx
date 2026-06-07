import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultConfig } from "../../src/core/defaultConfig";
import type { AppConfig } from "../../src/core/types";
import { DiagramsSection } from "../../src/ui/components/preferences/DiagramsSection";

describe("DiagramsSection", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onOpenKrokiSettings = vi.fn();
  const onUpdateRenderer = vi.fn();
  const onUpdateTimeout = vi.fn();

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
        <DiagramsSection
          config={config}
          onOpenKrokiSettings={onOpenKrokiSettings}
          onUpdateRenderer={onUpdateRenderer}
          onUpdateTimeout={onUpdateTimeout}
        />,
      );
    });
  }

  it("shows built-in renderer labels without user-visible Local text", () => {
    renderSection();

    expect(container.textContent).toContain("Built-in");
    expect(container.textContent).toContain(
      "Mermaid uses the built-in renderer.",
    );
    expect(container.textContent).not.toContain("Local");
  });

  it("keeps the internal local value while using the Built-in label", () => {
    renderSection({
      ...defaultConfig,
      diagram: {
        ...defaultConfig.diagram,
        plantumlRenderer: "kroki",
      },
    });

    const plantUmlBuiltIn = container.querySelector<HTMLInputElement>(
      'input[name="plantuml-renderer"][value="local"]',
    );
    expect(plantUmlBuiltIn?.checked).toBe(false);

    act(() => {
      plantUmlBuiltIn?.click();
      plantUmlBuiltIn?.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(onUpdateRenderer).toHaveBeenCalledWith("plantumlRenderer", "local");
  });

  it("shows Kroki endpoint guidance and opens Kroki settings", () => {
    renderSection({
      ...defaultConfig,
      diagram: {
        ...defaultConfig.diagram,
        plantumlRenderer: "kroki",
      },
    });

    expect(container.textContent).toContain(
      "Uses the endpoint configured in Kroki settings.",
    );

    const openButton = container.querySelector<HTMLButtonElement>(
      '[data-review-id="diagram-open-kroki-settings"]',
    );
    act(() => {
      openButton?.click();
    });

    expect(onOpenKrokiSettings).toHaveBeenCalledOnce();
  });

  it("keeps timeout controls in the advanced disclosure", () => {
    renderSection();

    const advanced = container.querySelector(
      '[data-review-id="diagram-advanced-settings"]',
    );
    expect(advanced?.textContent).toContain("PlantUML timeout");
    expect(advanced?.textContent).toContain("Graphviz / DOT timeout");
    expect(
      advanced?.querySelector<HTMLInputElement>(
        '[data-review-id="plantuml-timeout-control"]',
      )?.value,
    ).toBe("10000");
  });
});
