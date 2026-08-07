export async function hasExpectedMatrixLayout(root, expectedColumnCounts) {
  return root.evaluate((container, expected) => {
    const matrixBlocks = Array.from(
      container.querySelectorAll('[data-review-id="math-block"]'),
    ).filter((block) => block.querySelector(".mtable"));
    if (matrixBlocks.length !== expected.length) {
      return false;
    }

    return matrixBlocks.every((block, blockIndex) => {
      const blockRect = block.getBoundingClientRect();
      const blockStyle = getComputedStyle(block);
      const matrices = Array.from(block.querySelectorAll(".mtable"));
      const expectedColumns = expected[blockIndex];
      if (
        blockStyle.overflowX !== "auto" ||
        blockStyle.overflowY !== "hidden" ||
        matrices.length !== expectedColumns.length
      ) {
        return false;
      }

      const matrixLayoutIsValid = matrices.every((matrix, matrixIndex) => {
        const columns = Array.from(matrix.children).filter((child) =>
          child.classList.contains("col-align-c"),
        );
        if (columns.length !== expectedColumns[matrixIndex]) {
          return false;
        }

        return columns.every((column) => {
          const rows = Array.from(
            column.querySelectorAll(
              ":scope > .vlist-t > .vlist-r > .vlist > span",
            ),
          ).filter((row) => row.textContent?.replaceAll("\u200b", "").trim());
          if (rows.length !== 2) {
            return false;
          }
          const rowContents = rows.map((row) => row.querySelector(".mord"));
          if (rowContents.some((content) => !content)) {
            return false;
          }
          const [firstRowRect, secondRowRect] = rowContents.map((content) =>
            content.getBoundingClientRect(),
          );
          return (
            secondRowRect.top - firstRowRect.top >= 8 &&
            blockRect.top <= firstRowRect.top + 1 &&
            blockRect.bottom >= secondRowRect.bottom - 1
          );
        });
      });
      const delimiters = Array.from(block.querySelectorAll(".mopen, .mclose"));
      const delimitersAreVisible =
        delimiters.length >= matrices.length * 2 &&
        delimiters.every((delimiter) => {
          const rect = delimiter.getBoundingClientRect();
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            blockRect.top <= rect.top + 1 &&
            blockRect.bottom >= rect.bottom - 1
          );
        });

      return matrixLayoutIsValid && delimitersAreVisible;
    });
  }, expectedColumnCounts);
}
