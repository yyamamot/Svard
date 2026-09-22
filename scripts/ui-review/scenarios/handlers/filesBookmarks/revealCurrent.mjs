const revealLabel = "Reveal Current File in File Tree";
const markdown =
  '[data-review-id="tree-file"][data-path="/workspace/docs/git-modified.md"]';
const asciidoc =
  '[data-review-id="tree-file"][data-path="/workspace/docs/copy-actions.adoc"]';

export async function applyRevealCurrentScenario(page) {
  const checks = {};
  const dispatch = (id) =>
    page.evaluate(async (command) => {
      await window.__SVARD_COMMANDS__.dispatch(command);
    }, id);
  const enabled = () =>
    page.evaluate(
      () =>
        window.__SVARD_COMMANDS__.getCommandState("fileTree.revealCurrent")
          .enabled,
    );
  const focused = async (selector) => {
    await page.waitForFunction((rowSelector) => {
      const row = document.querySelector(rowSelector);
      return (
        row?.classList.contains("active") &&
        row.querySelector('button[aria-current="page"]') ===
          document.activeElement
      );
    }, selector);
    return true;
  };
  const palette = async () => {
    await page.keyboard.press("Control+L");
    await page
      .locator('[data-review-id="quick-open-input"]')
      .fill(`>${revealLabel}`);
    await page
      .locator('[data-review-id="quick-open-result"]')
      .filter({ hasText: revealLabel })
      .click();
  };
  await page.locator('[data-review-id="file-tree"]').waitFor();
  await dispatch("tab.closeAll");
  await page.evaluate(() => {
    window.__SVARD_DOCUMENT_OVERRIDES__ = {
      "/workspace/docs/git-modified.md": {
        source:
          "# Reveal fixture\n\n" +
          Array.from(
            { length: 100 },
            (_, i) => `Paragraph ${i}: stable reading position.\n\n`,
          ).join(""),
        updatedAt: "2026-05-12T00:03:00.000Z",
      },
    };
  });
  await page.locator(markdown).locator(".tree-row-main").click();
  await page
    .locator('[data-review-id="document-body"].format-markdown')
    .waitFor();
  checks.markdownActive =
    (await page
      .locator(`${markdown}.active button[aria-current="page"]`)
      .count()) === 1;
  await page.locator(asciidoc).locator(".tree-row-main").click();
  await page
    .locator('[data-review-id="document-body"].format-asciidoc')
    .waitFor();
  checks.asciidocActive =
    (await page
      .locator(`${asciidoc}.active button[aria-current="page"]`)
      .count()) === 1;
  await page.locator('[data-review-id="tree-collapse-all"]').click();
  await dispatch("sidebar.toggleLeft");
  await page
    .locator('[data-review-id="tab"]')
    .filter({ hasText: "git-modified.md" })
    .click();
  await page
    .locator('[data-review-id="document-body"].format-markdown')
    .waitFor();
  await dispatch("sidebar.toggleLeft");
  await page.locator('[data-review-id="file-tree"]').waitFor();
  checks.tabDoesNotFollow = (await page.locator(markdown).count()) === 0;
  await page.getByRole("button", { name: revealLabel, exact: true }).click();
  checks.toolbarReveals = await focused(markdown);
  await dispatch("sidebar.toggleLeft");
  await palette();
  checks.hiddenSidebarPaletteReveals = await focused(markdown);
  await dispatch("view.toggleZenMode");
  await palette();
  checks.zenPaletteReveals = await focused(markdown);
  await page.locator('[data-review-id="documents-view-toggle"]').click();
  await page.locator('[data-review-id="documents-view-mode-mkdocs"]').click();
  await page.locator('[data-review-id="documents-view"]').waitFor();
  await palette();
  checks.docsPaletteReveals = await focused(markdown);
  checks.docsSwitchedToTree =
    (await page.locator('[data-review-id="documents-view"]').count()) === 0;

  await page.locator('[data-review-id="split-view-toggle"]').click();
  await page.locator('[data-pane-id="right"].focused').waitFor();
  await page.locator(asciidoc).locator(".tree-row-main").click();
  await page.locator('[data-pane-id="right"] .format-asciidoc').waitFor();
  await page.locator('[data-pane-id="left"]').click();
  await dispatch("fileTree.revealCurrent");
  checks.splitLeft = await focused(markdown);
  await page.locator('[data-pane-id="right"]').click();
  await dispatch("fileTree.revealCurrent");
  checks.splitRight = await focused(asciidoc);
  await dispatch("view.closeSplit");
  await page.locator(markdown).locator(".tree-row-main").click();

  // Synthetic public fixture paths stay inside the browser and never enter evidence.
  await page.evaluate(() => {
    const entries = [
      ...document.querySelectorAll('[data-review-id="tree-file"]'),
    ]
      .map((row) => ({
        path: row.getAttribute("data-path"),
        name: row.querySelector(".tree-label")?.textContent,
        kind: "file",
      }))
      .filter(
        (entry) =>
          entry.path?.startsWith("/workspace/docs/") &&
          entry.path.split("/").length === 4,
      );
    const target = entries.find((entry) =>
      entry.path.endsWith("/git-modified.md"),
    );
    if (!target) throw new Error("Reveal fixture row unavailable");
    target.name =
      "zz-long-current-document-name-with-git-status-and-overflow.md";
    window.__SVARD_DIRECTORY_ENTRIES__ = {
      "/workspace/docs": [
        ...Array.from({ length: 70 }, (_, i) => ({
          name: `a-filler-${String(i).padStart(3, "0")}.md`,
          path: `/workspace/docs/a-filler-${i}.md`,
          kind: "file",
        })),
        ...entries.filter((entry) => entry !== target),
        target,
      ],
    };
    window.__SVARD_DOCUMENT_OVERRIDES__ = {
      "/workspace/docs/git-modified.md": {
        source:
          "# Reveal fixture\n\n" +
          Array.from(
            { length: 100 },
            (_, i) => `Paragraph ${i}: stable reading position.\n\n`,
          ).join(""),
        updatedAt: "2026-05-12T00:03:00.000Z",
      },
    };
  });
  await page.locator('[data-review-id="tree-refresh"]').click();
  await page
    .locator(`${markdown} .tree-label`)
    .filter({ hasText: "zz-long" })
    .waitFor();
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await page
    .locator('[data-review-id="document-body"] h1')
    .filter({ hasText: "Reveal fixture" })
    .waitFor({ state: "attached" });
  await page.locator('[data-review-id="document-viewer"]').hover();
  await page.mouse.wheel(0, 420);
  await page.waitForFunction(
    () =>
      document.querySelector('[data-review-id="document-viewer"]').scrollTop >
      0,
  );
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await page.evaluate(() => {
    const row = document.querySelector('[data-review-id="tree-file"].active');
    for (let node = row.parentElement; node; node = node.parentElement) {
      if (
        node.scrollHeight > node.clientHeight &&
        /auto|scroll/.test(getComputedStyle(node).overflowY)
      )
        node.scrollTop = 0;
    }
  });
  const before = await page.evaluate(() => {
    const row = document
      .querySelector('[data-review-id="tree-file"].active')
      .getBoundingClientRect();
    const scroller = document
      .querySelector('[data-review-id="tree-file"].active')
      .closest(".sidebar-tab-panel");
    const viewportBottom =
      scroller.getBoundingClientRect().top +
      scroller.clientTop +
      scroller.clientHeight;
    return {
      scroll: document.querySelector('[data-review-id="document-viewer"]')
        .scrollTop,
      offscreen: row.top >= viewportBottom,
    };
  });
  await page.getByRole("button", { name: revealLabel, exact: true }).focus();
  await page.keyboard.press("Enter");
  checks.keyboardFocus = await focused(markdown);
  checks.offscreenBefore = before.offscreen;
  checks.readingPositionPreserved = await page.evaluate(
    (scroll) =>
      scroll > 0 &&
      Math.abs(
        document.querySelector('[data-review-id="document-viewer"]').scrollTop -
          scroll,
      ) <= 1,
    before.scroll,
  );
  checks.offscreenRevealed = await page.evaluate(() => {
    const element = document.querySelector(
      '[data-review-id="tree-file"].active',
    );
    const row = element.getBoundingClientRect();
    const scroller = element.closest(".sidebar-tab-panel");
    const top = scroller.getBoundingClientRect().top + scroller.clientTop;
    return row.top >= top - 1 && row.bottom <= top + scroller.clientHeight + 1;
  });
  const layouts = [];
  for (const theme of ["light", "dark"]) {
    if (!(await page.locator(`.app-shell.theme-${theme}`).count()))
      await dispatch("theme.toggle");
    for (const width of [220, 260, 520]) {
      await page.evaluate(
        (value) =>
          document
            .querySelector('[data-review-id="shell"]')
            .style.setProperty("--left-sidebar-width", `${value}px`),
        width,
      );
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      await dispatch("fileTree.revealCurrent");
      await focused(markdown);
      const activeStyle = await page
        .locator(`${markdown}.active`)
        .evaluate((row) => {
          const style = getComputedStyle(row);
          return { background: style.backgroundColor, shadow: style.boxShadow };
        });
      await page
        .locator('[data-review-id="tree-file"]:not(.active)')
        .last()
        .hover();
      const styleChecks = await page.evaluate((active) => {
        const hovered = document.querySelector(
          '[data-review-id="tree-file"]:not(.active):hover',
        );
        const hoveredStyle = hovered ? getComputedStyle(hovered) : null;
        return {
          activeDistinctFromHover:
            !!hoveredStyle &&
            active.background !== hoveredStyle.backgroundColor &&
            active.shadow !== hoveredStyle.boxShadow,
          activeHasTwoPixelBar:
            /(?:^|\s)2px 0px 0px 0px(?:\s|$)/.test(active.shadow) &&
            active.shadow.includes("inset"),
        };
      }, activeStyle);
      await page.locator('[data-review-id="document-viewer"]').hover();
      await page.locator('[data-review-id="document-viewer"]').focus();
      styleChecks.activePersistsWithoutTreeFocus = await page
        .locator(markdown)
        .evaluate((row, active) => {
          const style = getComputedStyle(row);
          return (
            document.activeElement?.matches(
              '[data-review-id="document-viewer"]',
            ) &&
            row.classList.contains("active") &&
            row.querySelector('button[aria-current="page"]') !== null &&
            style.backgroundColor === active.background &&
            style.boxShadow === active.shadow
          );
        }, activeStyle);
      layouts.push(
        await page.evaluate(
          ({ width, dark, styleChecks }) => {
            const rect = (selector) =>
              document.querySelector(selector)?.getBoundingClientRect();
            const sidebar = rect('[data-review-id="left-sidebar"]');
            const toolbar = rect('[data-review-id="file-toolbar"]');
            const row = rect('[data-review-id="tree-file"].active');
            const label = rect(
              '[data-review-id="tree-file"].active .tree-label',
            );
            const badge = rect(
              '[data-review-id="tree-file"].active [data-review-id="git-status-diff-button"]',
            );
            const buttons = [
              ...document.querySelectorAll(
                '[data-review-id="file-toolbar"] button',
              ),
            ]
              .filter((button) => button.getBoundingClientRect().width > 0)
              .map((button) => button.getBoundingClientRect());
            return {
              width,
              dark,
              ...styleChecks,
              sidebarWidth: sidebar.width,
              toolbarContained: buttons.every(
                (b) =>
                  b.left >= toolbar.left - 1 && b.right <= toolbar.right + 1,
              ),
              toolbarNoOverlap: buttons.every((b, i) =>
                buttons
                  .slice(i + 1)
                  .every(
                    (other) =>
                      b.right <= other.left + 1 || other.right <= b.left + 1,
                  ),
              ),
              badgePresent: !!badge,
              longLabelContained:
                !!label &&
                !!badge &&
                label.right <= badge.left + 1 &&
                badge.right <= row.right + 1 &&
                label.left >= row.left,
            };
          },
          { width, dark: theme === "dark", styleChecks },
        ),
      );
    }
  }
  await dispatch("preferences.open");
  await page.locator('[data-review-id="preferences-page"]').waitFor();
  checks.preferencesDisabled = !(await enabled());
  await dispatch("preferences.close");
  await page
    .locator('[data-review-id="preferences-page"]')
    .waitFor({ state: "detached" });
  await page
    .locator(`${markdown} [data-review-id="git-status-diff-button"]`)
    .click();
  await page.locator('[data-review-id="git-diff-preview-panel"]').waitFor();
  checks.diffDisabled = !(await enabled());
  await page.locator('[data-review-id="git-diff-preview-close"]').click();
  await page
    .locator('[data-review-id="git-diff-preview-panel"]')
    .waitFor({ state: "detached" });
  await page.evaluate(() => {
    window.__SVARD_PICK_DOCUMENT__ = "/outside/reveal-outside.md";
    window.__SVARD_DOCUMENT_OVERRIDES__["/outside/reveal-outside.md"] = {
      source: "# Outside reveal fixture\n",
    };
  });
  await dispatch("file.open");
  await page
    .locator('[data-review-id="document-body"] h1')
    .filter({ hasText: "Outside reveal fixture" })
    .waitFor({ state: "attached" });
  checks.outsideWorkspaceDisabled = !(await enabled());
  await dispatch("tab.closeAll");
  checks.noDocumentDisabled = !(await enabled());
  await page.locator(markdown).locator(".tree-row-main").click();
  await dispatch("fileTree.revealCurrent");
  await focused(markdown);
  await page.evaluate(() => {
    window.__SVARD_DIRECTORY_ENTRIES__["/workspace/docs"] =
      window.__SVARD_DIRECTORY_ENTRIES__["/workspace/docs"].filter((entry) =>
        [
          "git-modified.md",
          "copy-actions.adoc",
          "preferences.adoc",
          "git-clean.md",
        ].some((name) => entry.path.endsWith(`/${name}`)),
      );
  });
  await page.evaluate(() => {
    const entry = window.__SVARD_DIRECTORY_ENTRIES__["/workspace/docs"].find(
      (candidate) => candidate.path.endsWith("/git-modified.md"),
    );
    entry.name = "git-modified.md";
  });
  await page.locator('[data-review-id="tree-refresh"]').click();
  await page.waitForFunction(
    () =>
      !document.querySelector('[data-path="/workspace/docs/a-filler-0.md"]'),
  );
  if (!(await page.locator(".app-shell.theme-light").count()))
    await dispatch("theme.toggle");
  await page.evaluate(() =>
    document
      .querySelector('[data-review-id="shell"]')
      .style.setProperty("--left-sidebar-width", "260px"),
  );
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await dispatch("fileTree.revealCurrent");
  await focused(markdown);
  await page.locator('[data-review-id="document-viewer"]').focus();
  await page.evaluate(
    (result) => {
      window.__SVARD_FILE_TREE_REVEAL_CURRENT_CHECK__ = result;
    },
    { checks, layouts },
  );
}
