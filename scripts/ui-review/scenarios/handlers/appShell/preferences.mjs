export async function applyAppShellPreferencesScenario(context) {
  const scenario = context.scenario;
  const page = context.page;
  if (
    scenario === "viewer-preferences" ||
    scenario === "viewer-preferences-kroki-remote-self-managed"
  ) {
    await openPreferencesPage(page, "preferences-dialog");
    await selectPreferencesSection(page, "Kroki");
    await page
      .locator('[data-review-id="kroki-mode-control"]')
      .selectOption("remote");
    await page
      .locator('[data-review-id="kroki-endpoint-control"]')
      .fill("http://192.168.1.10:8000");
    await page.locator('[data-review-id="kroki-test-run"]').click();
    await page.locator('[data-review-id="kroki-test-svg"] svg').waitFor();
    if (scenario === "viewer-preferences-kroki-remote-self-managed") {
      await resetPreferenceSamples(page, "__SVARD_KROKI_POLICY_SAMPLES__");
      await capturePreferenceSample(
        page,
        "__SVARD_KROKI_POLICY_SAMPLES__",
        () => ({
          mode: document.querySelector('[data-review-id="kroki-mode-control"]')
            ?.value,
          endpoint: document.querySelector(
            '[data-review-id="kroki-endpoint-control"]',
          )?.value,
        }),
      );
      await page
        .locator('[data-review-id="kroki-mode-control"]')
        .selectOption("public");
      await page.locator('[data-review-id="kroki-endpoint-control"]').waitFor();
      await capturePreferenceSample(
        page,
        "__SVARD_KROKI_POLICY_SAMPLES__",
        () => ({
          mode: document.querySelector('[data-review-id="kroki-mode-control"]')
            ?.value,
          endpoint: document.querySelector(
            '[data-review-id="kroki-endpoint-control"]',
          )?.value,
        }),
      );
      await page
        .locator('[data-review-id="kroki-mode-control"]')
        .selectOption("remote");
      await page
        .locator('[data-review-id="kroki-endpoint-control"]')
        .fill("http://192.168.1.10:8000");
      await page.locator('[data-review-id="kroki-test-run"]').click();
      await page.locator('[data-review-id="kroki-test-svg"] svg').waitFor();
    }
  } else if (scenario === "viewer-preferences-tab") {
    await openPreferencesPage(page);
    await resetPreferenceSamples(page, "__SVARD_PREFERENCES_TAB_SAMPLES__");
    await capturePreferenceSample(
      page,
      "__SVARD_PREFERENCES_TAB_SAMPLES__",
      () => ({
        openFilePreferenceRows: document.querySelectorAll(
          '[data-review-id="open-file-item"][data-tab-kind="preferences"]',
        ).length,
        preferencesPages: document.querySelectorAll(
          '[data-review-id="preferences-page"]',
        ).length,
        rightSidebarCount: document.querySelectorAll(
          '[data-review-id="right-sidebar"]',
        ).length,
        rightSidebarPlaceholderCount: document.querySelectorAll(
          '[data-review-id="preferences-right-sidebar-placeholder"]',
        ).length,
      }),
    );
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("preferences.open");
    });
    await capturePreferenceSample(
      page,
      "__SVARD_PREFERENCES_TAB_SAMPLES__",
      () => ({
        openFilePreferenceRows: document.querySelectorAll(
          '[data-review-id="open-file-item"][data-tab-kind="preferences"]',
        ).length,
        preferencesPages: document.querySelectorAll(
          '[data-review-id="preferences-page"]',
        ).length,
        rightSidebarCount: document.querySelectorAll(
          '[data-review-id="right-sidebar"]',
        ).length,
        rightSidebarPlaceholderCount: document.querySelectorAll(
          '[data-review-id="preferences-right-sidebar-placeholder"]',
        ).length,
      }),
    );
    await selectPreferencesSection(page, "Keybindings");
    await page
      .locator('[data-review-id="keybinding-shortcut-table"]')
      .waitFor();
    await selectPreferencesSection(page, "General");
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("zoom.in");
    });
    await page
      .locator('[data-review-id="zoom-value"]')
      .filter({ hasText: "110%" })
      .waitFor();
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("sidebar.toggleLeft");
    });
    await page.locator('[data-review-id="tab-bar"]').waitFor();
    await capturePreferenceSample(
      page,
      "__SVARD_PREFERENCES_TAB_SAMPLES__",
      () => ({
        activeTopbarPreferenceTabs: document.querySelectorAll(
          '[data-review-id="active-tab"][data-tab-kind="preferences"]',
        ).length,
        preferenceTabs: document.querySelectorAll(
          '[data-tab-kind="preferences"]',
        ).length,
      }),
    );
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("preferences.close");
    });
    await page.locator('[data-review-id="document-body"]').waitFor();
    await capturePreferenceSample(
      page,
      "__SVARD_PREFERENCES_TAB_SAMPLES__",
      () => ({
        preferencesPagesAfterClose: document.querySelectorAll(
          '[data-review-id="preferences-page"]',
        ).length,
        documentBodiesAfterClose: document.querySelectorAll(
          '[data-review-id="document-body"]',
        ).length,
        rightSidebarCountAfterClose: document.querySelectorAll(
          '[data-review-id="right-sidebar"]',
        ).length,
      }),
    );
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("sidebar.toggleLeft");
    });
    await page.locator('[data-review-id="left-sidebar"]').waitFor();
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("preferences.open");
    });
    await page.locator('[data-review-id="preferences-page"]').waitFor();
  } else if (scenario === "viewer-preferences-zoom-wheel") {
    await openPreferencesPage(page);
    await selectPreferencesSection(page, "General", "preferences-tab-general");
    await resetPreferenceSamples(
      page,
      "__SVARD_PREFERENCES_ZOOM_WHEEL_SAMPLES__",
    );
    await capturePreferenceSample(
      page,
      "__SVARD_PREFERENCES_ZOOM_WHEEL_SAMPLES__",
      () => ({
        step: "initial",
        checked:
          document.querySelector('[data-review-id="zoom-wheel-toggle"]')
            ?.checked ?? null,
        text: document
          .querySelector('[data-review-id="preferences-tab-general"]')
          ?.textContent?.trim(),
      }),
    );
    await page.locator('[data-review-id="zoom-wheel-toggle"]').check();
    await capturePreferenceSample(
      page,
      "__SVARD_PREFERENCES_ZOOM_WHEEL_SAMPLES__",
      () => ({
        step: "checked",
        checked:
          document.querySelector('[data-review-id="zoom-wheel-toggle"]')
            ?.checked ?? null,
      }),
    );
  } else if (scenario === "viewer-mouse-wheel-zoom") {
    await page.locator('[data-review-id="document-body"]').waitFor();
    await resetPreferenceSamples(page, "__SVARD_MOUSE_WHEEL_ZOOM_SAMPLES__");
    await captureMouseWheelZoomSample(page, "initial");
    await dispatchDocumentWheelZoom(page);
    await captureMouseWheelZoomSample(page, "default-off");
    await openPreferencesPage(page);
    await selectPreferencesSection(page, "General", "preferences-tab-general");
    await page.locator('[data-review-id="zoom-wheel-toggle"]').check();
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("preferences.close");
    });
    await page.locator('[data-review-id="document-body"]').waitFor();
    await dispatchDocumentWheelZoom(page);
    await captureMouseWheelZoomSample(page, "enabled");
  } else if (scenario === "viewer-preferences-security-persistence") {
    await openPreferencesPage(page);
    await selectPreferencesSection(
      page,
      "Security",
      "preferences-tab-security",
    );
    await resetPreferenceSamples(
      page,
      "__SVARD_PREFERENCES_SECURITY_SAMPLES__",
    );
    await capturePreferenceSample(
      page,
      "__SVARD_PREFERENCES_SECURITY_SAMPLES__",
      () => ({
        step: "initial",
        showExternalImages: document.querySelector(
          '[data-review-id="show-external-images-control"]',
        )?.checked,
      }),
    );
    await page
      .locator('[data-review-id="show-external-images-control"]')
      .check();
    await capturePreferenceSample(
      page,
      "__SVARD_PREFERENCES_SECURITY_SAMPLES__",
      () => ({
        step: "checked",
        showExternalImages: document.querySelector(
          '[data-review-id="show-external-images-control"]',
        )?.checked,
      }),
    );
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("preferences.close");
    });
    await page.locator('[data-review-id="document-body"]').waitFor();
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("preferences.open");
    });
    await page.locator('[data-review-id="preferences-page"]').waitFor();
    await selectPreferencesSection(
      page,
      "Security",
      "preferences-tab-security",
    );
    await capturePreferenceSample(
      page,
      "__SVARD_PREFERENCES_SECURITY_SAMPLES__",
      () => ({
        step: "reopened",
        showExternalImages: document.querySelector(
          '[data-review-id="show-external-images-control"]',
        )?.checked,
      }),
    );
  } else if (scenario === "viewer-preferences-experimental") {
    await openPreferencesPage(page);
    await selectPreferencesSection(
      page,
      "Experimental",
      "preferences-tab-experimental",
    );
    await resetPreferenceSamples(
      page,
      "__SVARD_PREFERENCES_EXPERIMENTAL_SAMPLES__",
    );
    await capturePreferenceSample(
      page,
      "__SVARD_PREFERENCES_EXPERIMENTAL_SAMPLES__",
      () => ({
        step: "initial",
        searchHitRuler: document.querySelector(
          '[data-review-id="experimental-search-hit-ruler-control"]',
        )?.checked,
      }),
    );
    await page
      .locator('[data-review-id="experimental-search-hit-ruler-control"]')
      .check();
    await capturePreferenceSample(
      page,
      "__SVARD_PREFERENCES_EXPERIMENTAL_SAMPLES__",
      () => ({
        step: "checked",
        searchHitRuler: document.querySelector(
          '[data-review-id="experimental-search-hit-ruler-control"]',
        )?.checked,
      }),
    );
  } else if (scenario === "viewer-preferences-zen-mode") {
    await openPreferencesPage(page);
    await selectPreferencesSection(
      page,
      "Zen Mode",
      "preferences-tab-zen-mode",
    );
    await page.locator('[data-review-id="zen-mode-preset-control"]').waitFor();
    await resetPreferenceSamples(
      page,
      "__SVARD_PREFERENCES_ZEN_MODE_SAMPLES__",
    );
    await capturePreferenceSample(
      page,
      "__SVARD_PREFERENCES_ZEN_MODE_SAMPLES__",
      () => ({
        step: "initial",
        generalHasZenControls:
          document
            .querySelector('[data-review-id="preferences-tab-general"]')
            ?.textContent?.includes("Center reader layout") ?? false,
        activeSection:
          document.querySelector('[data-review-id="preferences-pane"] h3')
            ?.textContent ?? "",
        rightSidebarCount: document.querySelectorAll(
          '[data-review-id="right-sidebar"]',
        ).length,
        rightSidebarPlaceholderCount: document.querySelectorAll(
          '[data-review-id="preferences-right-sidebar-placeholder"]',
        ).length,
        advancedOpen:
          document
            .querySelector('[data-review-id="zen-mode-advanced-settings"]')
            ?.hasAttribute("open") ?? false,
        widthDisabled:
          document.querySelector(
            '[data-review-id="zen-mode-max-width-control"]',
          )?.disabled ?? null,
      }),
    );
    await page
      .locator('[data-review-id="zen-mode-preset-control"]')
      .getByText("Minimal", { exact: true })
      .click();
    await capturePreferenceSample(
      page,
      "__SVARD_PREFERENCES_ZEN_MODE_SAMPLES__",
      () => ({
        step: "minimal",
        centerLayout:
          document.querySelector(
            '[data-review-id="zen-mode-center-layout-control"]',
          )?.checked ?? false,
        customSelected:
          document.querySelector(
            '[data-review-id="zen-mode-preset-control"] input[value="custom"]',
          )?.checked ?? false,
      }),
    );
    await page
      .locator('[data-review-id="zen-mode-preset-control"]')
      .getByText("Default", { exact: true })
      .click();
    await page
      .locator('[data-review-id="zen-mode-max-width-control"]')
      .fill("1040");
    await capturePreferenceSample(
      page,
      "__SVARD_PREFERENCES_ZEN_MODE_SAMPLES__",
      () => ({
        step: "custom",
        customSelected:
          document.querySelector(
            '[data-review-id="zen-mode-preset-control"] input[value="custom"]',
          )?.checked ?? false,
        contentWidth:
          document.querySelector(
            '[data-review-id="zen-mode-max-width-control"]',
          )?.value ?? "",
      }),
    );
    await page
      .locator('[data-review-id="zen-mode-advanced-settings"] summary')
      .click();
    await page
      .locator('[data-review-id="zen-mode-hide-tabs-control"]')
      .waitFor();
    await page
      .locator('[data-review-id="zen-mode-full-screen-control"]')
      .click();
    await capturePreferenceSample(
      page,
      "__SVARD_PREFERENCES_ZEN_MODE_SAMPLES__",
      () => ({
        step: "advanced",
        advancedOpen:
          document
            .querySelector('[data-review-id="zen-mode-advanced-settings"]')
            ?.hasAttribute("open") ?? false,
        fullScreen:
          document.querySelector(
            '[data-review-id="zen-mode-full-screen-control"]',
          )?.checked ?? false,
      }),
    );
  } else if (scenario === "viewer-preferences-stable-size") {
    await openPreferencesPage(page, "preferences-dialog");
    await resetPreferenceSamples(page, "__SVARD_PREFERENCES_SIZE_SAMPLES__");
    for (const section of ["General", "PR / MR Providers", "Keybindings"]) {
      await selectPreferencesSection(page, section);
      await page.locator('[data-review-id="preferences-pane"]').waitFor();
      await capturePreferenceSample(
        page,
        "__SVARD_PREFERENCES_SIZE_SAMPLES__",
        (name) => {
          const dialog = document.querySelector('[aria-label="Preferences"]');
          const pane = document.querySelector(
            '[data-review-id="preferences-pane"]',
          );
          const rect = dialog?.getBoundingClientRect();
          const paneRect = pane?.getBoundingClientRect();
          return {
            name,
            width: rect?.width ?? 0,
            height: rect?.height ?? 0,
            paneScrollable:
              pane instanceof HTMLElement
                ? pane.scrollHeight > pane.clientHeight
                : false,
            paneHeight: paneRect?.height ?? 0,
          };
        },
        section,
      );
    }
  } else if (scenario === "viewer-preferences-remote-providers") {
    await openPreferencesPage(page, "preferences-dialog");
    await selectPreferencesSection(
      page,
      "PR / MR Providers",
      "preferences-tab-remote-providers",
    );
    await page.locator('[data-review-id="remote-provider-github"]').waitFor();
    await page.locator('[data-review-id="remote-provider-gitlab"]').waitFor();
    await page
      .locator('[data-review-id="remote-provider-github-token"]')
      .fill("mock-token");
    await page
      .locator('[data-review-id="remote-provider-github-save-token"]')
      .click();
    await page
      .locator('[data-review-id="remote-provider-github-token-status"]')
      .filter({ hasText: "Ready for PR target detection" })
      .waitFor();
  } else if (scenario === "viewer-preferences-diagrams-polish") {
    await openPreferencesPage(page, "preferences-dialog");
    await selectPreferencesSection(
      page,
      "Diagrams",
      "preferences-tab-diagrams",
    );
    await page
      .locator('[data-review-id="diagram-advanced-settings"] summary')
      .click();
    await page
      .locator('[data-review-id="plantuml-renderer-control"]')
      .getByText("Kroki", { exact: true })
      .click();
    await page
      .locator('[data-review-id="diagram-open-kroki-settings"]')
      .first()
      .click();
    await page.locator('[data-review-id="preferences-tab-kroki"]').waitFor();
    await resetPreferenceSamples(page, "__SVARD_DIAGRAM_PREFERENCES_SAMPLES__");
    await capturePreferenceSample(
      page,
      "__SVARD_DIAGRAM_PREFERENCES_SAMPLES__",
      () => ({
        activeSection:
          document.querySelector('[data-review-id="preferences-pane"] h3')
            ?.textContent ?? "",
      }),
    );
    await selectPreferencesSection(
      page,
      "Diagrams",
      "preferences-tab-diagrams",
    );
    await page
      .locator('[data-review-id="diagram-advanced-settings"] summary')
      .click();
  } else if (scenario === "viewer-preferences-keybindings") {
    await openPreferencesPage(page, "preferences-dialog");
    await selectPreferencesSection(page, "Keybindings");
    await page
      .locator('[data-review-id="keybinding-shortcut-table"]')
      .waitFor();
    await page.locator('[data-review-id="keybinding-search"]').waitFor();
    await page.locator('[data-review-id="keybinding-reset"]').waitFor();
    await page
      .locator('[data-review-id="keybinding-record"]')
      .first()
      .waitFor();
    await page.locator('[data-review-id="keybinding-clear"]').first().waitFor();
    await page.locator("text=search.focus").first().waitFor();
    await page.locator("text=tab.close").first().waitFor();
    await page.locator("text=tab.restoreClosed").first().waitFor();
    await page.locator("text=quickOpen.focus").first().waitFor();
    await page.locator("text=sidebar.toggleLeft").first().waitFor();
    await page.locator("text=view.toggleZenMode").first().waitFor();
    await page.locator("text=Toggle Zen Mode").first().waitFor();
    await page.locator('[data-review-id="keybinding-search"]').fill("zen");
    await page.locator("text=Toggle Zen Mode").first().waitFor();
    await page.locator("text=view.toggleZenMode").first().waitFor();
  } else if (scenario === "viewer-preferences-keybindings-record-cancel") {
    await openPreferencesPage(page, "preferences-dialog");
    await selectPreferencesSection(page, "Keybindings");
    await page
      .locator('[data-review-id="keybinding-shortcut-table"]')
      .waitFor();
    const firstRecord = page
      .locator('[data-review-id="keybinding-record"]')
      .first();
    const resetButton = page.locator('[data-review-id="keybinding-reset"]');
    await firstRecord.click();
    await page
      .locator('[data-review-id="keybinding-recording"]')
      .filter({ hasText: "Escape or Tab to cancel" })
      .waitFor();
    await page.keyboard.press("Escape");
    await page
      .locator('[data-review-id="keybinding-recording"]')
      .waitFor({ state: "detached" });
    await firstRecord.click();
    await page.keyboard.press("Tab");
    await page
      .locator('[data-review-id="keybinding-recording"]')
      .waitFor({ state: "detached" });
    await firstRecord.click();
    await page.keyboard.press("Control");
    await page.locator('[data-review-id="keybinding-recording"]').waitFor();
    await resetButton.click();
    await page
      .locator('[data-review-id="keybinding-recording"]')
      .waitFor({ state: "detached" });
  } else {
    return false;
  }
  return true;
}

async function openPreferencesPage(page, targetReviewId = "preferences-page") {
  await page.evaluate(async () => {
    await window.__SVARD_COMMANDS__?.dispatch("preferences.open");
  });
  await page.locator(`[data-review-id="${targetReviewId}"]`).waitFor();
  await page.locator('[data-review-id="preferences-nav"]').waitFor();
  await page.locator('[data-review-id="preferences-pane"]').waitFor();
}

async function selectPreferencesSection(page, section, targetReviewId) {
  await page
    .locator('[data-review-id="preferences-nav-item"]')
    .filter({ hasText: section })
    .click();
  if (targetReviewId) {
    await page.locator(`[data-review-id="${targetReviewId}"]`).waitFor();
  }
}

async function resetPreferenceSamples(page, globalName) {
  await page.evaluate((globalName) => {
    window[globalName] = [];
  }, globalName);
}

async function capturePreferenceSample(page, globalName, collectSample, arg) {
  const sample = await page.evaluate(collectSample, arg);
  await page.evaluate(
    ({ globalName, sample }) => {
      window[globalName] = [...(window[globalName] ?? []), sample];
    },
    { globalName, sample },
  );
}

async function dispatchDocumentWheelZoom(page) {
  await page.evaluate(() => {
    const article = document.querySelector('[data-review-id="document-body"]');
    article?.dispatchEvent(
      new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
        deltaY: -120,
        metaKey: true,
      }),
    );
  });
}

async function captureMouseWheelZoomSample(page, step) {
  await capturePreferenceSample(
    page,
    "__SVARD_MOUSE_WHEEL_ZOOM_SAMPLES__",
    (step) => ({
      step,
      zoomStyle:
        document.querySelector('[data-review-id="document-body"]')?.style
          .fontSize ?? null,
    }),
    step,
  );
}
