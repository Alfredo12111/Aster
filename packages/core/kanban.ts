import type { KanbanBoard, ModuleState, Task } from "./modules";
export const taskStatuses: Task["status"][] = [
  "todo",
  "in-progress",
  "blocked",
  "done",
  "cancelled",
];
export const statusLabels: Record<Task["status"], string> = {
  todo: "To do",
  "in-progress": "In progress",
  blocked: "Blocked",
  done: "Done",
  cancelled: "Cancelled",
};
export function newKanban(
  name: string,
  projectId: string | null = null,
): KanbanBoard {
  const colors = ["#81a9d8", "#e6bb78", "#df8b97", "#79bfb0", "#aa9ad8"];
  return {
    id: crypto.randomUUID(),
    name,
    projectId,
    cards: [],
    columns: taskStatuses.map((status, i) => ({
      id: crypto.randomUUID(),
      title: statusLabels[status],
      status,
      color: colors[i],
    })),
  };
}
export function columnForTask(board: KanbanBoard, task: Task): string {
  const assigned = board.cards.find((c) => c.taskId === task.id),
    column = board.columns.find((c) => c.id === assigned?.columnId);
  return column?.status === task.status
    ? column.id
    : (board.columns.find((c) => c.status === task.status)?.id ?? "unmapped");
}
export function boardTasks(
  board: KanbanBoard,
  tasks: Task[],
  columnId: string,
): Task[] {
  const order = new Map(board.cards.map((c, i) => [c.taskId, i]));
  return tasks
    .filter(
      (t) =>
        (!board.projectId || t.projectId === board.projectId) &&
        columnForTask(board, t) === columnId,
    )
    .sort(
      (a, b) =>
        (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity) ||
        a.createdAt - b.createdAt ||
        a.id.localeCompare(b.id),
    );
}
export function moveKanbanTask(
  state: ModuleState,
  boardId: string,
  taskId: string,
  columnId: string,
  beforeId?: string,
) {
  if (taskId === beforeId) return;
  const board = state.kanban.find((b) => b.id === boardId),
    task = state.tasks.find((t) => t.id === taskId),
    column = board?.columns.find((c) => c.id === columnId);
  if (!board || !task || !column)
    throw new Error("The board, column or task no longer exists.");
  if (board.projectId && task.projectId !== board.projectId)
    throw new Error("This task belongs to a different project.");
  // Materialize the currently visible order before moving a previously unplaced task.
  const ordered = board.columns
    .flatMap((c) =>
      boardTasks(board, state.tasks, c.id).map((t) => ({
        taskId: t.id,
        columnId: c.id,
      })),
    )
    .filter((c) => c.taskId !== taskId);
  task.status = column.status;
  task.updatedAt = Date.now();
  let index = beforeId
    ? ordered.findIndex((c) => c.taskId === beforeId && c.columnId === columnId)
    : -1;
  if (index < 0) {
    const last = ordered.map((c) => c.columnId).lastIndexOf(columnId);
    index = last < 0 ? ordered.length : last + 1;
  }
  ordered.splice(index, 0, { taskId, columnId });
  board.cards = ordered;
}
