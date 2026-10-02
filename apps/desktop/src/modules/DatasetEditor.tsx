import { useEffect, useMemo, useRef, useState } from "react";
import {
  syncWorkbookCharts,
  type ChartRestore,
  type StructureEdit,
} from "../../../../packages/core/workbook-charts";
import ModuleDialog from "./ModuleDialog";
import {
  changeStructure,
  fillRange,
  renameSheet,
  visibleRows,
  formatCell,
} from "../../../../packages/core/workbook-tools";
import { statistics } from "../../../../packages/core/chart-math";
import { Plus, Undo2, Redo2, BarChart3, Download, Eraser } from "lucide-react";
import type { Dataset, CellValue } from "../../../../packages/core/chart-model";
import {
  MAX_CELLS,
  MAX_COLS,
  MAX_ROWS,
  datasetSchema,
} from "../../../../packages/core/chart-model";
import {
  columnName,
  parseDelimited,
  toCsv,
  dataRange,
} from "../../../../packages/core/chart-data";
import { chartWorker, runChartWorker } from "./chart-worker";
import { useModules, type Commit } from "./ModuleProvider";
type History = { dataset: Dataset; charts: ChartRestore[] };
type Position = { row: number; col: number };
export default function DatasetEditor({
  dataset,
  commit,
  onChart,
}: {
  dataset: Dataset;
  commit: Commit;
  onChart(sheet: string, range: string): void;
}) {
  const { registerFlush } = useModules();
  const [filter, setFilter] = useState(""),
    [filterColumn, setFilterColumn] = useState("all"),
    [operator, setOperator] = useState("contains"),
    [sortColumn, setSortColumn] = useState(""),
    [descending, setDescending] = useState(false),
    [goto, setGoto] = useState("");
  const [dialog, setDialog] = useState<
      "rename-workbook" | "rename-sheet" | "delete-sheet" | null
    >(null),
    [name, setName] = useState("");
  const root = useRef<HTMLDivElement>(null),
    savePromise = useRef<Promise<void> | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0),
    [page, setPage] = useState(0),
    [anchor, setAnchor] = useState<Position>({ row: 0, col: 0 }),
    [end, setEnd] = useState<Position>({ row: 0, col: 0 });
  const [calculated, setCalculated] = useState<CellValue[][]>([]),
    [warnings, setWarnings] = useState<string[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [formula, setFormula] = useState(""),
    editing = useRef(false),
    editRef = useRef({ sheet: 0, row: 0, col: 0, value: "" }),
    latest = useRef(dataset);
  latest.current = dataset;
  const [undo, setUndo] = useState<History[]>([]),
    [redo, setRedo] = useState<History[]>([]),
    dragging = useRef(false),
    [functions, setFunctions] = useState<string[]>([]),
    [help, setHelp] = useState(false);
  const sheet = dataset.sheets[sheetIndex] ?? dataset.sheets[0],
    width = Math.max(2, ...sheet.rows.map((r) => r.length)),
    height = Math.max(2, sheet.rows.length),
    pageSize = 25;
  useEffect(() => {
    if (sheetIndex >= dataset.sheets.length) {
      setSheetIndex(0);
      setPage(0);
      setAnchor({ row: 0, col: 0 });
      setEnd({ row: 0, col: 0 });
    }
  }, [dataset.sheets.length, sheetIndex]);
  const from = {
      row: Math.min(anchor.row, end.row),
      col: Math.min(anchor.col, end.col),
    },
    to = {
      row: Math.max(anchor.row, end.row),
      col: Math.max(anchor.col, end.col),
    };
  const range =
    columnName(from.col) +
    (from.row + 1) +
    ":" +
    columnName(to.col) +
    (to.row + 1);
  const viewRows = useMemo(
    () =>
      visibleRows(
        calculated,
        height,
        filter,
        filterColumn === "all" ? null : Number(filterColumn),
        operator,
        sortColumn === "" ? null : Number(sortColumn),
        descending,
      ),
    [
      calculated,
      height,
      filter,
      filterColumn,
      operator,
      sortColumn,
      descending,
    ],
  );
  const transformed = !!filter || sortColumn !== "";
  useEffect(
    () => setPage(0),
    [filter, filterColumn, operator, sortColumn, descending, sheetIndex],
  );
  useEffect(() => {
    if (page * pageSize >= viewRows.length)
      setPage(Math.max(0, Math.ceil(viewRows.length / pageSize) - 1));
  }, [viewRows.length, page]);
  const summary = useMemo(() => {
    const values: CellValue[] = [];
    for (let r = from.row; r <= to.row; r++)
      for (let c = from.col; c <= to.col; c++)
        values.push(calculated[r]?.[c] ?? null);
    const numbers = values.filter(
      (v): v is number => typeof v === "number" && Number.isFinite(v),
    );
    return {
      filled: values.filter((v) => v !== null && v !== "").length,
      errors: values.filter(
        (v) => typeof v === "string" && /^#[A-Z0-9/]+[!?]$/.test(v),
      ).length,
      stats: statistics(numbers),
    };
  }, [calculated, range]);
  useEffect(() => {
    setError("");
    return chartWorker<{
      sheets: { name: string; rows: CellValue[][] }[];
      warnings: string[];
    }>(
      { kind: "workbook", dataset },
      (r) => {
        setCalculated(r.sheets[sheetIndex]?.rows ?? []);
        setWarnings(r.warnings);
      },
      setError,
    );
  }, [dataset.id, dataset.updatedAt, sheetIndex]);
  const apply = async (
    next: Dataset,
    remember = true,
    structure?: StructureEdit,
    restore?: ChartRestore[],
  ) => {
    let charts: ChartRestore[] = [];
    const previous = structuredClone(latest.current),
      expected = previous.updatedAt;
    setBusy(true);
    setError("");
    try {
      const parsed = datasetSchema.parse({
        ...next,
        updatedAt: Math.max(Date.now(), expected + 1),
      });
      await commit((s) => {
        const index = s.datasets.findIndex((d) => d.id === dataset.id);
        if (index < 0) throw new Error("This workbook was removed.");
        if (s.datasets[index].updatedAt !== expected)
          throw new Error(
            "This workbook changed in another pane. Reopen it before editing.",
          );
        s.datasets[index] = parsed;
        charts = syncWorkbookCharts(
          s.charts,
          previous,
          parsed,
          structure,
          restore,
        );
      });
      if (remember) {
        setUndo((u) => [...u.slice(-9), { dataset: previous, charts }]);
        setRedo([]);
      }
      latest.current = parsed;
      return { dataset: previous, charts };
    } catch (e) {
      setError(String(e));
      throw e;
    } finally {
      setBusy(false);
    }
  };
  const flushRef = useRef<() => void>(() => {});
  const saveFormula = async () => {
    if (savePromise.current) await savePromise.current;
    if (!editing.current) return;
    const edit = editRef.current;
    editing.current = false;
    const next = structuredClone(latest.current),
      rows = next.sheets[edit.sheet].rows;
    while (rows.length <= edit.row) rows.push([]);
    while (rows[edit.row].length <= edit.col) rows[edit.row].push("");
    rows[edit.row][edit.col] = edit.value;
    const pending = apply(next)
      .then(() => {})
      .catch((error) => {
        editing.current = true;
        throw error;
      });
    savePromise.current = pending;
    try {
      await pending;
    } finally {
      savePromise.current = null;
    }
  };
  const mutate = async (
    fn: (d: Dataset) => Dataset,
    structure?: StructureEdit,
  ) => {
    try {
      await saveFormula();
      await apply(fn(structuredClone(latest.current)), true, structure);
    } catch (e) {
      setError(String(e));
    }
  };
  flushRef.current = () => {
    void saveFormula().catch(() => {});
  };
  const saveLatest = useRef(saveFormula);
  saveLatest.current = saveFormula;
  useEffect(() => registerFlush(() => saveLatest.current()), [registerFlush]);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (editing.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const up = () => {
      dragging.current = false;
    };
    window.addEventListener("beforeunload", guard);
    window.addEventListener("pointerup", up);
    return () => {
      flushRef.current();
      window.removeEventListener("beforeunload", guard);
      window.removeEventListener("pointerup", up);
    };
  }, []);
  useEffect(() => {
    if (!editing.current)
      setFormula(sheet.rows[anchor.row]?.[anchor.col] ?? "");
  }, [sheet, anchor]);
  const select = (p: Position, extend = false) => {
    if (extend && transformed) {
      setError(
        "Reset filters and sorting before selecting a range. Single-cell edits still update the original row.",
      );
      return;
    }
    void saveFormula().catch(() => {});
    if (!extend) setAnchor(p);
    setEnd(p);
  };
  const matrix = async (values: string[][]) => {
    if (transformed && (values.length > 1 || from.row !== to.row)) {
      setError("Reset the view before changing multiple rows.");
      return;
    }
    try {
      await saveFormula();
    } catch {
      return;
    }
    const next = structuredClone(latest.current),
      rows = next.sheets[sheetIndex].rows;
    if (
      from.row + values.length > MAX_ROWS ||
      from.col + Math.max(...values.map((r) => r.length)) > MAX_COLS
    ) {
      setError("Pasted cells exceed the worksheet limits.");
      return;
    }
    values.forEach((row, r) =>
      row.forEach((v, c) => {
        while (rows.length <= from.row + r) rows.push([]);
        while (rows[from.row + r].length <= from.col + c)
          rows[from.row + r].push("");
        rows[from.row + r][from.col + c] = v;
      }),
    );
    void apply(next).catch(() => {});
  };
  const exportData = async (
    format: "csv" | "xlsx",
    formulas = false,
    visible = false,
  ) => {
    setBusy(true);
    try {
      await saveFormula();
      if (format === "csv") {
        const result = await runChartWorker<{
          sheets: { rows: CellValue[][] }[];
        }>({ kind: "workbook", dataset: latest.current });
        const rows = result.sheets[sheetIndex].rows;
        const indexes = visibleRows(
          rows,
          height,
          filter,
          filterColumn === "all" ? null : Number(filterColumn),
          operator,
          sortColumn === "" ? null : Number(sortColumn),
          descending,
        );
        await window.aster.exportAsset({
          name: dataset.name + "-" + sheet.name,
          format,
          data: toCsv(visible ? indexes.map((i) => rows[i] ?? []) : rows),
        });
      } else {
        const bytes = await runChartWorker<Uint8Array>({
          kind: "export",
          dataset: latest.current,
          formulas,
        });
        let binary = "";
        for (let i = 0; i < bytes.length; i += 8192)
          binary += String.fromCharCode(...bytes.slice(i, i + 8192));
        await window.aster.exportAsset({
          name: dataset.name,
          format,
          data: btoa(binary),
        });
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="dataset-editor" ref={root}>
      <div className="dataset-toolbar">
        <strong>{dataset.name}</strong>
        <button
          disabled={busy}
          onClick={() => {
            setDialog("rename-workbook");
            setName(dataset.name);
          }}
        >
          Rename workbook
        </button>
        <select
          aria-label="Worksheet"
          value={sheetIndex}
          onChange={(e) => {
            void saveFormula().catch(() => {});
            setSheetIndex(+e.target.value);
            setPage(0);
            setAnchor({ row: 0, col: 0 });
            setEnd({ row: 0, col: 0 });
          }}
        >
          {dataset.sheets.map((s, i) => (
            <option key={s.name} value={i}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          disabled={busy}
          onClick={() => {
            setDialog("rename-sheet");
            setName(sheet.name);
          }}
        >
          Rename sheet
        </button>
        <button
          disabled={busy || dataset.sheets.length >= 20}
          onClick={() =>
            void mutate((d) => {
              let suffix = 2,
                newName = sheet.name.slice(0, 25) + " copy";
              while (d.sheets.some((s) => s.name === newName))
                newName = sheet.name.slice(0, 23) + " copy " + suffix++;
              d.sheets.push({
                ...structuredClone(d.sheets[sheetIndex]),
                name: newName,
              });
              return d;
            })
          }
        >
          Duplicate sheet
        </button>
        <button
          disabled={busy || dataset.sheets.length === 1}
          onClick={() => setDialog("delete-sheet")}
        >
          Delete sheet
        </button>
        <button
          title="Add worksheet"
          disabled={busy || dataset.sheets.length >= 20}
          onClick={async () => {
            try {
              await saveFormula();
            } catch {
              return;
            }
            const next = structuredClone(latest.current);
            let n = next.sheets.length + 1;
            while (next.sheets.some((s) => s.name === "Sheet" + n)) n++;
            next.sheets.push({
              name: "Sheet" + n,
              rows: [
                ["Category", "Value"],
                ["", ""],
              ],
            });
            void apply(next)
              .then(() => {
                setSheetIndex(next.sheets.length - 1);
                setPage(0);
              })
              .catch(() => {});
          }}
        >
          <Plus size={13} />
        </button>
        <button
          title="Undo data edit"
          disabled={!undo.length || busy}
          onClick={() => {
            const previous = undo.at(-1)!;
            void apply(previous.dataset, false, undefined, previous.charts)
              .then((inverse) => {
                setRedo((r) => [...r, inverse]);
                setUndo((u) => u.slice(0, -1));
              })
              .catch(() => {});
          }}
        >
          <Undo2 size={14} />
        </button>
        <button
          title="Redo data edit"
          disabled={!redo.length || busy}
          onClick={() => {
            const next = redo.at(-1)!;
            void apply(next.dataset, false, undefined, next.charts)
              .then((inverse) => {
                setUndo((u) => [...u, inverse]);
                setRedo((r) => r.slice(0, -1));
              })
              .catch(() => {});
          }}
        >
          <Redo2 size={14} />
        </button>
        <button onClick={() => void exportData("csv")} disabled={busy}>
          <Download size={13} />
          CSV
        </button>
        <button onClick={() => void exportData("xlsx")} disabled={busy}>
          Excel
        </button>
        <button onClick={() => void exportData("xlsx", true)} disabled={busy}>
          Excel with formulas
        </button>
      </div>
      <div className="sheet-analysis-toolbar">
        <label>
          Filter column
          <select
            aria-label="Workbook filter column"
            value={filterColumn}
            onChange={(e) => setFilterColumn(e.target.value)}
          >
            <option value="all">All columns</option>
            {Array.from({ length: width }, (_, c) => (
              <option key={c} value={c}>
                {columnName(c)} · {sheet.rows[0]?.[c] ?? ""}
              </option>
            ))}
          </select>
        </label>
        <select
          aria-label="Workbook filter operator"
          value={operator}
          onChange={(e) => setOperator(e.target.value)}
        >
          <option value="contains">Contains</option>
          <option value="equals">Equals</option>
          <option value="gt">Greater than</option>
          <option value="lt">Less than</option>
        </select>
        <input
          aria-label="Filter worksheet rows"
          placeholder="Filter rows"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <label>
          Sort
          <select
            aria-label="Sort worksheet by"
            value={sortColumn}
            onChange={(e) => setSortColumn(e.target.value)}
          >
            <option value="">Source order</option>
            {Array.from({ length: width }, (_, c) => (
              <option key={c} value={c}>
                {columnName(c)} · {sheet.rows[0]?.[c] ?? ""}
              </option>
            ))}
          </select>
        </label>
        <button onClick={() => setDescending((v) => !v)}>
          {descending ? "Descending" : "Ascending"}
        </button>
        <button
          onClick={() => {
            setFilter("");
            setSortColumn("");
          }}
        >
          Reset view
        </button>
        <button
          disabled={busy}
          onClick={() => void exportData("csv", false, true)}
        >
          Export visible CSV
        </button>
      </div>
      <div className="formula-bar">
        <span>
          {columnName(anchor.col)}
          {anchor.row + 1}
        </span>
        <b>ƒx</b>
        <input
          aria-label="Cell value or formula"
          disabled={busy}
          value={formula}
          onFocus={() => {
            editRef.current = { sheet: sheetIndex, ...anchor, value: formula };
          }}
          onChange={(e) => {
            setFormula(e.target.value);
            editing.current = true;
            editRef.current = {
              sheet: sheetIndex,
              ...anchor,
              value: e.target.value,
            };
          }}
          onBlur={() => void saveFormula().catch(() => {})}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              void saveFormula().catch(() => {});
              e.currentTarget.blur();
            }
            if (e.key === "Escape") {
              editing.current = false;
              setFormula(sheet.rows[anchor.row]?.[anchor.col] ?? "");
              e.currentTarget.blur();
            }
          }}
        />
        <button
          onClick={() => {
            setHelp(!help);
            if (!functions.length)
              void runChartWorker<string[]>({ kind: "functions" })
                .then(setFunctions)
                .catch((e) => setError(String(e)));
          }}
        >
          Functions
        </button>
      </div>
      <div className="sheet-range-toolbar">
        <input
          aria-label="Select worksheet range"
          placeholder="A1:D20"
          value={goto}
          onChange={(e) => setGoto(e.target.value)}
        />
        <button
          onClick={() => {
            try {
              const bounds = dataRange(goto, height, width);
              setFilter("");
              setSortColumn("");
              setAnchor(bounds.from);
              setEnd(bounds.to);
              setPage(Math.floor(bounds.from.row / pageSize));
              setError("");
            } catch (e) {
              setError(String(e));
            }
          }}
        >
          Select range
        </button>
        <label>
          Column format
          <select
            aria-label="Column format"
            value={sheet.columnFormats?.[String(anchor.col)] ?? "general"}
            disabled={busy}
            onChange={(e) => {
              const format = e.target.value as NonNullable<
                typeof sheet.columnFormats
              >[string];
              void mutate((d) => {
                const s = d.sheets[sheetIndex];
                s.columnFormats ??= {};
                for (let c = from.col; c <= to.col; c++)
                  s.columnFormats[c] = format;
                return d;
              });
            }}
          >
            {["general", "number", "percent", "currency", "date", "text"].map(
              (f) => (
                <option key={f} value={f}>
                  {f === "currency" ? "Currency (USD)" : f}
                </option>
              ),
            )}
          </select>
        </label>
        <button
          disabled={busy || transformed || from.row === to.row}
          onClick={() =>
            void mutate((d) => fillRange(d, sheetIndex, from, to, "down"))
          }
        >
          Fill down
        </button>
        <button
          disabled={busy || transformed || from.col === to.col}
          onClick={() =>
            void mutate((d) => fillRange(d, sheetIndex, from, to, "right"))
          }
        >
          Fill right
        </button>
      </div>
      {help && (
        <div className="formula-help">
          <p>
            Use =SUM(B2:B10), =AVERAGE(B2:B10), =PMT(0.01,12,1000), or
            references such as =Sheet2!B2*2. Prefix a value with an apostrophe
            to keep literal text.
          </p>
          <p>{functions.join(" · ")}</p>
        </div>
      )}
      {error && (
        <div className="module-error" role="alert">
          {error}
        </div>
      )}
      <div
        className="sheet-scroll"
        tabIndex={0}
        aria-label="Worksheet data grid"
        onPaste={(e) => {
          e.preventDefault();
          try {
            matrix(parseDelimited(e.clipboardData.getData("text/plain")));
          } catch (error) {
            setError(String(error));
          }
        }}
        onCopy={(e) => {
          e.preventDefault();
          e.clipboardData.setData(
            "text/plain",
            sheet.rows
              .slice(from.row, to.row + 1)
              .map((r) => r.slice(from.col, to.col + 1).join("\t"))
              .join("\n"),
          );
        }}
        onKeyDown={(e) => {
          if (
            ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Tab"].includes(
              e.key,
            )
          ) {
            e.preventDefault();
            const p = {
              row:
                viewRows[
                  Math.max(
                    0,
                    Math.min(
                      viewRows.length - 1,
                      Math.max(0, viewRows.indexOf(end.row)) +
                        (e.key === "ArrowDown"
                          ? 1
                          : e.key === "ArrowUp"
                            ? -1
                            : 0),
                    ),
                  )
                ] ?? 0,
              col: Math.max(
                0,
                Math.min(
                  width - 1,
                  end.col +
                    (e.key === "Tab" && e.shiftKey
                      ? -1
                      : e.key === "ArrowRight" || e.key === "Tab"
                        ? 1
                        : e.key === "ArrowLeft"
                          ? -1
                          : 0),
                ),
              ),
            };
            select(p, e.shiftKey && e.key !== "Tab");
            setPage(
              Math.floor(Math.max(0, viewRows.indexOf(p.row)) / pageSize),
            );
          }
          if (e.key === "Delete" || e.key === "Backspace") {
            e.preventDefault();
            matrix(
              Array.from({ length: to.row - from.row + 1 }, () =>
                Array(to.col - from.col + 1).fill(""),
              ),
            );
          }
          if (e.key === "Enter" || e.key === "F2") {
            e.preventDefault();
            (
              e.currentTarget.parentElement?.querySelector(
                '[aria-label="Cell value or formula"]',
              ) as HTMLInputElement
            )?.focus();
          }
        }}
      >
        <table className="data-grid">
          <thead>
            <tr>
              <th />
              {Array.from({ length: width }, (_, c) => (
                <th key={c}>{columnName(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from(
              { length: Math.min(pageSize, viewRows.length - page * pageSize) },
              (_, i) => {
                const r = viewRows[i + page * pageSize];
                return (
                  <tr key={r}>
                    <th>{r + 1}</th>
                    {Array.from({ length: width }, (_, c) => (
                      <td
                        key={c}
                        className={
                          (r >= from.row &&
                          r <= to.row &&
                          c >= from.col &&
                          c <= to.col
                            ? "range-selected "
                            : "") +
                          (r === anchor.row && c === anchor.col
                            ? "active-cell"
                            : "")
                        }
                        onPointerDown={(e) => {
                          e.preventDefault();
                          select({ row: r, col: c }, e.shiftKey);
                          dragging.current = true;
                          (
                            e.currentTarget.closest(
                              ".sheet-scroll",
                            ) as HTMLElement
                          )?.focus();
                        }}
                        onPointerEnter={() => {
                          if (dragging.current && !transformed)
                            setEnd({ row: r, col: c });
                        }}
                        onDoubleClick={() => {
                          const input = evaluateInput();
                          input?.focus();
                          input?.select();
                        }}
                        title={sheet.rows[r]?.[c] ?? ""}
                        aria-label={columnName(c) + (r + 1)}
                      >
                        {formatCell(
                          calculated[r]?.[c] ?? sheet.rows[r]?.[c] ?? "",
                          r === 0
                            ? "general"
                            : sheet.columnFormats?.[String(c)],
                        )}
                      </td>
                    ))}
                  </tr>
                );
              },
            )}
          </tbody>
        </table>
      </div>
      <div className="sheet-actions">
        {(["row", "column"] as const).flatMap((axis) =>
          [false, true].map((remove) => (
            <button
              key={axis + remove}
              disabled={busy || transformed}
              onClick={() =>
                void mutate(
                  (d) =>
                    changeStructure(
                      d,
                      sheetIndex,
                      axis,
                      axis === "row" ? anchor.row : anchor.col,
                      remove,
                    ),
                  {
                    sheet: sheet.name,
                    axis,
                    at: axis === "row" ? anchor.row : anchor.col,
                    remove,
                  },
                )
              }
            >
              {remove ? "Delete" : "Insert"} {axis}
            </button>
          )),
        )}
        <button
          disabled={busy || height >= MAX_ROWS}
          onClick={async () => {
            try {
              await saveFormula();
            } catch {
              return;
            }
            const next = structuredClone(latest.current);
            next.sheets[sheetIndex].rows.push(Array(width).fill(""));
            void apply(next).catch(() => {});
          }}
        >
          <Plus size={13} />
          Row
        </button>
        <button
          disabled={busy || width >= MAX_COLS}
          onClick={async () => {
            try {
              await saveFormula();
            } catch {
              return;
            }
            const next = structuredClone(latest.current);
            next.sheets[sheetIndex].rows = Array.from(
              { length: height },
              (_, r) => [
                ...Array.from(
                  { length: width },
                  (_, c) => sheet.rows[r]?.[c] ?? "",
                ),
                r === 0 ? columnName(width) : "",
              ],
            );
            void apply(next).catch(() => {});
          }}
        >
          <Plus size={13} />
          Column
        </button>
        <button
          disabled={busy}
          onClick={() =>
            matrix(
              Array.from({ length: to.row - from.row + 1 }, () =>
                Array(to.col - from.col + 1).fill(""),
              ),
            )
          }
        >
          <Eraser size={13} />
          Clear
        </button>
        <span>{range}</span>
        <button
          className="primary"
          disabled={busy || transformed || from.row === to.row}
          onClick={() => {
            void saveFormula()
              .then(() => onChart(sheet.name, range))
              .catch(() => {});
          }}
        >
          <BarChart3 size={14} />
          Chart selection
        </button>
      </div>
      <div className="sheet-pagination">
        <button disabled={!page} onClick={() => setPage((p) => p - 1)}>
          Previous rows
        </button>
        <span>
          {page * pageSize + 1}–
          {Math.min(viewRows.length, (page + 1) * pageSize)} of{" "}
          {viewRows.length} visible rows ({height} total)
        </span>
        <button
          disabled={(page + 1) * pageSize >= viewRows.length}
          onClick={() => setPage((p) => p + 1)}
        >
          Next rows
        </button>
        <small>
          First selected row becomes chart headers. Shift-click or drag to
          select a range.
        </small>
      </div>
      <div className="sheet-summary">
        Selection {range} · {summary.filled} filled · {summary.errors} errors
        {summary.stats && (
          <>
            {" "}
            · Sum {summary.stats.sum.toLocaleString()} · Mean{" "}
            {summary.stats.mean?.toLocaleString()} · Min {summary.stats.min} ·
            Max {summary.stats.max}
          </>
        )}
        {transformed && (
          <strong>
            {" "}
            · Sorted/filtered view keeps source row numbers. Reset view for
            range operations.
          </strong>
        )}
      </div>
      {dialog && (
        <ModuleDialog label="Workbook settings" onClose={() => setDialog(null)}>
          <form
            className="module-form"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await saveFormula();
                let d = structuredClone(latest.current);
                if (dialog === "rename-workbook") d.name = name;
                else if (dialog === "rename-sheet")
                  d = renameSheet(d, sheetIndex, name);
                else d.sheets.splice(sheetIndex, 1);
                await apply(d);
                if (dialog === "delete-sheet") setSheetIndex(0);
                setDialog(null);
              } catch (e) {
                setError(String(e));
              }
            }}
          >
            <h2>
              {dialog === "rename-workbook"
                ? "Rename workbook"
                : dialog === "rename-sheet"
                  ? "Rename worksheet"
                  : "Delete worksheet?"}
            </h2>
            {dialog === "delete-sheet" ? (
              <p>
                Remove this worksheet. Formulas that refer to it will show
                reference errors. You can undo this operation.
              </p>
            ) : (
              <label>
                Name
                <input
                  aria-label="Workbook item name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={dialog === "rename-sheet" ? 31 : 160}
                />
              </label>
            )}
            {error && <p role="alert">{error}</p>}
            <footer>
              <button type="button" onClick={() => setDialog(null)}>
                Cancel
              </button>
              <button className="primary" disabled={busy}>
                {dialog === "delete-sheet" ? "Delete worksheet" : "Save name"}
              </button>
            </footer>
          </form>
        </ModuleDialog>
      )}
      {warnings.length > 0 && (
        <details className="chart-warnings">
          <summary>{warnings.length} calculation messages</summary>
          {warnings.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
        </details>
      )}
    </div>
  );
  function evaluateInput() {
    return root.current?.querySelector(
      "[aria-label='Cell value or formula']",
    ) as HTMLInputElement | null;
  }
}
