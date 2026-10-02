import { createBasicVault } from './test-vault.mjs';
import { _electron as electron, expect } from "@playwright/test";
import electronPath from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { makePdfFixture } from "./pdf-fixture.mjs";
const results = path.resolve("test-results"),
  profile = path.join(results, "ecosystem-" + randomUUID()),
  packaged = process.env.ASTER_PACKAGED_EXE;
await fs.mkdir(results, { recursive: true });
const launch = {
  executablePath: packaged ?? electronPath,
  args: packaged ? [] : ["."],
  cwd: process.cwd(),
  env: { ...process.env, ASTER_USER_DATA: profile, ASTER_INITIAL_VAULT: await createBasicVault(profile) },
  timeout: 30000,
};
let app = await electron.launch(launch),
  page = await app.firstWindow();
const errors = [],
  checks = [];
const setup = async () => {
  page.on("pageerror", (e) => errors.push(e.message));
  page.setDefaultTimeout(15000);
  await page.setViewportSize({ width: 1680, height: 1050 });
};
await setup();
const step = (s) => {
  checks.push(s);
  console.log(s);
};
const button = (name) => page.getByRole("button", { name, exact: true });
const waitSaved = async () => {
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.dispatchEvent(new Event("beforeunload", { cancelable: true })),
      ),
    )
    .toBe(true);
};
const tree = async () => {
  await waitSaved();
  await button("Graph").click();
  await waitSaved();
  await button("Tree view").click();
  await expect(page.getByLabel("Tree hierarchy")).toBeVisible();
  await page.getByLabel("Filter graph", { exact: true }).fill("path:Research");
};
const node = (title) =>
  page
    .locator(".tree-node-open")
    .filter({ has: page.locator("strong").getByText(title, { exact: true }) });
const open = async (title) => {
  await tree();
  await node(title).dblclick();
};
const state = () =>
  page.evaluate(async () => (await window.aster.loadModules()).state);
try {
  await expect(page.locator(".tree-note")).toHaveCount(17);
  const fixture = path.join(results, "ecosystem-source.pdf");
  await fs.writeFile(fixture, makePdfFixture());
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, fixture);
  const seed = await page.evaluate(async () => {
    const id = () => crypto.randomUUID();
    let v = await window.aster.createNote("Research/Research question"),
      n = v.notes.find((n) => n.title === "Research question");
    await window.aster.saveNote({
      id: n.id,
      revision: n.revision,
      content:
        "# Research question\n\nThe measured samples increased from three to seven.\n",
    });
    v = await window.aster.createNote("Research/Source summary");
    const child = v.notes.find((n) => n.title === "Source summary");
    await window.aster.saveNote({
      id: child.id,
      revision: child.revision,
      content:
        '---\nparent: "[[Research question]]"\n---\n# Source summary\nReviewed supporting observations.',
    });
    await window.aster.importPdf();
    const m = await window.aster.loadModules(),
      s = m.state,
      ds = id(),
      chart = id(),
      project = id(),
      task = id(),
      board = id(),
      canvas = id(),
      col = id();
    s.datasets.push({
      id: ds,
      name: "Study workbook",
      updatedAt: 1,
      sheets: [
        {
          name: "Data",
          rows: [
            ["Sample", "Value", "Double"],
            ["Alpha", "3", "=B2*2"],
            ["Beta", "5", "=B3*2"],
            ["Gamma", "7", "=B4*2"],
          ],
        },
        {
          name: "Summary",
          rows: [
            ["Total", "=SUM(Data!B2:B4)"],
            ["Mean", "=AVERAGE(Data!B2:B4)"],
          ],
        },
      ],
    });
    s.charts.push({
      id: chart,
      title: "Study chart",
      type: "line",
      source: { kind: "dataset", datasetId: ds, sheet: "Data" },
      range: "A1:C4",
      x: "Sample",
      ys: ["Value"],
      colors: ["#79bfb0"],
    });
    s.projects.push({
      id: project,
      name: "Study project",
      description: "Connected research",
      noteIds: [n.id],
      createdAt: 1,
    });
    s.tasks.push({
      id: task,
      title: "Review sources",
      noteId: child.id,
      excerpt: "Review observations",
      due: null,
      status: "todo",
      priority: "high",
      projectId: project,
      createdAt: 1,
      updatedAt: 1,
    });
    s.kanban.push({
      id: board,
      name: "Study board",
      projectId: project,
      columns: [
        { id: col, title: "To review", status: "todo", color: "#79bfb0" },
      ],
      cards: [{ taskId: task, columnId: col }],
    });
    s.boards.push({ id: canvas, name: "Study canvas", cards: [] });
    const doc = s.documents[0],
      annotation = id();
    doc.annotations.push({
      id: annotation,
      page: 2,
      kind: "comment",
      color: "#79bfb0",
      width: 2,
      quads: [
        [
          { x: 60, y: 655 },
          { x: 300, y: 655 },
          { x: 300, y: 690 },
          { x: 60, y: 690 },
        ],
      ],
      points: [],
      quote: "Second page with rotated evidence.",
      comment: "Confirm against the worksheet.",
      createdAt: 1,
      updatedAt: 1,
    });
    await window.aster.saveModules({ ...m, state: s });
    return {
      parent: n.id,
      child: child.id,
      ds,
      chart,
      project,
      task,
      board,
      canvas,
      pdf: doc.id,
      pdfTitle: doc.path.split("/").pop(),
      annotation,
    };
  });
  await page.getByTitle("Reload from disk", { exact: true }).click();
  await expect(page.locator(".tree-note")).toHaveCount(19);
  step("Pin eight existing tools without duplicating their data");
  for (const [kind, id] of [
    ["dataset", seed.ds],
    ["chart", seed.chart],
    ["kanban", seed.board],
    ["canvas", seed.canvas],
    ["project", seed.project],
    ["task", seed.task],
    ["pdf", seed.pdf],
    ["calendar", "calendar"],
  ]) {
    await button("Add tool node").click();
    await page.getByLabel("Map tool item").selectOption(kind + ":" + id);
    await page.getByLabel("Map folder", { exact: true }).fill("Research/Tools");
    await page.getByLabel("Map parent note").selectOption(seed.parent);
    await button("Save tool node").click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await button("Close details").click();
  }
  await expect.poll(async () => (await state()).resources.length).toBe(8);
  await waitSaved();
  await button("Organic").click();
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const v = await window.aster.load(),
          m = await window.aster.loadModules(),
          view = v.settings.views.find((vw) => vw.id === v.settings.activeView);
        return m.state.resources.filter((p) =>
          Number.isFinite(view.positions[p.id]?.x),
        ).length;
      }),
    )
    .toBe(8);
  step(
    "Folder and parent tree, source-derived relationships, collapse and navigation",
  );
  await tree();
  await expect(node("Study workbook")).toBeVisible();
  await page.getByLabel("Tree hierarchy").selectOption("parents");
  await expect(node("Research question")).toBeVisible();
  await page.getByLabel("Filter graph", { exact: true }).fill("Study");
  await button("Fit tree").click();
  await page.screenshot({ path: path.join(results, "aster-tree.png") });
  await page.getByLabel("Filter graph", { exact: true }).fill("path:Research");
  await node("Study chart").click();
  await expect(page.locator(".resource-relations")).toContainText(
    "uses data from",
  );
  await button("Close details").click();
  await page.getByLabel("Filter graph", { exact: true }).fill("");
  await page.getByLabel("Collapse Research question", { exact: true }).click();
  await expect(node("Study workbook")).toHaveCount(0);
  await page.getByLabel("Expand Research question", { exact: true }).click();
  await expect(node("Study workbook")).toBeVisible();
  step(
    "Workbook opens from its node, recalculates and preserves references through fill, structure, undo and rename",
  );
  await open("Study workbook");
  await expect(page.getByLabel("B2", { exact: true })).toHaveText("3");
  await page.getByLabel("B2", { exact: true }).click();
  await page.getByLabel("Cell value or formula").fill("4");
  await page.getByLabel("Cell value or formula").press("Enter");
  await expect(page.getByLabel("C2", { exact: true })).toHaveText("8");
  await page.getByLabel("Select worksheet range").fill("C2:C4");
  await button("Select range").click();
  await button("Fill down").click();
  await expect(page.getByLabel("C4", { exact: true })).toHaveText("14");
  await page.getByLabel("B3", { exact: true }).click();
  await button("Insert row").click();
  await expect.poll(async () => (await state()).charts[0].range).toBe("A1:C5");
  await expect(page.getByLabel("C5", { exact: true })).toHaveText("14");
  await page.getByTitle("Undo data edit", { exact: true }).click();
  await expect.poll(async () => (await state()).charts[0].range).toBe("A1:C4");
  await page.getByTitle("Redo data edit", { exact: true }).click();
  await expect.poll(async () => (await state()).charts[0].range).toBe("A1:C5");
  await button("Delete row").click();
  await expect.poll(async () => (await state()).charts[0].range).toBe("A1:C4");
  await button("Rename sheet").click();
  await page.getByLabel("Workbook item name").fill("Observations");
  await button("Save name").click();
  await expect
    .poll(async () => (await state()).charts[0].source.sheet)
    .toBe("Observations");
  await page
    .getByLabel("Worksheet", { exact: true })
    .selectOption({ label: "Summary" });
  await expect(page.getByLabel("B1", { exact: true })).toHaveText("16");
  await page
    .getByLabel("Worksheet", { exact: true })
    .selectOption({ label: "Observations" });
  step(
    "Filtered edits keep original row addresses, summaries and number formatting",
  );
  await page.getByLabel("Workbook filter column").selectOption("1");
  await page.getByLabel("Workbook filter operator").selectOption("gt");
  await page.getByLabel("Filter worksheet rows").fill("4");
  await page.getByLabel("Sort worksheet by").selectOption("1");
  await button("Ascending").click();
  await expect(
    page.locator(".data-grid tbody tr").nth(1).locator("th"),
  ).toHaveText("4");
  await page.getByLabel("B4", { exact: true }).click();
  await page.getByLabel("Cell value or formula").fill("9");
  await page.getByLabel("Cell value or formula").press("Enter");
  await expect(page.getByLabel("C4", { exact: true })).toHaveText("18");
  await expect
    .poll(async () => (await state()).datasets[0].sheets[0].rows[3][1])
    .toBe("9");
  await button("Reset view").click();
  await page.getByLabel("Select worksheet range").fill("B2:B4");
  await button("Select range").click();
  await expect(page.locator(".sheet-summary")).toContainText("Sum 18");
  await page.getByLabel("Column format").selectOption("number");
  await page.screenshot({ path: path.join(results, "aster-workbook.png") });
  const exported = path.join(results, "ecosystem-formulas.xlsx");
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, exported);
  await button("Excel with formulas").click();
  await expect
    .poll(async () => {
      try {
        return (await fs.stat(exported)).size;
      } catch {
        return 0;
      }
    })
    .toBeGreaterThan(1000);
  step("Connect workbook to a note and attach exact note and PDF evidence");
  await tree();
  await node("Study workbook").click();
  await page.getByLabel("Tool relationship").selectOption("supports");
  await page.getByLabel("Connect tool to").selectOption(seed.child);
  await button("Connect tool").click();
  await button("Evidence (0)").click();
  await page
    .getByLabel("Evidence note", { exact: true })
    .selectOption(seed.parent);
  await page
    .getByLabel("Evidence passage")
    .fill("The measured samples increased from three to seven.");
  await button("Attach evidence").click();
  await expect(page.locator(".evidence-item")).toHaveCount(1);
  await page.getByLabel("Evidence source", { exact: true }).selectOption("pdf");
  await page.getByLabel("Evidence annotation").selectOption(seed.annotation);
  await button("Attach evidence").click();
  await expect(page.locator(".evidence-item")).toHaveCount(2);
  await page.screenshot({ path: path.join(results, "aster-evidence.png") });
  await page
    .locator(".evidence-item")
    .first()
    .getByRole("button", { name: "Open evidence source" })
    .click();
  await expect(page.locator(".note-heading h2")).toHaveText(
    "Research question",
  );
  await expect(page.locator(".cm-selectionBackground").first()).toBeVisible();
  await page.getByTitle("Create task from this note", { exact: true }).click();
  await expect(
    page.getByRole("textbox", {
      name: "Source excerpt / context",
      exact: true,
    }),
  ).toHaveValue("The measured samples increased from three to seven.");
  await button("Cancel").click();
  const current = await page.evaluate(() => window.aster.load()),
    source = current.notes.find((n) => n.id === seed.parent);
  await fs.appendFile(
    path.join(current.root, source.path),
    "\nA later source revision.\n",
  );
  await page.getByTitle("Reload from disk", { exact: true }).click();
  await tree();
  await node("Study workbook").click();
  await button("Evidence (2)").click();
  await expect(page.locator(".evidence-item").first()).toContainText(
    "Source changed",
  );
  await button("Confirm reviewed source").click();
  await expect(page.locator(".evidence-item").first()).toContainText(
    "Source current",
  );
  await page
    .locator(".evidence-item")
    .nth(1)
    .getByRole("button", { name: "Open evidence source" })
    .click();
  await expect(page.getByLabel("PDF page", { exact: true })).toHaveValue("2");
  await expect(page.locator(".annotation-entry.active")).toBeVisible();
  step("Open every linked tool in its native view");
  await open("Study chart");
  await page.getByTitle("Chart configuration", { exact: true }).click();
  await expect(page.getByLabel("Chart title", { exact: true })).toHaveValue(
    "Study chart",
  );
  await expect(page.locator(".chart-plot svg")).toBeVisible();
  await open("Study board");
  await expect(page.getByLabel("Kanban board", { exact: true })).toHaveValue(
    seed.board,
  );
  await expect(page.locator(".kanban-card")).toContainText("Review sources");
  await open("Study canvas");
  await expect(page.getByLabel("Canvas board", { exact: true })).toHaveValue(
    seed.canvas,
  );
  await open("Study project");
  await expect(page.locator(".project-notes")).toContainText(
    "Research question",
  );
  await open("Review sources");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Task title", { exact: true })).toHaveValue(
    "Review sources",
  );
  await button("Cancel").click();
  await open(seed.pdfTitle);
  await expect(page.getByLabel("PDF document", { exact: true })).toHaveValue(
    seed.pdf,
  );
  await open("Calendar");
  await expect(page.getByLabel("Calendar date", { exact: true })).toBeVisible();
  await tree();
  await waitSaved();
  const before = await state();
  await app.close();
  app = await electron.launch(launch);
  page = await app.firstWindow();
  await setup();
  step("Restart persists graph/tree resources, workbook changes and evidence");
  await expect(page.getByLabel("Tree hierarchy")).toBeVisible();
  const after = await state();
  expect(after.resources).toEqual(before.resources);
  expect(after.datasets).toEqual(before.datasets);
  const vault = await page.evaluate(() => window.aster.load());
  expect(
    vault.settings.relations.find((r) => r.kind === "supports").evidence,
  ).toHaveLength(2);
  expect(errors).toEqual([]);
  console.log(JSON.stringify({ ok: true, packaged: !!packaged, checks }));
} catch (e) {
  await page
    .screenshot({ path: path.join(results, "ecosystem-failure.png") })
    .catch(() => {});
  throw e;
} finally {
  await app
    .evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().forEach((w) => w.destroy()),
    )
    .catch(() => {});
  await app.close().catch(() => {});
}
