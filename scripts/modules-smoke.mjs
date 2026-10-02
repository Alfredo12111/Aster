import { createBasicVault } from './test-vault.mjs';
import { _electron as electron, expect } from "@playwright/test";
import electronPath from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { makePdfFixture } from "./pdf-fixture.mjs";
const results = path.resolve("test-results");
await fs.mkdir(results, { recursive: true });
const profile = path.join(results, `modules-${randomUUID()}`),
  fixture = path.join(results, "annotation-fixture.pdf");
await fs.writeFile(fixture, makePdfFixture());
const packaged = process.env.ASTER_PACKAGED_EXE;
const launchOptions = {
  executablePath: packaged ?? electronPath,
  args: packaged ? [] : ["."],
  cwd: process.cwd(),
  env: { ...process.env, ASTER_USER_DATA: profile, ASTER_INITIAL_VAULT: await createBasicVault(profile) },
  timeout: 30000,
};
let instance = await electron.launch(launchOptions);
let page = await instance.firstWindow();
await page.setViewportSize({ width: 1280, height: 720 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.setDefaultTimeout(15000);
const step = (s) => console.log(s);
try {
  await expect(page.locator(".tree-note")).toHaveCount(17);
  const seed = await page.evaluate(async () => {
    let v = await window.aster.createNote("Dataset/Parent");
    let n = v.notes.find((n) => n.title === "Parent");
    await window.aster.saveNote({
      id: n.id,
      revision: n.revision,
      content: "---\nstatus: active\ntags: [research]\n---\n# Parent",
    });
    v = await window.aster.createNote("Dataset/Child");
    n = v.notes.find((n) => n.title === "Child");
    await window.aster.saveNote({
      id: n.id,
      revision: n.revision,
      content:
        '---\nparent: "[[Parent]]"\nstatus: active\ntags: [research]\n---\n# Child',
    });
    return window.aster.load();
  });
  await page.getByTitle("Reload from disk", { exact: true }).click();
  await expect(page.locator(".tree-note")).toHaveCount(19);
  await page.getByTitle("Built-in modules", { exact: true }).click();
  await expect(page.locator(".module-cards article")).toHaveCount(7);
  for (const label of [
    "Enable Calendar",
    "Enable Tasks & Projects",
    "Enable PDF Library",
    "Enable Canvas",
    "Enable Navigator",
    "Enable Charts",
    "Enable Kanban",
  ]) {
    const toggle = page.getByRole("checkbox", { name: label, exact: true });
    await expect(toggle).toBeChecked();
  }
  await expect(page.locator(".module-save-status")).toHaveText("Local vault");
  step("All seven modules enabled by default; creating a project");
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page
    .getByLabel("Project name", { exact: true })
    .fill("Evidence pipeline");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Curated research and tasks");
  await page
    .getByLabel("Project related notes", { exact: true })
    .selectOption(seed.notes.find((n) => n.title === "Parent").id);
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await expect(page.locator(".project-notes")).toContainText("Parent");
  step("Calendar day/week/month and idempotent daily note");
  await page.getByRole("button", { name: "Calendar", exact: true }).click();
  await page.getByLabel("Calendar date", { exact: true }).fill("2028-02-29");
  await expect(page.locator(".calendar-cell")).toHaveCount(42);
  await page.getByRole("button", { name: "Week", exact: true }).click();
  await expect(page.locator(".calendar-cell")).toHaveCount(7);
  await page.getByRole("button", { name: "Day", exact: true }).click();
  await expect(page.locator(".calendar-cell")).toHaveCount(1);
  await page.screenshot({ path: path.join(results, "aster-calendar.png") });
  await page
    .getByRole("button", { name: "Open or create daily note", exact: true })
    .click();
  await expect(page.locator(".note-heading h2")).toHaveText("2028-02-29");
  step("Task creation from note and project assignment");
  await page.getByTitle("Create task from this note", { exact: true }).click();
  await page.getByLabel("Task title", { exact: true }).fill("Review evidence");
  await page.getByLabel("Due date", { exact: true }).fill("2028-02-29");
  await page.getByLabel("Task priority", { exact: true }).selectOption("high");
  await page
    .getByLabel("Task project", { exact: true })
    .selectOption({ label: "Evidence pipeline" });
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(page.locator(".task-row")).toContainText("Review evidence");
  await expect(page.locator(".task-row")).toContainText("2028-02-29");
  await page
    .getByRole("checkbox", { name: "Complete Review evidence", exact: true })
    .click();
  await expect(page.locator(".task-row")).toHaveCount(0);
  await page
    .getByLabel("Task status filter", { exact: true })
    .selectOption("all");
  await expect(page.locator(".task-row")).toHaveCount(1);
  await page
    .getByRole("checkbox", { name: "Complete Review evidence", exact: true })
    .click();
  // Return to one module pane before the legacy module navigation checks.
  await page.getByTitle("Built-in modules", { exact: true }).click();
  await expect(page.locator(".dock-pane")).toHaveCount(1);
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await page
    .locator(".projects-list")
    .getByRole("button", { name: /Evidence pipeline/ })
    .click();
  await expect(page.locator(".project-detail")).toContainText(
    "Review evidence",
  );
  await expect(page.locator(".project-notes")).toContainText("Parent");
  await page.screenshot({ path: path.join(results, "aster-projects.png") });
  step("Canvas live queries, move/resize, and external edit refresh");
  await page.getByRole("button", { name: "Canvas", exact: true }).click();
  await page.getByRole("button", { name: "New board", exact: true }).click();
  await page.getByLabel("Board name", { exact: true }).fill("Research board");
  await page.getByRole("button", { name: "Create board", exact: true }).click();
  await page
    .getByRole("button", { name: "Pin query card", exact: true })
    .click();
  await page.getByLabel("Card title", { exact: true }).fill("Active sources");
  await page
    .getByLabel("Aster query", { exact: true })
    .fill(
      'SELECT file.name, status\nFROM "Dataset"\nWHERE status = "active"\nWHERE tags contains "research"\nSORT file.name ASC\nLIMIT 50',
    );
  await page
    .getByRole("button", { name: "Save query card", exact: true })
    .click();
  await expect(page.locator(".query-card tbody tr")).toHaveCount(2);
  await page.getByTitle('Edit query Active sources',{exact:true}).click();
  await page.getByLabel('Columns',{exact:true}).fill('file.name, status, tags');
  await expect(page.getByLabel('Aster query',{exact:true})).toContainText('WHERE tags contains "research"');
  await page.getByRole('button',{name:'Save query card',exact:true}).click();
  await expect(page.locator('.query-card tbody tr')).toHaveCount(2);
  await fs.writeFile(
    path.join(seed.root, "Dataset/Child.md"),
    '---\nparent: "[[Parent]]"\nstatus: archived\ntags: [research]\n---\n# Child',
  );
  await expect(page.locator(".query-card tbody tr")).toHaveCount(1, {
    timeout: 10000,
  });
  const header = await page.locator(".query-card>header").boundingBox();
  await page.mouse.move(header.x + 100, header.y + 20);
  await page.mouse.down();
  await page.mouse.move(header.x + 170, header.y + 60, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator(".module-save-status")).toHaveText("Local vault");
  const handle = page.getByRole("button", {
    name: "Resize Active sources",
    exact: true,
  });
  await handle.focus();
  await handle.press("ArrowRight");
  await expect(page.locator(".module-save-status")).toHaveText("Local vault");
  await page
    .getByRole("button", { name: "Pin query card", exact: true })
    .click();
  await page.getByLabel("Card title", { exact: true }).fill("Daily notes");
  await page
    .getByLabel("Aster query", { exact: true })
    .fill('SELECT file.name, date\nFROM "Daily"\nLIMIT 50');
  await page
    .getByRole("button", { name: "Save query card", exact: true })
    .click();
  await expect(page.locator(".query-card")).toHaveCount(2);
  await page.screenshot({ path: path.join(results, "aster-canvas.png") });
  step("Hierarchy from metadata, folder and field filters");
  await page.getByRole("button", { name: "Navigator", exact: true }).click();
  await page.getByRole("button", { name: "Expand all", exact: true }).click();
  await page
    .getByLabel("Navigator folder", { exact: true })
    .selectOption("Dataset");
  await expect(page.locator(".hierarchy-row")).toHaveCount(2);
  await page.getByLabel("Search hierarchy", { exact: true }).fill("Child");
  await expect(page.locator(".hierarchy-row")).toHaveCount(2);
  await expect(page.locator(".hierarchy-row").first()).toContainText("Parent");
  await page.getByLabel("Search hierarchy", { exact: true }).fill("");
  await page
    .getByLabel("Metadata field", { exact: true })
    .selectOption("status");
  await page.getByLabel("Metadata value", { exact: true }).fill("archived");
  await expect(page.locator(".hierarchy-row")).toHaveCount(2);
  await page.screenshot({ path: path.join(results, "aster-navigator.png") });
  step("PDF import and rendering");
  const sidebarColor = await page
    .locator(".sidebar")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  await instance.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, fixture);
  await page.getByRole("button", { name: "PDF Library", exact: true }).click();
  await page.getByRole("button", { name: "Import PDF", exact: true }).click();
  await expect(page.locator(".textLayer span").first()).toBeVisible({
    timeout: 20000,
  });
  await expect(page.locator(".pdf-pagination")).toContainText("/ 3");
  expect(
    await page
      .locator(".sidebar")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe(sidebarColor);
  const selectText = async (index = 0) => {
    await expect(page.locator('.pdf-instructions')).not.toContainText('Rendering');
    await expect(page.locator('.pdf-page')).not.toHaveCSS('pointer-events', 'none');
    // The viewer centers a newly loaded annotation on the next animation frame.
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const span = page.locator(".textLayer span").nth(index);
    // Center the line below the sticky PDF instructions. Nearest-edge scrolling
    // can leave text covered by that header on a short CI desktop.
    await span.evaluate(el => el.scrollIntoView({block: 'center', inline: 'center'}));
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const b = await span.boundingBox();
    const vertical = b.height > b.width;
    await page.mouse.move(
      vertical ? b.x + b.width / 2 : b.x + 2,
      vertical ? b.y + 2 : b.y + b.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      vertical ? b.x + b.width / 2 : b.x + b.width - 2,
      vertical ? b.y + b.height - 2 : b.y + b.height / 2,
      { steps: 10 },
    );
    // Chromium can paint the final drag selection after the mouse-move command
    // resolves. Release only after the real browser selection covers the line;
    // the small pointer inset may omit a boundary punctuation glyph.
    const text = (await span.textContent()).trim();
    await expect.poll(() => page.evaluate(() => window.getSelection()?.toString().trim()))
      .toContain(text.slice(1, -1));
    await page.mouse.up();
  };
  step("Text highlight, underline, strikeout and area comments");
  await page.getByTitle("Highlight text", { exact: true }).click();
  await selectText(0);
  await expect(page.locator(".annotation-entry")).toHaveCount(1);
  await page.getByTitle("Underline text", { exact: true }).click();
  await selectText(1);
  await expect(page.locator(".annotation-entry")).toHaveCount(2);
  await page.getByTitle("Strike through text", { exact: true }).click();
  await selectText(2);
  await expect(page.locator(".annotation-entry")).toHaveCount(3);
  await page.getByTitle("Comment on an area", { exact: true }).click();
  const paper = await page.locator(".pdf-page").boundingBox();
  await page.mouse.move(paper.x + 70, paper.y + 220);
  await page.mouse.down();
  await page.mouse.move(paper.x + 280, paper.y + 280, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator(".annotation-entry")).toHaveCount(4);
  await page
    .getByLabel("Annotation comment", { exact: true })
    .fill("Evidence to follow up");
  await page.getByRole("button", { name: "Save comment", exact: true }).click();
  await expect(page.locator(".annotation-entry").last()).toContainText(
    "Evidence to follow up",
  );
  step("Freehand drawing, undo/redo and offscreen annotation navigation");
  await page.getByTitle("Next PDF page", { exact: true }).click();
  await expect(page.locator(".pdf-page")).toHaveAttribute(
    "data-page-number",
    "2",
  );
  await expect(page.locator(".textLayer span").first()).toBeVisible();
  await page.getByTitle("Freehand ink", { exact: true }).click();
  const paper2 = await page.locator(".pdf-page").boundingBox();
  await page.mouse.move(paper2.x + 60, paper2.y + 65);
  await page.mouse.down();
  await page.mouse.move(paper2.x + 120, paper2.y + 95, { steps: 5 });
  await page.mouse.move(paper2.x + 190, paper2.y + 70, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator(".annotation-entry")).toHaveCount(5);
  await page.getByTitle("Undo annotation", { exact: true }).click();
  await expect(page.locator(".annotation-entry")).toHaveCount(4);
  await page.getByTitle("Redo annotation", { exact: true }).click();
  await expect(page.locator(".annotation-entry")).toHaveCount(5);
  await page
    .getByRole("button", { name: "highlight on page 1", exact: true })
    .click();
  await expect(page.locator(".pdf-page")).toHaveAttribute(
    "data-page-number",
    "1",
  );
  await expect(
    page.locator("[data-annotation-id].annotation-selected"),
  ).toHaveCount(1);
  await page.getByTitle("Zoom in PDF", { exact: true }).click();
  await page.getByTitle("Rotate PDF view", { exact: true }).click();
  await expect(page.locator(".textLayer")).toHaveAttribute(
    "data-main-rotation",
    "90",
  );
  await expect(page.locator(".textLayer span").first()).toBeVisible();
  await expect(page.locator(".pdf-instructions")).not.toContainText(
    "Rendering",
  );
  const textBox = await page.locator(".textLayer span").first().boundingBox();
  const markBox = await page
    .locator(".annotation-selected polygon")
    .first()
    .boundingBox();
  expect(Math.abs(textBox.x - markBox.x)).toBeLessThan(5);
  expect(Math.abs(textBox.y - markBox.y)).toBeLessThan(5);
  expect(Math.abs(textBox.height - markBox.height)).toBeLessThan(8);
  await page.screenshot({ path: path.join(results, "aster-pdf-rotated.png") });
  const saved = await page.evaluate(() => window.aster.loadModules());
  expect(
    saved.state.documents[0].annotations.map((a) => a.kind).sort(),
  ).toEqual(["comment", "highlight", "ink", "strikeout", "underline"]);
  expect(saved.state.boards[0].cards[0].x).toBeGreaterThan(35);
  expect(saved.state.boards[0].cards[0].width).toBeGreaterThan(450);
  step("Module disable/re-enable and PDF reopen");
  await page.getByTitle("Manage modules", { exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Enable Calendar", exact: true })
    .click();
  await expect(
    page
      .locator(".module-nav")
      .getByRole("button", { name: "Calendar", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("checkbox", { name: "Enable Calendar", exact: true })
    .click();
  await page.getByRole("button", { name: "PDF Library", exact: true }).click();
  await expect(page.locator(".annotation-entry")).toHaveCount(5);
  await page
    .getByRole("button", { name: "ink on page 2", exact: true })
    .click();
  await expect(page.locator(".pdf-page")).toHaveAttribute(
    "data-page-number",
    "2",
  );
  await expect(page.locator(".annotation-selected polyline")).toBeVisible();
  await page.screenshot({ path: path.join(results, "aster-pdf.png") });
  step("Markup created on rotated and cropped pages");
  // Fit the long vertical text line inside the shorter docked PDF viewport.
  for(let i=0;i<3;i++)await page.getByTitle("Zoom out PDF",{exact:true}).click();
  await page.getByTitle("Underline text", { exact: true }).click();
  await selectText(0);
  await expect(page.locator(".annotation-entry")).toHaveCount(6);
  const underline = await page
    .locator(".annotation-selected line")
    .first()
    .boundingBox();
  expect(underline.height).toBeGreaterThan(100);
  expect(underline.width).toBeLessThan(5);
  for(let i=0;i<3;i++)await page.getByTitle("Zoom in PDF",{exact:true}).click();
  await page.getByTitle("Next PDF page", { exact: true }).click();
  await expect(page.locator(".pdf-page")).toHaveAttribute(
    "data-page-number",
    "3",
  );
  await expect(page.locator(".textLayer span").first()).toContainText(
    "Third page",
  );
  await page.getByTitle("Highlight text", { exact: true }).click();
  await selectText(0);
  await expect(page.locator(".annotation-entry")).toHaveCount(7);
  await page
    .getByLabel("Annotation comment", { exact: true })
    .fill("Cropped-page evidence");
  await page.getByRole("button", { name: "Save comment", exact: true }).click();
  await expect(page.locator(".annotation-entry").last()).toContainText(
    "Cropped-page evidence",
  );
  await page.getByTitle("Delete annotation", { exact: true }).click();
  await expect(page.locator(".annotation-entry")).toHaveCount(6);
  await page.getByTitle("Undo annotation", { exact: true }).click();
  await expect(page.locator(".annotation-entry")).toHaveCount(7);
  await page
    .getByLabel("Search annotations", { exact: true })
    .fill("Cropped-page");
  await expect(page.locator(".annotation-entry")).toHaveCount(1);
  await page
    .getByRole("button", { name: "highlight on page 3", exact: true })
    .click();
  const croppedPoints = await page
    .locator(".annotation-selected polygon")
    .first()
    .getAttribute("points");
  const persisted = await page.evaluate(() => window.aster.loadModules());
  await expect(page.locator(".module-save-status")).toHaveText("Local vault");
  expect(errors).toEqual([]);
  step(
    "Full desktop restart preserves records, card geometry and PDF coordinates",
  );
  await instance.close();
  instance = await electron.launch(launchOptions);
  page = await instance.firstWindow();
  await page.setViewportSize({ width: 1280, height: 720 });
  page.on("pageerror", (e) => errors.push(e.message));
  page.setDefaultTimeout(15000);
  await expect(page.locator(".tree-note")).toHaveCount(20);
  await expect(page.locator(".annotation-entry")).toHaveCount(7);
  expect((await page.evaluate(() => window.aster.loadModules())).state).toEqual(
    persisted.state,
  );
  await page.getByRole("button", { name: "PDF Library", exact: true }).click();
  await expect(page.locator(".annotation-entry")).toHaveCount(7);
  await page
    .getByRole("button", { name: "highlight on page 3", exact: true })
    .click();
  await expect(page.locator(".textLayer span").first()).toContainText(
    "Third page",
  );
  await expect(
    page.locator(".annotation-selected polygon").first(),
  ).toHaveAttribute("points", croppedPoints);
  await expect(
    page.getByLabel("Annotation comment", { exact: true }),
  ).toHaveValue("Cropped-page evidence");
  await page.screenshot({
    path: path.join(results, "aster-pdf-restarted.png"),
  });
  expect(errors).toEqual([]);
  step(
    "Large-vault navigator renders a bounded row window and resets filtered scrolling",
  );
  await fs.mkdir(path.join(seed.root, "Bulk"), { recursive: true });
  for (let offset = 0; offset < 1500; offset += 100)
    await Promise.all(
      Array.from({ length: 100 }, (_, j) =>
        fs.writeFile(
          path.join(
            seed.root,
            "Bulk",
            `Bulk${String(offset + j).padStart(4, "0")}.md`,
          ),
          `---\nstatus: indexed\n---\n# Bulk ${offset + j}\n`,
        ),
      ),
    );
  await page.getByRole("button", { name: "Navigator", exact: true }).click();
  await expect(
    page
      .getByLabel("Navigator folder", { exact: true })
      .locator("option", { hasText: "Bulk" }),
  ).toHaveCount(1, { timeout: 30000 });
  await page
    .getByLabel("Navigator folder", { exact: true })
    .selectOption("Bulk");
  await expect(page.locator(".navigator-search")).toContainText("1500 notes");
  expect(await page.locator(".hierarchy-row").count()).toBeLessThanOrEqual(38);
  await page.locator(".hierarchy-viewport").evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(page.locator(".hierarchy-row").last()).toContainText("Bulk1499");
  await page.getByLabel("Search hierarchy", { exact: true }).fill("Bulk1499");
  await expect(page.locator(".hierarchy-row")).toHaveCount(1);
  await expect(page.locator(".hierarchy-row").first()).toBeInViewport();
  await page.screenshot({
    path: path.join(results, "aster-navigator-large.png"),
  });
  step('Creating a task from a note enables the disabled task module');
  await page.getByTitle('Manage modules',{exact:true}).click();
  await page.getByRole('checkbox',{name:'Enable Tasks & Projects',exact:true}).click();
  await expect(page.getByRole('checkbox',{name:'Enable Tasks & Projects',exact:true})).not.toBeChecked();
  await page.getByRole('button',{name:'Write',exact:true}).click();
  await page.getByTitle('Create task from this note',{exact:true}).click();
  await page.getByLabel('Task title',{exact:true}).fill('Task enables its module');
  await page.getByRole('button',{name:'Save task',exact:true}).click();
  await expect(page.locator('.task-row')).toContainText(['Review evidence','Task enables its module']);
  expect((await page.evaluate(()=>window.aster.loadModules())).state.enabled.tasks).toBe(true);
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify({
      ok: true,
      packaged: !!packaged,
      profile,
      checks: [
        "optional modules",
        "project notes",
        "calendar views",
        "daily note",
        "tasks from notes",
        "task fields/completion/project",
        "live Canvas queries",
        "external-file refresh",
        "card move/resize",
        "metadata hierarchy filters",
        "PDF rendering",
        "highlight",
        "underline",
        "strikeout",
        "comment",
        "freehand",
        "undo/redo",
        "annotation navigation",
        "zoom/rotation",
        "PDF reopening",
        "rotated/cropped markup geometry",
        "annotation search/edit/delete/undo",
        "full application restart",
        "1500-note navigator virtualization",
        "query builder preserves additional filters",
        "note action enables Tasks",
      ],
    }),
  );
} catch (e) {
  console.error(e);
  await page
    .screenshot({ path: path.join(results, "modules-failure.png") })
    .catch(() => {});
  throw e;
} finally {
  await instance.close();
}
