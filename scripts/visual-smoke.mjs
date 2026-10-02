import { createBasicVault } from './test-vault.mjs';
import { _electron as electron, expect } from "@playwright/test";
import electronPath from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
const results = path.resolve("test-results"),
  profile = path.join(results, "visual-" + randomUUID()),
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
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.setDefaultTimeout(15000);
await page.setViewportSize({ width: 1600, height: 1000 });
const saveChart = async () => {
  const b = page.getByRole("button", { name: "Save chart", exact: true });
  if (await b.isEnabled()) await b.click();
  await expect(page.locator(".chart-document-heading")).not.toContainText(
    "unsaved chart",
  );
  await expect(b).toBeDisabled();
};
try {
  await expect(page.locator(".tree-note")).toHaveCount(17);
  await page.getByTitle("Built-in modules", { exact: true }).click();
  for (const name of [
    "Charts",
    "Kanban",
    "Calendar",
    "PDF Library",
    "Tasks & Projects",
  ]) {
    const toggle = page.getByLabel("Enable " + name, { exact: true });
    await expect(toggle).toBeChecked();
  }
  await page.getByRole("button", { name: "Open Charts", exact: true }).click();
  await page
    .getByRole("button", { name: "Try sample data", exact: true })
    .click();
  await expect(page.locator(".chart-plot svg")).toBeVisible();
  await expect(page.locator(".chart-statistics")).toContainText("45");
  await page.screenshot({ path: path.join(results, "aster-charts.png") });
  console.log("Chart types and analysis");
  for (const type of [
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
  ]) {
    await page.getByLabel("Chart type", { exact: true }).selectOption(type);
    if (type === "scatter" || type === "bubble")
      await page
        .getByLabel("X / categories", { exact: true })
        .selectOption("Readers");
    if (type === "bubble")
      await page
        .getByLabel("Bubble size", { exact: true })
        .selectOption("Size");
    if (type === "candlestick" || type === "ohlc")
      for (const field of ["Open", "High", "Low", "Close", "Volume"])
        await page.getByLabel(field, { exact: true }).selectOption(field);
    if (type === "calendar")
      await page
        .getByLabel("X / categories", { exact: true })
        .selectOption("Date");
    await expect(page.locator(".chart-document-heading")).toContainText(
      "6 live rows",
    );
    await expect(page.locator(".chart-plot svg")).toBeVisible();
    await saveChart();
  }
  await page.getByLabel("Chart type", { exact: true }).selectOption("line");
  await saveChart();
  console.log("Worksheet edit, formulas, selected ranges and export");
  await page
    .getByRole("button", { name: "Edit worksheet data", exact: true })
    .click();
  await page.getByLabel("B2", { exact: true }).click();
  await page
    .getByLabel("Cell value or formula", { exact: true })
    .fill("=SUM(C2,10)");
  await page
    .getByLabel("Cell value or formula", { exact: true })
    .press("Enter");
  await expect(page.getByLabel("B2", { exact: true })).toHaveText("24");
  await page.getByLabel("C2", { exact: true }).click();
  await page.getByLabel("Cell value or formula", { exact: true }).fill("20");
  await page
    .getByLabel("Cell value or formula", { exact: true })
    .press("Enter");
  await expect(page.getByLabel("B2", { exact: true })).toHaveText("30");
  await page.getByTitle("Undo data edit", { exact: true }).click();
  await expect(page.getByLabel("B2", { exact: true })).toHaveText("24");
  await page.getByTitle("Redo data edit", { exact: true }).click();
  await expect(page.getByLabel("B2", { exact: true })).toHaveText("30");
  const exportPath = path.join(results, "visual-export.xlsx");
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, exportPath);
  await page.getByRole("button", { name: "Excel", exact: true }).click();
  await expect
    .poll(async () => {
      try {
        return (await fs.stat(exportPath)).size;
      } catch {
        return 0;
      }
    })
    .toBeGreaterThan(1000);
  await page
    .getByLabel("Import chart data file", { exact: true })
    .setInputFiles(exportPath);
  await expect(page.locator(".chart-document-heading h2")).toHaveText(
    "visual-export",
  );
  await expect(page.getByLabel("B2", { exact: true })).toHaveText("30");
  const csvPath = path.join(results, "visual-input.csv");
  await fs.writeFile(csvPath, "Category,Value\nOne,4\nTwo,9\nThree,16");
  await page
    .getByLabel("Import chart data file", { exact: true })
    .setInputFiles(csvPath);
  await expect(page.locator(".chart-document-heading h2")).toHaveText(
    "visual-input",
  );
  await page.getByLabel("A1", { exact: true }).click();
  await page.getByLabel("B4", { exact: true }).click({ modifiers: ["Shift"] });
  await page
    .getByRole("button", { name: "Chart selection", exact: true })
    .click();
  await expect(page.locator(".chart-document-heading")).toContainText(
    "3 live rows",
  );
  await page.getByLabel("Chart title", { exact: true }).fill(" Selected range ");
  await saveChart();
  for (const format of ["SVG", "PNG", "Data CSV"]) {
    const extension = format === "Data CSV" ? "csv" : format.toLowerCase(),
      file = path.join(results, "visual-chart." + extension);
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    }, file);
    await page.getByRole("button", { name: format, exact: true }).click();
    await expect
      .poll(async () => {
        try {
          return (await fs.stat(file)).size;
        } catch {
          return 0;
        }
      })
      .toBeGreaterThan(20);
  }

  console.log("Live Markdown and metadata query sources");
  const live = await page.evaluate(async () => {
    const v = await window.aster.createNote("Metrics/Live chart"),
      n = v.notes.find((n) => n.path === "Metrics/Live chart.md");
    return window.aster.saveNote({
      id: n.id,
      revision: n.revision,
      content:
        "---\nvalue: 5\n---\n# Live chart\n\n| Category | Value |\n| --- | --- |\n| Signal | 5 |",
    });
  });
  await expect(
    page.locator(".tree-note").filter({ hasText: "Live chart" }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "New chart", exact: true }).click();
  await page.getByLabel("Chart title", { exact: true }).fill("Live source");
  await page
    .getByLabel("Chart source type", { exact: true })
    .selectOption("markdown");
  await expect(page.locator(".chart-statistics")).toContainText("mean 5");
  await saveChart();
  const liveFile = await page.evaluate(() => window.aster.load());
  await fs.writeFile(
    path.join(liveFile.root, live.path),
    live.content.replaceAll("5", "8"),
  );
  await expect(page.locator(".chart-statistics")).toContainText("mean 8", {
    timeout: 15000,
  });
  await page
    .getByLabel("Chart source type", { exact: true })
    .selectOption("query");
  await page
    .getByLabel("Chart query", { exact: true })
    .fill('SELECT file.name, value\nFROM "Metrics"\nLIMIT 50');
  await expect(page.locator(".chart-statistics")).toContainText("mean 8");
  await saveChart();
  await page
    .getByLabel("Chart title", { exact: true })
    .fill("Live source saved on switch");
  await page.getByRole("button", { name: "Kanban", exact: true }).click();
  await expect
    .poll(async () =>
      (await page.evaluate(() => window.aster.loadModules())).state.charts.some(
        (c) => c.title === "Live source saved on switch",
      ),
    )
    .toBe(true);
  console.log("Kanban connected tasks, drag, reorder and columns");
  await page.getByRole("button", { name: "Kanban", exact: true }).click();
  await page.getByRole("button", { name: "New board", exact: true }).click();
  await page
    .getByLabel("Kanban board name", { exact: true })
    .fill("Research pipeline");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const todo = page.getByRole("region", { name: "Column To do", exact: true });
  for (const title of ["Read source", "Extract evidence"]) {
    await todo.getByRole("button", { name: "Add card", exact: true }).click();
    await page.getByLabel("Card title", { exact: true }).fill(title);
    await page
      .getByLabel("Card source note", { exact: true })
      .selectOption({ index: 1 });
    await page.getByRole("button", { name: "Save", exact: true }).click();
  }
  await page.getByTitle("Move Extract evidence up", { exact: true }).click();
  await expect(todo.locator(".kanban-card").first()).toContainText(
    "Extract evidence",
  );
  const doing = page.getByRole("region", {
    name: "Column In progress",
    exact: true,
  });
  await todo
    .locator(".kanban-card")
    .filter({ hasText: "Read source" })
    .dragTo(doing);
  await expect(doing.locator(".kanban-card")).toContainText("Read source");
  expect(
    (await page.evaluate(() => window.aster.loadModules())).state.tasks.find(
      (t) => t.title === "Read source",
    ).status,
  ).toBe("in-progress");
  await page.getByTitle("Edit column In progress", { exact: true }).click();
  await page.getByLabel("Column name", { exact: true }).fill("Investigating");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.screenshot({ path: path.join(results, "aster-kanban.png") });
  console.log(
    "Arbitrary splits, pointer resizing, movable tabs, saved layouts",
  );
  await page.getByTitle("Split pane right", { exact: true }).click();
  await expect(page.locator(".dock-pane")).toHaveCount(2);
  await page
    .getByLabel("Add view to pane", { exact: true })
    .last()
    .selectOption("calendar");
  await expect(page.locator(".calendar-cell")).toHaveCount(42);
  const divider = page.getByRole("separator").first(),
    bounds = await divider.boundingBox();
  const first = page.locator(".dock-pane").first(),
    before = (await first.boundingBox()).width;
  await page.mouse.move(bounds.x + 3, bounds.y + 60);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 130, bounds.y + 60, { steps: 12 });
  await page.mouse.up();
  await expect
    .poll(async () => (await first.boundingBox()).width)
    .toBeGreaterThan(before + 80);
  await page.getByRole("button", { name: "Save layout", exact: true }).click();
  await page.getByLabel("Layout name", { exact: true }).fill("Research desk");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save layout", exact: true })
    .click();
  await page
    .getByRole("tab", { name: "Kanban", exact: true })
    .dragTo(page.locator(".pane-tabs").last());
  await expect(page.locator(".dock-pane")).toHaveCount(1);
  await page
    .getByLabel("Open saved layout", { exact: true })
    .selectOption({ label: "Research desk" });
  await expect(page.locator(".dock-pane")).toHaveCount(2);
  console.log("Themes and restart persistence");
  for (const theme of [
    "Cyber",
    "Lavender",
    "Deep Ocean",
    "Paper",
    "Rosewood",
    "Aster",
  ]) {
    await page.getByTitle("Appearance & themes", { exact: true }).click();
    const button = page.getByRole("button", {
      name: "Use " + theme + " theme",
      exact: true,
    });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await page.getByTitle("Close dialog", { exact: true }).click();
    if (theme === "Cyber" || theme === "Lavender")
      await page.screenshot({
        path: path.join(results, "aster-theme-" + theme.toLowerCase() + ".png"),
      });
  }
  await page.screenshot({ path: path.join(results, "aster-workspace.png") });
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => window.aster.loadModules())).state.workspace
          .saved.length,
    )
    .toBe(1);
  await app.close();
  app = await electron.launch(launch);
  page = await app.firstWindow();
  page.on("pageerror", (e) => errors.push(e.message));
  await expect(page.locator(".dock-pane")).toHaveCount(2);
  await expect(page.getByLabel("Kanban board", { exact: true })).toHaveValue(
    /.+/,
  );
  const state = (await page.evaluate(() => window.aster.loadModules())).state;
  expect(state.charts).toHaveLength(3);
  expect(state.datasets).toHaveLength(3);
  expect(state.kanban[0].columns[1].title).toBe("Investigating");
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify({
      ok: true,
      packaged: !!packaged,
      checks: [
        "13 chart types",
        "worksheet formulas",
        "undo/redo",
        "CSV/XLSX import",
        "XLSX export",
        "SVG/PNG/CSV chart export",
        "selected data ranges",
        "connected Kanban",
        "card dragging/order",
        "column renaming",
        "arbitrary splits",
        "pointer resizing",
        "tab dragging",
        "saved layouts",
        "six themes",
        "restart persistence",
      ],
    }),
  );
} catch (error) {
  console.error(error);
  await page
    .screenshot({ path: path.join(results, "visual-failure.png") })
    .catch(() => {});
  throw error;
} finally {
  await app.close();
}
