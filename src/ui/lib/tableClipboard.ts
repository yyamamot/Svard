function normalizeCellText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function cellText(cell: HTMLTableCellElement): string {
  const clone = cell.cloneNode(true) as HTMLTableCellElement;
  clone.querySelectorAll("br").forEach((breakElement) => {
    breakElement.replaceWith(" ");
  });
  return normalizeCellText(clone.textContent ?? "");
}

export function tableToMatrix(table: HTMLTableElement): string[][] {
  const matrix: string[][] = [];
  const rows = Array.from(table.rows);

  rows.forEach((row, rowIndex) => {
    matrix[rowIndex] ??= [];
    let columnIndex = 0;

    for (const cell of Array.from(row.cells)) {
      while (matrix[rowIndex][columnIndex] !== undefined) {
        columnIndex += 1;
      }

      const text = cellText(cell);
      const rowSpan = Math.max(1, cell.rowSpan || 1);
      const colSpan = Math.max(1, cell.colSpan || 1);

      for (let rowOffset = 0; rowOffset < rowSpan; rowOffset += 1) {
        const targetRow = rowIndex + rowOffset;
        matrix[targetRow] ??= [];
        for (let colOffset = 0; colOffset < colSpan; colOffset += 1) {
          matrix[targetRow][columnIndex + colOffset] =
            rowOffset === 0 && colOffset === 0 ? text : "";
        }
      }

      columnIndex += colSpan;
    }
  });

  const width = Math.max(0, ...matrix.map((row) => row.length));
  return matrix.map((row) =>
    Array.from({ length: width }, (_, index) => row[index] ?? ""),
  );
}

export function tableToTsv(table: HTMLTableElement): string {
  return tableToMatrix(table)
    .map((row) => row.join("\t"))
    .join("\n");
}

function csvCell(value: string): string {
  if (!/[",\n\r]/.test(value)) {
    return value;
  }
  return `"${value.replaceAll('"', '""')}"`;
}

export function tableToCsv(table: HTMLTableElement): string {
  return tableToMatrix(table)
    .map((row) => row.map(csvCell).join(","))
    .join("\n");
}

function markdownCell(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("|", "\\|");
}

export function tableToMarkdown(table: HTMLTableElement): string {
  const matrix = tableToMatrix(table);
  if (matrix.length === 0) {
    return "";
  }

  const header = matrix[0];
  const separator = header.map(() => "---");
  const body = matrix.slice(1);
  return [header, separator, ...body]
    .map((row) => `| ${row.map(markdownCell).join(" | ")} |`)
    .join("\n");
}
