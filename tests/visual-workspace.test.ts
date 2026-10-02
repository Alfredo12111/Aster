import { it, expect } from "vitest";
import {
  emptyModuleState,
  moduleStateSchema,
  taskSchema,
} from "../packages/core/modules";
import {
  makePane,
  moveTab,
  leaves,
  layoutSchema,
  type Layout,
} from "../packages/core/workspace";
import {
  newKanban,
  moveKanbanTask,
  boardTasks,
  columnForTask,
} from "../packages/core/kanban";
const task = (title: string, createdAt: number) =>
  taskSchema.parse({
    id: crypto.randomUUID(),
    title,
    createdAt,
    updatedAt: createdAt,
    noteId: null,
    due: null,
    status: "todo",
    priority: "normal",
    projectId: null,
  });
it("migrates older module sidecars without changing their data", () => {
  const state: any = emptyModuleState();
  delete state.charts;
  delete state.datasets;
  delete state.kanban;
  delete state.workspace;
  delete state.enabled.charts;
  delete state.enabled.kanban;
  state.enabled.pdf = false;
  const parsed = moduleStateSchema.parse(state);
  expect(parsed.charts).toEqual([]);
  expect(parsed.workspace.theme).toBe("aster");
  expect(parsed.enabled.charts).toBe(true);
  expect(parsed.enabled.kanban).toBe(true);
  expect(parsed.enabled.pdf).toBe(false);
});
it("only gives text tabs a note identity when creating workspace presets", () => {
  const noteId = crypto.randomUUID();
  expect(makePane("note", noteId).tabs[0].noteId).toBe(noteId);
  expect(makePane("graph", noteId).tabs[0].noteId).toBeUndefined();
  expect(makePane("modules", noteId).tabs[0].noteId).toBeUndefined();
});
it("moves tabs between nested panes, collapses empty panes and preserves tab identities", () => {
  const a = makePane("graph"),
    b = makePane("calendar"),
    c = makePane("pdf");
  const root: Layout = {
    id: crypto.randomUUID(),
    type: "split",
    axis: "horizontal",
    ratio: 0.6,
    first: a,
    second: {
      id: crypto.randomUUID(),
      type: "split",
      axis: "vertical",
      ratio: 0.4,
      first: b,
      second: c,
    },
  };
  const moved = moveTab(root, b.tabs[0].id, a.id, 0);
  expect(leaves(moved)).toHaveLength(2);
  expect(leaves(moved)[0].tabs.map((t) => t.kind)).toEqual([
    "calendar",
    "graph",
  ]);
  expect(layoutSchema.parse(moved)).toEqual(moved);
  expect(leaves(moved)[1].tabs[0].kind).toBe("pdf");
  expect(layoutSchema.safeParse({ ...moved, ratio: 1.2 }).success).toBe(false);
  expect(
    layoutSchema.safeParse({ ...a, tabs: [...a.tabs, a.tabs[0]] }).success,
  ).toBe(false);
});
it("keeps board ordering, task status and external task edits connected", () => {
  const state = emptyModuleState(),
    board = newKanban("Research"),
    a = task("First", 1),
    b = task("Second", 2),
    c = task("Third", 3);
  state.kanban.push(board);
  state.tasks.push(a, b, c);
  const todo = board.columns[0].id,
    doing = board.columns[1].id;
  moveKanbanTask(state, board.id, c.id, todo, a.id);
  expect(boardTasks(board, state.tasks, todo).map((t) => t.title)).toEqual([
    "Third",
    "First",
    "Second",
  ]);
  moveKanbanTask(state, board.id, c.id, todo, c.id);
  expect(boardTasks(board, state.tasks, todo)[0].id).toBe(c.id);
  moveKanbanTask(state, board.id, a.id, doing);
  expect(a.status).toBe("in-progress");
  expect(boardTasks(board, state.tasks, doing)[0].id).toBe(a.id);
  a.status = "done";
  expect(columnForTask(board, a)).toBe(board.columns[3].id);
  const restricted = newKanban("Project", crypto.randomUUID());
  state.kanban.push(restricted);
  expect(() =>
    moveKanbanTask(state, restricted.id, a.id, restricted.columns[0].id),
  ).toThrow("different project");
});
