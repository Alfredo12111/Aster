import { it, expect } from "vitest";
import ExcelJS from "exceljs";
import { emptyModuleState, moduleStateSchema } from "../packages/core/modules";
import { resourceNotes, resourceEdges } from "../packages/core/resources";
import {
  noteEvidence,
  pdfEvidence,
  evidenceStatus,
} from "../packages/core/evidence";
import { metadataTree, folderTree } from "../packages/core/hierarchy";
import { diagramLayout } from "../packages/core/tree-layout";
import {
  datasetSchema,
  chartSchema,
  chartPalette,
} from "../packages/core/chart-model";
import {
  shiftFormula,
  renameSheet,
  changeStructure,
  fillRange,
  visibleRows,
} from "../packages/core/workbook-tools";
import { evaluateWorkbook } from "../packages/core/chart-data";
import { exportWorkbook, importWorkbook } from "../packages/core/workbook-io";
import { exportChunks } from "../packages/core/rag";
import { settingsSchema } from "../packages/storage-fs/vault";
import { defaultSettings, type Note } from "../packages/core/types";
const id = () => crypto.randomUUID();
const note = (title: string, content = "A precise source passage."): Note => ({
  id: id(),
  title,
  path: `Research/${title}.md`,
  content,
  revision: "a".repeat(64),
  modifiedAt: 0,
  tags: [],
});
const workbook = () =>
  datasetSchema.parse({
    id: id(),
    name: "Research",
    updatedAt: 0,
    sheets: [
      {
        name: "Data",
        rows: [
          ["Sample", "Value", "Doubled"],
          ["Alpha", "3", "=B2*2"],
          ["Beta", "5", "=B3*2"],
          ["Gamma", "7", "=B4*2"],
        ],
      },
      {
        name: "Summary",
        rows: [
          ["Total", "=SUM(Data!B2:B4)"],
          ["First", "=Data!B2"],
        ],
      },
    ],
  });
it("pins existing resources with stable identities, updates titles, and derives genuine source relationships", () => {
  const state = emptyModuleState(),
    n = note("Parent"),
    d = workbook();
  state.datasets.push(d);
  const c = chartSchema.parse({
    id: id(),
    title: "Results",
    type: "line",
    source: { kind: "dataset", datasetId: d.id, sheet: "Data" },
    x: "Sample",
    ys: ["Value"],
    colors: chartPalette,
  });
  state.charts.push(c);
  state.resources.push(
    {
      id: id(),
      target: { kind: "dataset", id: d.id },
      folder: "Research",
      parentNoteId: n.id,
    },
    { id: id(), target: { kind: "chart", id: c.id }, folder: "Research" },
  );
  const first = resourceNotes(state, [n]);
  state.datasets[0].name = "Renamed data";
  const second = resourceNotes(state, [n]);
  expect(second[0].id).toBe(first[0].id);
  expect(second[0].title).toBe("Renamed data");
  expect(resourceEdges(state, [n]).map((e) => e.kind)).toEqual([
    "organized under",
    "uses data from",
  ]);
  expect(metadataTree([n, ...second])[0].children[0].id).toBe(first[0].id);
  state.datasets = [];
  expect(resourceNotes(state, [n])[0].metadata?.missing).toBe(true);
  const legacy: any = emptyModuleState();
  delete legacy.resources;
  expect(moduleStateSchema.parse(legacy).resources).toEqual([]);
});
it("retains captured note evidence and flags changed or missing sources", () => {
  const n = note("Evidence"),
    state = emptyModuleState(),
    e = noteEvidence(n, "precise source");
  expect(evidenceStatus(e, [n], state)).toBe("current");
  n.content = "Revised passage";
  n.revision = "b".repeat(64);
  expect(evidenceStatus(e, [n], state)).toBe("changed");
  expect(e.quote).toBe("precise source");
  expect(evidenceStatus(e, [], state)).toBe("missing");
  expect(() => noteEvidence(n, "invented quote")).toThrow();
  const settings = defaultSettings();
  settings.relations.push({
    id: id(),
    source: n.id,
    target: id(),
    kind: "supports",
    evidence: [e],
  });
  expect(settingsSchema.parse(settings).relations[0].evidence).toEqual([e]);
  const target = { ...note("Target"), id: settings.relations[0].target };
  expect(
    exportChunks({
      id: id(),
      name: "Fixture",
      root: "fixture",
      notes: [n, target],
      folders: [],
      settings,
    })[0].relationships[0].evidence,
  ).toEqual([e]);
  expect(() => noteEvidence(note("Repeated", "same same"), "same")).toThrow(
    "more than once",
  );
});
it("detects changes to PDF evidence geometry and preserves evidence when an annotation disappears", () => {
  const state = emptyModuleState(),
    doc = {
      id: id(),
      path: "Attachments/source.pdf",
      fingerprint: "a".repeat(64),
      annotations: [
        {
          id: id(),
          page: 2,
          kind: "comment" as const,
          color: "#ffaa00",
          width: 2,
          quads: [
            [
              { x: 1, y: 1 },
              { x: 2, y: 1 },
              { x: 2, y: 2 },
              { x: 1, y: 2 },
            ],
          ],
          points: [],
          quote: "",
          comment: "Supporting measurement",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    };
  state.documents.push(doc);
  const e = pdfEvidence(doc, doc.annotations[0]);
  expect(evidenceStatus(e, [], state)).toBe("current");
  doc.annotations[0].quads[0][0].x = 9;
  expect(evidenceStatus(e, [], state)).toBe("changed");
  doc.annotations = [];
  expect(evidenceStatus(e, [], state)).toBe("missing");
  expect(e.quote).toBe("Supporting measurement");
});
it("lays out readable branches without overlap and retains matching ancestors", () => {
  const notes = Array.from({ length: 80 }, (_, i) => ({
    ...note(`Note ${i}`),
    path: `Group ${i % 4}/Note ${i}.md`,
  }));
  const roots = folderTree(notes),
    expanded = new Set(roots.map((r) => r.id));
  const layout = diagramLayout(roots, expanded);
  expect(layout.nodes.length).toBe(84);
  for (const a of layout.nodes)
    for (const b of layout.nodes)
      if (a !== b && a.y === b.y)
        expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(204);
  const filtered = diagramLayout(roots, new Set(), new Set([notes[0].id]));
  expect(filtered.nodes).toHaveLength(2);
  expect(filtered.edges).toHaveLength(1);
  expect(diagramLayout(roots, expanded, undefined, 10).truncated).toBe(true);
});
it("fills relative formulas while preserving dollar anchors and quoted text", () => {
  expect(
    shiftFormula('=SUM(B2:B3)+$B$2+$B2+B$2+IF(A2="A1",LOG10(100),0)', 1, 1),
  ).toBe('=SUM(C3:C4)+$B$2+$B3+C$2+IF(B3="A1",LOG10(100),0)');
  const d = fillRange(
    workbook(),
    0,
    { row: 1, col: 2 },
    { row: 3, col: 2 },
    "down",
  );
  expect(
    evaluateWorkbook(d)
      .sheets[0].rows.slice(1)
      .map((r) => r[2]),
  ).toEqual([6, 10, 14]);
});
it("inserts and removes rows and columns while maintaining totals and cross-sheet references", () => {
  const d = workbook(),
    inserted = changeStructure(d, 0, "row", 2);
  expect(inserted.sheets[1].rows[0][1]).toBe("=SUM('Data'!B2:B5)");
  expect(evaluateWorkbook(inserted).sheets[1].rows[0][1]).toBe(15);
  const removed = changeStructure(inserted, 0, "row", 2, true);
  expect(evaluateWorkbook(removed).sheets[1].rows[0][1]).toBe(15);
  const lastRemoved = changeStructure(d, 0, "row", 3, true);
  expect(evaluateWorkbook(lastRemoved).sheets[1].rows[0][1]).toBe(8);
  const col = changeStructure(d, 0, "column", 1);
  expect(evaluateWorkbook(col).sheets[0].rows[1][3]).toBe(6);
  expect(evaluateWorkbook(col).sheets[1].rows[1][1]).toBe(3);
});
it("renames sheets without rewriting quoted strings and filters/sorts without moving source rows", () => {
  const d = workbook();
  d.sheets[1].rows.push(["Literal", '=IF(Data!B2=3,"Data!B2","no")']);
  const changed = renameSheet(d, 0, "Lab's data");
  expect(changed.sheets[1].rows[2][1]).toBe(
    "=IF('Lab''s data'!B2=3,\"Data!B2\",\"no\")",
  );
  expect(evaluateWorkbook(changed).sheets[1].rows[0][1]).toBe(15);
  const rows = evaluateWorkbook(d).sheets[0].rows;
  expect(visibleRows(rows, 4, "4", 1, "gt", 1, true)).toEqual([0, 3, 2]);
  expect(d.sheets[0].rows[1][0]).toBe("Alpha");
});
it("supports useful research functions with independent expected results", () => {
  const d = workbook();
  d.sheets[1].rows = [
    ["Count", '=COUNTIF(Data!B2:B4,">3")'],
    ["Total", '=SUMIF(Data!B2:B4,">3",Data!B2:B4)'],
    ["Lookup", '=VLOOKUP("Beta",Data!A2:C4,2,FALSE)'],
    ["Average", "=AVERAGE(Data!B2:B4)"],
    ["Deviation", "=STDEV.S(Data!B2:B4)"],
    ["Error", "=IFERROR(1/0,99)"],
  ];
  expect(evaluateWorkbook(d).sheets[1].rows.map((r) => r[1])).toEqual([
    2, 12, 5, 5, 2, 99,
  ]);
});
it("exports working formulas and formats, while blocking external formulas and retaining values-only export", async () => {
  const d = workbook();
  d.sheets[0].columnFormats = { "1": "percent" };
  d.sheets[1].rows.push(["Blocked", '=WEBSERVICE("https://example.com")']);
  const bytes = await exportWorkbook(d, true),
    book = new ExcelJS.Workbook();
  await book.xlsx.load(bytes as any);
  expect(book.getWorksheet("Data")!.getCell("C2").formula).toBe("B2*2");
  expect(book.getWorksheet("Data")!.getCell("B2").numFmt).toBe("0.00%");
  expect(book.getWorksheet("Summary")!.getCell("B3").formula).toBeUndefined();
  const imported = await importWorkbook("research.xlsx", bytes);
  expect(evaluateWorkbook(imported).sheets[1].rows[0][1]).toBe(15);
  const values = await importWorkbook("values.xlsx", await exportWorkbook(d));
  expect(values.sheets[0].rows[1][2]).toBe("6");
});

import { syncWorkbookCharts } from "../packages/core/workbook-charts";
it("updates linked chart ranges atomically and refuses conflicting undo or header deletion", () => {
  const d = workbook(),
    c = chartSchema.parse({
      id: id(),
      title: "Results",
      type: "line",
      source: { kind: "dataset", datasetId: d.id, sheet: "Data" },
      x: "Sample",
      ys: ["Value"],
      range: "A1:C4",
      colors: chartPalette,
    }),
    charts = [c];
  const next = changeStructure(d, 0, "row", 2),
    undo = syncWorkbookCharts(charts, d, next, {
      sheet: "Data",
      axis: "row",
      at: 2,
      remove: false,
    });
  expect(c.range).toBe("A1:C5");
  const redo = syncWorkbookCharts(charts, next, d, undefined, undo);
  expect(c.range).toBe("A1:C4");
  syncWorkbookCharts(charts, d, next, undefined, redo);
  expect(c.range).toBe("A1:C5");
  c.range = "A1:B3";
  expect(() => syncWorkbookCharts(charts, next, d, undefined, undo)).toThrow(
    "changed",
  );
  expect(() =>
    syncWorkbookCharts(charts, d, changeStructure(d, 0, "row", 0, true), {
      sheet: "Data",
      axis: "row",
      at: 0,
      remove: true,
    }),
  ).toThrow("headers");
  const renamed = renameSheet(d, 0, "Sources");
  syncWorkbookCharts(charts, d, renamed);
  expect(c.source).toMatchObject({ sheet: "Sources" });
});
