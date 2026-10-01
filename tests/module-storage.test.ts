import { beforeEach, afterEach, it, expect } from "vitest";
import * as fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { VaultRepository } from "../packages/storage-fs/vault";
let root: string, repo: VaultRepository;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "aster-modules-"));
  repo = new VaultRepository(root);
  await repo.initialize();
});
afterEach(async () => {
  if (
    path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep) &&
    path.basename(root).startsWith("aster-modules-")
  )
    await fs.rm(root, { recursive: true, force: true });
});
it("creates daily notes idempotently and preserves user edits plus date metadata", async () => {
  const m = await repo.loadModules();
  const first = await repo.openDailyNote({
    vaultId: m.vaultId,
    date: "2024-02-29",
  });
  const n = first.vault.notes[0];
  expect(n.metadata?.date).toBe("2024-02-29");
  await repo.saveNote({
    id: n.id,
    revision: n.revision,
    content: n.content + "Keep my text",
  });
  const second = await repo.openDailyNote({
    vaultId: m.vaultId,
    date: "2024-02-29",
  });
  expect(second.noteId).toBe(first.noteId);
  expect(second.vault.notes[0].content).toContain("Keep my text");
  await expect(
    repo.openDailyNote({ vaultId: randomUUID(), date: "2024-02-29" }),
  ).rejects.toThrow("active vault");
});
it("round-trips tasks, projects, boards and optional flags while rejecting stale sidecar writes", async () => {
  const snap = await repo.loadModules();
  const projectId = randomUUID();
  snap.state.enabled.tasks = true;
  snap.state.projects.push({
    id: projectId,
    name: "Research",
    description: "Evidence",
    noteIds: [],
    createdAt: 1,
  });
  snap.state.tasks.push({
    id: randomUUID(),
    title: "Review",
    noteId: null,
    excerpt: "",
    due: "2026-10-05",
    status: "in-progress",
    priority: "high",
    projectId,
    createdAt: 1,
    updatedAt: 1,
  });
  snap.state.boards.push({
    id: randomUUID(),
    name: "Research",
    cards: [
      {
        id: randomUUID(),
        title: "Sources",
        query: "SELECT file.name",
        x: 10,
        y: 20,
        width: 400,
        height: 300,
      },
    ],
  });
  const saved = await repo.saveModules(snap);
  await expect(repo.saveModules(snap)).rejects.toThrow("changed outside");
  const reopened = new VaultRepository(root);
  await reopened.initialize();
  expect((await reopened.loadModules()).state).toEqual(saved.state);
  saved.state.enabled.tasks = false;
  await repo.saveModules(saved);
  expect((await repo.loadModules()).state.tasks).toHaveLength(1);
  expect(
    (await fs.readdir(path.join(root, ".aster/module-history"))).length,
  ).toBeGreaterThan(0);
});
it("keeps PDF annotations tied to an exact document revision and rejects changed bytes", async () => {
  const source = path.join(root, "original.pdf");
  await fs.writeFile(source, "%PDF-1.7\nTest fixture");
  let m = await repo.importPdf(source);
  const doc = m.state.documents[0];
  doc.annotations.push({
    id: randomUUID(),
    page: 2,
    kind: "highlight",
    color: "#ffaa00",
    width: 2,
    quads: [
      [
        { x: 10, y: 20 },
        { x: 40, y: 20 },
        { x: 40, y: 35 },
        { x: 10, y: 35 },
      ],
    ],
    points: [],
    quote: "Evidence",
    comment: "Useful",
    createdAt: 1,
    updatedAt: 1,
  });
  m = await repo.saveModules(m);
  expect(
    (await repo.readPdf({ vaultId: m.vaultId, documentId: doc.id }))
      .fingerprint,
  ).toBe(doc.fingerprint);
  const reopened = new VaultRepository(root);
  await reopened.initialize();
  expect((await reopened.loadModules()).state.documents[0].annotations).toEqual(
    doc.annotations,
  );
  await fs.writeFile(path.join(root, doc.path), "%PDF-1.7\nDifferent revision");
  await expect(
    repo.readPdf({ vaultId: m.vaultId, documentId: doc.id }),
  ).rejects.toThrow("changed on disk");
});
it("preserves invalid module sidecars instead of overwriting them", async () => {
  await fs.writeFile(path.join(root, ".aster/modules.json"), "invalid");
  await expect(repo.loadModules()).rejects.toThrow("preserved");
  expect(
    await fs.readFile(path.join(root, ".aster/modules.json"), "utf8"),
  ).toBe("invalid");
});

it("normalizes Windows daily-folder paths and rejects paths outside the vault", async () => {
  let snapshot = await repo.loadModules();
  snapshot.state.calendar.dailyFolder = "Journal\\Daily";
  snapshot = await repo.saveModules(snapshot);
  const daily = await repo.openDailyNote({
    vaultId: snapshot.vaultId,
    date: "2026-10-01",
  });
  expect(daily.vault.notes[0].path).toBe("Journal/Daily/2026-10-01.md");
  snapshot.state.calendar.dailyFolder = "../outside";
  await expect(repo.saveModules(snapshot)).rejects.toThrow("relative path");
  expect((await repo.loadModules()).state.calendar.dailyFolder).toBe(
    "Journal/Daily",
  );
});

it("rejects duplicate entity identities and keeps the previous version readable", async () => {
  const snapshot = await repo.loadModules();
  const project = {
    id: randomUUID(),
    name: "Evidence",
    description: "",
    noteIds: [],
    createdAt: 1,
  };
  snapshot.state.projects.push(project, { ...project });
  await expect(repo.saveModules(snapshot)).rejects.toThrow(
    "Duplicate project IDs",
  );
  expect((await repo.loadModules()).state.projects).toHaveLength(0);
});

it("deduplicates PDF imports by bytes and preserves pre-import recovery history", async () => {
  const source = path.join(root, "original.pdf");
  await fs.writeFile(source, "%PDF-1.7\nFixture");
  const before = await repo.loadModules();
  const first = await repo.importPdf(source);
  const second = await repo.importPdf(source);
  expect(second.revision).toBe(first.revision);
  expect(second.state.documents).toHaveLength(1);
  const old = JSON.parse(
    await fs.readFile(
      path.join(root, ".aster/module-history", before.revision + ".json"),
      "utf8",
    ),
  );
  expect(old.documents).toHaveLength(0);
  first.state.documents[0].annotations.push({
    id: randomUUID(),
    page: 1,
    kind: "ink",
    color: "#ffaa00",
    width: 2,
    points: [],
    quads: [],
    quote: "",
    comment: "",
    createdAt: 1,
    updatedAt: 1,
  });
  await expect(repo.saveModules(first)).rejects.toThrow("geometry");
  expect(
    (await repo.loadModules()).state.documents[0].annotations,
  ).toHaveLength(0);
});
