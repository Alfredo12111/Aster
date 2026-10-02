import ExcelJS from "exceljs";
import {
  datasetSchema,
  MAX_CELLS,
  MAX_COLS,
  MAX_ROWS,
  type Dataset,
} from "./chart-model";
import { evaluateWorkbook, parseDelimited } from "./chart-data";
export function checkXlsxArchive(bytes: Uint8Array) {
  if (bytes.byteLength > 10_000_000)
    throw new Error("Workbook imports are limited to 10 MB.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  if (end < 0) throw new Error("This is not a valid XLSX workbook.");
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true))
    throw new Error("Split archives are unsupported.");
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true),
    total = 0;
  if (count > 5000 || offset >= bytes.length)
    throw new Error("This workbook archive is too large.");
  for (let i = 0; i < count; i++) {
    if (
      offset + 46 > bytes.length ||
      view.getUint32(offset, true) !== 0x02014b50
    )
      throw new Error("Invalid workbook archive directory.");
    total += view.getUint32(offset + 24, true);
    if (total > 50_000_000)
      throw new Error("Expanded workbook data must be 50 MB or smaller.");
    offset +=
      46 +
      view.getUint16(offset + 28, true) +
      view.getUint16(offset + 30, true) +
      view.getUint16(offset + 32, true);
  }
}
export async function importWorkbook(
  name: string,
  bytes: Uint8Array,
): Promise<Dataset> {
  if (bytes.length > 10_000_000)
    throw new Error("Imports are limited to 10 MB.");
  const result: Dataset = {
    id: crypto.randomUUID(),
    name: name.replace(/\.[^.]+$/, "").slice(0, 160) || "Imported data",
    sheets: [],
    updatedAt: Date.now(),
  };
  if (/\.(csv|tsv)$/i.test(name)) {
    result.sheets = [
      {
        name: "Sheet1",
        rows: parseDelimited(
          new TextDecoder("utf-8", { fatal: true }).decode(bytes),
          /\.tsv$/i.test(name) ? "\t" : ",",
        ),
      },
    ];
  } else if (/\.xlsx$/i.test(name)) {
    checkXlsxArchive(bytes);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes as any);
    if (workbook.worksheets.length > 20)
      throw new Error("A workbook supports at most 20 sheets.");
    let cells = 0;
    for (const sheet of workbook.worksheets) {
      if (sheet.rowCount > MAX_ROWS || sheet.columnCount > MAX_COLS)
        throw new Error("Worksheets support 10,000 rows and 100 columns.");
      cells += sheet.rowCount * sheet.columnCount;
      if (cells > MAX_CELLS)
        throw new Error("A workbook supports 100,000 cells.");
      const rows: string[][] = [];
      for (let r = 1; r <= sheet.rowCount; r++) {
        const row: string[] = [];
        for (let c = 1; c <= sheet.columnCount; c++) {
          const cell = sheet.getCell(r, c),
            value = cell.value;
          row.push(
            cell.formula
              ? "=" + cell.formula
              : value instanceof Date
                ? value.toISOString().slice(0, 10)
                : value === null
                  ? ""
                  : typeof value === "object" && "error" in value
                    ? value.error
                    : cell.text,
          );
        }
        rows.push(row);
      }
      result.sheets.push({ name: sheet.name, rows });
    }
    if (!result.sheets.length) result.sheets = [{ name: "Sheet1", rows: [] }];
  } else throw new Error("Choose a UTF-8 CSV/TSV file or an XLSX workbook.");
  return datasetSchema.parse(result);
}
export async function exportWorkbook(dataset: Dataset): Promise<Uint8Array> {
  const evaluated = evaluateWorkbook(dataset),
    book = new ExcelJS.Workbook();
  const names = new Set<string>();
  for (const sheet of evaluated.sheets) {
    const base =
      sheet.name
        .replace(/[\\/*?:\[\]]/g, "_")
        .replace(/^'+|'+$/g, "")
        .slice(0, 31) || "Sheet";
    let name = base,
      index = 2;
    while (names.has(name.toLowerCase())) {
      const suffix = " (" + index++ + ")";
      name = base.slice(0, 31 - suffix.length) + suffix;
    }
    names.add(name.toLowerCase());
    const target = book.addWorksheet(name);
    sheet.rows.forEach((row) => target.addRow(row));
    target.getRow(1).font = { bold: true };
    target.views = [{ state: "frozen", ySplit: 1 }];
  }
  return new Uint8Array((await book.xlsx.writeBuffer()) as ArrayBuffer);
}
