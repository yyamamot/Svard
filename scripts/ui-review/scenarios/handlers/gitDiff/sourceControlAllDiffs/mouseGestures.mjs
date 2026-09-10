export async function exerciseAllDiffsMouseGestures(page) {
  await page.keyboard.press("Escape");
  await page.locator('button[aria-label="Close all diffs"]').click();
  await page
    .locator('[data-review-id="source-control-all-diffs-panel"]')
    .waitFor({ state: "detached" });
  await page.evaluate(async () => {
    await window.__SVARD_COMMANDS__?.dispatch("preferences.open");
  });
  await page.locator('[data-review-id="preferences-page"]').waitFor();
  await page
    .locator('[data-review-id="preferences-nav"] button')
    .filter({ hasText: "Mouse Gestures" })
    .click();
  await page.locator('[data-review-id="mouse-gestures-enabled"] input').check();
  await page
    .locator('[data-review-id="preferences-dialog"] button:has-text("Close")')
    .click();
  await page.waitForTimeout(750);
  await page.locator('[data-review-id="source-control-all-diffs"]').click();
  await page
    .locator('[data-review-id="source-control-all-diffs-panel"]')
    .waitFor();
  await page
    .locator('[data-review-id="diff-stream-rendered-block"]')
    .first()
    .waitFor();
  await page
    .locator('.diff-stream-rendered-body [data-active-change="true"]')
    .first()
    .waitFor();

  const streamSelector = ".diff-stream-body";
  const gestureSelector =
    '[data-review-id="diff-stream-file-section"][data-stream-index="0"] [data-review-id="diff-stream-right-pane"]';
  let lastGesturePoint = null;
  async function performStreamGesture(directions) {
    const box = await page.locator(gestureSelector).boundingBox();
    if (!box) {
      throw new Error("All diffs gesture pane is not visible");
    }
    let x = box.x + Math.min(180, box.width / 2);
    let y = box.y + 18;
    lastGesturePoint = { x, y };
    const pane = page.locator(gestureSelector);
    const mouse = {
      bubbles: true,
      button: 2,
      buttons: 2,
      cancelable: true,
      clientX: x,
      clientY: y,
    };
    await pane.dispatchEvent("mousedown", mouse);
    for (const direction of directions) {
      if (direction === "Left") {
        x -= 90;
      } else if (direction === "Right") {
        x += 90;
      } else if (direction === "Up") {
        y -= 90;
      } else if (direction === "Down") {
        y += 90;
      }
      await pane.dispatchEvent("mousemove", {
        ...mouse,
        clientX: x,
        clientY: y,
      });
    }
    await pane.dispatchEvent("mouseup", {
      ...mouse,
      buttons: 0,
      clientX: x,
      clientY: y,
    });
  }
  await page.waitForFunction(
    () =>
      document
        .querySelector('.diff-stream-rendered-body [data-active-change="true"]')
        ?.getAttribute("data-change-index") === "0",
  );
  await performStreamGesture(["Right"]);
  await page
    .waitForFunction(
      () =>
        document
          .querySelector(
            '.diff-stream-rendered-body [data-active-change="true"]',
          )
          ?.getAttribute("data-change-index") === "1",
      undefined,
      { timeout: 5000 },
    )
    .catch(async () => {
      const debug = await page.evaluate((point) => {
        const hit =
          point && typeof point.x === "number" && typeof point.y === "number"
            ? document.elementFromPoint(point.x, point.y)
            : null;
        return {
          activeChangeIndex:
            document
              .querySelector(
                '.diff-stream-rendered-body [data-active-change="true"]',
              )
              ?.getAttribute("data-change-index") ?? "",
          hitClass: hit instanceof HTMLElement ? hit.className : "",
          hitReviewId:
            hit instanceof HTMLElement
              ? (hit
                  .closest("[data-review-id]")
                  ?.getAttribute("data-review-id") ?? "")
              : "",
          mouseGesturesEnabled:
            document
              .querySelector(
                '[data-review-id="source-control-all-diffs-panel"]',
              )
              ?.getAttribute("data-mouse-gestures-enabled") ?? "",
          lastGesture: window.__SVARD_COMMANDS__?.getLastMouseGesture(),
        };
      }, lastGesturePoint);
      throw new Error(
        `All diffs Right gesture did not advance: ${JSON.stringify(debug)}`,
      );
    });
  const afterRight = await page.evaluate(() => ({
    activeChangeIndex:
      document
        .querySelector('.diff-stream-rendered-body [data-active-change="true"]')
        ?.getAttribute("data-change-index") ?? "",
    lastGesture: window.__SVARD_COMMANDS__?.getLastMouseGesture(),
  }));

  await performStreamGesture(["Left"]);
  await page.waitForFunction(
    () =>
      document
        .querySelector('.diff-stream-rendered-body [data-active-change="true"]')
        ?.getAttribute("data-change-index") === "0",
  );
  const afterLeft = await page.evaluate(() => ({
    activeChangeIndex:
      document
        .querySelector('.diff-stream-rendered-body [data-active-change="true"]')
        ?.getAttribute("data-change-index") ?? "",
    lastGesture: window.__SVARD_COMMANDS__?.getLastMouseGesture(),
  }));

  await performStreamGesture(["Down"]);
  await page.waitForFunction((selector) => {
    const stream = document.querySelector(selector);
    return stream instanceof HTMLElement && stream.scrollTop > 0;
  }, streamSelector);
  const afterDown = await page.evaluate((selector) => {
    const stream = document.querySelector(selector);
    return {
      scrollTop: stream instanceof HTMLElement ? stream.scrollTop : 0,
      lastGesture: window.__SVARD_COMMANDS__?.getLastMouseGesture(),
    };
  }, streamSelector);

  await performStreamGesture(["Up"]);
  await page.waitForFunction((selector) => {
    const stream = document.querySelector(selector);
    return stream instanceof HTMLElement && stream.scrollTop === 0;
  }, streamSelector);
  const afterUp = await page.evaluate((selector) => {
    const stream = document.querySelector(selector);
    return {
      scrollTop: stream instanceof HTMLElement ? stream.scrollTop : -1,
      lastGesture: window.__SVARD_COMMANDS__?.getLastMouseGesture(),
    };
  }, streamSelector);

  await performStreamGesture(["Down", "Right"]);
  await page
    .locator('[data-review-id="source-control-all-diffs-panel"]')
    .waitFor({ state: "detached" });
  const afterClose = await page.evaluate(() => ({
    panelCount: document.querySelectorAll(
      '[data-review-id="source-control-all-diffs-panel"]',
    ).length,
    lastGesture: window.__SVARD_COMMANDS__?.getLastMouseGesture(),
  }));

  await page.evaluate(
    ({ afterRight, afterLeft, afterDown, afterUp, afterClose }) => {
      window.__SVARD_ALL_DIFFS_MOUSE_GESTURE_SAMPLE__ = {
        afterRight,
        afterLeft,
        afterDown,
        afterUp,
        afterClose,
      };
    },
    { afterRight, afterLeft, afterDown, afterUp, afterClose },
  );
}
