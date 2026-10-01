import ModuleDialog from "./ModuleDialog";
import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  FileText,
  Trash2,
  ArrowUpRight,
  FolderKanban,
  Pencil,
} from "lucide-react";
import {
  localDate,
  type Project,
  type Task,
} from "../../../../packages/core/modules";
import { noteMetadata } from "../../../../packages/core/metadata";
import type { ModuleProps } from "./ModuleHost";
const statuses: Task["status"][] = [
  "todo",
  "in-progress",
  "blocked",
  "done",
  "cancelled",
];
const priorities: Task["priority"][] = ["low", "normal", "high", "urgent"];
type Props = ModuleProps & {
  projectView: boolean;
  initialTask?: { noteId: string; excerpt: string } | null;
  onTaskHandled(): void;
};
export default function TasksModule({
  vault,
  state,
  commit,
  onOpen,
  projectView,
  initialTask,
  onTaskHandled,
}: Props) {
  const [editing, setEditing] = useState<Task | null>(null),
    [project, setProject] = useState(""),
    [status, setStatus] = useState("open"),
    [priority, setPriority] = useState("all"),
    [due, setDue] = useState("all"),
    [search, setSearch] = useState("");
  const [projectDraft, setProjectDraft] = useState<Project | null>(null),
    [saving, setSaving] = useState(false),
    [formError, setFormError] = useState("");
  const blank = (noteId: string | null = null, excerpt = ""): Task => ({
    id: crypto.randomUUID(),
    title: excerpt.split("\n")[0].slice(0, 500),
    excerpt,
    noteId,
    due: null,
    status: "todo",
    priority: "normal",
    projectId: project || null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  useEffect(() => {
    if (initialTask) {
      setEditing(blank(initialTask.noteId, initialTask.excerpt));
      onTaskHandled();
    }
  }, [initialTask]);
  const selectedProject = state.projects.find((p) => p.id === project);
  const tasks = useMemo(
    () =>
      state.tasks
        .filter(
          (t) =>
            (!project || t.projectId === project) &&
            (status === "all" || status === "open"
              ? !["done", "cancelled"].includes(t.status) || status === "all"
              : t.status === status) &&
            (priority === "all" || t.priority === priority) &&
            (!search || t.title.toLowerCase().includes(search.toLowerCase())) &&
            (due === "all" ||
              (due === "today" && t.due === localDate()) ||
              (due === "overdue" &&
                !!t.due &&
                t.due < localDate() &&
                !["done", "cancelled"].includes(t.status)) ||
              (due === "upcoming" && !!t.due && t.due > localDate())),
        )
        .sort(
          (a, b) =>
            (a.due ?? "9999").localeCompare(b.due ?? "9999") ||
            priorities.indexOf(b.priority) - priorities.indexOf(a.priority),
        ),
    [state.tasks, project, status, priority, due, search],
  );
  const related = vault.notes.filter(
    (n) =>
      selectedProject &&
      (selectedProject.noteIds.includes(n.id) ||
        [
          selectedProject.id,
          selectedProject.name,
          `[[${selectedProject.name}]]`,
        ].includes(String(noteMetadata(n).project))),
  );
  const saveTask = async () => {
    if (!editing) return;
    setSaving(true);
    setFormError("");
    try {
      await commit((s) => {
        const index = s.tasks.findIndex((t) => t.id === editing.id);
        const task = {
          ...editing,
          title: editing.title.trim(),
          updatedAt: Date.now(),
        };
        if (index < 0) s.tasks.push(task);
        else s.tasks[index] = task;
      });
      setEditing(null);
    } catch (e) {
      setFormError(String(e));
    } finally {
      setSaving(false);
    }
  };
  const taskList = (
    <>
      <div className="task-filters">
        <input
          aria-label="Search tasks"
          placeholder="Search tasks"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Task status filter"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="open">Open statuses</option>
          <option value="all">All statuses</option>
          {statuses.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          aria-label="Task priority filter"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          <option value="all">All priorities</option>
          {priorities.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          aria-label="Due date filter"
          value={due}
          onChange={(e) => setDue(e.target.value)}
        >
          <option value="all">Any due date</option>
          <option value="today">Due today</option>
          <option value="overdue">Overdue</option>
          <option value="upcoming">Upcoming</option>
        </select>
      </div>
      <div className="task-table">
        <div className="task-table-header">
          <span>Task</span>
          <span>Status</span>
          <span>Priority</span>
          <span>Due</span>
          <span>Project</span>
          <span />
        </div>
        {tasks.map((t) => {
          const source = vault.notes.find((n) => n.id === t.noteId);
          return (
            <div
              key={t.id}
              className={`task-row ${t.status === "done" ? "completed" : ""}`}
            >
              <div className="task-title-cell">
                <input
                  type="checkbox"
                  aria-label={`Complete ${t.title}`}
                  checked={t.status === "done"}
                  onChange={(e) => {
                    const done = e.target.checked;
                    void commit((s) => {
                      const task = s.tasks.find((x) => x.id === t.id)!;
                      task.status = done ? "done" : "todo";
                      task.updatedAt = Date.now();
                    }).catch(() => {});
                  }}
                />
                <div>
                  <button
                    className="task-title"
                    onClick={() => {
                      setEditing({ ...t });
                      setFormError("");
                    }}
                  >
                    {t.title}
                  </button>
                  {source ? (
                    <button
                      className="task-source"
                      onClick={() => onOpen(source.id)}
                    >
                      <FileText size={11} />
                      {source.title}
                    </button>
                  ) : (
                    t.noteId && <small>Source note unavailable</small>
                  )}
                </div>
              </div>
              <select
                aria-label={`Status for ${t.title}`}
                value={t.status}
                onChange={(e) => {
                  const value = e.target.value as Task["status"];
                  void commit((s) => {
                    const task = s.tasks.find((x) => x.id === t.id)!;
                    task.status = value;
                    task.updatedAt = Date.now();
                  }).catch(() => {});
                }}
              >
                {statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <span className={`priority-badge priority-${t.priority}`}>
                {t.priority}
              </span>
              <span
                className={
                  t.due &&
                  t.due < localDate() &&
                  !["done", "cancelled"].includes(t.status)
                    ? "overdue"
                    : ""
                }
              >
                {t.due ?? "—"}
              </span>
              <span>
                {state.projects.find((p) => p.id === t.projectId)?.name ?? "—"}
              </span>
              <button
                title={`Edit ${t.title}`}
                onClick={() => setEditing({ ...t })}
              >
                <Pencil size={13} />
              </button>
            </div>
          );
        })}
        {!tasks.length && (
          <div className="module-empty">No tasks match these filters.</div>
        )}
      </div>
    </>
  );
  return (
    <div className="module-page tasks-module">
      <header className="module-page-heading">
        <div>
          <span className="eyebrow">IDEAS INTO ACTION</span>
          <h1>{projectView ? "Projects" : "Tasks"}</h1>
        </div>
        <div className="module-toolbar">
          {projectView && (
            <button
              className="quiet-button"
              onClick={() =>
                setProjectDraft({
                  id: crypto.randomUUID(),
                  name: "",
                  description: "",
                  noteIds: [],
                  createdAt: Date.now(),
                })
              }
            >
              <FolderKanban size={14} />
              New project
            </button>
          )}
          <button
            className="primary"
            onClick={() => {
              setEditing(blank());
              setFormError("");
            }}
          >
            <Plus size={14} />
            New task
          </button>
        </div>
      </header>
      {projectView ? (
        <div className="projects-body">
          <aside className="projects-list">
            <button
              className={!project ? "active" : ""}
              onClick={() => setProject("")}
            >
              All projects<span>{state.projects.length}</span>
            </button>
            {state.projects.map((p) => (
              <button
                key={p.id}
                className={project === p.id ? "active" : ""}
                onClick={() => setProject(p.id)}
              >
                <FolderKanban size={14} />
                {p.name}
                <span>
                  {
                    state.tasks.filter(
                      (t) =>
                        t.projectId === p.id &&
                        !["done", "cancelled"].includes(t.status),
                    ).length
                  }
                </span>
              </button>
            ))}
          </aside>
          <div className="project-detail">
            {selectedProject ? (
              <>
                <div className="project-heading">
                  <div>
                    <h2>{selectedProject.name}</h2>
                    <p>
                      {selectedProject.description ||
                        "Keep the notes and tasks for this project together."}
                    </p>
                  </div>
                  <button
                    title="Edit project"
                    onClick={() =>
                      setProjectDraft(structuredClone(selectedProject))
                    }
                  >
                    <Pencil size={15} />
                  </button>
                </div>
                <h3>Related notes</h3>
                <div className="project-notes">
                  {related.map((n) => (
                    <button key={n.id} onClick={() => onOpen(n.id)}>
                      <FileText size={15} />
                      {n.title}
                      <ArrowUpRight size={13} />
                    </button>
                  ))}
                  {!related.length && (
                    <p className="muted">
                      Edit this project to attach notes, or add matching project
                      frontmatter.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="project-heading">
                <div>
                  <h2>Everything you’re moving forward.</h2>
                  <p>Select a project to see its notes and tasks together.</p>
                </div>
              </div>
            )}
            {taskList}
          </div>
        </div>
      ) : (
        <>
          <label className="project-filter">
            Project
            <select
              aria-label="Task project filter"
              value={project}
              onChange={(e) => setProject(e.target.value)}
            >
              <option value="">All projects</option>
              {state.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {taskList}
        </>
      )}
      {editing && (
        <ModuleDialog
          label="Task editor"
          busy={saving}
          onClose={() => setEditing(null)}
        >
          <form
            className="module-dialog"
            aria-label="Task editor"
            onSubmit={(e) => {
              e.preventDefault();
              void saveTask();
            }}
          >
            <h2>
              {state.tasks.some((t) => t.id === editing.id)
                ? "Edit task"
                : "Create a task"}
            </h2>
            <label>
              Task title
              <input
                autoFocus
                required
                maxLength={500}
                value={editing.title}
                onChange={(e) =>
                  setEditing({ ...editing, title: e.target.value })
                }
              />
            </label>
            <div className="form-grid">
              <label>
                Due date
                <input
                  type="date"
                  value={editing.due ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, due: e.target.value || null })
                  }
                />
              </label>
              <label>
                Status
                <select
                  aria-label="Task status"
                  value={editing.status}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      status: e.target.value as Task["status"],
                    })
                  }
                >
                  {statuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Priority
                <select
                  aria-label="Task priority"
                  value={editing.priority}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      priority: e.target.value as Task["priority"],
                    })
                  }
                >
                  {priorities.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Project
                <select
                  aria-label="Task project"
                  value={editing.projectId ?? ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      projectId: e.target.value || null,
                    })
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
            <label>
              Source note
              <select
                aria-label="Task source note"
                value={editing.noteId ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, noteId: e.target.value || null })
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
              Source excerpt / context
              <textarea
                rows={3}
                value={editing.excerpt}
                onChange={(e) =>
                  setEditing({ ...editing, excerpt: e.target.value })
                }
              />
            </label>
            {formError && (
              <p className="module-error" role="alert">
                {formError}
              </p>
            )}
            <div className="dialog-actions">
              {state.tasks.some((t) => t.id === editing.id) && (
                <button
                  type="button"
                  className="danger-text"
                  onClick={async () => {
                    try {
                      await commit((s) => {
                        s.tasks = s.tasks.filter((t) => t.id !== editing.id);
                      });
                      setEditing(null);
                    } catch {}
                  }}
                >
                  <Trash2 size={14} />
                  Delete task
                </button>
              )}
              <button type="button" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button
                className="primary"
                disabled={saving || !editing.title.trim()}
              >
                Save task
              </button>
            </div>
          </form>
        </ModuleDialog>
      )}
      {projectDraft && (
        <ModuleDialog
          label="Project editor"
          busy={saving}
          onClose={() => setProjectDraft(null)}
        >
          <form
            className="module-dialog"
            aria-label="Project editor"
            onSubmit={async (e) => {
              e.preventDefault();
              setSaving(true);
              try {
                await commit((s) => {
                  const i = s.projects.findIndex(
                    (p) => p.id === projectDraft.id,
                  );
                  if (i < 0) s.projects.push(projectDraft);
                  else s.projects[i] = projectDraft;
                });
                setProject(projectDraft.id);
                setProjectDraft(null);
              } catch {
              } finally {
                setSaving(false);
              }
            }}
          >
            <h2>Project details</h2>
            <label>
              Project name
              <input
                autoFocus
                required
                maxLength={160}
                value={projectDraft.name}
                onChange={(e) =>
                  setProjectDraft({ ...projectDraft, name: e.target.value })
                }
              />
            </label>
            <label>
              Description
              <textarea
                value={projectDraft.description}
                onChange={(e) =>
                  setProjectDraft({
                    ...projectDraft,
                    description: e.target.value,
                  })
                }
              />
            </label>
            <label>
              Related notes
              <select
                aria-label="Project related notes"
                multiple
                size={6}
                value={projectDraft.noteIds}
                onChange={(e) =>
                  setProjectDraft({
                    ...projectDraft,
                    noteIds: Array.from(
                      e.target.selectedOptions,
                      (o) => o.value,
                    ),
                  })
                }
              >
                {vault.notes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.path}
                  </option>
                ))}
              </select>
            </label>
            <div className="dialog-actions">
              <button type="button" onClick={() => setProjectDraft(null)}>
                Cancel
              </button>
              <button className="primary" disabled={saving}>
                Save project
              </button>
            </div>
          </form>
        </ModuleDialog>
      )}
    </div>
  );
}
