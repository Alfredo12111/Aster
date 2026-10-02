import { it, expect } from "vitest";
import ExcelJS from "exceljs";
import {
  chartSchema,
  chartTypes,
  datasetSchema,
  type DataTable,
} from "../packages/core/chart-model";
import { buildChart } from "../packages/core/chart-options";
import {
  importWorkbook,
  exportWorkbook,
  checkXlsxArchive,
} from "../packages/core/workbook-io";
import { evaluateWorkbook, toCsv } from "../packages/core/chart-data";
import { regression } from "../packages/core/chart-math";
const table: DataTable = {
  columns: [
    "Day",
    "X",
    "Y",
    "Z",
    "Size",
    "Open",
    "High",
    "Low",
    "Close",
    "Volume",
    "Group",
  ],
  rows: [
    ["2026-01-01", 1, 2, 4, 9, 10, 14, 8, 12, 100, "A"],
    ["2026-01-02", 2, 4, 6, 16, 12, 17, 11, 16, 200, "A"],
    ["2026-01-03", 3, 6, 8, 25, 16, 20, 15, 18, 300, "B"],
  ],
  warnings: [],
};
const make = (type: string) =>
  chartSchema.parse({
    id: crypto.randomUUID(),
    title: "Metrics",
    type,
    source: { kind: "query", query: "SELECT file.name" },
    x: ["scatter", "bubble"].includes(type) ? "X" : "Day",
    ys: ["Y", "Z"],
    open: "Open",
    high: "High",
    low: "Low",
    close: "Close",
    volume: "Volume",
    size: "Size",
    calendarYear: 2026,
    colors: ["#79bfb0", "#df8b97"],
  });
it.each(chartTypes)("builds finite serializable %s chart options", (type) => {
  const chart = buildChart(make(type), table);
  expect(chart.option.series.length).toBeGreaterThan(0);
  expect(JSON.stringify(chart.option)).not.toMatch(/NaN|Infinity/);
  expect(chart.statistics[0].mean).toBe(4);
  if (type === "candlestick")
    expect(chart.option.series[0].data[0]).toEqual([10, 12, 8, 14]);
  if (type === "ohlc")
    expect(chart.option.series[0].data[0]).toEqual([0, 10, 12, 8, 14]);
  if (type === "calendar")
    expect(chart.option.series[0].data[0]).toEqual(["2026-01-01", 2]);
  if (type === "bubble")
    expect(chart.option.series[0].data.at(-1).symbolSize).toBe(50);
});
it("computes duplicate-category aggregation, calendar dates and rejects invalid OHLC", () => {
  const chart = make("column");
  chart.aggregation = "sum";
  chart.x = "Group";
  expect(buildChart(chart, table).option.series[0].data).toEqual([6, 6]);
  const calendar = make("calendar");
  const result = buildChart(calendar, {
    ...table,
    rows: [...table.rows, table.rows[0], [1e300, 1, 3]],
  });
  expect(result.option.series[0].data[0]).toEqual(["2026-01-01", 4]);
  expect(result.warnings.join()).toContain("excluded");
  const bad = structuredClone(table);
  bad.rows[0][7] = 50;
  expect(
    buildChart(make("candlestick"), bad).option.series[0].data,
  ).toHaveLength(2);
});
it("evaluates trendlines exactly at category positions and fits higher-order curves", () => {
  const c = make("line");
  c.trend = "linear";
  const data = {
    columns: table.columns,
    rows: Array.from({ length: 201 }, (_, i) => [
      "day" + i,
      i,
      2 * i + 1,
      3 * i + 2,
    ]),
    warnings: [],
  };
  expect(buildChart(c, data).option.series[2].data[99]).toBeCloseTo(199, 9);
  const points = Array.from({ length: 20 }, (_, x) => [
    x,
    3 * x * x - 2 * x + 7,
  ]);
  const fit = regression(points, "polynomial", 2, [4, 9])!;
  expect(fit.r2).toBeCloseTo(1);
  expect(fit.points[0][1]).toBeCloseTo(47);
  expect(
    regression(
      [
        [1, 2],
        [2, 4],
        [3, 8],
      ],
      "exponential",
    )!.r2,
  ).toBeCloseTo(1);
});
it("imports XLSX formulas and exports calculated values with stable sheet names", async () => {
  const source = new ExcelJS.Workbook(),
    sheet = source.addWorksheet("Data");
  sheet.addRows([
    ["Name", "Value", "Twice"],
    ["A", 4, { formula: "B2*2", result: 8 }],
    ["B", 7, { formula: "SUM(B2:B3)", result: 11 }],
  ]);
  const imported = await importWorkbook(
    "Example.xlsx",
    new Uint8Array((await source.xlsx.writeBuffer()) as ArrayBuffer),
  );
  expect(imported.sheets[0].rows[1][2]).toBe("=B2*2");
  expect(evaluateWorkbook(imported).sheets[0].rows[2][2]).toBe(11);
  const bytes = await exportWorkbook(imported);
  const roundtrip = await importWorkbook("Export.xlsx", bytes);
  expect(roundtrip.sheets[0].rows[2][2]).toBe("11");
  imported.sheets.push(
    { ...imported.sheets[0], name: "a".repeat(32) },
    { ...imported.sheets[0], name: "a".repeat(33) },
  );
  expect(
    (await importWorkbook("Names.xlsx", await exportWorkbook(imported))).sheets,
  ).toHaveLength(3);
  expect(() => checkXlsxArchive(new Uint8Array(100))).toThrow("valid XLSX");
  expect(() => checkXlsxArchive(new Uint8Array(10_000_001))).toThrow("10 MB");
});
it("handles financial functions, logical branches and safe literal CSV output", () => {
  const d = datasetSchema.parse({
    id: crypto.randomUUID(),
    name: "Finance",
    updatedAt: 1,
    sheets: [
      {
        name: "Sheet1",
        rows: [
          [
            "=NPV(0.1,100,100)",
            "=FV(0.1,2,0,-100)",
            "=IF(2>1,7,9)",
            "=ROUND(2.345,2)",
          ],
        ],
      },
    ],
  });
  const row = evaluateWorkbook(d).sheets[0].rows[0];
  expect(row[0]).toBeCloseTo(173.553719);
  expect(row[1]).toBeCloseTo(121);
  expect(row[2]).toBe(7);
  expect(row[3]).toBe(2.35);
  expect(toCsv([["=SUM(1,2)", -12, "@link"]])).toBe(
    "\"'=SUM(1,2)\",-12,'@link",
  );
});
