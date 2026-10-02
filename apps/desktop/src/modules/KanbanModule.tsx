import { useState } from "react";
import {
  Plus,
  GripVertical,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  FileText,
} from "lucide-react";
import {
  type KanbanColumn,
  type Task,
  taskSchema,
} from "../../../../packages/core/modules";
import {
  boardTasks,
  columnForTask,
  moveKanbanTask,
  newKanban,
  statusLabels,
  taskStatuses,
} from "../../../../packages/core/kanban";
import type { ModuleProps } from "./ModuleHost";
import ModuleDialog from "./ModuleDialog";

export default function KanbanModule({
  vault,
  state,
  commit,
  onOpen,
}: ModuleProps) {
  const [boardId, setBoardId] = useState(""),
    [search, setSearch] = useState(""),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState<
      "board" | "rename" | "column" | "task" | "delete-board" | null
    >(null),
    [name, setName] = useState(""),
    [projectId, setProjectId] = useState("");
  const [column, setColumn] = useState<KanbanColumn | null>(null),
    [task, setTask] = useState<Task | null>(null),
    [taskColumn, setTaskColumn] = useState(""),
    [hover, setHover] = useState("");
  const board = state.kanban.find((b) => b.id === boardId) ?? state.kanban[0];
  const perform = async (fn: () => Promise<void>) => {
    setSaving(true);
    setError("");
    try {
      await fn();
      return true;
    } catch (e) {
      setError(String(e));
      return false;
    } finally {
      setSaving(false);
    }
  };
  const move = (taskId: string, columnId: string, beforeId?: string) =>
    void perform(() =>
      commit((s) => moveKanbanTask(s, board.id, taskId, columnId, beforeId)),
    );
  const newTask = (columnId: string) => {
    const col = board.columns.find((c) => c.id === columnId)!;
    setTask({
      id: crypto.randomUUID(),
      title: "",
      noteId: null,
      excerpt: "",
      due: null,
      status: col.status,
      priority: "normal",
      projectId: board.projectId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setTaskColumn(columnId);
    setDialog("task");
  };
  const submit = async () => {
    const ok = await perform(async () => {
      if (dialog === "board") {
        const next = newKanban(name.trim(), projectId || null);
        if (!next.name) throw new Error("Give the board a name.");
        await commit((s) => {
          s.kanban.push(next);
          s.enabled.tasks = true;
        });
        setBoardId(next.id);
      }
      if (dialog === "rename")
        await commit((s) => {
          const b = s.kanban.find((b) => b.id === board.id)!;
          b.name = name.trim();
          b.projectId = projectId || null;
        });
      if (dialog === "column" && column)
        await commit((s) => {
          const b = s.kanban.find((b) => b.id === board.id)!;
          const i = b.columns.findIndex((c) => c.id === column.id);
          if (i < 0) b.columns.push(column);
          else b.columns[i] = column;
        });
      if (dialog === "task" && task)
        await commit((s) => {
          const parsed = taskSchema.parse({ ...task, updatedAt: Date.now() }),
            i = s.tasks.findIndex((t) => t.id === task.id);
          if (i >= 0 && s.tasks[i].updatedAt !== task.updatedAt)
            throw new Error(
              "This task changed in another view. Close and reopen the card before editing.",
            );
          if (i < 0) {
            s.tasks.push(parsed);
            if (taskColumn) {
              const b = s.kanban.find((b) => b.id === board.id)!;
              if (!b.columns.some((c) => c.id === taskColumn))
                throw new Error("This column was removed.");
              b.cards.push({ taskId: task.id, columnId: taskColumn });
            }
          } else s.tasks[i] = parsed;
          s.enabled.tasks = true;
        });
      if (dialog === "delete-board")
        await commit((s) => {
          s.kanban = s.kanban.filter((b) => b.id !== board.id);
        });
    });
    if (ok) setDialog(null);
  };
  const filtered = (columnId: string) =>
    boardTasks(board, state.tasks, columnId).filter((t) =>
      (t.title + " " + t.excerpt).toLowerCase().includes(search.toLowerCase()),
    );
  const drop = (e: React.DragEvent, columnId: string, beforeId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    setHover("");
    const id = e.dataTransfer.getData("application/aster-task");
    if (id) move(id, columnId, beforeId);
  };
  const unmatched = board ? filtered("unmapped") : [];
  return (
    <div className="kanban-module module-content">
      <div className="module-page-heading">
        <div>
          <span className="eyebrow">WORK IN MOTION</span>
          <h1>Kanban</h1>
          <p>One task, every view. Move work without losing its context.</p>
        </div>
        <button
          className="primary"
          onClick={() => {
            setName("");
            setProjectId("");
            setDialog("board");
          }}
        >
          <Plus size={15} />
          New board
        </button>
      </div>
      {error && (
        <div role="alert" className="module-error">
          {error}
        </div>
      )}
      {board ? (
        <>
          <div className="kanban-toolbar">
            <select
              aria-label="Kanban board"
              value={board.id}
              onChange={(e) => setBoardId(e.target.value)}
            >
              {state.kanban.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <button
              title="Edit Kanban board"
              onClick={() => {
                setName(board.name);
                setProjectId(board.projectId ?? "");
                setDialog("rename");
              }}
            >
              <Pencil size={14} />
            </button>
            <input
              aria-label="Filter Kanban cards"
              placeholder="Find a card…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              onClick={() => {
                setColumn({
                  id: crypto.randomUUID(),
                  title: "New column",
                  status: "todo",
                  color: "#81a9d8",
                });
                setDialog("column");
              }}
            >
              <Plus size={14} />
              Add column
            </button>
            <button
              title="Delete Kanban board"
              onClick={() => setDialog("delete-board")}
            >
              <Trash2 size={14} />
            </button>
          </div>
          <div className="kanban-columns" aria-label={board.name}>
            {[
              ...board.columns,
              ...(unmatched.length
                ? [
                    {
                      id: "unmapped",
                      title: "Other statuses",
                      status: "todo" as const,
                      color: "#83878e",
                    },
                  ]
                : []),
            ].map((col, colIndex) => {
              const tasks = filtered(col.id),
                unmapped = col.id === "unmapped";
              return (
                <section
                  key={col.id}
                  className={
                    "kanban-column " + (hover === col.id ? "drop-target" : "")
                  }
                  style={{ "--column-color": col.color } as React.CSSProperties}
                  aria-label={"Column " + col.title}
                  onDragOver={(e) => {
                    if (
                      !unmapped &&
                      e.dataTransfer.types.includes("application/aster-task")
                    ) {
                      e.preventDefault();
                      setHover(col.id);
                    }
                  }}
                  onDrop={(e) => {
                    if (!unmapped) drop(e, col.id);
                  }}
                >
                  <header>
                    <span className="column-dot" />
                    <h2>{col.title}</h2>
                    <span>{tasks.length}</span>
                    {!unmapped && (
                      <>
                        <button
                          title={"Edit column " + col.title}
                          onClick={() => {
                            setColumn({ ...col });
                            setDialog("column");
                          }}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          title={"Move column " + col.title + " left"}
                          disabled={!colIndex || saving}
                          onClick={() =>
                            void perform(() =>
                              commit((s) => {
                                const b = s.kanban.find(
                                    (b) => b.id === board.id,
                                  )!,
                                  index = b.columns.findIndex(
                                    (c) => c.id === col.id,
                                  );
                                [b.columns[index - 1], b.columns[index]] = [
                                  b.columns[index],
                                  b.columns[index - 1],
                                ];
                              }),
                            )
                          }
                        >
                          <ArrowLeft size={13} />
                        </button>
                      </>
                    )}
                  </header>
                  <div className="kanban-card-list">
                    {tasks.map((t, i) => (
                      <article
                        key={t.id}
                        className="kanban-card"
                        draggable={!saving}
                        data-task-id={t.id}
                        onDragStart={(e) => {
                          e.dataTransfer.setData(
                            "application/aster-task",
                            t.id,
                          );
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => setHover("")}
                        onDragOver={(e) => {
                          if (!unmapped) e.preventDefault();
                        }}
                        onDrop={(e) => {
                          if (!unmapped) {
                            const after =
                              e.clientY >
                              e.currentTarget.getBoundingClientRect().top +
                                e.currentTarget.offsetHeight / 2;
                            drop(e, col.id, after ? tasks[i + 1]?.id : t.id);
                          }
                        }}
                      >
                        <div className="kanban-card-title">
                          <GripVertical size={14} />
                          <button
                            onClick={() => {
                              setTask({ ...t });
                              setTaskColumn("");
                              setDialog("task");
                            }}
                          >
                            {t.title}
                          </button>
                        </div>
                        {t.excerpt && <p>{t.excerpt.slice(0, 160)}</p>}
                        <div className="card-badges">
                          <span className={"priority-" + t.priority}>
                            {t.priority}
                          </span>
                          {t.due && <time>{t.due}</time>}
                          {t.projectId && (
                            <span>
                              {state.projects.find((p) => p.id === t.projectId)
                                ?.name ?? "Missing project"}
                            </span>
                          )}
                        </div>
                        {t.noteId && (
                          <button
                            className="card-source"
                            disabled={
                              !vault.notes.some((n) => n.id === t.noteId)
                            }
                            onClick={() => onOpen(t.noteId!)}
                          >
                            <FileText size={12} />
                            {vault.notes.find((n) => n.id === t.noteId)
                              ?.title ?? "Missing source note"}
                          </button>
                        )}
                        <div className="card-movement">
                          <select
                            aria-label={"Move " + t.title + " to column"}
                            value={columnForTask(board, t)}
                            disabled={saving}
                            onChange={(e) => move(t.id, e.target.value)}
                          >
                            {unmapped && (
                              <option value="unmapped">Other statuses</option>
                            )}
                            {board.columns.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.title}
                              </option>
                            ))}
                          </select>
                          <button
                            title={"Move " + t.title + " up"}
                            disabled={saving || i === 0 || unmapped}
                            onClick={() => move(t.id, col.id, tasks[i - 1].id)}
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            title={"Move " + t.title + " down"}
                            disabled={
                              saving || i === tasks.length - 1 || unmapped
                            }
                            onClick={() => move(t.id, col.id, tasks[i + 2]?.id)}
                          >
                            <ArrowDown size={12} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                  {!unmapped && (
                    <button
                      className="add-kanban-card"
                      onClick={() => newTask(col.id)}
                    >
                      <Plus size={14} />
                      Add card
                    </button>
                  )}
                </section>
              );
            })}
          </div>
        </>
      ) : (
        <div className="module-empty">
          <h2>Give your work a home.</h2>
          <p>
            Create a board for all tasks, or choose a project. Existing tasks
            appear automatically.
          </p>
        </div>
      )}
      {dialog && (
        <ModuleDialog
          label={
            dialog === "task"
              ? "Kanban card"
              : dialog === "column"
                ? "Kanban column"
                : "Kanban board settings"
          }
          busy={saving}
          onClose={() => setDialog(null)}
        >
          <form
            className="module-form"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <h2>
              {dialog === "task"
                ? "Card details"
                : dialog === "column"
                  ? "Column settings"
                  : dialog === "delete-board"
                    ? "Delete this board?"
                    : dialog === "board"
                      ? "Create a board"
                      : "Board settings"}
            </h2>
            {dialog === "board" || dialog === "rename" ? (
              <>
                <label>
                  Board name
                  <input
                    aria-label="Kanban board name"
                    required
                    maxLength={160}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label>
                  Project
                  <select
                    aria-label="Kanban project"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                  >
                    <option value="">All tasks</option>
                    {state.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}
            {dialog === "column" && column && (
              <>
                <label>
                  Column name
                  <input
                    aria-label="Column name"
                    required
                    value={column.title}
                    onChange={(e) =>
                      setColumn({ ...column, title: e.target.value })
                    }
                  />
                </label>
                <label>
                  Moving a card here sets its status to
                  <select
                    aria-label="Column task status"
                    value={column.status}
                    onChange={(e) =>
                      setColumn({
                        ...column,
                        status: e.target.value as Task["status"],
                      })
                    }
                  >
                    {taskStatuses.map((s) => (
                      <option key={s} value={s}>
                        {statusLabels[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Column color
                  <input
                    type="color"
                    value={column.color}
                    onChange={(e) =>
                      setColumn({ ...column, color: e.target.value })
                    }
                  />
                </label>
                {board.columns.some((c) => c.id === column.id) && (
                  <button
                    type="button"
                    className="danger-text"
                    disabled={board.columns.length < 2 || saving}
                    onClick={async () => {
                      if (
                        await perform(() =>
                          commit((s) => {
                            const b = s.kanban.find((b) => b.id === board.id)!;
                            b.columns = b.columns.filter(
                              (c) => c.id !== column.id,
                            );
                            b.cards = b.cards.filter(
                              (c) => c.columnId !== column.id,
                            );
                          }),
                        )
                      )
                        setDialog(null);
                    }}
                  >
                    Remove column; keep its tasks
                  </button>
                )}
              </>
            )}
            {dialog === "task" && task && (
              <>
                <label>
                  Title
                  <input
                    aria-label="Card title"
                    required
                    maxLength={500}
                    value={task.title}
                    onChange={(e) =>
                      setTask({ ...task, title: e.target.value })
                    }
                  />
                </label>
                <label>
                  Source note
                  <select
                    aria-label="Card source note"
                    value={task.noteId ?? ""}
                    onChange={(e) =>
                      setTask({ ...task, noteId: e.target.value || null })
                    }
                  >
                    <option value="">No source note</option>
                    {vault.notes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.path}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Context
                  <textarea
                    aria-label="Card context"
                    value={task.excerpt}
                    onChange={(e) =>
                      setTask({ ...task, excerpt: e.target.value })
                    }
                  />
                </label>
                <div className="form-grid">
                  <label>
                    Due date
                    <input
                      aria-label="Card due date"
                      type="date"
                      value={task.due ?? ""}
                      onChange={(e) =>
                        setTask({ ...task, due: e.target.value || null })
                      }
                    />
                  </label>
                  <label>
                    Priority
                    <select
                      aria-label="Card priority"
                      value={task.priority}
                      onChange={(e) =>
                        setTask({
                          ...task,
                          priority: e.target.value as Task["priority"],
                        })
                      }
                    >
                      {["low", "normal", "high", "urgent"].map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Status
                    <select
                      aria-label="Card status"
                      value={task.status}
                      onChange={(e) =>
                        setTask({
                          ...task,
                          status: e.target.value as Task["status"],
                        })
                      }
                    >
                      {taskStatuses.map((s) => (
                        <option key={s} value={s}>
                          {statusLabels[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Project
                    <select
                      aria-label="Card project"
                      value={task.projectId ?? ""}
                      onChange={(e) =>
                        setTask({ ...task, projectId: e.target.value || null })
                      }
                    >
                      <option value="">No project</option>
                      {state.projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </>
            )}
            {dialog === "delete-board" && (
              <p>
                Only this board and its column order will be removed. Its
                connected tasks and notes remain available.
              </p>
            )}
            {error && (
              <p role="alert" className="module-error">
                {error}
              </p>
            )}
            <footer>
              <button
                type="button"
                disabled={saving}
                onClick={() => setDialog(null)}
              >
                Cancel
              </button>
              <button className="primary" disabled={saving}>
                {saving
                  ? "Saving…"
                  : dialog === "delete-board"
                    ? "Delete board"
                    : "Save"}
              </button>
            </footer>
          </form>
        </ModuleDialog>
      )}
    </div>
  );
}
