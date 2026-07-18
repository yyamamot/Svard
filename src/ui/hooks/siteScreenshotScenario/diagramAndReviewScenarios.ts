import { fixtureDirectory } from "./helpers";
import type { SiteScreenshotScenarioContext } from "./types";

export async function runDiagramAndReviewScenarios(
  context: SiteScreenshotScenarioContext,
) {
  const {
    closeAllTabs,
    dismissInlineNotice,
    documentPayload,
    fixturePath,
    loadDocumentForScreenshot,
    openDirectory,
    openDocument,
    scenario,
    setConfig,
    setDocumentPayload,
    setRightSidebarTab,
    setRootDirectory,
    setTabs,
    showGitDiff,
  } = context;

  if (scenario === "rendered-diff") {
    await showGitDiff(fixturePath);
    window.setTimeout(() => {
      document
        .querySelector<HTMLButtonElement>(
          '[data-review-id="git-diff-full-preview-view"]',
        )
        ?.click();
    }, 300);
    return true;
  }

  if (scenario === "table-list-diff-review") {
    await showGitDiff(fixturePath);
    window.setTimeout(() => {
      document
        .querySelector<HTMLButtonElement>(
          '[data-review-id="git-diff-rendered-view"]',
        )
        ?.click();
    }, 300);
    return true;
  }

  if (scenario === "table-list-diff-table") {
    await showGitDiff(fixturePath);
    const openTableView = () => {
      document
        .querySelector<HTMLButtonElement>(
          '[data-review-id="git-diff-table-view"]',
        )
        ?.click();
    };
    window.setTimeout(openTableView, 300);
    window.setTimeout(openTableView, 900);
    window.setTimeout(openTableView, 1500);
    return true;
  }

  if (scenario === "table-copy-context-menu") {
    const applyTableCopyState = () => {
      dismissInlineNotice();
      setConfig((current) =>
        current
          ? {
              ...current,
              sidebarVisible: false,
              rightSidebarVisible: false,
            }
          : current,
      );
      setTabs((current) => {
        const active = documentPayload ?? current[0];
        return active ? [active] : current;
      });
      document
        .querySelector<HTMLElement>("article table")
        ?.scrollIntoView({ block: "center" });
    };
    const openTableCopyContextMenu = () => {
      applyTableCopyState();
      const cell =
        document.querySelector<HTMLElement>("article table tbody td") ??
        document.querySelector<HTMLElement>("article table td");
      if (!cell) return;
      const rect = cell.getBoundingClientRect();
      cell.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + Math.min(80, rect.width / 2),
          clientY: rect.top + rect.height / 2,
          button: 2,
        }),
      );
    };
    const focusCopyMenuItem = () => {
      document
        .querySelector<HTMLButtonElement>(
          '[data-review-id="context-menu-item-copy-table-markdown"]',
        )
        ?.focus();
    };
    const openAndFocusTableCopyMenu = () => {
      openTableCopyContextMenu();
      window.setTimeout(focusCopyMenuItem, 80);
      window.setTimeout(focusCopyMenuItem, 180);
    };

    applyTableCopyState();
    window.setTimeout(applyTableCopyState, 300);
    window.setTimeout(openAndFocusTableCopyMenu, 1200);
    window.setTimeout(openAndFocusTableCopyMenu, 2400);
    window.setTimeout(openAndFocusTableCopyMenu, 3600);
    return true;
  }

  if (scenario === "link-hover-preview" || scenario === "link-context-menu") {
    const directory = fixtureDirectory(fixturePath);
    const applyLinkDocumentState = () => {
      dismissInlineNotice();
      setRootDirectory(directory);
      setConfig((current) =>
        current
          ? {
              ...current,
              sidebarVisible: true,
              rightSidebarVisible: false,
              layout: {
                ...current.layout,
                leftSidebarWidth: 340,
              },
              workspace: {
                ...current.workspace,
                sidebarTab: "files",
              },
              experimental: {
                ...current.experimental,
                searchHitRuler: false,
              },
            }
          : current,
      );
    };
    const targetLink = () =>
      Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]")).find(
        (link) => link.textContent?.includes("Related runbook"),
      );
    const hoverLink = () => {
      applyLinkDocumentState();
      const link = targetLink();
      if (!link) return;
      link.focus();
      const rect = link.getBoundingClientRect();
      const options = {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
      };
      link.dispatchEvent(new MouseEvent("mouseover", options));
      link.dispatchEvent(new MouseEvent("mousemove", options));
    };
    const openLinkContextMenu = () => {
      applyLinkDocumentState();
      const link = targetLink();
      if (!link) return;
      link.focus();
      const rect = link.getBoundingClientRect();
      link.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
          button: 2,
        }),
      );
      window.setTimeout(() => {
        document
          .querySelector<HTMLElement>(
            '[data-review-id="context-menu-item-open-document"]',
          )
          ?.focus();
      }, 80);
    };

    closeAllTabs();
    await openDirectory(directory);
    await openDocument(fixturePath);
    applyLinkDocumentState();
    if (scenario === "link-hover-preview") {
      window.setTimeout(hoverLink, 1200);
      window.setTimeout(hoverLink, 2400);
      window.setTimeout(hoverLink, 4000);
    } else {
      window.setTimeout(openLinkContextMenu, 1200);
      window.setTimeout(openLinkContextMenu, 2400);
      window.setTimeout(openLinkContextMenu, 4000);
    }
    return true;
  }

  if (scenario === "change-review-mode-markers") {
    const directory = fixtureDirectory(fixturePath);
    const applyWorkingTreeMarkerState = () => {
      dismissInlineNotice();
      setRootDirectory(directory);
      setConfig((current) =>
        current
          ? {
              ...current,
              sidebarVisible: false,
              rightSidebarVisible: false,
              experimental: {
                ...current.experimental,
                postDiffGitMarkers: true,
              },
            }
          : current,
      );
    };

    closeAllTabs();
    applyWorkingTreeMarkerState();
    await openDirectory(directory);
    applyWorkingTreeMarkerState();
    await openDocument(fixturePath);
    applyWorkingTreeMarkerState();
    window.setTimeout(applyWorkingTreeMarkerState, 300);
    window.setTimeout(applyWorkingTreeMarkerState, 900);
    window.setTimeout(applyWorkingTreeMarkerState, 1500);
    window.setTimeout(applyWorkingTreeMarkerState, 2500);
    return true;
  }

  if (
    scenario === "diagram-inspector" ||
    scenario === "diagram-inline-preview-entry" ||
    scenario === "diagram-preview" ||
    scenario === "diagram-save-action"
  ) {
    const directory = fixtureDirectory(fixturePath);
    const scrubDiagramInspectorValues = () => {
      document
        .querySelectorAll<HTMLElement>(".diagram-inspector-facts dt")
        .forEach((label) => {
          if (label.textContent?.trim() !== "Source") return;
          const value = label.nextElementSibling as HTMLElement | null;
          if (value) value.textContent = "overview.adoc:16";
        });
      document
        .querySelectorAll<HTMLButtonElement>(
          ".diagram-inspector-actions button",
        )
        .forEach((button) => {
          if (button.textContent?.includes("Copy Source")) {
            button.style.display = "none";
          }
        });
      const previewReference = document.querySelector<HTMLElement>(
        ".diagram-preview-title small",
      );
      if (previewReference) previewReference.textContent = "overview.adoc:16";
    };
    const applyDiagramInspectorState = () => {
      dismissInlineNotice();
      setRootDirectory(directory);
      setRightSidebarTab("diagrams");
      setConfig((current) =>
        current
          ? {
              ...current,
              sidebarVisible: false,
              rightSidebarVisible: true,
              layout: {
                ...current.layout,
                rightSidebarWidth: 400,
              },
              experimental: {
                ...current.experimental,
                diagramPlaceholderRendering: true,
                diagramPlaceholderRenderingConfigured: true,
                searchHitRuler: false,
              },
            }
          : current,
      );
      scrubDiagramInspectorValues();
    };
    const focusSecondDiagram = () => {
      scrubDiagramInspectorValues();
      const items = Array.from(
        document.querySelectorAll<HTMLButtonElement>(
          '[data-review-id="diagram-inspector-item"]',
        ),
      );
      const target = items[1] ?? items[0];
      target?.click();
      target?.focus();
      window.setTimeout(scrubDiagramInspectorValues, 80);
    };
    const openDiagramPreview = () => {
      applyDiagramInspectorState();
      document
        .querySelector<HTMLButtonElement>(
          '[data-review-id="diagram-inspector-open-preview"]',
        )
        ?.click();
      window.setTimeout(scrubDiagramInspectorValues, 80);
      window.setTimeout(scrubDiagramInspectorValues, 240);
    };
    const focusSaveAction = () => {
      applyDiagramInspectorState();
      scrubDiagramInspectorValues();
      document
        .querySelector<HTMLButtonElement>(
          '[data-review-id="diagram-inspector-save-svg"]',
        )
        ?.focus();
    };
    const focusInlineDiagram = () => {
      dismissInlineNotice();
      setRootDirectory(directory);
      setConfig((current) =>
        current
          ? {
              ...current,
              sidebarVisible: false,
              rightSidebarVisible: false,
              experimental: {
                ...current.experimental,
                diagramPlaceholderRendering: true,
                diagramPlaceholderRenderingConfigured: true,
                searchHitRuler: false,
              },
            }
          : current,
      );
      const diagram = document.querySelector<HTMLElement>(
        '[data-review-id="diagram-inline-image"]',
      );
      if (!diagram) return;
      document
        .querySelectorAll<HTMLElement>(".tab:not(.active)")
        .forEach((tab) => {
          tab.style.display = "none";
        });
      diagram.scrollIntoView({ block: "center", inline: "nearest" });
      diagram.setAttribute("tabindex", "-1");
      diagram.focus();
      diagram.style.borderColor = "#287466";
      diagram.style.boxShadow = "0 0 0 4px rgba(40, 116, 102, 0.2)";
      diagram.style.background = "#f8fcfb";
    };

    closeAllTabs();
    await openDirectory(directory);
    await openDocument(fixturePath);
    const diagramDocument = await loadDocumentForScreenshot(fixturePath);
    setTabs([diagramDocument]);
    setDocumentPayload(diagramDocument);
    setConfig((current) =>
      current
        ? {
            ...current,
            workspace: {
              ...current.workspace,
              openTabs: [fixturePath],
              recentTabs: [fixturePath],
            },
          }
        : current,
    );
    if (scenario === "diagram-inline-preview-entry") {
      window.setTimeout(focusInlineDiagram, 800);
      window.setTimeout(focusInlineDiagram, 1800);
      window.setTimeout(focusInlineDiagram, 3200);
      return true;
    }
    applyDiagramInspectorState();
    window.setTimeout(applyDiagramInspectorState, 300);
    window.setTimeout(applyDiagramInspectorState, 900);
    window.setTimeout(scrubDiagramInspectorValues, 1500);
    window.setTimeout(focusSecondDiagram, 2200);
    window.setTimeout(focusSecondDiagram, 3600);
    if (scenario === "diagram-preview") {
      window.setTimeout(openDiagramPreview, 4500);
      window.setTimeout(openDiagramPreview, 5800);
    }
    if (scenario === "diagram-save-action") {
      window.setTimeout(focusSaveAction, 4200);
      window.setTimeout(focusSaveAction, 5600);
    }
    return true;
  }

  return false;
}
