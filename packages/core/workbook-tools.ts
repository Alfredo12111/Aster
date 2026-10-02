import {
  MAX_COLS,
  MAX_ROWS,
  datasetSchema,
  type Dataset,
  type CellValue,
} from "./chart-model";
import { columnName } from "./chart-data";
type Ref = {
  sheet?: string;
  column: number;
  row: number;
  absoluteColumn: boolean;
  absoluteRow: boolean;
};
const cell = "\\$?[A-Za-z]{1,3}\\$?[1-9]\\d*";
const token = new RegExp(
  "\"(?:[^\"\\n]|\"\")*\"|(?<![A-Za-z0-9_.])(?:(?:'((?:[^']|'')+)'|([A-Za-z_][A-Za-z0-9_.]*))!)?(" +
    cell +
    ")(?::(" +
    cell +
    "))?(?![A-Za-z0-9_]|\\s*\\()",
  "g",
);
function readRef(address: string, sheet?: string): Ref {
  const m = /^(\$?)([A-Za-z]+)(\$?)(\d+)$/.exec(address)!;
  let column = 0;
  for (const c of m[2].toUpperCase())
    column = column * 26 + c.charCodeAt(0) - 64;
  return {
    sheet,
    column: column - 1,
    row: Number(m[4]) - 1,
    absoluteColumn: !!m[1],
    absoluteRow: !!m[3],
  };
}
const address = (r: Ref) =>
  r.row < 0 || r.column < 0 || r.row >= MAX_ROWS || r.column >= MAX_COLS
    ? "#REF!"
    : (r.absoluteColumn ? "$" : "") +
      columnName(r.column) +
      (r.absoluteRow ? "$" : "") +
      (r.row + 1);
const prefix = (sheet?: string) =>
  sheet === undefined ? "" : "'" + sheet.replaceAll("'", "''") + "'!";
function rewrite(formula: string, fn: (a: Ref, b?: Ref) => string) {
  if (!formula.startsWith("=")) return formula;
  return formula.replace(token, (full, quoted, plain, a, b) =>
    full.startsWith('"')
      ? full
      : fn(
          readRef(a, quoted?.replaceAll("''", "'") ?? plain),
          b ? readRef(b, quoted?.replaceAll("''", "'") ?? plain) : undefined,
        ),
  );
}
export function shiftFormula(formula: string, rows: number, columns: number) {
  return rewrite(formula, (a, b) => {
    const shift = (r: Ref) => ({
      ...r,
      row: r.row + (r.absoluteRow ? 0 : rows),
      column: r.column + (r.absoluteColumn ? 0 : columns),
    });
    return (
      prefix(a.sheet) + address(shift(a)) + (b ? ":" + address(shift(b)) : "")
    );
  });
}
export function renameReferences(formula: string, names: Map<string, string>) {
  if (!formula.startsWith("=")) return formula;
  return formula.replace(
    /"(?:[^"]|"")*"|'((?:[^']|'')+)'!|([A-Za-z_][A-Za-z0-9_.]*)!/g,
    (full, quoted, plain) => {
      if (full.startsWith('"')) return full;
      const name = quoted?.replaceAll("''", "'") ?? plain,
        next = names.get(name.toLowerCase());
      return next === undefined ? full : prefix(next);
    },
  );
}
export function renameSheet(dataset: Dataset, index: number, name: string) {
  name = name.trim();
  if (
    !name ||
    name.length > 31 ||
    /[\\/*?:\[\]]/.test(name) ||
    /^'|'$/.test(name)
  )
    throw new Error(
      "Use a unique worksheet name of 1–31 characters without / \\ [ ] : * ? or surrounding apostrophes.",
    );
  if (
    dataset.sheets.some(
      (s, i) => i !== index && s.name.toLowerCase() === name.toLowerCase(),
    )
  )
    throw new Error("A worksheet already has that name.");
  const next = structuredClone(dataset),
    old = next.sheets[index].name;
  next.sheets[index].name = name;
  const names = new Map([[old.toLowerCase(), name]]);
  for (const s of next.sheets)
    s.rows = s.rows.map((r) => r.map((v) => renameReferences(v, names)));
  return datasetSchema.parse(next);
}
export function changeStructure(
  dataset: Dataset,
  sheetIndex: number,
  axis: "row" | "column",
  at: number,
  remove = false,
) {
  const next = structuredClone(dataset),
    sheet = next.sheets[sheetIndex],
    height = Math.max(2, sheet.rows.length),
    width = Math.max(2, ...sheet.rows.map((r) => r.length));
  const max = axis === "row" ? MAX_ROWS : MAX_COLS,
    size = axis === "row" ? height : width;
  if (at < 0 || at >= size) throw new Error("Choose a cell in the worksheet.");
  if (!remove && size >= max)
    throw new Error("The worksheet size limit has been reached.");
  if (remove && size <= 2)
    throw new Error("Keep at least two rows and two columns.");
  for (const s of next.sheets)
    for (const row of s.rows)
      for (const raw of row)
        if (
          raw.startsWith("=") &&
          /(?:\$?[A-Z]+:\$?[A-Z]+|\$?\d+:\$?\d+)/i.test(
            raw.replace(/"(?:[^"]|"")*"/g, ""),
          )
        )
          throw new Error(
            "Convert whole-row or whole-column formula references to bounded A1 ranges before inserting or deleting cells.",
          );
  sheet.rows = Array.from({ length: height }, (_, r) =>
    Array.from({ length: width }, (_, c) => sheet.rows[r]?.[c] ?? ""),
  );
  if (axis === "row")
    sheet.rows.splice(
      at,
      remove ? 1 : 0,
      ...(remove ? [] : [Array(width).fill("")]),
    );
  else {
    for (const row of sheet.rows)
      row.splice(at, remove ? 1 : 0, ...(remove ? [] : [""]));
    if (sheet.columnFormats) {
      const formats: NonNullable<typeof sheet.columnFormats> = {};
      for (const [key, value] of Object.entries(sheet.columnFormats)) {
        const col = Number(key);
        if (remove && col === at) continue;
        formats[String(col >= at ? col + (remove ? -1 : 1) : col)] = value;
      }
      sheet.columnFormats = formats;
    }
  }
  for (const s of next.sheets)
    s.rows = s.rows.map((row) =>
      row.map((raw) =>
        rewrite(raw, (a, b) => {
          if ((a.sheet ?? s.name).toLowerCase() !== sheet.name.toLowerCase())
            return prefix(a.sheet) + address(a) + (b ? ":" + address(b) : "");
          const key = axis === "row" ? "row" : "column";
          if (remove && !b && a[key] === at) return "#REF!";
          if (remove && b) {
            const lo = Math.min(a[key], b[key]),
              hi = Math.max(a[key], b[key]);
            if (lo === hi && lo === at) return "#REF!";
            const newLo = lo > at ? lo - 1 : lo,
              newHi = hi >= at ? hi - 1 : hi;
            const forward = a[key] <= b[key];
            a[key] = forward ? newLo : newHi;
            b[key] = forward ? newHi : newLo;
          } else {
            if (a[key] >= at) a[key] += remove ? -1 : 1;
            if (b && b[key] >= at) b[key] += remove ? -1 : 1;
          }
          return prefix(a.sheet) + address(a) + (b ? ":" + address(b) : "");
        }),
      ),
    );
  return datasetSchema.parse(next);
}
export function fillRange(
  dataset: Dataset,
  index: number,
  from: { row: number; col: number },
  to: { row: number; col: number },
  direction: "down" | "right",
) {
  const next = structuredClone(dataset),
    rows = next.sheets[index].rows;
  if (from.row < 0 || from.col < 0 || to.row >= MAX_ROWS || to.col >= MAX_COLS)
    throw new Error("Selection exceeds worksheet limits.");
  while (rows.length <= to.row) rows.push([]);
  for (let r = from.row; r <= to.row; r++) {
    while (rows[r].length <= to.col) rows[r].push("");
    for (let c = from.col; c <= to.col; c++) {
      if (direction === "down" && r > from.row)
        rows[r][c] = shiftFormula(
          dataset.sheets[index].rows[from.row]?.[c] ?? "",
          r - from.row,
          0,
        );
      if (direction === "right" && c > from.col)
        rows[r][c] = shiftFormula(
          dataset.sheets[index].rows[r]?.[from.col] ?? "",
          0,
          c - from.col,
        );
    }
  }
  return datasetSchema.parse(next);
}
export function visibleRows(
  rows: CellValue[][],
  height: number,
  filter: string,
  column: number | null,
  operator: string,
  sortColumn: number | null,
  descending: boolean,
) {
  let indexes = Array.from(
    { length: Math.max(0, height - 1) },
    (_, i) => i + 1,
  );
  if (filter)
    indexes = indexes.filter((i) => {
      const values = column === null ? (rows[i] ?? []) : [rows[i]?.[column]];
      return values.some((v) =>
        operator === "contains"
          ? String(v ?? "")
              .toLowerCase()
              .includes(filter.toLowerCase())
          : operator === "equals"
            ? String(v ?? "").toLowerCase() === filter.toLowerCase()
            : typeof v === "number" &&
              Number.isFinite(Number(filter)) &&
              (operator === "gt" ? v > Number(filter) : v < Number(filter)),
      );
    });
  if (sortColumn !== null)
    indexes.sort((a, b) => {
      const x = rows[a]?.[sortColumn],
        y = rows[b]?.[sortColumn];
      if (x == null || x === "") return y == null || y === "" ? a - b : 1;
      if (y == null || y === "") return -1;
      const compare =
        typeof x === "number" && typeof y === "number"
          ? x - y
          : String(x).localeCompare(String(y), undefined, { numeric: true });
      return (descending ? -compare : compare) || a - b;
    });
  return [0, ...indexes];
}
export function formatCell(value: CellValue | undefined, format = "general") {
  if (value == null) return "";
  if (typeof value !== "number" || format === "general" || format === "text")
    return String(value);
  if (format === "date") {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    return Number.isFinite(+date)
      ? date.toISOString().slice(0, 10)
      : String(value);
  }
  return new Intl.NumberFormat(
    undefined,
    format === "percent"
      ? { style: "percent", maximumFractionDigits: 2 }
      : format === "currency"
        ? { style: "currency", currency: "USD" }
        : { maximumFractionDigits: 2 },
  ).format(value);
}
