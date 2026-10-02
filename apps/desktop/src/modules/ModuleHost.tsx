import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  CheckSquare,
  FolderKanban,
  FileScan,
  LayoutDashboard,
  ListTree,
  Puzzle,
  ChartNoAxesCombined,
  RefreshCw,
} from "lucide-react";
import {
  moduleNames,
  type ModuleName,
  type ModuleSnapshot,
  type ModuleState,
} from "../../../../packages/core/modules";
import type { VaultSnapshot } from "../../../../packages/core/types";
import CalendarModule from "./CalendarModule";
import TasksModule from "./TasksModule";
import CanvasModule from "./CanvasModule";
import NavigatorModule from "./NavigatorModule";
import "./modules.css";
import { useModules } from "./ModuleProvider";
import KanbanModule from "./KanbanModule";
const ChartsModule = lazy(() => import("./ChartsModule"));
const PdfModule = lazy(() => import("./PdfModule"));
export type Commit = (change: (state: ModuleState) => void) => Promise<void>;
export type ModuleProps = {
  vault: VaultSnapshot;
  state: ModuleState;
  commit: Commit;
  onOpen(id: string): void;
};
const info = {
  charts: {
    title: "Charts",
    icon: ChartNoAxesCombined,
    description:
      "Live data, editable worksheets, and charts for every question.",
  },
  kanban: {
    title: "Kanban",
    icon: FolderKanban,
    description:
      "Move connected tasks through columns, with notes close at hand.",
  },
  calendar: {
    title: "Calendar",
    icon: CalendarDays,
    description: "Daily notes, date-based browsing, and task due dates.",
  },
  tasks: {
    title: "Tasks & Projects",
    icon: CheckSquare,
    description: "Turn your notes into action. Keep related work together.",
  },
  pdf: {
    title: "PDF Library",
    icon: FileScan,
    description: "Read, annotate, and return to the passages that matter.",
  },
  canvas: {
    title: "Canvas",
    icon: LayoutDashboard,
    description: "Pin live vault queries to a canvas you can arrange.",
  },
  navigator: {
    title: "Navigator",
    icon: ListTree,
    description:
      "Browse large collections through folders and metadata hierarchies.",
  },
};
type Props = {
  vault: VaultSnapshot;
  onOpen(id: string): void;
  onVault(vault: VaultSnapshot): void;
  initialView?: ModuleName | "modules" | "projects";
  onViewChange?(view: ModuleName | "modules" | "projects"): void;
  initialTask?: { noteId: string; excerpt: string } | null;
  onTaskHandled(): void;
};
export default function ModuleHost({
  vault,
  onOpen,
  onVault,
  initialTask,
  initialView = "modules",
  onViewChange,
  onTaskHandled,
}: Props) {
  const { snapshot, commit, pending, error, reload, importPdf } = useModules();
  const [active, setActiveLocal] = useState<ModuleName | "modules">(
    initialTask ? "tasks" : initialView === "projects" ? "tasks" : initialView,
  );
  const [projectView, setProjectView] = useState(initialView === "projects");
  const setActive = (view: ModuleName | "modules") => {
    setActiveLocal(view);
    onViewChange?.(view);
  };
  useEffect(() => {
    setActiveLocal(
      initialTask
        ? "tasks"
        : initialView === "projects"
          ? "tasks"
          : initialView,
    );
    setProjectView(initialView === "projects");
  }, [initialView]);
  const taskEnableRequested = useRef(false);
  useEffect(() => {
    if (
      initialTask &&
      snapshot &&
      !snapshot.state.enabled.tasks &&
      !taskEnableRequested.current
    ) {
      taskEnableRequested.current = true;
      void commit((s) => {
        s.enabled.tasks = true;
      }).catch(() => {
        taskEnableRequested.current = false;
      });
    }
  }, [initialTask, snapshot]);
  const state = snapshot?.state;
  const shared = state ? { vault, state, commit, onOpen } : null;
  return (
    <section className="module-workspace">
      <nav className="module-nav" aria-label="Built-in modules">
        <button
          className={active === "modules" ? "active" : ""}
          onClick={() => setActive("modules")}
          title="Manage modules"
        >
          <Puzzle size={17} />
        </button>
        {moduleNames
          .filter((m) => state?.enabled[m])
          .map((m) => {
            const Icon = info[m].icon;
            return (
              <button
                key={m}
                className={active === m ? "active" : ""}
                onClick={() => {
                  setActive(m);
                  setProjectView(false);
                }}
              >
                <Icon size={15} />
                {m === "tasks" ? "Tasks" : info[m].title}
              </button>
            );
          })}
        {state?.enabled.tasks && (
          <button
            className={active === "tasks" && projectView ? "active" : ""}
            onClick={() => {
              setActiveLocal("tasks");
              setProjectView(true);
              onViewChange?.("projects");
            }}
          >
            <FolderKanban size={15} />
            Projects
          </button>
        )}
        <span className="module-save-status">
          {pending ? "Saving…" : "Local vault"}
        </span>
        <button
          title="Reload modules"
          disabled={pending > 0}
          onClick={() => void reload()}
        >
          <RefreshCw size={14} />
        </button>
      </nav>
      {error && (
        <div className="module-error" role="alert">
          {error}
          <button onClick={() => void reload()} disabled={pending > 0}>
            Reload saved data
          </button>
        </div>
      )}
      {!state ? (
        <div className="module-loading">Loading vault modules…</div>
      ) : active === "modules" || !state.enabled[active] ? (
        <div className="modules-home">
          <span className="eyebrow">BUILT IN. YOUR CHOICE.</span>
          <h1>More ways to work with your knowledge.</h1>
          <p>
            Enable the tools this vault needs. Turning a tool off preserves its
            data.
          </p>
          <div className="module-cards">
            {moduleNames.map((m) => {
              const Icon = info[m].icon;
              return (
                <article key={m}>
                  <Icon size={25} />
                  <h2>{info[m].title}</h2>
                  <p>{info[m].description}</p>
                  <label className="module-toggle">
                    <span>{state.enabled[m] ? "Enabled" : "Disabled"}</span>
                    <input
                      aria-label={`Enable ${info[m].title}`}
                      type="checkbox"
                      checked={state.enabled[m]}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        void commit((s) => {
                          s.enabled[m] = enabled;
                        }).catch(() => {});
                      }}
                    />
                  </label>
                  <button
                    className="quiet-button"
                    disabled={!state.enabled[m]}
                    onClick={() => setActive(m)}
                  >
                    Open {info[m].title}
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      ) : active === "kanban" ? (
        <KanbanModule {...shared!} />
      ) : active === "charts" ? (
        <Suspense
          fallback={<div className="module-loading">Loading chart tools…</div>}
        >
          <ChartsModule {...shared!} />
        </Suspense>
      ) : active === "calendar" ? (
        <CalendarModule {...shared!} onVault={onVault} />
      ) : active === "tasks" ? (
        <TasksModule
          {...shared!}
          projectView={projectView}
          initialTask={initialTask}
          onTaskHandled={onTaskHandled}
        />
      ) : active === "canvas" ? (
        <CanvasModule {...shared!} />
      ) : active === "navigator" ? (
        <NavigatorModule {...shared!} />
      ) : (
        <Suspense
          fallback={<div className="module-loading">Loading PDF tools…</div>}
        >
          <PdfModule {...shared!} onImport={importPdf} />
        </Suspense>
      )}
    </section>
  );
}
