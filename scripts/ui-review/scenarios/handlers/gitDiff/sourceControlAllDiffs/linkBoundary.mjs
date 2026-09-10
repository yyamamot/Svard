export async function exerciseAllDiffsLinkBoundary(page) {
  let externalRequestCount = 0;
  let mainFrameNavigationCount = 0;
  let popupCount = 0;
  const handleRequest = (request) => {
    try {
      if (new URL(request.url()).hostname === "example.invalid") {
        externalRequestCount += 1;
      }
    } catch {
      // Non-URL browser events do not authorize navigation.
    }
  };
  const handleFrameNavigation = (frame) => {
    if (frame === page.mainFrame()) {
      mainFrameNavigationCount += 1;
    }
  };
  const handlePopup = () => {
    popupCount += 1;
  };
  page.on("request", handleRequest);
  page.on("framenavigated", handleFrameNavigation);
  page.on("popup", handlePopup);
  const setup = await page.evaluate(() => {
    const pane = document.querySelector(
      '[data-review-id="diff-stream-right-pane"]',
    );
    if (!(pane instanceof HTMLElement)) {
      throw new Error("All Diffs rendered pane is unavailable");
    }
    const outside = document.createElement("h2");
    outside.id = "imp-544-fragment";
    document.body.append(outside);
    const fixture = document.createElement("p");
    fixture.dataset.reviewId = "imp-544-link-boundary";
    fixture.innerHTML = [
      '<a data-link-category="external" href="https://example.invalid/imp-544">External</a>',
      '<a data-link-category="mailto" href="mailto:blocked@example.invalid">Mail</a>',
      '<a data-link-category="protocol-relative" href="//example.invalid/imp-544">Protocol relative</a>',
      '<a data-link-category="custom" href="custom:imp-544">Custom</a>',
      '<a data-link-category="fragment" href="#imp-544-fragment">Fragment</a>',
      '<h2 id="imp-544-fragment">Inside fragment</h2>',
    ].join(" ");
    pane.append(fixture);
    outside.scrollIntoView = () => {
      outside.dataset.scrolled = "true";
    };
    const inside = fixture.querySelector("h2");
    if (inside instanceof HTMLElement) {
      inside.scrollIntoView = () => {
        inside.dataset.scrolled = "true";
      };
    }
    return {
      externalOpenCount: window.__SVARD_EXTERNAL_URL_OPEN_COUNT__ ?? 0,
      navigationPath: window.location.pathname,
    };
  });
  const dispatch = (category, init = {}) =>
    page
      .locator(`[data-link-category="${category}"]`)
      .evaluate((link, eventInit) => {
        const event = new MouseEvent(eventInit.type ?? "click", {
          bubbles: true,
          cancelable: true,
          button: eventInit.button ?? 0,
          metaKey: eventInit.metaKey ?? false,
        });
        link.dispatchEvent(event);
        return event.defaultPrevented;
      }, init);
  const externalPrevented = await dispatch("external");
  await page
    .locator('[data-review-id="external-link-confirmation-dialog"]')
    .waitFor();
  await page.getByRole("button", { name: "Cancel" }).click();
  const mailtoPrevented = await dispatch("mailto");
  const protocolRelativePrevented = await dispatch("protocol-relative");
  const customPrevented = await dispatch("custom");
  const modifierPrevented = await dispatch("external", { metaKey: true });
  const middlePrevented = await dispatch("external", {
    type: "auxclick",
    button: 1,
  });
  const fragmentPrevented = await dispatch("fragment");
  page.off("request", handleRequest);
  page.off("framenavigated", handleFrameNavigation);
  page.off("popup", handlePopup);
  const externalOpenCount = await page.evaluate(
    () => window.__SVARD_EXTERNAL_URL_OPEN_COUNT__ ?? 0,
  );
  await page.evaluate(
    ({
      customPrevented,
      externalPrevented,
      fragmentPrevented,
      mailtoPrevented,
      middlePrevented,
      modifierPrevented,
      externalRequestCount,
      externalOpenCount,
      initialExternalOpenCount,
      mainFrameNavigationCount,
      navigationPath,
      popupCount,
      protocolRelativePrevented,
    }) => {
      const fixture = document.querySelector(
        '[data-review-id="imp-544-link-boundary"]',
      );
      const inside = fixture?.querySelector("#imp-544-fragment");
      const outside = Array.from(
        document.querySelectorAll("#imp-544-fragment"),
      ).find((element) => !fixture?.contains(element));
      window.__SVARD_ALL_DIFFS_LINK_BOUNDARY_CHECK__ = {
        blockedPrevented:
          mailtoPrevented && protocolRelativePrevented && customPrevented,
        externalConfirmationCancelled: externalPrevented,
        hostOpenCountUnchanged: externalOpenCount === initialExternalOpenCount,
        fragmentScoped:
          inside?.getAttribute("data-scrolled") === "true" &&
          outside?.getAttribute("data-scrolled") !== "true",
        middlePrevented,
        modifierPrevented,
        navigationUnchanged:
          mainFrameNavigationCount === 0 &&
          window.location.pathname === navigationPath,
        requestCountUnchanged: externalRequestCount === 0,
        popupCountUnchanged: popupCount === 0,
        fragmentPrevented,
      };
      fixture?.remove();
      outside?.remove();
    },
    {
      customPrevented,
      externalPrevented,
      fragmentPrevented,
      mailtoPrevented,
      middlePrevented,
      modifierPrevented,
      externalRequestCount,
      externalOpenCount,
      initialExternalOpenCount: setup.externalOpenCount,
      mainFrameNavigationCount,
      navigationPath: setup.navigationPath,
      popupCount,
      protocolRelativePrevented,
    },
  );
}
