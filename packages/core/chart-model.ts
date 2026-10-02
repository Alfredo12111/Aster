import { z } from "zod";
const id = z.string().uuid();
export const chartTypes = [
  "line",
  "slope",
  "bar",
  "column",
  "scatter",
  "bubble",
  "candlestick",
  "ohlc",
  "histogram",
  "boxplot",
  "density",
  "heatmap",
  "calendar",
] as const;
export const MAX_ROWS = 10000,
  MAX_COLS = 100,
  MAX_CELLS = 100000;
export const sheetSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    rows: z.array(z.array(z.string().max(4000)).max(MAX_COLS)).max(MAX_ROWS),
    columnFormats: z
      .record(
        z.string().regex(/^\d{1,2}$/),
        z.enum(["general", "number", "percent", "currency", "date", "text"]),
      )
      .optional(),
  })
  .refine(
    (s) => s.rows.reduce((n, row) => n + row.length, 0) <= MAX_CELLS,
    "A sheet supports up to 100,000 cells",
  );
export const datasetSchema = z
  .object({
    id,
    name: z.string().trim().min(1).max(160),
    sheets: z.array(sheetSchema).min(1).max(20),
    updatedAt: z.number(),
  })
  .refine(
    (d) =>
      new Set(d.sheets.map((s) => s.name.toLowerCase())).size ===
      d.sheets.length,
    "Duplicate sheet names",
  )
  .refine(
    (d) =>
      d.sheets.reduce(
        (n, s) => n + s.rows.reduce((m, r) => m + r.length, 0),
        0,
      ) <= MAX_CELLS,
    "A workbook supports up to 100,000 cells",
  );
export const chartSourceSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("dataset"),
    datasetId: id,
    sheet: z.string().max(80),
  }),
  z.object({ kind: z.literal("query"), query: z.string().min(1).max(5000) }),
  z.object({
    kind: z.literal("markdown"),
    noteId: id,
    table: z.number().int().min(0).max(100),
  }),
]);
export const chartSchema = z
  .object({
    id,
    title: z.string().trim().min(1).max(160),
    type: z.enum(chartTypes),
    source: chartSourceSchema,
    x: z.string().max(160),
    ys: z.array(z.string().max(160)).min(1).max(12),
    group: z.string().max(160).default(""),
    size: z.string().max(160).default(""),
    open: z.string().max(160).default(""),
    high: z.string().max(160).default(""),
    low: z.string().max(160).default(""),
    close: z.string().max(160).default(""),
    volume: z.string().max(160).default(""),
    aggregation: z
      .enum(["none", "sum", "mean", "median", "min", "max", "count"])
      .default("none"),
    sort: z.enum(["source", "ascending", "descending"]).default("source"),
    range: z.string().max(80).default(""),
    colors: z
      .array(z.string().regex(/^#[0-9a-f]{6}$/i))
      .min(1)
      .max(12),
    xTitle: z.string().max(160).default(""),
    yTitle: z.string().max(160).default(""),
    legend: z.boolean().default(true),
    labels: z.boolean().default(false),
    stacked: z.boolean().default(false),
    smooth: z.boolean().default(false),
    logY: z.boolean().default(false),
    zeroBaseline: z.boolean().default(true),
    yMin: z.number().finite().nullable().default(null),
    yMax: z.number().finite().nullable().default(null),
    bins: z.number().int().min(1).max(100).default(12),
    trend: z
      .enum([
        "none",
        "linear",
        "exponential",
        "logarithmic",
        "polynomial",
        "moving-average",
      ])
      .default("none"),
    degree: z.number().int().min(2).max(5).default(2),
    window: z.number().int().min(2).max(100).default(5),
    calendarYear: z
      .number()
      .int()
      .min(1900)
      .max(2200)
      .default(new Date().getFullYear()),
    missing: z.enum(["gap", "zero"]).default("gap"),
  })
  .refine(
    (c) => c.yMin === null || c.yMax === null || c.yMin < c.yMax,
    "Y minimum must be less than maximum",
  );
export type ChartDefinition = z.infer<typeof chartSchema>;
export type Dataset = z.infer<typeof datasetSchema>;
export type DataSheet = z.infer<typeof sheetSchema>;
export type CellValue = string | number | boolean | null;
export type DataTable = {
  columns: string[];
  rows: CellValue[][];
  warnings: string[];
};
export const chartPalette = [
  "#81a9d8",
  "#79bfb0",
  "#e6bb78",
  "#aa9ad8",
  "#df8b97",
  "#b7c879",
];
