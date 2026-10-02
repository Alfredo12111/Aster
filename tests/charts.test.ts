import { describe, it, expect } from "vitest";
import {
  evaluateWorkbook,
  parseDelimited,
  markdownTables,
  resolveChartSource,
  formulaFunctions,
  tableFromRows,
} from "../packages/core/chart-data";
import {
  statistics,
  histogram,
  regression,
  boxplot,
  correlation,
  density,
} from "../packages/core/chart-math";
import {
  datasetSchema,
  chartSchema,
  chartPalette,
} from "../packages/core/chart-model";
const data = (rows: string[][]) =>
  datasetSchema.parse({
    id: crypto.randomUUID(),
    name: "Metrics",
    sheets: [{ name: "Sheet1", rows }],
    updatedAt: 0,
  });
describe("chart calculations", () => {
  it("calculates referenced and financial formulas with cycles and external calls blocked", () => {
    const workbook = data([
      ["x", "y", "result"],
      ["2", "3", "=SUM(A2:B2)"],
      ["4", "6", "=C2*2"],
      ["", "", "=PMT(0.01,12,1000)"],
      ["", "", "=C5"],
      ["", "", '=WEBSERVICE("https://example.com")'],
    ]);
    const result = evaluateWorkbook(workbook).sheets[0].rows;
    expect(result[1][2]).toBe(5);
    expect(result[2][2]).toBe(10);
    expect(result[3][2]).toBeCloseTo(-88.84878868, 6);
    expect(String(result[4][2])).toContain("#");
    expect(result[5][2]).toBe("#BLOCKED!");
    expect(formulaFunctions()).toContain("NPV");
  });
  it("recalculates cross-sheet references and preserves blank/error semantics", () => {
    const workbook = data([
      ["label", "value"],
      ["a", "=Other!B2+1"],
      ["b", "=1/0"],
      ["c", "=SUM(B5:B10)"],
    ]);
    workbook.sheets.push({
      name: "Other",
      rows: [
        ["x", "y"],
        ["a", "8"],
      ],
    });
    expect(evaluateWorkbook(workbook).sheets[0].rows.map((r) => r[1])).toEqual([
      "value",
      9,
      "#DIV/0!",
      0,
    ]);
    workbook.sheets[1].rows[1][1] = "12";
    expect(evaluateWorkbook(workbook).sheets[0].rows[1][1]).toBe(13);
  });
  it("parses quoted CSV, escaped table pipes, and selected ranges", () => {
    expect(
      parseDelimited('Name,Value\r\n"a,b","2"\r\n"multi\nline",3'),
    ).toEqual([
      ["Name", "Value"],
      ["a,b", "2"],
      ["multi\nline", "3"],
    ]);
    expect(() => parseDelimited('"bad')).toThrow();
    expect(
      markdownTables("| A | B |\n| --- | --- |\n| one\\|two | 3 |")[0][1],
    ).toEqual(["one|two", "3"]);
    expect(
      tableFromRows(
        [
          ["x", "y"],
          [1, 2],
          [2, 4],
        ],
        "A1:B2",
      ).rows,
    ).toEqual([[1, 2]]);
    expect(() => tableFromRows([["x"]], "A1:B5")).toThrow();
  });
  it("computes unbiased variance, inclusive quantiles, bins, outliers and fits", () => {
    const s = statistics([1, 2, 3, 4]);
    expect(s.mean).toBe(2.5);
    expect(s.variance).toBeCloseTo(5 / 3);
    expect(s.q1).toBe(1.75);
    expect(histogram([0, 1, 2, 3, 4], 2).map((b) => b.count)).toEqual([2, 3]);
    expect(boxplot([1, 2, 3, 4, 100])?.outliers).toEqual([100]);
    const fit = regression(
      [
        [0, 1],
        [1, 3],
        [2, 5],
        [3, 7],
      ],
      "linear",
    )!;
    expect(fit.r2).toBeCloseTo(1);
    expect(fit.points.at(-1)?.[1]).toBeCloseTo(7);
    expect(
      regression(
        [
          [1, 1],
          [1, 2],
        ],
        "linear",
      ),
    ).toBeNull();
    expect(
      correlation([
        [1, 4],
        [2, 2],
        [3, 0],
      ]),
    ).toBeCloseTo(-1);
    expect(density([2, 2, 2]).every((p) => p.every(Number.isFinite))).toBe(
      true,
    );
  });
  it("reads live note tables without storing a second copy", () => {
    const note: any = {
      id: crypto.randomUUID(),
      content: "| Month | Value |\n| --- | --- |\n| Jan | 5 |",
    };
    const chart = chartSchema.parse({
      id: crypto.randomUUID(),
      title: "Live",
      type: "line",
      source: { kind: "markdown", noteId: note.id, table: 0 },
      x: "Month",
      ys: ["Value"],
      colors: chartPalette,
    });
    expect(resolveChartSource(chart, [], [note]).rows[0][1]).toBe(5);
    note.content = note.content.replace("5", "8");
    expect(resolveChartSource(chart, [], [note]).rows[0][1]).toBe(8);
  });
});
