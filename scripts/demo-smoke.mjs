import { _electron as electron, expect } from "@playwright/test";
import electronPath from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const results = path.resolve("test-results"),
  profile = path.join(results, "demo-" + randomUUID());
await fs.mkdir(results, { recursive: true });
const packaged = process.env.ASTER_PACKAGED_EXE;
const env = { ...process.env, ASTER_USER_DATA: profile };
delete env.ASTER_INITIAL_VAULT;
const launch = {
  executablePath: packaged ?? electronPath,
  args: packaged ? [] : ["."],
  cwd: process.cwd(),
  env,
  timeout: 30000,
};
let app = await electron.launch(launch),
  page = await app.firstWindow();
const errors = [];
const setup = async () => {
  page.setDefaultTimeout(20000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1800, height: 1120 });
};
await setup();
const button = (name) => page.getByRole("button", { name, exact: true });
const saved = async () =>
  expect
    .poll(() =>
      page.evaluate(() =>
        window.dispatchEvent(new Event("beforeunload", { cancelable: true })),
      ),
    )
    .toBe(true);
const shot = async (name) => {
  await expect(page.locator(".module-error, .error-banner")).toHaveCount(0);
  await page.screenshot({ path: path.join(results, `pelagic-${name}.png`) });
};
const layout = async (name) => {
  await saved();
  await page.getByLabel("Open saved layout").selectOption({ label: name });
  await saved();
};
try {
  await expect(page.locator(".tree-note")).toHaveCount(128, { timeout: 20000 });
  const initial = await page.evaluate(async () => ({
    v: await window.aster.load(),
    m: await window.aster.loadModules(),
  }));
  expect(initial.v.name).toBe("Pelagic Labs");
  expect(initial.m.state.resources).toHaveLength(40);
  expect(initial.m.state.tasks).toHaveLength(42);
  expect(initial.m.state.charts).toHaveLength(15);
  expect(Object.values(initial.m.state.enabled).every(Boolean)).toBe(true);
  await expect(page.locator("canvas")).toBeVisible();
  await shot("graph");
  await page.getByTitle("Hide inspector", { exact: true }).click();
  console.log("First launch: 128 notes, 40 tool nodes, 15 charts, 42 tasks");
  await layout("Mission control");
  await button("Read formatted note").click();
  await expect(page.locator(".markdown-preview")).toContainText(
    "Six ways to explore",
  );
  await shot("mission");
  await layout("Data studio");
  await expect(page.locator(".chart-document-heading").first()).toContainText(
    "Nursery before and after",
  );
  await expect(page.locator(".dataset-editor")).toBeVisible();
  await expect(page.locator(".module-loading")).toHaveCount(0);
  await expect(page.locator(".chart-plot svg")).toBeVisible();
  await shot("data");
  await layout("Launch room");
  await expect(page.locator(".kanban-card")).toHaveCount(7);
  await shot("launch");
  const board = initial.m.state.kanban[0],
    column = board.columns.find((c) => c.status === "in-progress");
  await page
    .getByLabel("Move Inspect L-07 spare connector to column", { exact: true })
    .selectOption(column.id);
  await saved();
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          (await window.aster.loadModules()).state.tasks.find(
            (t) => t.title === "Inspect L-07 spare connector",
          ).status,
      ),
    )
    .toBe("in-progress");
  console.log("Kanban updates the underlying project task");
  await layout("Evidence desk");
  await expect(page.locator(".pdf-page canvas")).toBeVisible();
  await expect(page.locator(".pdf-instructions")).not.toContainText(
    "Rendering page",
  );
  await expect(page.locator(".textLayer span").first()).toBeVisible();
  await page.getByTitle("Zoom out PDF", { exact: true }).click();
  await expect(page.locator(".pdf-instructions")).not.toContainText(
    "Rendering page",
  );
  await expect(page.locator(".annotation-entry")).toHaveCount(
    initial.m.state.documents[0].annotations.length,
  );
  await button("Read formatted note").click();
  await shot("evidence");
  await page
    .getByRole("button", { name: "comment on page 2", exact: true })
    .click();
  await expect(page.getByLabel("PDF page", { exact: true })).toHaveValue("2");
  await expect(page.locator(".pdf-annotation-overlay")).toBeVisible();
  await shot("annotation");
  await layout("Research tree");
  await expect(page.getByLabel("Tree hierarchy")).toBeVisible();
  await page.getByLabel("Tree hierarchy").selectOption("parents");
  await page.getByLabel("Filter graph", { exact: true }).fill("path:Farwater");
  await button("Fit tree").click();
  await page.getByLabel("Search hierarchy").fill("Farwater");
  await button("Expand all").click();
  await shot("tree");
  await layout("Ocean watch");
  await expect(page.locator(".query-card")).toHaveCount(4);
  await expect(page.locator(".module-loading")).toHaveCount(0);
  await shot("canvas");
  const station = initial.v.notes.find((n) => n.title === "Station L-07");
  await page.evaluate(async (n) => {
    await window.aster.saveNote({
      id: n.id,
      revision: n.revision,
      content: n.content.replace("readiness: 62", "readiness: 74"),
    });
  }, station);
  await expect(
    page.locator(".query-card").filter({ hasText: "Station gates" }),
  ).toContainText("74");
  console.log("Saved note metadata refreshes the live Canvas query");
  await saved();
  await app.close();
  app = await electron.launch(launch);
  page = await app.firstWindow();
  await setup();
  await expect(page.locator(".tree-note")).toHaveCount(128);
  await button("Open demo").click();
  await expect(page.locator(".tree-note")).toHaveCount(128);
  const persisted = await page.evaluate(async () => ({
    v: await window.aster.load(),
    m: await window.aster.loadModules(),
  }));
  expect(persisted.v.id).toBe(initial.v.id);
  expect(
    persisted.v.notes.find((n) => n.id === station.id).metadata.readiness,
  ).toBe(74);
  expect(
    persisted.m.state.tasks.find(
      (t) => t.title === "Inspect L-07 spare connector",
    ).status,
  ).toBe("in-progress");
  // An existing ordinary vault stays selected across a normal restart.
  const ordinary = path.join(profile, "My existing vault");
  await fs.mkdir(ordinary);
  await fs.writeFile(
    path.join(ordinary, "Personal draft.md"),
    "# Preserved draft",
  );
  await app.evaluate(({ dialog }, root) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [root],
    });
  }, ordinary);
  await button("Open").click();
  await expect(page.locator(".tree-note")).toHaveCount(1);
  await saved();
  await app.close();
  app = await electron.launch(launch);
  page = await app.firstWindow();
  await setup();
  await expect(page.locator(".tree-note")).toHaveCount(1);
  expect((await page.evaluate(() => window.aster.load())).root).toBe(ordinary);
  await button("Open demo").click();
  await expect(page.locator(".tree-note")).toHaveCount(128);
  expect(
    await fs.readFile(path.join(ordinary, "Personal draft.md"), "utf8"),
  ).toBe("# Preserved draft");
  expect(errors).toEqual([]);
  console.log(
    "Demo edits survive restart and reopening; existing vaults remain untouched",
  );
} catch (e) {
  await page
    .screenshot({ path: path.join(results, "pelagic-failure.png") })
    .catch(() => {});
  console.error("Renderer errors:", errors);
  throw e;
} finally {
  await app.close();
}
