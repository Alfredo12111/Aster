import { it, expect } from "vitest";
import * as fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { makeDemo } from "../packages/demo/pelagic";
import {
  createDemoVault,
  ensureDemoVault,
  readDemoSources,
} from "../packages/demo/filesystem";
import {
  resourceNotes,
  resourceCatalog,
  resourceEdges,
  resourceKey,
} from "../packages/core/resources";
import { evidenceStatus } from "../packages/core/evidence";
import {
  evaluateWorkbook,
  resolveChartSource,
} from "../packages/core/chart-data";
import { buildChart } from "../packages/core/chart-options";
import { chartTypes } from "../packages/core/chart-model";
import { executeQuery } from "../packages/core/query";
import { VaultRepository } from "../packages/storage-fs/vault";

const assets = path.resolve("public/demo");
const demo = async () => makeDemo("2026-10-02", await readDemoSources(assets));
it("builds a connected, synthetic vault with every tool type and no broken wikilinks", async () => {
  const d = await demo(),
    titles = new Set(d.notes.map((n) => n.title));
  expect(d.notes.length).toBe(128);
  for (const n of d.notes) {
    expect(n.metadata?.demo).toBe(true);
    for (const m of n.content.matchAll(/\[\[([^\]|#]+)(?:[^\]]*)\]\]/g))
      expect(titles.has(m[1]), `${n.title} links ${m[1]}`).toBe(true);
  }
  const catalog = new Set(
    resourceCatalog(d.state).map((r) => resourceKey(r.target)),
  );
  expect(new Set(d.state.resources.map((r) => r.target.kind)).size).toBe(8);
  for (const pin of d.state.resources) {
    expect(catalog.has(resourceKey(pin.target))).toBe(true);
    expect(d.notes.some((n) => n.id === pin.parentNoteId)).toBe(true);
  }
  expect(resourceNotes(d.state, d.notes).length).toBe(40);
  expect(resourceEdges(d.state, d.notes).length).toBeGreaterThan(60);
  expect(d.state.workspace.saved.length).toBe(6);
  for (const r of d.settings.relations)
    for (const e of r.evidence!)
      expect(evidenceStatus(e, d.notes, d.state)).toBe("current");
});
it("populates all chart families and sources with valid calculations and live queries", async () => {
  const d = await demo();
  expect(new Set(d.state.charts.map((c) => c.type))).toEqual(
    new Set(chartTypes),
  );
  expect(new Set(d.state.charts.map((c) => c.source.kind))).toEqual(
    new Set(["dataset", "query", "markdown"]),
  );
  for (const b of d.state.datasets) {
    const result = evaluateWorkbook(b);
    expect(result.warnings, b.name).toEqual([]);
    for (const s of result.sheets)
      for (const row of s.rows)
        for (const v of row)
          expect(String(v).startsWith("#"), `${b.name}:${s.name}:${v}`).toBe(
            false,
          );
  }
  const ecology = evaluateWorkbook(d.state.datasets[0]).sheets[2].rows;
  expect(ecology[1][1]).toBe(72);
  expect(ecology[2][1]).toBe(89);
  expect(ecology[3][1]).toBe(17);
  expect(evaluateWorkbook(d.state.datasets[2]).sheets[2].rows[1][1]).toBe(
    180000,
  );
  for (const c of d.state.charts) {
    const table = resolveChartSource(c, d.state.datasets, d.notes);
    expect(table.rows.length, c.title).toBeGreaterThan(0);
    expect(() => buildChart(c, table), c.title).not.toThrow();
  }
  for (const b of d.state.boards)
    for (const c of b.cards)
      expect(
        executeQuery(d.notes, c.query).rows.length,
        c.title,
      ).toBeGreaterThan(0);
  for (const board of d.state.kanban)
    for (const card of board.cards)
      expect(board.columns.find((c) => c.id === card.columnId)?.status).toBe(
        d.state.tasks.find((t) => t.id === card.taskId)?.status,
      );
});
it("uses valid PDF fingerprints, page coordinates, and all five annotation types", async () => {
  const sources = await readDemoSources(assets),
    d = makeDemo("2026-10-02", sources);
  expect(
    new Set(d.state.documents.flatMap((p) => p.annotations.map((a) => a.kind)))
      .size,
  ).toBe(5);
  for (const [i, doc] of d.state.documents.entries()) {
    expect(doc.fingerprint).toBe(
      createHash("sha256").update(sources[i].data).digest("hex"),
    );
    expect(Buffer.from(sources[i].data).subarray(0, 5).toString()).toBe(
      "%PDF-",
    );
    for (const a of doc.annotations) {
      expect(a.page).toBeLessThanOrEqual(i === 2 ? 2 : 3);
      for (const p of [...a.points, ...a.quads.flat()]) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(612);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(792);
      }
    }
  }
});
it("seeds atomically, preserves edits on reopen, and refuses existing destinations", async () => {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), "aster-demo-test-")),
    root = path.join(parent, "Pelagic Labs");
  try {
    await expect(
      createDemoVault(root, path.join(parent, "missing")),
    ).rejects.toThrow();
    await expect(fs.stat(root)).rejects.toThrow();
    await createDemoVault(root, assets, "2026-10-02");
    const repo = new VaultRepository(root),
      snapshot = await repo.initialize();
    expect(snapshot.notes.length).toBe(128);
    const modules = await repo.loadModules();
    expect(modules.state.tasks.length).toBe(42);
    for (const r of snapshot.settings.relations)
      for (const e of r.evidence!)
        expect(evidenceStatus(e, snapshot.notes, modules.state)).toBe(
          "current",
        );
    const n = snapshot.notes.find((n) => n.title === "Welcome aboard")!;
    await repo.saveNote({
      id: n.id,
      revision: n.revision,
      content: "My edited demo",
    });
    await ensureDemoVault(root, assets);
    expect(await fs.readFile(path.join(root, n.path), "utf8")).toBe(
      "My edited demo",
    );
    await expect(createDemoVault(root, assets)).rejects.toThrow(
      "already exists",
    );
    expect(
      (await fs.readdir(parent)).filter((n) =>
        n.startsWith(".pelagic-staging"),
      ),
    ).toEqual([]);
  } finally {
    await fs.rm(parent, { recursive: true, force: true });
  }
});
