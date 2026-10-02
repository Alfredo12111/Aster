import FormulaParser from "fast-formula-parser";
import * as formulas from "@formulajs/formulajs";
import {
  MAX_CELLS,
  MAX_COLS,
  MAX_ROWS,
  type CellValue,
  type Dataset,
  type DataTable,
  type ChartDefinition,
} from "./chart-model";
import { executeQuery } from "./query";
import type { Note } from "./types";

export function columnName(index: number): string {
  let s = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26))
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
export function cellAddress(value: string): { row: number; col: number } {
  const m = /^\$?([A-Z]{1,3})\$?([1-9]\d*)$/i.exec(value.trim());
  if (!m) throw new Error("Use an A1 cell address.");
  let col = 0;
  for (const c of m[1].toUpperCase()) col = col * 26 + c.charCodeAt(0) - 64;
  const row = Number(m[2]);
  if (row > MAX_ROWS || col > MAX_COLS)
    throw new Error("Cell address exceeds worksheet limits.");
  return { row: row - 1, col: col - 1 };
}
export function dataRange(text: string, height: number, width: number) {
  if (!text.trim())
    return {
      from: { row: 0, col: 0 },
      to: { row: Math.max(0, height - 1), col: Math.max(0, width - 1) },
    };
  const refs = text.split(":");
  if (refs.length > 2) throw new Error("Use a range such as A1:D20.");
  const from = cellAddress(refs[0]),
    to = cellAddress(refs[1] ?? refs[0]);
  if (from.row > to.row || from.col > to.col)
    throw new Error("The range must run from top-left to bottom-right.");
  return { from, to };
}
export function parseDelimited(text: string, delimiter?: string): string[][] {
  if (text.length > 10_000_000)
    throw new Error("Text imports are limited to 10 MB.");
  text = text.replace(/^\uFEFF/, "");
  delimiter ??= text.split(/\r?\n/, 1)[0].includes("\t") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  const addCell = () => {
    if (cell.length > 4000) throw new Error("A cell exceeds 4,000 characters.");
    row.push(cell);
    cell = "";
    if (row.length > MAX_COLS) throw new Error("A sheet supports 100 columns.");
  };
  const addRow = () => {
    addCell();
    rows.push(row);
    row = [];
    if (rows.length > MAX_ROWS)
      throw new Error("A sheet supports 10,000 rows.");
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && !cell) quoted = true;
    else if (c === delimiter) addCell();
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      addRow();
    } else cell += c;
  }
  if (quoted) throw new Error("Unclosed quote in delimited data.");
  if (cell.length || row.length) addRow();
  if (rows.reduce((n, r) => n + r.length, 0) > MAX_CELLS)
    throw new Error("A workbook supports 100,000 cells.");
  return rows;
}
export function toCsv(rows: CellValue[][]): string {
  return rows
    .map((row) =>
      row
        .map((v) => {
          let s = String(v ?? "");
          if (typeof v === "string" && /^\s*[=+@\-\t\r]/.test(v)) s = "'" + s;
          return /[",\r\n]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s;
        })
        .join(","),
    )
    .join("\r\n");
}
function markdownRow(line: string): string[] {
  const cells: string[] = [];
  let cell = "",
    escaped = false,
    code = false;
  const text = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  for (const ch of text) {
    if (escaped) {
      cell += ch;
      escaped = false;
    } else if (ch === "\\") escaped = true;
    else if (ch.charCodeAt(0) === 96) {
      code = !code;
      cell += ch;
    } else if (ch === "|" && !code) {
      cells.push(cell.trim());
      cell = "";
    } else cell += ch;
  }
  if (escaped) cell += "\\";
  cells.push(cell.trim());
  return cells;
}
export function markdownTables(content: string): string[][][] {
  const lines = content.split(/\r?\n/),
    tables: string[][][] = [];
  let fenced = false;
  for (let i = 0; i < lines.length - 1; i++) {
    if (/^\s*(?:\x60{3,}|~{3,})/.test(lines[i])) {
      fenced = !fenced;
      continue;
    }
    if (fenced || !lines[i].includes("|")) continue;
    const separators = markdownRow(lines[i + 1]);
    if (!separators.length || !separators.every((c) => /^:?-{3,}:?$/.test(c)))
      continue;
    const table = [markdownRow(lines[i])];
    i += 2;
    while (i < lines.length && lines[i].trim() && lines[i].includes("|")) {
      table.push(markdownRow(lines[i++]));
    }
    i--;
    tables.push(table);
  }
  return tables;
}
const blocked = new Set([
  "WEBSERVICE",
  "HYPERLINK",
  "IMAGE",
  "RTD",
  "DDE",
  "CALL",
  "REGISTER.ID",
]);
function flatFunctions(
  value: unknown,
  prefix = "",
  output: Record<string, Function> = {},
  ancestors = new Set<unknown>(),
): Record<string, Function> {
  if (typeof value === "function" && prefix) output[prefix] = value;
  if (ancestors.has(value)) return output;
  const next = new Set(ancestors).add(value);
  if (value && (typeof value === "object" || typeof value === "function"))
    for (const [key, fn] of Object.entries(value))
      if (/^[A-Z][A-Z0-9_]*$/.test(key))
        flatFunctions(fn, prefix ? prefix + "." + key : key, output, next);
  return output;
}
const additions = flatFunctions(formulas);
const isStub = (fn: unknown) =>
  typeof fn === "function" &&
  /^(?:\([^)]*\)\s*=>|function\s*\w*\([^)]*\))\s*\{\s*\}$/.test(
    String(fn).trim(),
  );
export function formulaFunctions(): string[] {
  return [
    ...new Set([
      ...Object.entries(new FormulaParser().functions)
        .filter(([, fn]) => !isStub(fn))
        .map(([name]) => name),
      ...Object.keys(additions),
    ]),
  ]
    .filter((n) => !blocked.has(n))
    .sort();
}
function literal(raw: string): CellValue {
  if (raw.startsWith("'")) return raw.slice(1);
  const value = raw.trim();
  if (!value) return null;
  if (/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) {
    const n = Number(value);
    return Number.isFinite(n) ? n : "#NUM!";
  }
  if (/^(true|false)$/i.test(value)) return value.toLowerCase() === "true";
  return raw;
}
type Ref = { sheet?: string; row: number; col: number };
export function evaluateWorkbook(dataset: Dataset): {
  sheets: { name: string; rows: CellValue[][] }[];
  warnings: string[];
} {
  const cache = new Map<string, any>(),
    active = new Set<string>(),
    parsers: FormulaParser[] = [];
  const sheets = new Map(dataset.sheets.map((s) => [s.name.toLowerCase(), s]));
  let operations = 0;
  const started = Date.now(),
    warnings: string[] = [];
  const error = (code: string) => new FormulaParser.FormulaError(code);
  const get = (ref: Ref, depth: number): any => {
    if (++operations > 500000 || Date.now() - started > 7000)
      throw new Error(
        "Calculation limit reached; reduce the worksheet or formula range.",
      );
    const sheet = sheets.get(
      (ref.sheet ?? dataset.sheets[0].name).toLowerCase(),
    );
    if (
      !sheet ||
      ref.row < 1 ||
      ref.col < 1 ||
      ref.row > MAX_ROWS ||
      ref.col > MAX_COLS
    )
      return error("#REF!");
    const key = sheet.name + "!" + ref.row + ":" + ref.col;
    if (cache.has(key)) return cache.get(key);
    if (active.has(key)) return error("#CYCLE!");
    if (depth > 64) return error("#DEPTH!");
    const raw = sheet.rows[ref.row - 1]?.[ref.col - 1] ?? "";
    if (!raw.startsWith("=")) return literal(raw);
    if (
      /\b(?:WEBSERVICE|HYPERLINK|IMAGE|RTD|DDE|CALL|REGISTER\.ID)\s*\(/i.test(
        raw,
      ) ||
      /\[[^\]]*\]/.test(raw)
    )
      return error("#BLOCKED!");
    active.add(key);
    let result: any;
    try {
      let parser = parsers[depth];
      if (!parser) {
        const base = new FormulaParser(),
          extra: Record<string, Function> = {};
        const unwrap = (arg: any) =>
          arg && typeof arg === "object" && Object.hasOwn(arg, "value")
            ? arg.value
            : arg;
        for (const [name, fn] of Object.entries(additions))
          if (
            !Object.hasOwn(base.functions, name) ||
            isStub(base.functions[name])
          )
            extra[name] = (...args: any[]) => {
              const values = args.map(unwrap),
                invalid = values.flat(Infinity).find((v) => v instanceof Error);
              if (invalid) return invalid;
              const value = fn(...values);
              return value instanceof Error ? error(value.message) : value;
            };
        extra.REPT = (a: unknown, b: unknown) => {
          const value = unwrap(a),
            count = unwrap(b);
          return Number.isInteger(count) &&
            count >= 0 &&
            String(value).length * count <= 100000
            ? String(value).repeat(count)
            : error("#NUM!");
        };
        extra.MUNIT = (a: unknown) => {
          const size = unwrap(a);
          return Number.isInteger(size) && size >= 1 && size <= 100
            ? Array.from({ length: size }, (_, i) =>
                Array.from({ length: size }, (_, j) => +(i === j)),
              )
            : error("#NUM!");
        };
        for (const name of blocked) extra[name] = () => error("#BLOCKED!");
        parser = new FormulaParser({
          functions: extra,
          onCell: (r: Ref) => get(r, depth + 1),
          onRange: (r: any) => {
            const source = sheets.get(
              (r.sheet ?? dataset.sheets[0].name).toLowerCase(),
            );
            if (!source) return [[error("#REF!")]];
            const endRow = Math.min(r.to.row, source.rows.length),
              endCol = Math.min(
                r.to.col,
                Math.max(1, ...source.rows.map((row) => row.length)),
              );
            if (
              (endRow - r.from.row + 1) * (endCol - r.from.col + 1) >
              MAX_CELLS
            )
              return [[error("#NUM!")]];
            return Array.from(
              { length: Math.max(0, endRow - r.from.row + 1) },
              (_, i) =>
                Array.from(
                  { length: Math.max(0, endCol - r.from.col + 1) },
                  (_, j) =>
                    get(
                      {
                        sheet: source.name,
                        row: r.from.row + i,
                        col: r.from.col + j,
                      },
                      depth + 1,
                    ),
                ),
            );
          },
        });
        // Only own, explicitly registered functions are callable.
        Object.setPrototypeOf(parser.functions, null);
        parsers[depth] = parser;
      }
      result = parser.parse(raw.slice(1), {
        sheet: sheet.name,
        row: ref.row,
        col: ref.col,
      });
    } catch (e) {
      if (e instanceof Error && e.message.includes("Calculation limit"))
        throw e;
      result = error("#ERROR!");
    } finally {
      active.delete(key);
    }
    cache.set(key, result);
    return result;
  };
  const output = dataset.sheets.map((sheet) => ({
    name: sheet.name,
    rows: sheet.rows.map((row, r) =>
      row.map((_cell, c) => {
        const v = get({ sheet: sheet.name, row: r + 1, col: c + 1 }, 0);
        if (v instanceof Error) {
          if (warnings.length < 20)
            warnings.push(
              sheet.name + "!" + columnName(c) + (r + 1) + ": " + String(v),
            );
          return String(v);
        }
        if (v instanceof Date) return v.toISOString().slice(0, 10);
        return typeof v === "number"
          ? Number.isFinite(v)
            ? v
            : "#NUM!"
          : typeof v === "boolean" || typeof v === "string"
            ? v
            : v == null
              ? null
              : String(v);
      }),
    ),
  }));
  return { sheets: output, warnings };
}
export function tableFromRows(rows: CellValue[][], range = ""): DataTable {
  if (
    rows.length > MAX_ROWS ||
    rows.reduce((n, r) => n + r.length, 0) > MAX_CELLS ||
    rows.some((r) => r.length > MAX_COLS)
  )
    throw new Error(
      "Chart data exceeds 10,000 rows, 100 columns, or 100,000 cells.",
    );
  const width = Math.max(0, ...rows.map((r) => r.length));
  if (!rows.length || !width) return { columns: [], rows: [], warnings: [] };
  const { from, to } = dataRange(range, rows.length, width);
  if (to.row >= rows.length || to.col >= width)
    throw new Error("The selected range extends beyond the source data.");
  const sliced = rows
    .slice(from.row, to.row + 1)
    .map((row) =>
      Array.from(
        { length: to.col - from.col + 1 },
        (_, i) => row[from.col + i] ?? null,
      ),
    );
  const names = new Set<string>();
  const columns = sliced[0].map((v, i) => {
    const base = String(v ?? "").trim() || columnName(i + from.col);
    let name = base,
      n = 2;
    while (names.has(name)) name = base + " (" + n++ + ")";
    names.add(name);
    return name;
  });
  return { columns, rows: sliced.slice(1), warnings: [] };
}
export function resolveChartSource(
  chart: ChartDefinition,
  datasets: Dataset[],
  notes: Note[],
): DataTable {
  const source = chart.source;
  if (source.kind === "query") {
    const result = executeQuery(notes, source.query),
      table = tableFromRows(
        [
          result.columns,
          ...result.rows.map((r) =>
            r.values.map((v) =>
              typeof v === "object" && v !== null
                ? JSON.stringify(v)
                : (v as CellValue),
            ),
          ),
        ],
        chart.range,
      );
    if (result.total > result.rows.length)
      table.warnings.push(
        "Query shows " +
          result.rows.length +
          " of " +
          result.total +
          " matching notes. Adjust LIMIT to include more.",
      );
    return table;
  }
  if (source.kind === "markdown") {
    const note = notes.find((n) => n.id === source.noteId);
    if (!note) throw new Error("The source note is missing.");
    const rows = markdownTables(note.content)[source.table];
    if (!rows) throw new Error("The source Markdown table is missing.");
    return tableFromRows(
      rows.map((r) => r.map(literal)),
      chart.range,
    );
  }
  const dataset = datasets.find((d) => d.id === source.datasetId);
  if (!dataset) throw new Error("The source workbook is missing.");
  const calculated = evaluateWorkbook(dataset),
    sheet = calculated.sheets.find((s) => s.name === source.sheet);
  if (!sheet) throw new Error("The source worksheet is missing.");
  const table = tableFromRows(sheet.rows, chart.range);
  table.warnings.push(...calculated.warnings);
  return table;
}
