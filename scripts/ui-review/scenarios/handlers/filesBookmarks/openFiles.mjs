export async function applyOpenFilesScenario(context) {
  const scenario = context.scenario;
  const page = context.page;
  if (scenario === "viewer-render-cache-tab-revisit") {
    const pathA = "/workspace/docs/markdown-sample.md";
    const pathB = "/workspace/docs/markdown-code.md";
    const beginPhase = async (phase) => {
      const started = await page.evaluate(
        (phaseName) =>
          window.__SVARD_DOCUMENT_RENDER_CACHE_BENCHMARK_BEGIN__?.(phaseName),
        phase,
      );
      if (started !== true) {
        throw new Error(`Failed to start render cache phase: ${phase}`);
      }
    };
    const endPhase = async (phase) => {
      await page.evaluate(
        () =>
          new Promise((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(resolve));
          }),
      );
      const ended = await page.evaluate(
        (phaseName) =>
          window.__SVARD_DOCUMENT_RENDER_CACHE_BENCHMARK_END__?.(phaseName),
        phase,
      );
      if (ended !== true) {
        throw new Error(`Failed to end render cache phase: ${phase}`);
      }
    };
    const readDocumentShape = () =>
      page.evaluate(() => {
        const sourceReferences = [
          ...document.querySelectorAll(
            '[data-review-id="document-body"] [data-source-reference]',
          ),
        ].map((element) => element.getAttribute("data-source-reference"));
        const sourceSelections = [
          ...document.querySelectorAll(
            '[data-review-id="document-body"] [data-source-selection-start][data-source-selection-end]',
          ),
        ].map((element) => [
          element.getAttribute("data-source-selection-start"),
          element.getAttribute("data-source-selection-end"),
          element.getAttribute("data-source-selection-source-path"),
        ]);
        return {
          headingCount: document.querySelectorAll(
            '[data-review-id="document-body"] h1, [data-review-id="document-body"] h2',
          ).length,
          paragraphCount: document.querySelectorAll(
            '[data-review-id="document-body"] p',
          ).length,
          sourceReferences,
          sourceSelections,
          tocTargets: [
            ...document.querySelectorAll('[data-review-id="toc"] a'),
          ].map((element) => element.getAttribute("href")),
        };
      });

    await page.locator('[data-review-id="file-tree"]').waitFor();
    await page.evaluate(
      ({ firstPath, secondPath }) => {
        const buildSource = (title, prefix, referenceCount) => {
          const sections = Array.from({ length: 6 }, (_, index) => {
            const number = index + 1;
            return `## ${prefix} Section ${number}\n\nCache target paragraph ${number} keeps the rendered structure deterministic.\n\n| Item | Value |\n| --- | --- |\n| Phase | ${number} |\n`;
          });
          const references = Array.from(
            { length: referenceCount },
            (_, index) => {
              const number = String(index + 1).padStart(5, "0");
              return `[ref-${number}]: ./target-${number}.md`;
            },
          );
          return `# ${title}\n\nCache target introduction for the bounded render artifact benchmark.\n\n${sections.join("\n")}\n${references.join("\n")}\n`;
        };
        window.__SVARD_DOCUMENT_OVERRIDES__ = {
          [firstPath]: {
            source: buildSource(
              "Markdown Sample Render Cache A",
              "Alpha",
              16_000,
            ),
            updatedAt: "2026-05-12T00:10:00.000Z",
          },
          [secondPath]: {
            source: buildSource(
              "Markdown Code Sample Render Cache B",
              "Beta",
              12_000,
            ),
            updatedAt: "2026-05-12T00:11:00.000Z",
          },
        };
      },
      { firstPath: pathA, secondPath: pathB },
    );
    await page.locator('[data-review-id="tree-collapse-all"]').click();
    await page
      .locator('[data-review-id="tree-folder-toggle"]')
      .filter({ hasText: "docs" })
      .click();

    await beginPhase("cold-a");
    await page
      .locator('[data-review-id="tree-file"]')
      .filter({ hasText: "markdown-sample.md" })
      .click();
    await page
      .getByRole("heading", { name: "Markdown Sample Render Cache A" })
      .waitFor();
    await endPhase("cold-a");
    const coldShape = await readDocumentShape();

    await beginPhase("cold-b");
    await page
      .locator('[data-review-id="tree-file"]')
      .filter({ hasText: "markdown-code.md" })
      .click();
    await page
      .getByRole("heading", { name: "Markdown Code Sample Render Cache B" })
      .waitFor();
    await endPhase("cold-b");

    await beginPhase("revisit-a");
    await page
      .locator(
        '[data-review-id="open-file-item"][data-path="/workspace/docs/markdown-sample.md"]',
      )
      .click();
    await page
      .getByRole("heading", { name: "Markdown Sample Render Cache A" })
      .waitFor();
    await endPhase("revisit-a");
    const revisitShape = await readDocumentShape();
    const selectionUsable = await page.evaluate(() => {
      const paragraph = document.querySelector(
        '[data-review-id="document-body"] p',
      );
      if (!(paragraph instanceof HTMLElement)) return false;
      const range = document.createRange();
      range.selectNodeContents(paragraph);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      const usable = (selection?.toString().trim().length ?? 0) > 0;
      selection?.removeAllRanges();
      return usable;
    });
    await page.locator('[data-review-id="right-sidebar-tab-search"]').click();
    await page.locator('[data-review-id="search-input"]').fill("cache target");
    await page
      .locator('[data-review-id="search-result-item"]')
      .first()
      .waitFor();
    const searchUsable =
      (await page.locator('[data-review-id="search-result-item"]').count()) >
        0 && (await page.locator('[data-review-id="search-hit"]').count()) > 0;
    await page.locator('[data-review-id="search-input"]').fill("");
    await page
      .locator('[data-review-id="search-hit"]')
      .first()
      .waitFor({ state: "detached" });
    await page.locator('[data-review-id="right-sidebar-tab-contents"]').click();
    await page.locator('[data-review-id="toc"] a').first().waitFor();

    const initialTheme = await page.evaluate(() =>
      document
        .querySelector('[data-review-id="shell"]')
        ?.classList.contains("theme-dark")
        ? "dark"
        : "light",
    );
    const nextTheme = initialTheme === "dark" ? "light" : "dark";
    await beginPhase("theme-a");
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("theme.toggle");
    });
    await page.locator(`.app-shell.theme-${nextTheme}`).waitFor();
    await page.waitForFunction(() => {
      const metrics =
        window.__SVARD_DOCUMENT_RENDER_CACHE_BENCHMARK_CURRENT__?.();
      return (
        (metrics?.coreProducerCount ?? 0) + (metrics?.coreHitCount ?? 0) > 0 &&
        (metrics?.prepareProducerCount ?? 0) +
          (metrics?.preparedHitCount ?? 0) >
          0
      );
    });
    await endPhase("theme-a");

    await page.evaluate(
      ({ documentPath }) => {
        const current = window.__SVARD_DOCUMENT_OVERRIDES__?.[documentPath];
        if (!current) return;
        window.__SVARD_DOCUMENT_OVERRIDES__ = {
          ...window.__SVARD_DOCUMENT_OVERRIDES__,
          [documentPath]: {
            ...current,
            source: current.source.replace(
              "# Markdown Sample Render Cache A",
              "# Markdown Sample Render Cache Reloaded",
            ),
            updatedAt: "2026-05-12T00:12:00.000Z",
          },
        };
      },
      { documentPath: pathA },
    );
    await beginPhase("reload-a");
    await page.evaluate(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("viewer.reloadForce");
    });
    await page
      .getByRole("heading", { name: "Markdown Sample Render Cache Reloaded" })
      .waitFor();
    await endPhase("reload-a");
    await page.evaluate(
      ({ cold, revisit, selectionOk, searchOk, expectedTheme }) => {
        window.__SVARD_RENDER_CACHE_UI_CHECK__ = {
          equivalentShape:
            JSON.stringify(cold) === JSON.stringify(revisit) &&
            cold.headingCount > 0 &&
            cold.paragraphCount > 0 &&
            cold.sourceReferences.length > 0 &&
            cold.sourceSelections.length > 0 &&
            cold.tocTargets.length > 0,
          selectionUsable: selectionOk,
          searchUsable: searchOk,
          themeApplied: document
            .querySelector('[data-review-id="shell"]')
            ?.classList.contains(`theme-${expectedTheme}`),
          latestContentVisible:
            document
              .querySelector('[data-review-id="document-body"] h1')
              ?.textContent?.trim() === "Markdown Sample Render Cache Reloaded",
        };
      },
      {
        cold: coldShape,
        revisit: revisitShape,
        selectionOk: selectionUsable,
        searchOk: searchUsable,
        expectedTheme: nextTheme,
      },
    );
  } else if (scenario === "viewer-drag-reorder-open-files") {
    await page.locator('[data-review-id="file-tree"]').waitFor();
    await page.locator('[data-review-id="tree-collapse-all"]').click();
    await page
      .locator('[data-review-id="tree-folder-toggle"]')
      .filter({ hasText: "docs" })
      .click();
    for (const file of [
      "preferences.adoc",
      "copy-actions.adoc",
      "render-fixtures.adoc",
    ]) {
      await page
        .locator('[data-review-id="tree-file"]')
        .filter({ hasText: file })
        .click();
      await page
        .locator('[data-review-id="active-document-title"]')
        .filter({ hasText: file })
        .waitFor();
    }
    const firstRow = page.locator('[data-review-id="open-file-item"]').nth(0);
    await page
      .locator('[data-review-id="open-file-item"] .open-file-button')
      .nth(1)
      .dragTo(firstRow);
    await page.waitForFunction(() =>
      document
        .querySelectorAll('[data-review-id="open-file-item"]')
        .item(0)
        ?.textContent?.includes("preferences.adoc"),
    );
  } else if (scenario === "viewer-pinned-tabs") {
    await page.locator('[data-review-id="tree-collapse-all"]').click();
    await page
      .locator('[data-review-id="tree-folder-toggle"]')
      .filter({ hasText: "docs" })
      .click();
    for (const file of ["preferences.adoc", "render-fixtures.adoc"]) {
      await page
        .locator('[data-review-id="tree-file"]')
        .filter({ hasText: file })
        .click();
    }
    await page.locator("text=Render Fixtures").waitFor();
    const preferencesRow = page
      .locator('[data-review-id="open-file-item"]')
      .filter({ hasText: "preferences.adoc" });
    await preferencesRow.hover();
    await preferencesRow.locator('[data-review-id="open-file-pin"]').click();
    await page
      .locator('[data-review-id="open-file-item"]')
      .filter({ hasText: "render-fixtures.adoc" })
      .click({ button: "right" });
    await page.locator('[data-review-id="context-menu"]').waitFor();
    await page
      .locator('[data-review-id="context-menu-item-close-other-files"]')
      .click({ force: true });
  } else if (scenario === "viewer-open-files-row-actions") {
    await page.locator('[data-review-id="tree-collapse-all"]').click();
    await page
      .locator('[data-review-id="tree-folder-toggle"]')
      .filter({ hasText: "docs" })
      .click();
    for (const file of [
      "preferences.adoc",
      "copy-actions.adoc",
      "render-fixtures.adoc",
    ]) {
      await page
        .locator('[data-review-id="tree-file"]')
        .filter({ hasText: file })
        .click();
      await page
        .locator('[data-review-id="active-document-title"]')
        .filter({ hasText: file })
        .waitFor();
    }
    const preferencesRow = page
      .locator('[data-review-id="open-file-item"]')
      .filter({ hasText: "preferences.adoc" });
    await preferencesRow.hover();
    await preferencesRow.locator('[data-review-id="open-file-pin"]').click();
    const restingCopyActions = await page.evaluate(() => {
      const row = [
        ...document.querySelectorAll('[data-review-id="open-file-item"]'),
      ]
        .filter((candidate) => candidate instanceof HTMLElement)
        .find((candidate) =>
          candidate.textContent?.includes("copy-actions.adoc"),
        );
      const readAction = (selector) => {
        const action = row?.querySelector(selector);
        if (!(action instanceof HTMLElement)) {
          return null;
        }
        const style = getComputedStyle(action);
        return {
          opacity: Number(style.opacity),
          visibility: style.visibility,
          pointerEvents: style.pointerEvents,
          ariaLabel: action.getAttribute("aria-label"),
        };
      };
      return {
        restingPin: readAction('[data-review-id="open-file-pin"]'),
        restingClose: readAction('[data-review-id="open-file-close"]'),
      };
    });
    await page
      .locator('[data-review-id="open-file-item"]')
      .filter({ hasText: "copy-actions.adoc" })
      .hover();
    await page.waitForTimeout(180);
    await page.evaluate((restingCopyActions) => {
      const readAction = (row, selector) => {
        const action = row?.querySelector(selector);
        if (!(action instanceof HTMLElement)) {
          return null;
        }
        const style = getComputedStyle(action);
        return {
          opacity: Number(style.opacity),
          visibility: style.visibility,
          pointerEvents: style.pointerEvents,
          ariaLabel: action.getAttribute("aria-label"),
        };
      };
      const rowByText = (text) =>
        [...document.querySelectorAll('[data-review-id="open-file-item"]')]
          .filter((row) => row instanceof HTMLElement)
          .find((row) => row.textContent?.includes(text));
      const hovered = rowByText("copy-actions.adoc");
      const pinned = rowByText("preferences.adoc");
      const active = rowByText("render-fixtures.adoc");
      window.__SVARD_OPEN_FILES_ROW_ACTIONS_CHECK__ = {
        ...restingCopyActions,
        hoveredPin: readAction(hovered, '[data-review-id="open-file-pin"]'),
        hoveredClose: readAction(hovered, '[data-review-id="open-file-close"]'),
        pinnedPin: readAction(pinned, '[data-review-id="open-file-pin"]'),
        pinnedClose: readAction(pinned, '[data-review-id="open-file-close"]'),
        activeClose: readAction(active, '[data-review-id="open-file-close"]'),
        pinnedRowClass: pinned?.classList.contains("pinned") ?? false,
        activeRowClass: active?.classList.contains("active") ?? false,
      };
    }, restingCopyActions);
  } else if (scenario === "viewer-open-files-filter") {
    await page.locator('[data-review-id="tree-collapse-all"]').click();
    await page
      .locator('[data-review-id="tree-folder-toggle"]')
      .filter({ hasText: "docs" })
      .click();
    await page
      .locator('[data-review-id="tree-file"]')
      .filter({ hasText: "preferences.adoc" })
      .click();
    await page.locator('[data-review-id="open-files-filter"]').fill("pref");
    await page.locator('[data-review-id="open-files-filter"]').press("Enter");
    await page.locator("text=Preferences Defaults").waitFor();
  } else if (scenario === "viewer-open-files-glob-filter") {
    await page.locator('[data-review-id="tree-collapse-all"]').click();
    await page
      .locator('[data-review-id="tree-folder-toggle"]')
      .filter({ hasText: "docs" })
      .click();
    for (const file of [
      "math-rendering.md",
      "preferences.adoc",
      "copy-actions.adoc",
    ]) {
      await page
        .locator('[data-review-id="tree-file"]')
        .filter({ hasText: file })
        .click();
      await page
        .locator('[data-review-id="active-document-title"]')
        .filter({ hasText: file })
        .waitFor();
    }
    const preferencesRow = page
      .locator('[data-review-id="open-file-item"]')
      .filter({ hasText: "preferences.adoc" });
    await preferencesRow.hover();
    await preferencesRow.locator('[data-review-id="open-file-pin"]').click();
    await page.locator('[data-review-id="open-files-filter"]').fill("*pref*");
    await page
      .locator('[data-review-id="open-file-item"].pinned')
      .filter({ hasText: "preferences.adoc" })
      .waitFor();
    await page.locator('[data-review-id="open-files-filter"]').fill("*.md");
    await page
      .locator('[data-review-id="open-file-item"]')
      .filter({ hasText: "math-rendering.md" })
      .waitFor();
    await page.locator('[data-review-id="open-files-filter"]').fill("*copy*");
    await page.locator('[data-review-id="open-files-filter"]').press("Enter");
    await page.locator("text=Copy Actions").waitFor();
  } else if (scenario === "viewer-open-files-collapse") {
    await page.locator('[data-review-id="tree-collapse-all"]').click();
    await page
      .locator('[data-review-id="tree-folder-toggle"]')
      .filter({ hasText: "docs" })
      .click();
    await page
      .locator('[data-review-id="tree-file"]')
      .filter({ hasText: "preferences.adoc" })
      .click();
    await page.locator('[data-review-id="open-files-collapse"]').click();
    await page.locator('[data-review-id="open-files-collapsed-bar"]').waitFor();
    await page
      .locator('[data-review-id="tree-file"]')
      .filter({ hasText: "copy-actions.adoc" })
      .click();
    await page.locator('[data-review-id="active-document-title"]').waitFor();
    await page.locator('[data-review-id="open-files-expand"]').click();
    await page.locator('[data-review-id="open-file-item"]').first().waitFor();
    await page.locator('[data-review-id="open-files-collapse"]').click();
    await page.locator('[data-review-id="open-files-collapsed-bar"]').waitFor();
  } else if (scenario === "viewer-open-files-auto-reload-inactive") {
    await page.locator("text=markdown-sample.md").click();
    await page.getByRole("heading", { name: "Markdown Sample" }).waitFor();
    await page.locator("text=markdown-code.md").click();
    await page.getByRole("heading", { name: "Markdown Code Sample" }).waitFor();
    await page.evaluate(() => {
      window.__SVARD_DOCUMENT_OVERRIDES__ = {
        "/workspace/docs/markdown-sample.md": {
          source:
            "# Markdown Sample Reloaded\n\nThis content was reloaded while the file was inactive.\n",
          updatedAt: "2026-05-12T00:02:00.000Z",
        },
      };
      window.__SVARD_TRIGGER_DOCUMENT_CHANGE__?.(
        "/workspace/docs/markdown-sample.md",
      );
    });
    await page.waitForTimeout(150);
    await page
      .locator(
        '[data-review-id="open-file-item"][data-path="/workspace/docs/markdown-sample.md"]',
      )
      .click();
    await page
      .getByRole("heading", { name: "Markdown Sample Reloaded" })
      .waitFor();
  } else if (scenario === "viewer-open-files-auto-reload-error") {
    await page.locator("text=markdown-sample.md").click();
    await page.getByRole("heading", { name: "Markdown Sample" }).waitFor();
    await page.locator("text=markdown-code.md").click();
    await page.getByRole("heading", { name: "Markdown Code Sample" }).waitFor();
    await page.evaluate(() => {
      window.__SVARD_OPEN_DOCUMENT_ERRORS__ = {
        "/workspace/docs/markdown-sample.md": "mock reload failed",
      };
      window.__SVARD_TRIGGER_DOCUMENT_CHANGE__?.(
        "/workspace/docs/markdown-sample.md",
      );
    });
    await page
      .locator(
        '[data-review-id="open-file-item"][data-path="/workspace/docs/markdown-sample.md"][data-reload-status="error"]',
      )
      .waitFor();
  } else {
    return false;
  }
  return true;
}
