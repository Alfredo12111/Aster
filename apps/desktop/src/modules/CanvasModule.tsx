import ModuleDialog from "./ModuleDialog";
import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Grip,
  Pencil,
  Trash2,
  Database,
  Check,
  Maximize2,
} from "lucide-react";
import {
  displayValue,
  parseQuery,
  type Filter,
  type executeQuery,
} from "../../../../packages/core/query";
import type { QueryCard } from "../../../../packages/core/modules";
import type { ModuleProps } from "./ModuleHost";
type Result = { result?: ReturnType<typeof executeQuery>; error?: string };
export default function CanvasModule({
  vault,
  state,
  commit,
  onOpen,
  resource,
}: ModuleProps) {
  const [boardId, setBoardId] = useState(
      resource?.kind === "canvas" ? resource.id : (state.boards[0]?.id ?? ""),
    ),
    [editing, setEditing] = useState<QueryCard | null>(null),
    [boardName, setBoardName] = useState(""),
    [newBoard, setNewBoard] = useState(false),
    [error, setError] = useState(""),
    [results, setResults] = useState<Record<string, Result>>({}),
    [querying, setQuerying] = useState(false);
  const [live, setLive] = useState<Record<string, Partial<QueryCard>>>({}),
    drag = useRef<{
      id: string;
      x: number;
      y: number;
      card: QueryCard;
      resize: boolean;
    } | null>(null);
  const board = state.boards.find((b) => b.id === boardId) ?? state.boards[0];
  const [builder, setBuilder] = useState({
    columns: "file.name, status",
    folder: "",
    field: "",
    op: "=",
    value: "",
    sort: "file.name",
    direction: "ASC",
    limit: 50,
  });
  const [saving, setSaving] = useState(false);
  const [builderAvailable, setBuilderAvailable] = useState(true);
  const additionalFilters = useRef<Filter[]>([]);
  useEffect(() => {
    if (!board) {
      setResults({});
      return;
    }
    setQuerying(true);
    const worker = new Worker(new URL("./query.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (e) => {
      setResults(e.data.results);
      setQuerying(false);
    };
    worker.onerror = () => {
      setError("Query worker failed. Edit a card or reopen Canvas to retry.");
      setQuerying(false);
    };
    worker.postMessage({
      requestId: Date.now(),
      notes: vault.notes.map((n) => ({
        ...n,
        content: n.metadata ? "" : n.content,
      })),
      cards: board.cards.map((c) => ({ id: c.id, query: c.query })),
    });
    return () => worker.terminate();
  }, [
    vault.notes,
    board?.id,
    JSON.stringify(board?.cards.map((c) => [c.id, c.query])),
  ]);
  const syncBuilder = (query: string) => {
    try {
      const p = parseQuery(query);
      additionalFilters.current = p.filters.slice(1);
      setBuilder({
        columns: p.columns.join(", "),
        folder: p.folder,
        field: p.filters[0]?.field ?? "",
        op: p.filters[0]?.op ?? "=",
        value: JSON.stringify(p.filters[0]?.value ?? ""),
        sort: p.sort,
        direction: p.direction,
        limit: p.limit,
      });
      setBuilderAvailable(true);
    } catch {
      setBuilderAvailable(false);
    }
  };
  const edit = (card: QueryCard) => {
    setEditing({ ...card });
    setError("");
    syncBuilder(card.query);
  };
  const updateBuilder = (patch: Partial<typeof builder>) => {
    const b = { ...builder, ...patch };
    setBuilder(b);
    let value: unknown = b.value;
    try {
      const parsed = JSON.parse(b.value);
      if (
        parsed === null ||
        ["string", "number", "boolean"].includes(typeof parsed)
      )
        value = parsed;
    } catch {}
    const extraFilters = additionalFilters.current
      .map((f) => `WHERE ${f.field} ${f.op} ${JSON.stringify(f.value)}\n`)
      .join("");
    const query = `SELECT ${b.columns}\n${b.folder ? `FROM ${JSON.stringify(b.folder)}\n` : ""}${b.field ? `WHERE ${b.field} ${b.op} ${JSON.stringify(value)}\n` : ""}${extraFilters}SORT ${b.sort} ${b.direction}\nLIMIT ${b.limit}`;
    setEditing((e) => (e ? { ...e, query } : e));
  };
  const save = async () => {
    if (!editing || !board) return;
    setError("");
    try {
      parseQuery(editing.query);
      setSaving(true);
      await commit((s) => {
        const b = s.boards.find((b) => b.id === board.id)!;
        const i = b.cards.findIndex((c) => c.id === editing.id);
        if (i < 0) b.cards.push(editing);
        else b.cards[i] = editing;
      });
      setEditing(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };
  const begin = (e: React.PointerEvent, id: string, resize = false) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const c = board!.cards.find((c) => c.id === id)!;
    drag.current = { id, x: e.clientX, y: e.clientY, card: c, resize };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x,
      dy = e.clientY - d.y;
    setLive({
      [d.id]: d.resize
        ? {
            width: Math.max(280, Math.min(2000, d.card.width + dx)),
            height: Math.max(180, Math.min(2000, d.card.height + dy)),
          }
        : { x: Math.max(0, d.card.x + dx), y: Math.max(0, d.card.y + dy) },
    });
  };
  const end = async (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const patch = live[d.id];
    if (patch)
      try {
        await commit((s) => {
          Object.assign(
            s.boards
              .find((b) => b.id === board!.id)!
              .cards.find((c) => c.id === d.id)!,
            patch,
          );
        });
      } catch {}
    setLive({});
  };
  return (
    <div className="canvas-module">
      <header className="module-page-heading">
        <div>
          <span className="eyebrow">LIVE VIEWS OF YOUR VAULT</span>
          <h1>Canvas</h1>
        </div>
        <div className="module-toolbar">
          <select
            aria-label="Canvas board"
            value={board?.id ?? ""}
            onChange={(e) => setBoardId(e.target.value)}
          >
            {!state.boards.length && <option value="">No boards yet</option>}
            {state.boards.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <button
            className="quiet-button"
            onClick={() => {
              setBoardName("");
              setNewBoard(true);
            }}
          >
            New board
          </button>
          <button
            className="primary"
            disabled={!board}
            onClick={() =>
              edit({
                id: crypto.randomUUID(),
                title: "Live query",
                query:
                  "SELECT file.name, status, tags\nSORT file.name ASC\nLIMIT 50",
                x: 35 + (board!.cards.length % 2) * 500,
                y: 35 + Math.floor(board!.cards.length / 2) * 390,
                width: 450,
                height: 340,
              })
            }
          >
            <Plus size={14} />
            Pin query card
          </button>
        </div>
      </header>
      <div className="canvas-info">
        <span>
          <Database size={13} />
          {board?.cards.length ?? 0} live cards
        </span>
        <span>
          {querying ? "Updating queries…" : "Updates when vault data changes"}
        </span>
        <span>Drag a card header · Resize from its corner</span>
      </div>
      <div className="canvas-scroll">
        <div
          className="canvas-stage"
          style={{
            width: Math.max(
              1800,
              ...(board?.cards.map((c) => c.x + c.width + 300) ?? []),
            ),
            height: Math.max(
              1200,
              ...(board?.cards.map((c) => c.y + c.height + 300) ?? []),
            ),
          }}
        >
          {board?.cards.map((original) => {
            const c = { ...original, ...live[original.id] },
              data = results[c.id];
            return (
              <article
                className="query-card"
                key={c.id}
                data-card-id={c.id}
                style={{
                  left: c.x,
                  top: c.y,
                  width: c.width,
                  height: c.height,
                }}
              >
                <header
                  onPointerDown={(e) => begin(e, c.id)}
                  onPointerMove={move}
                  onPointerUp={(e) => void end(e)}
                  onPointerCancel={() => {
                    drag.current = null;
                    setLive({});
                  }}
                >
                  <Grip size={15} />
                  <strong>{c.title}</strong>
                  <button
                    title={`Edit query ${c.title}`}
                    onClick={() => edit(original)}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    title={`Remove card ${c.title}`}
                    onClick={() =>
                      void commit((s) => {
                        const b = s.boards.find((b) => b.id === board!.id)!;
                        b.cards = b.cards.filter((c2) => c2.id !== c.id);
                      }).catch(() => {})
                    }
                  >
                    <Trash2 size={13} />
                  </button>
                </header>
                <div className="query-output">
                  {data?.error ? (
                    <p className="query-error">{data.error}</p>
                  ) : data?.result ? (
                    <>
                      <table>
                        <thead>
                          <tr>
                            {data.result.columns.map((col) => (
                              <th key={col}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {data.result.rows.map((row) => (
                            <tr
                              key={row.id}
                              onDoubleClick={() => onOpen(row.id)}
                            >
                              {row.values.map((v, i) => (
                                <td key={i}>
                                  {i === 0 ? (
                                    <button
                                      title={`Open ${row.title}`}
                                      onClick={() => onOpen(row.id)}
                                    >
                                      {displayValue(v)}
                                    </button>
                                  ) : (
                                    displayValue(v)
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!data.result.rows.length && (
                        <div className="module-empty">
                          No notes match this query.
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="module-empty">Running query…</div>
                  )}
                </div>
                <footer>
                  <span>
                    {data?.result
                      ? `${data.result.rows.length} of ${data.result.total} matching notes`
                      : "Aster Query"}
                  </span>
                  <Check size={12} />
                </footer>
                <div
                  className="card-resizer"
                  role="button"
                  aria-label={`Resize ${c.title}`}
                  tabIndex={0}
                  onPointerDown={(e) => begin(e, c.id, true)}
                  onPointerMove={move}
                  onPointerUp={(e) => void end(e)}
                  onKeyDown={(e) => {
                    if (
                      [
                        "ArrowRight",
                        "ArrowDown",
                        "ArrowLeft",
                        "ArrowUp",
                      ].includes(e.key)
                    ) {
                      e.preventDefault();
                      void commit((s) => {
                        const card = s.boards
                          .find((b) => b.id === board!.id)!
                          .cards.find((x) => x.id === c.id)!;
                        card.width = Math.max(
                          280,
                          Math.min(
                            2000,
                            card.width +
                              (e.key === "ArrowRight"
                                ? 20
                                : e.key === "ArrowLeft"
                                  ? -20
                                  : 0),
                          ),
                        );
                        card.height = Math.max(
                          180,
                          Math.min(
                            2000,
                            card.height +
                              (e.key === "ArrowDown"
                                ? 20
                                : e.key === "ArrowUp"
                                  ? -20
                                  : 0),
                          ),
                        );
                      }).catch(() => {});
                    }
                  }}
                >
                  <Maximize2 size={12} />
                </div>
              </article>
            );
          })}
          {!board && (
            <div className="canvas-welcome">
              <Database size={32} />
              <h2>Keep useful queries in view.</h2>
              <p>Create a board, then pin live tables from your vault.</p>
              <button className="primary" onClick={() => setNewBoard(true)}>
                Create a board
              </button>
            </div>
          )}
        </div>
      </div>
      {newBoard && (
        <ModuleDialog
          label="Canvas board editor"
          busy={saving}
          onClose={() => setNewBoard(false)}
        >
          <form
            className="module-dialog"
            onSubmit={async (e) => {
              e.preventDefault();
              const id = crypto.randomUUID();
              try {
                await commit((s) => {
                  s.boards.push({ id, name: boardName.trim(), cards: [] });
                });
                setBoardId(id);
                setNewBoard(false);
              } catch {}
            }}
          >
            <h2>Create a Canvas board</h2>
            <label>
              Board name
              <input
                required
                autoFocus
                value={boardName}
                onChange={(e) => setBoardName(e.target.value)}
              />
            </label>
            <div className="dialog-actions">
              <button type="button" onClick={() => setNewBoard(false)}>
                Cancel
              </button>
              <button className="primary" disabled={!boardName.trim()}>
                Create board
              </button>
            </div>
          </form>
        </ModuleDialog>
      )}
      {editing && (
        <ModuleDialog
          label="Query card editor"
          busy={saving}
          onClose={() => setEditing(null)}
        >
          <form
            className="module-dialog query-dialog"
            aria-label="Query card editor"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <h2>Pin a live query</h2>
            <label>
              Card title
              <input
                required
                value={editing.title}
                onChange={(e) =>
                  setEditing({ ...editing, title: e.target.value })
                }
              />
            </label>
            <details open>
              <summary>Query builder</summary>
              <fieldset
                className="form-grid query-builder-fields"
                disabled={!builderAvailable}
              >
                <label>
                  Columns
                  <input
                    value={builder.columns}
                    onChange={(e) => updateBuilder({ columns: e.target.value })}
                  />
                </label>
                <label>
                  Folder
                  <select
                    aria-label="Query folder"
                    value={builder.folder}
                    onChange={(e) => updateBuilder({ folder: e.target.value })}
                  >
                    <option value="">Whole vault</option>
                    {vault.folders.map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Filter field
                  <input
                    placeholder="status"
                    value={builder.field}
                    onChange={(e) => updateBuilder({ field: e.target.value })}
                  />
                </label>
                <label>
                  Comparison
                  <select
                    aria-label="Query comparison"
                    value={builder.op}
                    onChange={(e) => updateBuilder({ op: e.target.value })}
                  >
                    {["=", "!=", "contains", ">", ">=", "<", "<="].map((op) => (
                      <option key={op}>{op}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Filter value
                  <input
                    value={builder.value}
                    onChange={(e) => updateBuilder({ value: e.target.value })}
                  />
                </label>
                <label>
                  Sort field
                  <input
                    value={builder.sort}
                    onChange={(e) => updateBuilder({ sort: e.target.value })}
                  />
                </label>
                <label>
                  Order
                  <select
                    aria-label="Query order"
                    value={builder.direction}
                    onChange={(e) =>
                      updateBuilder({ direction: e.target.value })
                    }
                  >
                    <option>ASC</option>
                    <option>DESC</option>
                  </select>
                </label>
                <label>
                  Row limit
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={builder.limit}
                    onChange={(e) => updateBuilder({ limit: +e.target.value })}
                  />
                </label>
              </fieldset>
              {!builderAvailable && (
                <p className="muted">
                  Correct the query syntax below to use the builder.
                </p>
              )}
            </details>
            <label>
              Aster query
              <textarea
                aria-label="Aster query"
                rows={6}
                value={editing.query}
                onChange={(e) => {
                  setEditing({ ...editing, query: e.target.value });
                  syncBuilder(e.target.value);
                }}
              />
            </label>
            <p className="muted">
              Use SELECT, FROM, WHERE, SORT and LIMIT, one clause per line.
              Multiple WHERE lines combine with AND. Values use JSON syntax. No
              JavaScript is executed.
            </p>
            {error && (
              <p className="module-error" role="alert">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              <button type="button" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button className="primary" disabled={saving}>
                Save query card
              </button>
            </div>
          </form>
        </ModuleDialog>
      )}
    </div>
  );
}
