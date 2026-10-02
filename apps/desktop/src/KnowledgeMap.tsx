import { useMemo, useState, useRef, useEffect } from "react";
import { Plus, Search, X } from "lucide-react";
import Graph, { colorFor } from "./Graph";
import TreeDiagram from "./TreeDiagram";
import ConnectionEvidence from "./ConnectionEvidence";
import ModuleDialog from "./modules/ModuleDialog";
import { useModules } from "./modules/ModuleProvider";
import { buildEdges, matchesNote } from "../../../packages/core/knowledge";
import {
  resourceCatalog,
  resourceKey,
  resourceLabels,
  resourceNotes,
  resourceEdges,
  type ResourceTarget,
} from "../../../packages/core/resources";
import {
  groupOf,
  PALETTE,
  type GraphView,
  type VaultSettings,
  type VaultSnapshot,
} from "../../../packages/core/types";
import type { Evidence } from "../../../packages/core/evidence";
export default function KnowledgeMap({
  vault,
  view,
  selected,
  tree,
  onSelect,
  onOpen,
  onOpenResource,
  onEvidenceNote,
  onSwitch,
  onSaveView,
  onSettings,
  onView,
}: {
  vault: VaultSnapshot;
  view: GraphView;
  selected: string;
  tree: boolean;
  onSelect(id: string): void;
  onOpen(id: string): void;
  onOpenResource(target: ResourceTarget): void;
  onEvidenceNote(e: Extract<Evidence, { kind: "note" }>): void;
  onSwitch(tree: boolean): void;
  onSaveView(): void;
  onSettings(patch: Partial<VaultSettings>): void;
  onView(patch: Partial<GraphView>): void;
}) {
  const { snapshot, commit, pending } = useModules(),
    state = snapshot?.state;
  const [adding, setAdding] = useState(false),
    [choice, setChoice] = useState(""),
    [folder, setFolder] = useState("Tools"),
    [parent, setParent] = useState(""),
    [error, setError] = useState(""),
    [resourceId, setResourceId] = useState(""),
    [target, setTarget] = useState(""),
    [kind, setKind] = useState("relates to"),
    [evidenceId, setEvidenceId] = useState("");
  const selectionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (selectionTimer.current) clearTimeout(selectionTimer.current);
    },
    [],
  );
  const pins = state?.resources ?? [],
    catalog = useMemo(() => (state ? resourceCatalog(state) : []), [state]);
  const extra = useMemo(
      () => (state ? resourceNotes(state, vault.notes) : []),
      [state, vault.notes],
    ),
    notes = useMemo(() => [...vault.notes, ...extra], [vault.notes, extra]);
  const filtered = notes.filter((n) => matchesNote(n, view.filter)),
    groups = [...new Set(notes.map((n) => groupOf(n.path)))].sort();
  const edges = useMemo(
    () => [
      ...buildEdges({ ...vault, notes }),
      ...(state ? resourceEdges(state, vault.notes) : []),
    ],
    [vault, notes, state],
  );
  const pin = pins.find((p) => p.id === resourceId),
    active = pin ? resourceId : selected,
    resource = extra.find((n) => n.id === resourceId);
  const relation = vault.settings.relations.find((r) => r.id === evidenceId);
  const open = (id: string) => {
    if (selectionTimer.current) clearTimeout(selectionTimer.current);
    const p = pins.find((p) => p.id === id);
    if (p) {
      if (catalog.some((r) => resourceKey(r.target) === resourceKey(p.target)))
        onOpenResource(p.target);
      else
        setError(
          "The source item was removed. Remove this map node or restore the source item.",
        );
    } else onOpen(id);
  };
  const select = (id: string) => {
    if (selectionTimer.current) clearTimeout(selectionTimer.current);
    if (pins.some((p) => p.id === id))
      selectionTimer.current = setTimeout(() => setResourceId(id), 300);
    else {
      setResourceId("");
      onSelect(id);
    }
  };
  return (
    <section className="graph-panel knowledge-map">
      <div className="graph-top">
        <div>
          <span className="eyebrow">YOUR KNOWLEDGE, CONNECTED</span>
          <h1>
            {tree ? "An organized perspective" : "A wider perspective"}
            <span>.</span>
          </h1>
          <p>
            {filtered.length} {pins.length ? "items" : "notes"} <span>·</span>{" "}
            {edges.length} connections <span>·</span> {groups.length}{" "}
            neighborhoods
          </p>
        </div>
        <div className="map-actions">
          <button
            className="quiet-button"
            disabled={pending > 0}
            onClick={() => onSwitch(!tree)}
          >
            {tree ? "Graph view" : "Tree view"}
          </button>
          <button
            className="quiet-button"
            onClick={() => {
              setAdding(true);
              setError("");
            }}
          >
            <Plus size={14} />
            Add tool node
          </button>
          <button className="quiet-button" onClick={onSaveView}>
            <Plus size={14} />
            Save view
          </button>
        </div>
      </div>
      <div className="graph-filter">
        <Search size={14} />
        <input
          aria-label="Filter graph"
          placeholder="Filter by idea, tag: or path:"
          value={view.filter}
          onChange={(e) => onView({ filter: e.target.value })}
        />
        {view.filter && (
          <button
            title="Clear graph filter"
            onClick={() => onView({ filter: "" })}
          >
            <X size={13} />
          </button>
        )}
      </div>
      {error && !adding && (
        <div className="module-error" role="alert">
          {error}
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}
      {resource && pin && (
        <details className="resource-inspector" open>
          <summary>
            {resourceLabels[pin.target.kind]} · {resource.title}
          </summary>
          <div className="resource-actions">
            <label>
              Node color{" "}
              <input
                type="color"
                aria-label="Tool node color"
                value={colorFor(resource, vault.settings, groups)}
                onChange={(e) =>
                  onSettings({
                    noteColors: {
                      ...vault.settings.noteColors,
                      [pin.id]: e.target.value,
                    },
                  })
                }
              />
            </label>
            <button className="primary" onClick={() => open(pin.id)}>
              Open {resourceLabels[pin.target.kind].toLowerCase()}
            </button>
            <button
              onClick={() => {
                setAdding(true);
                setChoice(resourceKey(pin.target));
                setFolder(pin.folder);
                setParent(pin.parentNoteId ?? "");
              }}
            >
              Edit node location
            </button>
            <button
              onClick={() =>
                void commit((s) => {
                  s.resources = s.resources.filter((p) => p.id !== pin.id);
                })
                  .then(() => setResourceId(""))
                  .catch((e) => setError(String(e)))
              }
            >
              Remove from map
            </button>
            <button onClick={() => setResourceId("")}>Close details</button>
          </div>
          <div className="resource-connect">
            <select
              aria-label="Tool relationship"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {[
                "relates to",
                "supports",
                "contradicts",
                "depends on",
                "contains",
                "uses data from",
              ].map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
            <select
              aria-label="Connect tool to"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              <option value="">Choose a note or tool</option>
              {notes
                .filter((n) => n.id !== pin.id)
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.path}
                  </option>
                ))}
            </select>
            <button
              disabled={!target}
              onClick={() => {
                if (
                  vault.settings.relations.some(
                    (r) =>
                      r.source === pin.id &&
                      r.target === target &&
                      r.kind === kind,
                  )
                ) {
                  setError("That connection already exists.");
                  return;
                }
                onSettings({
                  relations: [
                    ...vault.settings.relations,
                    { id: crypto.randomUUID(), source: pin.id, target, kind },
                  ],
                });
              }}
            >
              Connect tool
            </button>
          </div>
          <div className="resource-relations">
            {edges
              .filter((e) => e.source === pin.id || e.target === pin.id)
              .map((e) => (
                <div key={e.id}>
                  <button
                    onClick={() =>
                      open(e.source === pin.id ? e.target : e.source)
                    }
                  >
                    {e.kind} ·{" "}
                    {notes.find(
                      (n) =>
                        n.id === (e.source === pin.id ? e.target : e.source),
                    )?.title ?? "Missing item"}
                  </button>
                  {e.origin === "manual" ? (
                    <>
                      <button onClick={() => setEvidenceId(e.id)}>
                        Evidence ({e.evidence?.length ?? 0})
                      </button>
                      <button
                        aria-label="Remove tool connection"
                        onClick={() =>
                          onSettings({
                            relations: vault.settings.relations.filter(
                              (r) => r.id !== e.id,
                            ),
                          })
                        }
                      >
                        ×
                      </button>
                    </>
                  ) : (
                    <small>From source data</small>
                  )}
                </div>
              ))}
          </div>
        </details>
      )}
      {tree ? (
        <TreeDiagram
          notes={notes}
          selected={active}
          filter={view.filter}
          onSelect={select}
          onOpen={open}
        />
      ) : (
        <Graph
          notes={filtered}
          edges={edges}
          settings={vault.settings}
          view={view}
          selected={active}
          groups={groups}
          onSelect={select}
          onOpen={open}
          onMove={(id, point) =>
            onView({ positions: { ...view.positions, [id]: point } })
          }
          onEdge={(e) => {
            if (e.origin === "manual") setEvidenceId(e.id);
          }}
        />
      )}
      <div className="graph-legend">
        {groups.map((g, i) => (
          <button
            key={g}
            onClick={() =>
              onView({ filter: view.filter === `path:${g}` ? "" : `path:${g}` })
            }
          >
            <span
              style={{
                background:
                  vault.settings.colors[g] ?? PALETTE[i % PALETTE.length],
              }}
            />
            {g.replace(/^\d+\s*/, "")}
          </button>
        ))}
      </div>
      {adding && (
        <ModuleDialog
          label="Add tool to knowledge map"
          onClose={() => setAdding(false)}
        >
          <form
            className="module-form"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const r = catalog.find((r) => resourceKey(r.target) === choice);
                if (!r)
                  throw new Error(
                    "Choose an existing tool item. Create it in its module first.",
                  );
                await commit((s) => {
                  const old = s.resources.find(
                    (p) => resourceKey(p.target) === choice,
                  );
                  if (old) {
                    old.folder = folder;
                    old.parentNoteId = parent || undefined;
                    setResourceId(old.id);
                  } else {
                    const id = crypto.randomUUID();
                    s.resources.push({
                      id,
                      target: r.target,
                      folder,
                      parentNoteId: parent || undefined,
                    });
                    setResourceId(id);
                  }
                });
                setAdding(false);
                setError("");
              } catch (err) {
                setError(String(err));
              }
            }}
          >
            <h2>Connect a tool to your knowledge</h2>
            <p>
              This node opens the original item. Edits stay shared across the
              map and its module.
            </p>
            <label>
              Tool item
              <select
                aria-label="Map tool item"
                value={choice}
                onChange={(e) => setChoice(e.target.value)}
                required
              >
                <option value="">Choose an existing item</option>
                {catalog.map((r) => (
                  <option
                    key={resourceKey(r.target)}
                    value={resourceKey(r.target)}
                  >
                    {resourceLabels[r.target.kind]} · {r.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Map folder
              <input
                aria-label="Map folder"
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                maxLength={300}
              />
            </label>
            <label>
              Parent note
              <select
                aria-label="Map parent note"
                value={parent}
                onChange={(e) => setParent(e.target.value)}
              >
                <option value="">No parent</option>
                {vault.notes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.path}
                  </option>
                ))}
              </select>
            </label>
            <p>
              Map folders organize tool nodes without moving files. Parent notes
              determine their position in the metadata tree.
            </p>
            {error && (
              <p className="module-error" role="alert">
                {error}
              </p>
            )}
            <footer>
              <button type="button" onClick={() => setAdding(false)}>
                Cancel
              </button>
              <button className="primary" disabled={pending > 0}>
                Save tool node
              </button>
            </footer>
          </form>
        </ModuleDialog>
      )}
      {relation && (
        <ConnectionEvidence
          relation={relation}
          vault={vault}
          onClose={() => setEvidenceId("")}
          onChange={(evidence) =>
            onSettings({
              relations: vault.settings.relations.map((r) =>
                r.id === relation.id ? { ...r, evidence } : r,
              ),
            })
          }
          onOpenNote={onEvidenceNote}
          onOpenResource={onOpenResource}
        />
      )}
    </section>
  );
}
