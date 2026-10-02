import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Columns2, Rows2, Plus, X, Save, Trash2 } from "lucide-react";
import {
  leaves,
  makePane,
  mapLayout,
  moveTab,
  removePane,
  surfaceNames,
  type Layout,
  type Pane,
  type Surface,
  type WorkspaceTab,
} from "../../../packages/core/workspace";
import { useModules, TabContext } from "./modules/ModuleProvider";
import ModuleDialog from "./modules/ModuleDialog";
import { chartSchema } from "../../../packages/core/chart-model";
import {
  resourceSurface,
  resourceCatalog,
  resourceKey,
  type ResourceTarget,
} from "../../../packages/core/resources";
export type WorkspaceHandle = {
  preset(mode: "graph" | "split" | "write" | "modules", noteId?: string): void;
  openNote(id: string, passage?: WorkspaceTab["passage"]): void;
  openResource(target: ResourceTarget): void;
  followNote(id: string): void;
  openModule(kind: Surface): string;
  changeTab(id: string, kind: Surface): void;
};
const titles: Record<Surface, string> = {
  graph: "Web",
  tree: "Tree",
  note: "Text",
  modules: "Modules",
  calendar: "Calendar",
  tasks: "Tasks",
  projects: "Projects",
  pdf: "PDF Annotation",
  canvas: "Canvas",
  navigator: "Navigator",
  charts: "Charts",
  kanban: "Kanban",
};
type Props = {
  render(tab: WorkspaceTab): ReactNode;
  noteTitle(id: string): string;
  selected: string;
  onSelect(id: string): void;
  onMode(mode: "graph" | "split" | "write" | "modules"): void;
};
const Workspace = forwardRef<WorkspaceHandle, Props>(function Workspace(
  { render, noteTitle, selected, onSelect, onMode },
  ref,
) {
  const store = useModules(),
    initial = useRef<Layout>(makePane("graph")),
    [activePane, setActivePane] = useState(""),
    [preview, setPreview] = useState<Layout | null>(null);
  const [error, setError] = useState(""),
    [savingLayout, setSavingLayout] = useState(false),
    [layoutName, setLayoutName] = useState("");
  const current = store.snapshot?.state.workspace.layout ?? initial.current,
    layout = preview ?? current,
    latest = useRef(current);
  latest.current = current;
  const mutate = (fn: (tree: Layout) => Layout) => {
    void store
      .commit((s) => {
        const next = fn(s.workspace.layout ?? initial.current),
          tabs = leaves(next).flatMap((p) => p.tabs);
        for (const [key, draft] of store.drafts)
          if (
            key.endsWith(":chart-draft") &&
            draft &&
            !chartSchema.safeParse(draft).success &&
            !tabs.some((t) => t.id === key.split(":")[0] && t.kind === "charts")
          )
            throw new Error(
              "Fix or discard invalid chart settings before closing this view.",
            );
        s.workspace.layout = next;
      })
      .catch((e) => setError(String(e)));
  };
  const resourceTitles = new Map(
    (store.snapshot ? resourceCatalog(store.snapshot.state) : []).map((r) => [
      resourceKey(r.target),
      r.title,
    ]),
  );
  const tabTitle = (tab: WorkspaceTab) =>
    tab.kind === "note" && tab.noteId
      ? noteTitle(tab.noteId)
      : tab.resource
        ? (resourceTitles.get(resourceKey(tab.resource)) ?? titles[tab.kind])
        : titles[tab.kind];
  const activate = (paneId: string, tab: WorkspaceTab) => {
    setActivePane(paneId);
    if (tab.kind === "note" && tab.noteId) onSelect(tab.noteId);
    mutate((tree) =>
      mapLayout(tree, paneId, (n) => ({ ...n, active: tab.id }) as Pane),
    );
  };
  const openModule = (kind: Surface, resource?: ResourceTarget) => {
    const tree = latest.current,
      panes = leaves(tree),
      p = panes.find((p) => p.id === activePane) ?? panes[0],
      tab = {
        id: crypto.randomUUID(),
        kind,
        ...(resource ? { resource } : {}),
        ...(kind === "note" && selected ? { noteId: selected } : {}),
      };
    mutate((tree) =>
      mapLayout(tree, p.id, (n) => {
        const p = n as Pane;
        return {
          ...p,
          tabs:
            p.tabs.length >= 12
              ? [...p.tabs.slice(0, -1), tab]
              : [...p.tabs, tab],
          active: tab.id,
        };
      }),
    );
    return tab.id;
  };
  const openNote = (id: string, passage?: WorkspaceTab["passage"]) => {
    const tree = latest.current,
      panes = leaves(tree),
      existing = panes.find((p) =>
        p.tabs.some((t) => t.kind === "note" && t.noteId === id),
      );
    if (existing) {
      activate(
        existing.id,
        existing.tabs.find((t) => t.kind === "note" && t.noteId === id)!,
      );
      if (passage)
        mutate((tree) =>
          mapLayout(
            tree,
            existing.id,
            (n) =>
              ({
                ...n,
                tabs: (n as Pane).tabs.map((t) =>
                  t.kind === "note" && t.noteId === id ? { ...t, passage } : t,
                ),
              }) as Pane,
          ),
        );
      return;
    }
    const editor = panes.find((p) => p.tabs.some((t) => t.kind === "note"));
    const tab: WorkspaceTab = {
      id: crypto.randomUUID(),
      kind: "note",
      noteId: id,
      ...(passage ? { passage } : {}),
    };
    if (editor) {
      setActivePane(editor.id);
      mutate((tree) =>
        mapLayout(tree, editor.id, (n) => {
          const p = n as Pane;
          return {
            ...p,
            tabs:
              p.tabs.length >= 12
                ? [...p.tabs.slice(0, -1), tab]
                : [...p.tabs, tab],
            active: tab.id,
          };
        }),
      );
    } else if (panes.length < 8) {
      const pane = makePane("note", id);
      if (passage) pane.tabs[0].passage = passage;
      setActivePane(pane.id);
      mutate((tree) => ({
        id: crypto.randomUUID(),
        type: "split",
        axis: "horizontal",
        ratio: 0.5,
        first: tree,
        second: pane,
      }));
    } else {
      const target = panes.find((p) => p.id === activePane) ?? panes[0];
      mutate((tree) =>
        mapLayout(
          tree,
          target.id,
          (n) =>
            ({
              ...n,
              tabs: [...(n as Pane).tabs.slice(0, 11), tab],
              active: tab.id,
            }) as Pane,
        ),
      );
    }
  };
  useImperativeHandle(ref, () => ({
    preset(mode, noteId) {
      const first = makePane(
        mode === "write" ? "note" : mode === "modules" ? "modules" : "graph",
        noteId,
      );
      const next: Layout =
        mode === "split"
          ? {
              id: crypto.randomUUID(),
              type: "split",
              axis: "horizontal",
              ratio: 0.5,
              first,
              second: makePane("note", noteId),
            }
          : first;
      mutate(() => next);
      setActivePane(first.id);
    },
    openNote,
    openModule,
    openResource(target) {
      openModule(resourceSurface(target), target);
    },
    changeTab(id, kind) {
      const pane = leaves(latest.current).find((p) =>
        p.tabs.some((t) => t.id === id),
      );
      if (pane)
        mutate((tree) =>
          mapLayout(
            tree,
            pane.id,
            (n) =>
              ({
                ...n,
                tabs: (n as Pane).tabs.map((t) =>
                  t.id === id
                    ? { ...t, kind, resource: undefined, passage: undefined }
                    : t,
                ),
              }) as Pane,
          ),
        );
    },
    followNote(id) {
      const p = leaves(latest.current).find(
        (p) => p.tabs.find((t) => t.id === p.active)?.kind === "note",
      );
      if (p)
        mutate((tree) =>
          mapLayout(
            tree,
            p.id,
            (n) =>
              ({
                ...n,
                tabs: (n as Pane).tabs.map((t) =>
                  t.id === (n as Pane).active ? { ...t, noteId: id } : t,
                ),
              }) as Pane,
          ),
        );
    },
  }));
  useEffect(() => {
    const panes = leaves(current),
      kinds = panes.map((p) => p.tabs.find((t) => t.id === p.active)?.kind);
    onMode(
      kinds.length === 1 && ["graph", "tree"].includes(kinds[0] ?? "")
        ? "graph"
        : kinds.length === 1 && kinds[0] === "note"
          ? "write"
          : kinds.every((k) => !["graph", "tree", "note"].includes(k ?? ""))
            ? "modules"
            : "split",
    );
  }, [current, onMode]);
  const split = (pane: Pane, axis: "horizontal" | "vertical") => {
    if (leaves(current).length >= 8) return;
    const added = makePane("modules");
    setActivePane(added.id);
    mutate((tree) =>
      mapLayout(tree, pane.id, (n) => ({
        id: crypto.randomUUID(),
        type: "split",
        axis,
        ratio: 0.5,
        first: n,
        second: added,
      })),
    );
  };
  const close = (pane: Pane, tabId: string) =>
    mutate((tree) => {
      if (pane.tabs.length === 1)
        return leaves(tree).length > 1 ? removePane(tree, pane.id) : tree;
      return mapLayout(tree, pane.id, (n) => {
        const p = n as Pane,
          tabs = p.tabs.filter((t) => t.id !== tabId);
        return {
          ...p,
          tabs,
          active: p.active === tabId ? tabs[0].id : p.active,
        };
      });
    });
  const resize = (
    e: React.PointerEvent,
    splitId: string,
    axis: "horizontal" | "vertical",
  ) => {
    e.preventDefault();
    const handle = e.currentTarget as HTMLElement,
      parent = handle.parentElement!,
      rect = parent.getBoundingClientRect(),
      base = latest.current;
    handle.setPointerCapture(e.pointerId);
    let next = base;
    const move = (event: PointerEvent) => {
      const ratio = Math.max(
        0.1,
        Math.min(
          0.9,
          axis === "horizontal"
            ? (event.clientX - rect.left) / rect.width
            : (event.clientY - rect.top) / rect.height,
        ),
      );
      next = mapLayout(base, splitId, (n) => ({ ...n, ratio }) as Layout);
      setPreview(next);
    };
    const end = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", cancel);
      void store
        .commit((s) => {
          s.workspace.layout = next;
        })
        .catch((e) => setError(String(e)))
        .finally(() => setPreview(null));
    };
    const cancel = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", cancel);
      setPreview(null);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", cancel);
  };
  const renderLayout = (node: Layout): ReactNode => {
    if (node.type === "split")
      return (
        <div
          key={node.id}
          className={"dock-split " + node.axis}
          style={{
            gridTemplateColumns:
              node.axis === "horizontal"
                ? node.ratio + "fr 7px " + (1 - node.ratio) + "fr"
                : undefined,
            gridTemplateRows:
              node.axis === "vertical"
                ? node.ratio + "fr 7px " + (1 - node.ratio) + "fr"
                : undefined,
          }}
        >
          {renderLayout(node.first)}
          <div
            className="pane-divider"
            role="separator"
            tabIndex={0}
            aria-label={"Resize " + node.axis + " panes"}
            aria-orientation={
              node.axis === "horizontal" ? "vertical" : "horizontal"
            }
            aria-valuemin={10}
            aria-valuemax={90}
            aria-valuenow={Math.round(node.ratio * 100)}
            onPointerDown={(e) => resize(e, node.id, node.axis)}
            onDoubleClick={() =>
              mutate((t) =>
                mapLayout(t, node.id, (n) => ({ ...n, ratio: 0.5 }) as Layout),
              )
            }
            onKeyDown={(e) => {
              if (
                [
                  "ArrowLeft",
                  "ArrowUp",
                  "ArrowRight",
                  "ArrowDown",
                  "Home",
                ].includes(e.key)
              ) {
                e.preventDefault();
                mutate((t) =>
                  mapLayout(
                    t,
                    node.id,
                    (n) =>
                      ({
                        ...n,
                        ratio:
                          e.key === "Home"
                            ? 0.5
                            : Math.max(
                                0.1,
                                Math.min(
                                  0.9,
                                  (n as typeof node).ratio +
                                    (["ArrowRight", "ArrowDown"].includes(e.key)
                                      ? 0.03
                                      : -0.03),
                                ),
                              ),
                      }) as Layout,
                  ),
                );
              }
            }}
          />
          {renderLayout(node.second)}
        </div>
      );
    const active = node.tabs.find((t) => t.id === node.active) ?? node.tabs[0];
    return (
      <section
        key={node.id}
        className={"dock-pane " + (activePane === node.id ? "focused" : "")}
        data-pane-id={node.id}
        onPointerDown={() => {
          setActivePane(node.id);
          if (active.kind === "note" && active.noteId) onSelect(active.noteId);
        }}
      >
        <div
          className="pane-tabs"
          role="tablist"
          aria-label="Pane tabs"
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("application/aster-tab"))
              e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            const id = e.dataTransfer.getData("application/aster-tab");
            if (id) mutate((t) => moveTab(t, id, node.id));
          }}
        >
          {node.tabs.map((tab, i) => (
            <div
              key={tab.id}
              className={"pane-tab " + (tab.id === active.id ? "active" : "")}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("application/aster-tab", tab.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const id = e.dataTransfer.getData("application/aster-tab");
                if (id) mutate((t) => moveTab(t, id, node.id, i));
              }}
            >
              <button
                role="tab"
                aria-selected={tab.id === active.id}
                onClick={() => activate(node.id, tab)}
              >
                {tabTitle(tab)}
              </button>
              <button
                title={"Close " + tabTitle(tab) + " tab"}
                disabled={
                  node.tabs.length === 1 && leaves(current).length === 1
                }
                onClick={() => close(node, tab.id)}
              >
                <X size={11} />
              </button>
            </div>
          ))}
          <select
            aria-label="Add view to pane"
            value=""
            onChange={(e) => {
              const kind = e.target.value as Surface;
              const tab: WorkspaceTab = {
                id: crypto.randomUUID(),
                kind,
                ...(kind === "note" && selected ? { noteId: selected } : {}),
              };
              mutate((t) =>
                mapLayout(
                  t,
                  node.id,
                  (n) =>
                    ({
                      ...n,
                      tabs: [...(n as Pane).tabs, tab],
                      active: tab.id,
                    }) as Pane,
                ),
              );
            }}
            disabled={node.tabs.length >= 12}
          >
            <option value="">＋ View</option>
            {surfaceNames.map((s) => (
              <option key={s} value={s}>
                {titles[s]}
              </option>
            ))}
          </select>
          <button
            title="Split pane right"
            disabled={leaves(current).length >= 8}
            onClick={() => split(node, "horizontal")}
          >
            <Columns2 size={14} />
          </button>
          <button
            title="Split pane below"
            disabled={leaves(current).length >= 8}
            onClick={() => split(node, "vertical")}
          >
            <Rows2 size={14} />
          </button>
        </div>
        <div className="pane-content" data-surface={active.kind}>
          <TabContext.Provider value={active.id}>
            {render(active)}
          </TabContext.Provider>
        </div>
      </section>
    );
  };
  return (
    <div className="dock-workspace">
      <div className="layout-toolbar">
        <span>WORKSPACE</span>
        <select
          aria-label="Open saved layout"
          value=""
          onChange={(e) => {
            const saved = store.snapshot?.state.workspace.saved.find(
              (s) => s.id === e.target.value,
            );
            if (saved) mutate(() => structuredClone(saved.layout));
          }}
        >
          <option value="">Saved layouts</option>
          {store.snapshot?.state.workspace.saved.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            setLayoutName("");
            setSavingLayout(true);
          }}
        >
          <Save size={13} />
          Save layout
        </button>
        <span className="layout-hint">Drag tabs · drag borders to resize</span>
      </div>
      {(error || store.error) && (
        <div className="module-error" role="alert">
          {error || store.error}
          <button
            onClick={() => {
              setError("");
              void store.reload();
            }}
          >
            Reload saved data
          </button>
        </div>
      )}
      {!store.snapshot ? (
        <div className="module-loading">Loading workspace…</div>
      ) : (
        <div className="dock-root">{renderLayout(layout)}</div>
      )}
      {savingLayout && (
        <ModuleDialog
          label="Save workspace layout"
          onClose={() => setSavingLayout(false)}
        >
          <form
            className="module-form"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await store.commit((s) => {
                  if (
                    s.workspace.saved.some(
                      (l) =>
                        l.name.toLowerCase() ===
                        layoutName.trim().toLowerCase(),
                    )
                  )
                    throw new Error("A layout with that name already exists.");
                  s.workspace.saved.push({
                    id: crypto.randomUUID(),
                    name: layoutName.trim(),
                    layout: structuredClone(latest.current),
                  });
                });
                setSavingLayout(false);
              } catch (e) {
                setError(String(e));
              }
            }}
          >
            <h2>Save this workspace</h2>
            <label>
              Layout name
              <input
                aria-label="Layout name"
                required
                maxLength={80}
                value={layoutName}
                onChange={(e) => setLayoutName(e.target.value)}
              />
            </label>
            <p>
              Keep your pane arrangement, open tabs, and proportions for this
              vault.
            </p>
            <div className="saved-layout-list">
              {store.snapshot?.state.workspace.saved.map((saved) => (
                <div key={saved.id}>
                  <span>{saved.name}</span>
                  <button
                    type="button"
                    title={"Delete layout " + saved.name}
                    onClick={() =>
                      void store
                        .commit((s) => {
                          s.workspace.saved = s.workspace.saved.filter(
                            (l) => l.id !== saved.id,
                          );
                        })
                        .catch((e) => setError(String(e)))
                    }
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
            {error && <p role="alert">{error}</p>}
            <footer>
              <button type="button" onClick={() => setSavingLayout(false)}>
                Cancel
              </button>
              <button className="primary" disabled={store.pending > 0}>
                Save layout
              </button>
            </footer>
          </form>
        </ModuleDialog>
      )}
    </div>
  );
});
export default Workspace;
