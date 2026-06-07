export async function createDocumentAssertionContext(context) {
  const scenario = context.scenario;
  const page = context.page;
  let documentTextCache = null;
  async function documentText() {
    documentTextCache ??=
      (await page.locator('[data-review-id="document-body"]').textContent()) ??
      "";
    return documentTextCache;
  }
  return {
    ...context,
    documentText,
    asciiDocThemeGeometry: await readAsciiDocThemeGeometry(page, scenario),
    antoraImageFitsReader: await readAntoraImageFitsReader(page, scenario),
  };
}

async function readAsciiDocThemeGeometry(page, scenario) {
  if (
    scenario !== "viewer-asciidoc-standard-theme" &&
    scenario !== "viewer-asciidoc-antora-theme" &&
    scenario !== "viewer-asciidoc-theme-compare"
  ) {
    return null;
  }
  return page
    .locator(".document-body.format-asciidoc")
    .evaluate((body) => {
      const rect = body.getBoundingClientRect();
      const viewer = body.closest(".viewer-shell");
      const viewerRect = viewer?.getBoundingClientRect();
      const paragraph = body.querySelector(".paragraph");
      const paragraphStyle = paragraph
        ? window.getComputedStyle(paragraph)
        : null;
      const heading = body.querySelector("h1, h2, h3");
      const headingLink = body.querySelector("h1 a, h2 a, h3 a");
      const bodyStyle = window.getComputedStyle(body);
      const headingStyle = heading ? window.getComputedStyle(heading) : null;
      const headingLinkStyle = headingLink
        ? window.getComputedStyle(headingLink)
        : null;
      const groupedTable = Array.from(
        body.querySelectorAll("table.tableblock"),
      ).find((table) =>
        table.caption?.textContent?.includes("Grouped Table Caption Example"),
      );
      const groupedTableCell = groupedTable?.querySelector('td[rowspan="3"]');
      const groupedTableHeader = groupedTable?.querySelector("th");
      const groupedTableStyle = groupedTable
        ? window.getComputedStyle(groupedTable)
        : null;
      const groupedTableCellStyle = groupedTableCell
        ? window.getComputedStyle(groupedTableCell)
        : null;
      const groupedTableHeaderStyle = groupedTableHeader
        ? window.getComputedStyle(groupedTableHeader)
        : null;
      const paddingLeft = parseFloat(bodyStyle.paddingLeft) || 0;
      const paddingRight = parseFloat(bodyStyle.paddingRight) || 0;
      const contentWidth = rect.width - paddingLeft - paddingRight;
      const maxReaderWidth = Math.min(viewerRect?.width ?? rect.width, 1000);
      return {
        width: rect.width,
        className: body.className,
        contentWidth,
        viewerWidth: viewerRect?.width ?? rect.width,
        capped: rect.width <= maxReaderWidth + 2,
        centered: viewerRect
          ? viewerRect.width <= 1002
            ? Math.abs(rect.left - viewerRect.left) <= 2
            : Math.abs(
                rect.left -
                  viewerRect.left -
                  (viewerRect.width - rect.width) / 2,
              ) <= 2
          : false,
        fontFamily: bodyStyle.fontFamily,
        headingColor: headingStyle?.color ?? "",
        headingFontFamily: headingStyle?.fontFamily ?? "",
        hasHeadingLink: Boolean(headingLinkStyle),
        headingLinkColor: headingLinkStyle?.color ?? "",
        headingLinkTextDecoration: headingLinkStyle?.textDecorationLine ?? "",
        groupedTableDisplay: groupedTableStyle?.display ?? "",
        groupedTableCellBorderStyle:
          groupedTableCellStyle?.borderTopStyle ?? "",
        groupedTableCellBorderWidth:
          groupedTableCellStyle?.borderTopWidth ?? "",
        groupedTableHeaderBackground:
          groupedTableHeaderStyle?.backgroundColor ?? "",
        groupedTableRowspan: groupedTableCell?.getAttribute("rowspan") ?? "",
        lineHeight: bodyStyle.lineHeight,
        paragraphMarginBottom: paragraphStyle?.marginBottom ?? "",
      };
    })
    .catch(() => null);
}

async function readAntoraImageFitsReader(page, scenario) {
  if (scenario !== "viewer-antora-module-local-assets") {
    return true;
  }
  return page
    .locator('img[src^="data:image/svg+xml"]')
    .first()
    .evaluate((image) => {
      const body = image.closest(".document-body");
      const viewport = image.closest(".viewer-shell");
      if (!body || !viewport) {
        return false;
      }
      const imageRect = image.getBoundingClientRect();
      const bodyRect = body.getBoundingClientRect();
      const viewportRect = viewport.getBoundingClientRect();
      return (
        imageRect.width > 0 &&
        imageRect.width <= bodyRect.width + 1 &&
        bodyRect.right <= viewportRect.right + 1 &&
        imageRect.left >= bodyRect.left - 1 &&
        imageRect.right <= bodyRect.right + 1 &&
        imageRect.right <= viewportRect.right + 1
      );
    })
    .catch(() => false);
}
