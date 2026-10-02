import { useEffect, useRef, useState } from "react";
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
} from "../../../../packages/core/chart-data";
import { chartWorker, runChartWorker } from "./chart-worker";
import { useModules, type Commit } from "./ModuleProvider";
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
  const [undo, setUndo] = useState<Dataset[]>([]),
    [redo, setRedo] = useState<Dataset[]>([]),
    dragging = useRef(false),
    [functions, setFunctions] = useState<string[]>([]),
    [help, setHelp] = useState(false);
  const sheet = dataset.sheets[sheetIndex] ?? dataset.sheets[0],
    width = Math.max(2, ...sheet.rows.map((r) => r.length)),
    height = Math.max(2, sheet.rows.length),
    pageSize = 25;
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
  const apply = async (next: Dataset, remember = true) => {
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
      });
      if (remember) {
        setUndo((u) => [...u.slice(-9), previous]);
        setRedo([]);
      }
      latest.current = parsed;
    } catch (e) {
      setError(String(e));
      throw e;
    } finally {
      setBusy(false);
    }
  };
  const flushRef = useRef<() => void>(() => {});
  const saveFormula = async () => {
    if (!editing.current) return;
    const edit = editRef.current;
    editing.current = false;
    const next = structuredClone(latest.current),
      rows = next.sheets[edit.sheet].rows;
    while (rows.length <= edit.row) rows.push([]);
    while (rows[edit.row].length <= edit.col) rows[edit.row].push("");
    rows[edit.row][edit.col] = edit.value;
    await apply(next).catch((error) => {
      editing.current = true;
      throw error;
    });
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
    void saveFormula().catch(() => {});
    if (!extend) setAnchor(p);
    setEnd(p);
  };
  const matrix = (values: string[][]) => {
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
  const exportData = async (format: "csv" | "xlsx") => {
    setBusy(true);
    try {
      await saveFormula();
      if (format === "csv")
        await window.aster.exportAsset({
          name: dataset.name + "-" + sheet.name,
          format,
          data: toCsv(
            (
              await runChartWorker<{ sheets: { rows: CellValue[][] }[] }>({
                kind: "workbook",
                dataset: latest.current,
              })
            ).sheets[sheetIndex].rows,
          ),
        });
      else {
        const bytes = await runChartWorker<Uint8Array>({
          kind: "export",
          dataset: latest.current,
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
    <div className="dataset-editor">
      <div className="dataset-toolbar">
        <strong>{dataset.name}</strong>
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
          title="Add worksheet"
          disabled={busy || dataset.sheets.length >= 20}
          onClick={() => {
            const next = structuredClone(dataset);
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
            void apply(previous, false)
              .then(() => {
                setRedo((r) => [...r, structuredClone(dataset)]);
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
            void apply(next, false)
              .then(() => {
                setUndo((u) => [...u, structuredClone(dataset)]);
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
      </div>
      <div className="formula-bar">
        <span>
          {columnName(anchor.col)}
          {anchor.row + 1}
        </span>
        <b>ƒx</b>
        <input
          aria-label="Cell value or formula"
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
              row: Math.max(
                0,
                Math.min(
                  height - 1,
                  end.row +
                    (e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0),
                ),
              ),
              col: Math.max(
                0,
                Math.min(
                  width - 1,
                  end.col +
                    (e.key === "ArrowRight" || e.key === "Tab"
                      ? 1
                      : e.key === "ArrowLeft"
                        ? -1
                        : 0),
                ),
              ),
            };
            select(p, e.shiftKey && e.key !== "Tab");
            setPage(Math.floor(p.row / pageSize));
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
              { length: Math.min(pageSize, height - page * pageSize) },
              (_, i) => {
                const r = i + page * pageSize;
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
                          if (dragging.current) setEnd({ row: r, col: c });
                        }}
                        onDoubleClick={() => {
                          const input = evaluateInput();
                          input?.focus();
                          input?.select();
                        }}
                        title={sheet.rows[r]?.[c] ?? ""}
                        aria-label={columnName(c) + (r + 1)}
                      >
                        {String(calculated[r]?.[c] ?? sheet.rows[r]?.[c] ?? "")}
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
        <button
          disabled={busy || height >= MAX_ROWS}
          onClick={() => {
            const next = structuredClone(dataset);
            next.sheets[sheetIndex].rows.push(Array(width).fill(""));
            void apply(next).catch(() => {});
          }}
        >
          <Plus size={13} />
          Row
        </button>
        <button
          disabled={busy || width >= MAX_COLS}
          onClick={() => {
            const next = structuredClone(dataset);
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
          disabled={from.row === to.row}
          onClick={() => {
            void saveFormula().catch(() => {});
            onChart(sheet.name, range);
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
          {page * pageSize + 1}–{Math.min(height, (page + 1) * pageSize)} of{" "}
          {height}
        </span>
        <button
          disabled={(page + 1) * pageSize >= height}
          onClick={() => setPage((p) => p + 1)}
        >
          Next rows
        </button>
        <small>
          First selected row becomes chart headers. Shift-click or drag to
          select a range.
        </small>
      </div>
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
    return document.querySelector(
      ".dock-pane.focused [aria-label='Cell value or formula']",
    ) as HTMLInputElement | null;
  }
}
