import { useMemo, useRef, useState } from "react";
import { resourceLabels } from "../../../packages/core/resources";
import type { Note } from "../../../packages/core/types";
import { folderTree, metadataTree } from "../../../packages/core/hierarchy";
import { diagramLayout } from "../../../packages/core/tree-layout";
import { matchesNote } from "../../../packages/core/knowledge";
import { useTabState } from "./modules/ModuleProvider";
export default function TreeDiagram({
  notes,
  selected,
  filter,
  onSelect,
  onOpen,
}: {
  notes: Note[];
  selected: string;
  filter: string;
  onSelect(id: string): void;
  onOpen(id: string): void;
}) {
  const [mode, setMode] = useTabState("tree-mode", "folders"),
    [field, setField] = useTabState("tree-parent-field", "parent"),
    [collapsed, setCollapsed] = useTabState<string[]>("tree-collapsed", []),
    [zoom, setZoom] = useState(1);
  const byId = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes]);
  const box = useRef<HTMLDivElement>(null);
  const roots = useMemo(
    () => (mode === "folders" ? folderTree(notes) : metadataTree(notes, field)),
    [notes, mode, field],
  );
  const ids = useMemo(() => {
    const result: string[] = [],
      stack = [...roots];
    while (stack.length) {
      const n = stack.pop()!;
      result.push(n.id);
      stack.push(...n.children);
    }
    return result;
  }, [roots]);
  const expanded = useMemo(
    () => new Set(ids.filter((id) => !collapsed.includes(id))),
    [ids, collapsed],
  );
  const matching = useMemo(
    () =>
      filter
        ? new Set(notes.filter((n) => matchesNote(n, filter)).map((n) => n.id))
        : undefined,
    [notes, filter],
  );
  const diagram = useMemo(
    () => diagramLayout(roots, expanded, matching),
    [roots, expanded, matching],
  );
  const toggle = (id: string) =>
    setCollapsed((list) =>
      list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
    );
  return (
    <div className="tree-diagram">
      <div className="tree-toolbar">
        <label>
          Hierarchy
          <select
            aria-label="Tree hierarchy"
            value={mode}
            onChange={(e) => {
              setMode(e.target.value);
              setCollapsed([]);
            }}
          >
            <option value="folders">Folders</option>
            <option value="parents">Parent metadata</option>
          </select>
        </label>
        {mode === "parents" && (
          <label>
            Parent field
            <input
              aria-label="Tree parent field"
              value={field}
              onChange={(e) => setField(e.target.value)}
            />
          </label>
        )}
        <button onClick={() => setCollapsed([])}>Expand branches</button>
        <button onClick={() => setCollapsed(ids)}>Collapse branches</button>
        <button
          aria-label="Zoom tree out"
          onClick={() => setZoom((z) => Math.max(0.15, z / 1.2))}
        >
          −
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button
          aria-label="Zoom tree in"
          onClick={() => setZoom((z) => Math.min(2, z * 1.2))}
        >
          ＋
        </button>
        <button
          onClick={() => {
            setZoom(
              Math.max(
                0.15,
                Math.min(1, (box.current?.clientWidth ?? 800) / diagram.width),
              ),
            );
            box.current?.scrollTo(0, 0);
          }}
        >
          Fit tree
        </button>
      </div>
      <div className="tree-scroll" ref={box}>
        <div
          style={{
            width: diagram.width * zoom,
            height: diagram.height * zoom,
            position: "relative",
          }}
        >
          <div
            style={{
              width: diagram.width,
              height: diagram.height,
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
              position: "absolute",
            }}
          >
            <svg
              className="tree-connectors"
              width={diagram.width}
              height={diagram.height}
              aria-hidden="true"
            >
              {diagram.edges.map((e) => (
                <path
                  key={e.child}
                  d={`M ${e.from.x + 102} ${e.from.y + 64} V ${e.to.y - 27} H ${e.to.x + 102} V ${e.to.y}`}
                />
              ))}
            </svg>
            {diagram.nodes.map(({ node, x, y, count }) => (
              <div
                key={node.id}
                className={
                  "tree-node " +
                  (selected === node.noteId ? "selected " : "") +
                  (node.issue ? "issue" : "")
                }
                style={{ left: x, top: y }}
              >
                <button
                  className="tree-node-open"
                  title={node.issue ?? node.label}
                  onClick={() =>
                    node.noteId ? onSelect(node.noteId) : toggle(node.id)
                  }
                  onDoubleClick={() => node.noteId && onOpen(node.noteId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && node.noteId) {
                      e.preventDefault();
                      onOpen(node.noteId);
                    }
                  }}
                >
                  <small>
                    {node.issue
                      ? "Hierarchy issue"
                      : !node.noteId
                        ? "Folder"
                        : (resourceLabels[
                            byId.get(node.noteId)?.metadata
                              ?.asterResource as keyof typeof resourceLabels
                          ] ?? "Note")}
                  </small>
                  <strong>{node.label}</strong>
                </button>
                {!!node.children.length && (
                  <button
                    className="tree-node-toggle"
                    aria-label={`${expanded.has(node.id) ? "Collapse" : "Expand"} ${node.label}`}
                    onClick={() => toggle(node.id)}
                  >
                    {expanded.has(node.id) ? "−" : "+"} {count}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="tree-caption">
        {diagram.nodes.length} items · Double-click to open · Branches follow{" "}
        {mode === "folders" ? "folders" : field + " metadata"}
        {diagram.truncated && (
          <strong>
            {" "}
            · View limited to 600 items. Filter or collapse branches to narrow
            the diagram.
          </strong>
        )}
      </div>
    </div>
  );
}
