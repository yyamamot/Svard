export async function applyDocumentPositionScenario({ scenario, page }) {
  if (scenario !== "viewer-document-switch-scroll-restore") return false;
  const names = [
    "position-a.md",
    "position-b.md",
    "position-c.adoc",
    "position-d.adoc",
  ];
  await page.evaluate((files) => {
    window.__SVARD_DOCUMENT_OVERRIDES__ = Object.fromEntries(
      files.map((name, index) => {
        const adoc = name.endsWith(".adoc");
        const title = `Position document ${index + 1}`;
        const source =
          `${adoc ? "=" : "#"} ${title}\n\n${adoc ? "==" : "##"} Reading section\n\n` +
          Array.from(
            { length: 100 },
            (_, n) =>
              `Paragraph ${n + 1}. Reading position stays inside this long section.\n\n`,
          ).join("");
        return [
          `/workspace/docs/${name}`,
          { source, updatedAt: "2026-09-11T00:00:00Z" },
        ];
      }),
    );
    window.__SVARD_POSITION_COUNTS__ = { render: 0, commit: 0, diagrams: 0 };
    localStorage.setItem("SVARD_PERF_TRACE", "1");
    const info = console.info.bind(console);
    console.info = (...args) => {
      const event = args[1]?.event;
      const counts = window.__SVARD_POSITION_COUNTS__;
      if (event === "render.effect.start") counts.render += 1;
      if (event === "render.articleInnerHtmlCommit") counts.commit += 1;
      if (event === "render.applyInlineDiagramsToHtml") counts.diagrams += 1;
      info(...args);
    };
  }, names);

  const waitForDocument = async (name) => {
    await page.waitForFunction((name) => {
      const article = document.querySelector(
        '[data-review-id="document-body"]',
      );
      return (
        article?.dataset.renderedDocumentPath === `/workspace/docs/${name}` &&
        article.dataset.layoutState === "ready"
      );
    }, name);
  };
  const open = async (name) => {
    await page.evaluate(async (name) => {
      window.__SVARD_PICK_DOCUMENT__ = `/workspace/docs/${name}`;
      await window.__SVARD_COMMANDS__.dispatch("file.open");
    }, name);
    await waitForDocument(name);
  };
  const tab = async (name) => {
    await page
      .locator('[data-review-id="open-file-item"]')
      .filter({ hasText: name })
      .click();
    await waitForDocument(name);
  };
  const setPosition = async (top, pane = "left") =>
    page.evaluate(
      ({ top, pane }) => {
        const viewer = document.querySelector(
          `.viewer-pane[data-pane-id="${pane}"]`,
        );
        viewer.dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
        viewer.scrollTop = top;
        return viewer.scrollTop;
      },
      { top, pane },
    );
  const assertPosition = async (top, pane = "left") => {
    await page.waitForFunction(
      ({ top, pane }) => {
        const viewer = document.querySelector(
          `.viewer-pane[data-pane-id="${pane}"]`,
        );
        return viewer && Math.abs(viewer.scrollTop - top) <= 2;
      },
      { top, pane },
    );
    return page.evaluate(
      ({ top, pane }) =>
        Math.abs(
          document.querySelector(`.viewer-pane[data-pane-id="${pane}"]`)
            .scrollTop - top,
        ),
      { top, pane },
    );
  };

  const errors = [];
  await open(names[0]);
  errors.push(await assertPosition(0));
  const a = await setPosition(1377);
  await open(names[1]);
  errors.push(await assertPosition(0));
  const b = await setPosition(997);
  await tab(names[0]);
  errors.push(await assertPosition(a));
  await tab(names[1]);
  errors.push(await assertPosition(b));
  await open(names[2]);
  const c = await setPosition(1219);
  await open(names[3]);
  await setPosition(1299);
  await tab(names[2]);
  errors.push(await assertPosition(c));
  await tab(names[0]);
  errors.push(await assertPosition(a));

  // Opening through the file picker uses the IO path rather than cached tabs.
  await open(names[1]);
  errors.push(await assertPosition(b));
  await open(names[0]);
  errors.push(await assertPosition(a));
  // A completed image above the saved anchor changes geometry after commit.
  const imageShift = await page.evaluate(() => {
    const article = document.querySelector('[data-review-id="document-body"]');
    const viewer = article.closest(".viewer-pane");
    const anchor = article.querySelector("p");
    const before = anchor.getBoundingClientRect().top + viewer.scrollTop;
    const image = document.createElement("img");
    image.dataset.positionFixture = "true";
    image.style.cssText =
      "display:block;width:1px;height:180px;margin:0;padding:0;border:0";
    image.alt = "";
    article.prepend(image);
    const shift =
      anchor.getBoundingClientRect().top + viewer.scrollTop - before;
    image.dispatchEvent(new Event("load"));
    return shift;
  });
  errors.push(await assertPosition(a + imageShift));
  await page
    .locator("[data-position-fixture]")
    .evaluate((node) => node.remove());
  errors.push(await assertPosition(a));
  const before = await page.evaluate(() => ({
    ...window.__SVARD_POSITION_COUNTS__,
  }));
  const manual = await setPosition(823);
  await page.waitForTimeout(2150);
  errors.push(await assertPosition(manual));
  const after = await page.evaluate(() => ({
    ...window.__SVARD_POSITION_COUNTS__,
  }));

  await page.locator('[data-review-id="split-view-toggle"]').click();
  await page.locator('.viewer-pane[data-pane-id="right"]').waitFor();
  await setPosition(1800, "right");
  await page
    .locator('.viewer-pane[data-pane-id="left"]')
    .click({ position: { x: 12, y: 40 } });
  await setPosition(700, "left");
  await page
    .locator('.viewer-pane[data-pane-id="right"]')
    .click({ position: { x: 12, y: 40 } });
  errors.push(await assertPosition(1800, "right"));
  errors.push(await assertPosition(700, "left"));

  // Closing the focused right pane keeps the left pane's reading position.
  const leftAnchor = await page.evaluate(() => {
    const viewer = document.querySelector('.viewer-pane[data-pane-id="left"]');
    const top = viewer.getBoundingClientRect().top;
    const node = [...viewer.querySelectorAll("[data-source-reference]")].sort(
      (a, b) =>
        Math.abs(a.getBoundingClientRect().top - top) -
        Math.abs(b.getBoundingClientRect().top - top),
    )[0];
    return {
      id: node.dataset.sourceReference,
      offset: node.getBoundingClientRect().top - top,
    };
  });
  await page.locator('[data-review-id="split-view-toggle"]').click();
  await page
    .locator('.viewer-pane[data-pane-id="right"]')
    .waitFor({ state: "detached" });
  await page.waitForFunction(({ id, offset }) => {
    const viewer = document.querySelector('.viewer-pane[data-pane-id="left"]');
    const node = [...viewer.querySelectorAll("[data-source-reference]")].find(
      (node) => node.dataset.sourceReference === id,
    );
    return (
      Math.abs(
        node.getBoundingClientRect().top -
          viewer.getBoundingClientRect().top -
          offset,
      ) <= 2
    );
  }, leftAnchor);
  const remaining = await page
    .locator('.viewer-pane[data-pane-id="left"]')
    .evaluate((node) => node.scrollTop);
  errors.push(await assertPosition(remaining));
  await tab(names[1]);
  errors.push(await assertPosition(b));
  await page
    .locator('[data-review-id="open-file-item"]')
    .filter({ hasText: names[1] })
    .locator('[data-review-id="open-file-close"]')
    .click();
  await open(names[1]);
  errors.push(await assertPosition(0));
  await tab(names[0]);
  errors.push(await assertPosition(remaining));
  await page.locator('[data-review-id="split-view-toggle"]').click();
  await page.locator('.viewer-pane[data-pane-id="right"]').waitFor();
  await setPosition(1800, "right");

  await page.evaluate(
    ({ errors, before, after }) => {
      window.__SVARD_DOCUMENT_POSITION_CHECK__ = {
        maxError: Math.max(...errors),
        samples: errors.length,
        idleRenderDelta: after.render - before.render,
        idleCommitDelta: after.commit - before.commit,
        idleDiagramDelta: after.diagrams - before.diagrams,
      };
      console.info(
        "[ui-review] document-position metrics",
        JSON.stringify(window.__SVARD_DOCUMENT_POSITION_CHECK__),
      );
    },
    { errors, before, after },
  );
  return true;
}
