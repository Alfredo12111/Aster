import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Upload,
  Table2,
  ChartNoAxesCombined,
  Save,
  Copy,
  Trash2,
  Download,
  SlidersHorizontal,
} from "lucide-react";
import {
  chartSchema,
  chartTypes,
  chartPalette,
  type ChartDefinition,
  type Dataset,
  type DataTable,
} from "../../../../packages/core/chart-model";
import {
  chartLabels,
  type buildChart,
} from "../../../../packages/core/chart-options";
import {
  markdownTables,
  toCsv,
  tableFromRows,
} from "../../../../packages/core/chart-data";
import { useTabState, useModules } from "./ModuleProvider";
import type { ModuleProps } from "./ModuleHost";
import ChartView, { type ChartViewHandle } from "./ChartView";
import DatasetEditor from "./DatasetEditor";
import { chartWorker, runChartWorker } from "./chart-worker";
import ModuleDialog from "./ModuleDialog";
type ChartResult = ReturnType<typeof buildChart> & { table: DataTable };
function blankChart(dataset?: Dataset): ChartDefinition {
  const sheet = dataset?.sheets[0],
    columns = sheet?.rows[0] ?? [];
  return chartSchema.parse({
    id: crypto.randomUUID(),
    title: "Untitled chart",
    type: "line",
    source: dataset
      ? { kind: "dataset", datasetId: dataset.id, sheet: sheet!.name }
      : { kind: "query", query: "SELECT file.name, value\nLIMIT 100" },
    x: columns[0] ?? "file.name",
    ys: [columns[1] ?? "value"],
    colors: chartPalette,
  });
}
export default function ChartsModule({
  vault,
  state,
  commit,
  onOpen,
  resource,
}: ModuleProps) {
  const { registerFlush } = useModules();
  const [selected, setSelected] = useTabState(
      "chart-selected",
      resource?.kind === "chart" ? resource.id : (state.charts[0]?.id ?? ""),
    ),
    [draft, setDraft] = useTabState<ChartDefinition | null>(
      "chart-draft",
      null,
    ),
    [datasetId, setDatasetId] = useTabState(
      "chart-dataset",
      resource?.kind === "dataset" ? resource.id : "",
    );
  const [baseline, setBaseline] = useTabState<string | null>(
    "chart-baseline",
    null,
  );
  const [result, setResult] = useState<ChartResult | null>(null),
    [sourceTable, setSourceTable] = useState<DataTable | null>(null),
    [error, setError] = useState(""),
    [calcError, setCalcError] = useState(""),
    [calculating, setCalculating] = useState(false),
    [busy, setBusy] = useState(false),
    [showConfig, setShowConfig] = useState(resource?.kind !== "chart");
  const [dialog, setDialog] = useState<
      "workbook" | "delete-chart" | "delete-data" | null
    >(null),
    [name, setName] = useState("");
  const input = useRef<HTMLInputElement>(null),
    view = useRef<ChartViewHandle>(null);
  const saved = state.charts.find((c) => c.id === selected),
    chart = draft ?? saved,
    dataset = state.datasets.find((d) => d.id === datasetId);
  const dataRevision = state.datasets
      .map((d) => d.id + ":" + d.updatedAt)
      .join("|"),
    chartSignature = JSON.stringify(chart);
  useEffect(() => {
    if (!chart || datasetId) {
      setResult(null);
      return;
    }
    setCalculating(true);
    setCalcError("");
    let cancel = () => {};
    const timer = window.setTimeout(() => {
      cancel = chartWorker<ChartResult>(
        { kind: "chart", chart, datasets: state.datasets, notes: vault.notes },
        (r) => {
          setResult(r);
          setSourceTable(r.table);
          setCalculating(false);
        },
        (e) => {
          setCalcError(e);
          setResult(null);
          setCalculating(false);
        },
      );
    }, 180);
    return () => {
      clearTimeout(timer);
      cancel();
    };
  }, [chartSignature, dataRevision, vault.notes, datasetId]);
  const sourceSignature =
    JSON.stringify(chart?.source) + "|" + (chart?.range ?? "");
  useEffect(() => {
    if (!chart || datasetId) return;
    return chartWorker<DataTable>(
      { kind: "source", chart, datasets: state.datasets, notes: vault.notes },
      (table) => {
        setSourceTable(table);
        if (table.columns.length) {
          const valid = chart.ys.filter((y) => table.columns.includes(y));
          if (
            !table.columns.includes(chart.x) ||
            !valid.length ||
            valid.length !== chart.ys.length
          ) {
            if (!draft) setBaseline(saved ? JSON.stringify(saved) : null);
            setDraft((current) => {
              const base = current ?? chart;
              if (
                JSON.stringify(base.source) !== JSON.stringify(chart.source) ||
                base.range !== chart.range
              )
                return current;
              return {
                ...base,
                x: table.columns.includes(base.x) ? base.x : table.columns[0],
                ys: valid.length
                  ? valid
                  : [table.columns[1] ?? table.columns[0]],
              };
            });
          }
        }
      },
      () => setSourceTable(null),
    );
  }, [sourceSignature, dataRevision, vault.notes, datasetId]);
  const patch = (changes: Partial<ChartDefinition>) => {
    if (chart) {
      if (!draft) setBaseline(saved ? JSON.stringify(saved) : null);
      setDraft({ ...chart, ...changes });
    }
  };
  const action = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      return true;
    } catch (e) {
      setError(String(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const saving = useRef(false);
  const save = async () => {
    if (!draft) return true;
    if (saving.current) return false;
    saving.current = true;
    const result = await action(async () => {
      if (!chart) return;
      const parsed = chartSchema.parse(chart);
      await commit((s) => {
        const i = s.charts.findIndex((c) => c.id === parsed.id);
        if (
          baseline !== null &&
          (i < 0 || JSON.stringify(s.charts[i]) !== baseline)
        )
          throw new Error(
            "This chart changed in another pane. Discard this draft to load the saved version.",
          );
        if (i < 0) s.charts.push(parsed);
        else s.charts[i] = parsed;
      });
      setBaseline(JSON.stringify(parsed));
      setSelected(parsed.id);
      setDraft((current) =>
        JSON.stringify(current) === JSON.stringify(chart) ? null : current,
      );
    });
    saving.current = false;
    return result;
  };
  const attempted = useRef("");
  const saveLatest = useRef(save);
  saveLatest.current = save;
  useEffect(
    () =>
      registerFlush(async () => {
        if (!(await saveLatest.current()))
          throw new Error(
            "Save or discard chart changes before switching vaults.",
          );
      }),
    [registerFlush],
  );
  useEffect(() => {
    if (
      !draft ||
      busy ||
      attempted.current === chartSignature ||
      !chartSchema.safeParse(draft).success
    )
      return;
    const timer = setTimeout(() => {
      attempted.current = chartSignature;
      void saveLatest.current();
    }, 750);
    return () => clearTimeout(timer);
  }, [chartSignature, busy]);
  useEffect(
    () => () => {
      void saveLatest.current();
    },
    [],
  );
  const create = async (data?: Dataset, range = "", sheet?: string) => {
    if (!(await save())) return;
    const next = blankChart(data);
    if (data && sheet)
      next.source = { kind: "dataset", datasetId: data.id, sheet };
    next.range = range;
    if (data && range) {
      const rows = data.sheets.find(
        (s) => s.name === (sheet ?? data.sheets[0].name),
      )!.rows;
      const columns = tableFromRows(rows, range).columns;
      next.x = columns[0];
      next.ys = [columns[1] ?? columns[0]];
    }
    setDraft(next);
    setBaseline(null);
    setSelected("");
    setDatasetId("");
    setShowConfig(true);
  };
  const importFile = (file?: File) => {
    if (file)
      void action(async () => {
        if (draft)
          throw new Error(
            "Save or discard chart changes before importing a workbook.",
          );
        if (file.size > 10_000_000)
          throw new Error("Imports are limited to 10 MB.");
        const data = await runChartWorker<Dataset>({
          kind: "import",
          name: file.name,
          bytes: new Uint8Array(await file.arrayBuffer()),
        });
        await commit((s) => s.datasets.push(data));
        setDatasetId(data.id);
        setDraft(null);
      });
  };
  const exportChart = (format: "png" | "svg" | "csv") =>
    void action(async () => {
      if (!chart || !result) throw new Error("Wait for a valid chart.");
      const data =
        format === "csv"
          ? toCsv([result.table.columns, ...result.table.rows])
          : view.current!.export(format);
      await window.aster.exportAsset({ name: chart.title, format, data });
    });
  const columns = sourceTable?.columns ?? [];
  const field = (
    label: string,
    key: "x" | "group" | "size" | "open" | "high" | "low" | "close" | "volume",
    optional = false,
  ) => (
    <label>
      {label}
      <select
        aria-label={label}
        value={chart?.[key] ?? ""}
        onChange={(e) => patch({ [key]: e.target.value })}
      >
        <option value="">{optional ? "None" : "Choose column"}</option>
        {columns.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
    </label>
  );
  const sample = () =>
    void action(async () => {
      const data: Dataset = {
        id: crypto.randomUUID(),
        name: "Sample research metrics",
        updatedAt: Date.now(),
        sheets: [
          {
            name: "Metrics",
            rows: [
              [
                "Date",
                "Revenue",
                "Expenses",
                "Readers",
                "Size",
                "Open",
                "High",
                "Low",
                "Close",
                "Volume",
                "Group",
              ],
              [
                "2026-01-01",
                "24",
                "14",
                "120",
                "10",
                "20",
                "26",
                "18",
                "24",
                "1200",
                "A",
              ],
              [
                "2026-02-01",
                "35",
                "18",
                "180",
                "15",
                "24",
                "37",
                "22",
                "35",
                "1600",
                "A",
              ],
              [
                "2026-03-01",
                "29",
                "20",
                "155",
                "12",
                "35",
                "38",
                "27",
                "29",
                "1400",
                "B",
              ],
              [
                "2026-04-01",
                "48",
                "24",
                "240",
                "22",
                "29",
                "50",
                "28",
                "48",
                "2200",
                "B",
              ],
              [
                "2026-05-01",
                "61",
                "27",
                "300",
                "27",
                "48",
                "65",
                "46",
                "61",
                "2800",
                "A",
              ],
              [
                "2026-06-01",
                "73",
                "33",
                "360",
                "34",
                "61",
                "77",
                "58",
                "73",
                "3300",
                "B",
              ],
            ],
          },
        ],
      };
      const example = blankChart(data);
      example.title = "Research momentum";
      example.ys = ["Revenue", "Expenses"];
      await commit((s) => {
        s.datasets.push(data);
        s.charts.push(example);
      });
      setSelected(example.id);
      setDraft(null);
      setDatasetId("");
    });
  return (
    <div className="charts-module module-content">
      <div className="module-page-heading">
        <div>
          <span className="eyebrow">DATA, WITH PERSPECTIVE</span>
          <h1>Charts</h1>
          <p>Connect a source. Ask a question. Watch the picture change.</p>
        </div>
        <div className="chart-header-actions">
          <input
            ref={input}
            type="file"
            accept=".csv,.tsv,.xlsx"
            aria-label="Import chart data file"
            hidden
            onChange={(e) => {
              importFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button onClick={() => input.current?.click()} disabled={busy}>
            <Upload size={14} />
            Import CSV / Excel
          </button>
          <button
            onClick={() => {
              setName("");
              setDialog("workbook");
            }}
          >
            <Table2 size={14} />
            New workbook
          </button>
          <button className="primary" onClick={() => create(state.datasets[0])}>
            <Plus size={14} />
            New chart
          </button>
        </div>
      </div>
      {error && (
        <div className="module-error" role="alert">
          {error}
          {draft && (
            <button
              onClick={() => {
                setDraft(null);
                setBaseline(null);
                setError("");
              }}
            >
              Discard chart draft
            </button>
          )}
        </div>
      )}
      <div className="chart-workbench">
        <aside className="chart-library">
          <span className="section-label">CHARTS</span>
          {state.charts.map((c) => (
            <button
              key={c.id}
              className={!datasetId && selected === c.id ? "active" : ""}
              onClick={async () => {
                if (!(await save())) return;
                setSelected(c.id);
                setDraft(null);
                setDatasetId("");
              }}
            >
              <ChartNoAxesCombined size={14} />
              <span>
                {c.title}
                <small>{chartLabels[c.type]}</small>
              </span>
            </button>
          ))}
          <span className="section-label">WORKBOOKS</span>
          {state.datasets.map((d) => (
            <button
              key={d.id}
              className={datasetId === d.id ? "active" : ""}
              onClick={async () => {
                if (!(await save())) return;
                setDatasetId(d.id);
                setDraft(null);
              }}
            >
              <Table2 size={14} />
              <span>
                {d.name}
                <small>
                  {d.sheets.length} worksheet{d.sheets.length === 1 ? "" : "s"}
                </small>
              </span>
            </button>
          ))}
        </aside>
        {dataset ? (
          <div className="chart-main">
            <div className="chart-document-heading">
              <h2>{dataset.name}</h2>
              <button onClick={() => create(dataset)}>
                Chart this workbook
              </button>
              <button
                title="Delete workbook"
                onClick={() => setDialog("delete-data")}
              >
                <Trash2 size={14} />
              </button>
            </div>
            <DatasetEditor
              key={dataset.id}
              dataset={dataset}
              commit={commit}
              onChart={(sheet, range) => create(dataset, range, sheet)}
            />
          </div>
        ) : chart ? (
          <div className="chart-main">
            <div className="chart-document-heading">
              <div>
                <h2>{chart.title}</h2>
                <span>
                  {calculating
                    ? "Calculating…"
                    : result
                      ? result.rowCount + " live rows"
                      : chartLabels[chart.type]}
                  {draft ? " · unsaved chart" : ""}
                </span>
              </div>
              <button
                title="Chart configuration"
                onClick={() => setShowConfig(!showConfig)}
              >
                <SlidersHorizontal size={15} />
              </button>
              <button
                onClick={() => exportChart("png")}
                disabled={!result || busy || calculating || !!calcError}
              >
                <Download size={14} />
                PNG
              </button>
              <button
                onClick={() => exportChart("svg")}
                disabled={!result || busy || calculating || !!calcError}
              >
                SVG
              </button>
              <button
                onClick={() => exportChart("csv")}
                disabled={!result || busy || calculating || !!calcError}
              >
                Data CSV
              </button>
              <button
                title="Duplicate chart"
                onClick={async () => {
                  if (!(await save())) return;
                  setBaseline(null);
                  setDraft({
                    ...chart,
                    id: crypto.randomUUID(),
                    title: chart.title + " copy",
                  });
                  setSelected("");
                }}
              >
                <Copy size={14} />
              </button>
              {saved && (
                <button
                  title="Delete chart"
                  onClick={() => setDialog("delete-chart")}
                >
                  <Trash2 size={14} />
                </button>
              )}
              <button
                className="primary"
                onClick={save}
                disabled={busy || !draft}
              >
                <Save size={14} />
                Save chart
              </button>
            </div>
            <div className="chart-body">
              <div className="chart-display">
                {calcError ? (
                  <div className="chart-empty-state" role="alert">
                    <ChartNoAxesCombined size={32} />
                    <h3>Adjust this chart’s data</h3>
                    <p>{calcError}</p>
                  </div>
                ) : result ? (
                  <ChartView
                    ref={view}
                    option={result.option}
                    theme={state.workspace.theme}
                    title={chart.title}
                  />
                ) : (
                  <div className="module-loading">Preparing chart…</div>
                )}
                {result && (
                  <>
                    <div className="chart-statistics">
                      {result.statistics.map((s) => (
                        <div key={s.name}>
                          <strong>{s.name}</strong>
                          <span>
                            n {s.count} · mean{" "}
                            {s.mean?.toLocaleString(undefined, {
                              maximumFractionDigits: 3,
                            }) ?? "—"}{" "}
                            · median{" "}
                            {s.median?.toLocaleString(undefined, {
                              maximumFractionDigits: 3,
                            }) ?? "—"}
                          </span>
                          <small>
                            Σ{" "}
                            {s.sum.toLocaleString(undefined, {
                              maximumFractionDigits: 3,
                            })}{" "}
                            · min {s.min ?? "—"} · max {s.max ?? "—"} · sample σ{" "}
                            {s.stddev?.toFixed(3) ?? "—"}
                          </small>
                        </div>
                      ))}
                    </div>
                    {result.fit.length > 0 && (
                      <p className="chart-fit">{result.fit.join(" · ")}</p>
                    )}
                    {result.warnings.length > 0 && (
                      <details className="chart-warnings">
                        <summary>
                          {result.warnings.length} data messages
                        </summary>
                        {result.warnings.map((w, i) => (
                          <p key={i}>{w}</p>
                        ))}
                      </details>
                    )}
                    <details className="chart-data-preview">
                      <summary>
                        View source data ({result.table.rows.length} rows)
                      </summary>
                      <div>
                        <table>
                          <thead>
                            <tr>
                              {result.table.columns.map((c) => (
                                <th key={c}>{c}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {result.table.rows.slice(0, 100).map((r, i) => (
                              <tr key={i}>
                                {r.map((v, j) => (
                                  <td key={j}>{String(v ?? "")}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {result.table.rows.length > 100 && (
                        <p>
                          First 100 rows shown. Export Data CSV for the full
                          chart source.
                        </p>
                      )}
                    </details>
                  </>
                )}
              </div>
              {showConfig && (
                <aside className="chart-config">
                  <label>
                    Chart title
                    <input
                      aria-label="Chart title"
                      value={chart.title}
                      maxLength={160}
                      onChange={(e) => patch({ title: e.target.value })}
                    />
                  </label>
                  <label>
                    Chart type
                    <select
                      aria-label="Chart type"
                      value={chart.type}
                      onChange={(e) =>
                        patch({
                          type: e.target.value as ChartDefinition["type"],
                        })
                      }
                    >
                      {chartTypes.map((type) => (
                        <option key={type} value={type}>
                          {chartLabels[type]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <fieldset>
                    <legend>Data source</legend>
                    <select
                      aria-label="Chart source type"
                      value={chart.source.kind}
                      onChange={(e) => {
                        if (e.target.value === "dataset") {
                          const d = state.datasets[0];
                          if (d)
                            patch({
                              source: {
                                kind: "dataset",
                                datasetId: d.id,
                                sheet: d.sheets[0].name,
                              },
                              range: "",
                            });
                          else setError("Create or import a workbook first.");
                        }
                        if (e.target.value === "query")
                          patch({
                            source: {
                              kind: "query",
                              query: "SELECT file.name, value\nLIMIT 100",
                            },
                            range: "",
                          });
                        if (e.target.value === "markdown") {
                          const n = vault.notes.find(
                            (n) => markdownTables(n.content).length,
                          );
                          if (n)
                            patch({
                              source: {
                                kind: "markdown",
                                noteId: n.id,
                                table: 0,
                              },
                              range: "",
                            });
                          else
                            setError("Add a Markdown table to a note first.");
                        }
                      }}
                    >
                      <option value="dataset">Workbook</option>
                      <option value="query">Live Aster Query</option>
                      <option value="markdown">Markdown table</option>
                    </select>
                    {chart.source.kind === "dataset" && (
                      <>
                        <select
                          aria-label="Chart workbook"
                          value={chart.source.datasetId}
                          onChange={(e) => {
                            const d = state.datasets.find(
                              (d) => d.id === e.target.value,
                            )!;
                            patch({
                              source: {
                                kind: "dataset",
                                datasetId: d.id,
                                sheet: d.sheets[0].name,
                              },
                              range: "",
                            });
                          }}
                        >
                          {state.datasets.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                        <select
                          aria-label="Chart worksheet"
                          value={chart.source.sheet}
                          onChange={(e) => {
                            if (chart.source.kind === "dataset")
                              patch({
                                source: {
                                  ...chart.source,
                                  sheet: e.target.value,
                                },
                                range: "",
                              });
                          }}
                        >
                          {state.datasets
                            .find(
                              (d) =>
                                chart.source.kind === "dataset" &&
                                d.id === chart.source.datasetId,
                            )
                            ?.sheets.map((s) => (
                              <option key={s.name}>{s.name}</option>
                            ))}
                        </select>
                        <button
                          onClick={() => {
                            if (chart.source.kind === "dataset")
                              setDatasetId(chart.source.datasetId);
                          }}
                        >
                          Edit worksheet data
                        </button>
                      </>
                    )}
                    {chart.source.kind === "query" && (
                      <textarea
                        aria-label="Chart query"
                        rows={5}
                        value={chart.source.query}
                        onChange={(e) =>
                          patch({
                            source: { kind: "query", query: e.target.value },
                          })
                        }
                      />
                    )}
                    {chart.source.kind === "markdown" && (
                      <>
                        <select
                          aria-label="Chart source note"
                          value={chart.source.noteId}
                          onChange={(e) =>
                            patch({
                              source: {
                                kind: "markdown",
                                noteId: e.target.value,
                                table: 0,
                              },
                              range: "",
                            })
                          }
                        >
                          {vault.notes
                            .filter((n) => markdownTables(n.content).length)
                            .map((n) => (
                              <option key={n.id} value={n.id}>
                                {n.path}
                              </option>
                            ))}
                        </select>
                        <label>
                          Table number
                          <input
                            aria-label="Markdown table number"
                            type="number"
                            min={1}
                            value={chart.source.table + 1}
                            onChange={(e) => {
                              if (chart.source.kind === "markdown")
                                patch({
                                  source: {
                                    ...chart.source,
                                    table: Math.max(0, +e.target.value - 1),
                                  },
                                });
                            }}
                          />
                        </label>
                        <button
                          onClick={() => {
                            if (chart.source.kind === "markdown")
                              onOpen(chart.source.noteId);
                          }}
                        >
                          Open source note
                        </button>
                      </>
                    )}
                    <label>
                      Cell range
                      <input
                        aria-label="Chart data range"
                        placeholder="All data, or A1:D20"
                        value={chart.range}
                        onChange={(e) => patch({ range: e.target.value })}
                      />
                    </label>
                  </fieldset>
                  <fieldset>
                    <legend>Columns</legend>
                    {field(
                      "X / categories",
                      "x",
                      ["histogram", "boxplot", "density"].includes(chart.type),
                    )}
                    <label>Value series</label>
                    <div className="chart-series-fields">
                      {columns.map((c) => (
                        <label key={c}>
                          <input
                            type="checkbox"
                            aria-label={"Plot " + c}
                            checked={chart.ys.includes(c)}
                            onChange={(e) =>
                              patch({
                                ys: e.target.checked
                                  ? [...chart.ys, c].slice(0, 12)
                                  : chart.ys.length > 1
                                    ? chart.ys.filter((y) => y !== c)
                                    : chart.ys,
                              })
                            }
                          />
                          {c}
                        </label>
                      ))}
                    </div>
                    {field(
                      chart.type === "heatmap"
                        ? "Y categories (blank = correlation)"
                        : "Group / category color",
                      "group",
                      true,
                    )}
                    {chart.type === "bubble" && field("Bubble size", "size")}
                    {["candlestick", "ohlc"].includes(chart.type) && (
                      <>
                        {field("Open", "open")}
                        {field("High", "high")}
                        {field("Low", "low")}
                        {field("Close", "close")}
                        {field("Volume", "volume", true)}
                      </>
                    )}
                    <label>
                      Aggregation
                      <select
                        aria-label="Chart aggregation"
                        value={chart.aggregation}
                        onChange={(e) =>
                          patch({
                            aggregation: e.target
                              .value as ChartDefinition["aggregation"],
                          })
                        }
                      >
                        {[
                          "none",
                          "sum",
                          "mean",
                          "median",
                          "min",
                          "max",
                          "count",
                        ].map((a) => (
                          <option key={a}>{a}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Sort categories
                      <select
                        aria-label="Chart sort"
                        value={chart.sort}
                        onChange={(e) =>
                          patch({
                            sort: e.target.value as ChartDefinition["sort"],
                          })
                        }
                      >
                        {["source", "ascending", "descending"].map((a) => (
                          <option key={a}>{a}</option>
                        ))}
                      </select>
                    </label>
                  </fieldset>
                  <details open>
                    <summary>Style & axes</summary>
                    <label>
                      X title
                      <input
                        aria-label="Chart X title"
                        value={chart.xTitle}
                        onChange={(e) => patch({ xTitle: e.target.value })}
                      />
                    </label>
                    <label>
                      Y title
                      <input
                        aria-label="Chart Y title"
                        value={chart.yTitle}
                        onChange={(e) => patch({ yTitle: e.target.value })}
                      />
                    </label>
                    <div className="chart-color-palette">
                      {chart.colors.map((color, i) => (
                        <input
                          key={i}
                          type="color"
                          aria-label={"Series color " + (i + 1)}
                          value={color}
                          onChange={(e) =>
                            patch({
                              colors: chart.colors.map((v, j) =>
                                i === j ? e.target.value : v,
                              ),
                            })
                          }
                        />
                      ))}
                    </div>
                    {(
                      [
                        "legend",
                        "labels",
                        "stacked",
                        "smooth",
                        "logY",
                        "zeroBaseline",
                      ] as const
                    ).map((key) => (
                      <label key={key} className="chart-check">
                        <input
                          type="checkbox"
                          checked={chart[key]}
                          onChange={(e) => patch({ [key]: e.target.checked })}
                        />
                        {
                          {
                            legend: "Show legend",
                            labels: "Data labels",
                            stacked: "Stack bar / column series",
                            smooth: "Smooth lines",
                            logY: "Logarithmic value axis",
                            zeroBaseline: "Include zero baseline",
                          }[key]
                        }
                      </label>
                    ))}
                    <div className="form-grid">
                      {(["yMin", "yMax"] as const).map((key) => (
                        <label key={key}>
                          {key === "yMin" ? "Y minimum" : "Y maximum"}
                          <input
                            aria-label={
                              key === "yMin"
                                ? "Chart Y minimum"
                                : "Chart Y maximum"
                            }
                            type="number"
                            placeholder="Auto"
                            value={chart[key] ?? ""}
                            onChange={(e) =>
                              patch({
                                [key]:
                                  e.target.value === ""
                                    ? null
                                    : +e.target.value,
                              })
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <label>
                      Missing values
                      <select
                        aria-label="Missing chart values"
                        value={chart.missing}
                        onChange={(e) =>
                          patch({ missing: e.target.value as "gap" | "zero" })
                        }
                      >
                        <option value="gap">Leave a gap</option>
                        <option value="zero">Treat as zero</option>
                      </select>
                    </label>
                  </details>
                  <details>
                    <summary>Analysis</summary>
                    <label>
                      Trend
                      <select
                        aria-label="Chart trend"
                        value={chart.trend}
                        onChange={(e) =>
                          patch({
                            trend: e.target.value as ChartDefinition["trend"],
                          })
                        }
                      >
                        {[
                          "none",
                          "linear",
                          "exponential",
                          "logarithmic",
                          "polynomial",
                          "moving-average",
                        ].map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Polynomial degree
                      <input
                        aria-label="Polynomial degree"
                        type="number"
                        min={2}
                        max={5}
                        value={chart.degree}
                        onChange={(e) => patch({ degree: +e.target.value })}
                      />
                    </label>
                    <label>
                      Moving average window
                      <input
                        aria-label="Moving average window"
                        type="number"
                        min={2}
                        max={100}
                        value={chart.window}
                        onChange={(e) => patch({ window: +e.target.value })}
                      />
                    </label>
                    <label>
                      Histogram bins
                      <input
                        aria-label="Histogram bins"
                        type="number"
                        min={1}
                        max={100}
                        value={chart.bins}
                        onChange={(e) => patch({ bins: +e.target.value })}
                      />
                    </label>
                    <label>
                      Calendar year
                      <input
                        aria-label="Calendar chart year"
                        type="number"
                        min={1900}
                        max={2200}
                        value={chart.calendarYear}
                        onChange={(e) =>
                          patch({ calendarYear: +e.target.value })
                        }
                      />
                    </label>
                    <p>
                      Regression uses valid numeric pairs. Variance and standard
                      deviation are sample estimates; box plots use inclusive
                      quartiles and 1.5 × IQR whiskers.
                    </p>
                  </details>
                </aside>
              )}
            </div>
          </div>
        ) : (
          <div className="chart-main chart-welcome">
            <ChartNoAxesCombined size={48} />
            <h2>Make the numbers tell their story.</h2>
            <p>
              Bring in a workbook, select a Markdown table, or build a live
              query. Use all thirteen chart types with the same local data.
            </p>
            <button className="primary" onClick={sample} disabled={busy}>
              Try sample data
            </button>
            <p className="control-hint">
              The sample is a small fictional research dataset.
            </p>
          </div>
        )}
      </div>
      {dialog && (
        <ModuleDialog
          label={
            dialog === "workbook" ? "New chart workbook" : "Delete chart data"
          }
          busy={busy}
          onClose={() => setDialog(null)}
        >
          <form
            className="module-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await action(async () => {
                  if (dialog === "workbook") {
                    const d: Dataset = {
                      id: crypto.randomUUID(),
                      name: name.trim(),
                      updatedAt: Date.now(),
                      sheets: [
                        {
                          name: "Sheet1",
                          rows: [
                            ["Category", "Value"],
                            ["", ""],
                            ["", ""],
                          ],
                        },
                      ],
                    };
                    if (!d.name) throw new Error("Enter a workbook name.");
                    await commit((s) => s.datasets.push(d));
                    setDatasetId(d.id);
                  }
                  if (dialog === "delete-chart" && saved) {
                    await commit((s) => {
                      s.charts = s.charts.filter((c) => c.id !== saved.id);
                    });
                    setSelected("");
                    setDraft(null);
                  }
                  if (dialog === "delete-data" && dataset) {
                    if (
                      state.charts.some(
                        (c) =>
                          c.source.kind === "dataset" &&
                          c.source.datasetId === dataset.id,
                      )
                    )
                      throw new Error(
                        "Some charts still use this workbook. Change their sources or remove those charts first.",
                      );
                    await commit((s) => {
                      s.datasets = s.datasets.filter(
                        (d) => d.id !== dataset.id,
                      );
                    });
                    setDatasetId("");
                  }
                })
              )
                setDialog(null);
            }}
          >
            <h2>
              {dialog === "workbook"
                ? "Create a workbook"
                : "Remove this item?"}
            </h2>
            {dialog === "workbook" ? (
              <label>
                Name
                <input
                  aria-label="Workbook name"
                  required
                  maxLength={160}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
            ) : (
              <p>
                {dialog === "delete-chart"
                  ? "The source data stays in the vault."
                  : "This removes the workbook’s editable cells. Referenced workbooks must be disconnected from charts first."}
              </p>
            )}
            {error && <p role="alert">{error}</p>}
            <footer>
              <button type="button" onClick={() => setDialog(null)}>
                Cancel
              </button>
              <button className="primary" disabled={busy}>
                {dialog === "workbook" ? "Create workbook" : "Delete"}
              </button>
            </footer>
          </form>
        </ModuleDialog>
      )}
    </div>
  );
}
