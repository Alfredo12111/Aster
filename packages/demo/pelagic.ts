import { createHash } from "node:crypto";
import {
  emptyModuleState,
  moduleStateSchema,
  addDays,
  type Annotation,
} from "../core/modules";
import {
  chartSchema,
  type ChartDefinition,
  type Dataset,
} from "../core/chart-model";
import { defaultSettings, type Note } from "../core/types";
import { noteEvidence, pdfEvidence } from "../core/evidence";
import {
  resourceNotes,
  resourceSurface,
  type ResourceTarget,
} from "../core/resources";
import type { Layout, Surface, WorkspaceTab } from "../core/workspace";
import {
  makeNotes,
  demoId as id,
  sectors,
  sites,
  before,
  after,
  fishBefore,
  fishAfter,
  areas,
  readiness,
  station,
} from "./notes";

export type PdfSource = {
  file: string;
  title: string;
  data: Uint8Array;
  annotations: Pick<
    Annotation,
    "page" | "kind" | "quote" | "comment" | "quads" | "points"
  >[];
};
export const demoName = "Pelagic Labs";
export function makeDemo(date: string, pdfs: PdfSource[]) {
  const notes = makeNotes(date),
    now = +new Date(`${date}T12:00:00Z`),
    state = emptyModuleState();
  const ref = (title: string) => {
    const n = notes.find((n) => n.title === title);
    if (!n) throw new Error(`Missing demo note: ${title}`);
    return n;
  };
  const colors = [
    "#79CDBB",
    "#79ACDB",
    "#E6BB78",
    "#EAA5B7",
    "#BCABD9",
    "#B4CC82",
  ];
  state.calendar = { dailyFolder: "08 Journal", weekStartsOn: 1 };
  const projectNames = [
    "Tideglass pilot",
    "Lantern deployment",
    "Atlas research",
    "Harbor logistics",
    "Community access",
    "Stewardship gate",
  ];
  const hubs = [
    "Tideglass reef program",
    "Lantern sensor network",
    "Atlas evidence library",
    "Harbor operations",
    "Community partnership",
    "Stewardship review",
  ];
  const owners = [
    "Mara Vale",
    "Ivo Chen",
    "Ada Finch",
    "Theo Reed",
    "Rae North",
    "Mara Vale",
  ];
  state.projects = projectNames.map((name, i) => ({
    id: id(name),
    name,
    description: `Synthetic workstream coordinated by ${owners[i]}. Open the linked program notes for scope and evidence.`,
    noteIds: [
      ref(hubs[i]).id,
      ref("Mission control").id,
      ref(
        i === 0
          ? "Expansion decision"
          : i === 1
            ? "Deployment decision"
            : "Evidence review",
      ).id,
    ],
    createdAt: now,
  }));
  const taskTitles = [
    [
      "Inspect Farwater nursery",
      "Reconcile paired survival counts",
      "Review six-site limitation",
      "Repeat shaded transect",
      "Validate nursery labels",
      "Capture report evidence",
      "Prepare bounded expansion brief",
    ],
    [
      "Inspect L-07 spare connector",
      "Recheck offshore calibration",
      "Verify recovery beacon",
      "Review telemetry gaps",
      "Confirm battery reserve",
      "Run deployment rehearsal",
      "Approve inshore release gate",
    ],
    [
      "Link expansion source passage",
      "Review changed evidence",
      "Tag observation provenance",
      "Export a RAG evaluation set",
      "Inspect citation coverage",
      "Document missing intervals",
      "Curate methods glossary",
    ],
    [
      "Reserve alternate vessel slot",
      "Pack recovery spares",
      "Reconcile committed spend",
      "Check crate labels",
      "Inspect field inventory",
      "Prepare supplier handoff",
      "Publish equipment manifest",
    ],
    [
      "Draft workshop explainer",
      "Review accessible summary",
      "Prepare feedback template",
      "Schedule listening session",
      "Link methods references",
      "Record workshop decisions",
      "Publish synthetic data notice",
    ],
    [
      "Review allocation variance",
      "Check expansion uncertainty",
      "Review release gates",
      "Inspect blocked-task context",
      "Document decision ownership",
      "Confirm evidence trace",
      "Record portfolio review",
    ],
  ];
  const statuses = [
    "blocked",
    "in-progress",
    "todo",
    "done",
    "todo",
    "in-progress",
    "done",
  ] as const;
  state.tasks = taskTitles.flatMap((titles, p) =>
    titles.map((title, i) => ({
      id: id(title),
      title,
      noteId: ref(
        i === 0 && p === 0
          ? "Farwater"
          : i === 0 && p === 1
            ? "Supply chain"
            : hubs[p],
      ).id,
      excerpt: `${owners[p]} coordinates this fictional review. Record the outcome and its evidence before changing the status.`,
      due: addDays(date, i + p - 3),
      status: statuses[i],
      priority:
        i === 0
          ? ("urgent" as const)
          : i === 1
            ? ("high" as const)
            : ("normal" as const),
      projectId: state.projects[p].id,
      createdAt: now - 86400000 * (10 - i),
      updatedAt: now,
    })),
  );
  const sheet = (
    name: string,
    rows: (string | number)[][],
    columnFormats?: Dataset["sheets"][number]["columnFormats"],
  ) => ({
    name,
    rows: rows.map((row) => row.map(String)),
    ...(columnFormats ? { columnFormats } : {}),
  });
  const book = (name: string, sheets: Dataset["sheets"]) => ({
    id: id(name),
    name,
    sheets,
    updatedAt: now,
  });
  state.datasets = [
    book("Ecology workbook", [
      sheet("Paired sites", [
        [
          "Site",
          "Survival before",
          "Survival after",
          "Fish before",
          "Fish after",
          "Area",
          "Gain",
        ],
        ...sites.map((s, i) => [
          s,
          before[i],
          after[i],
          fishBefore[i],
          fishAfter[i],
          areas[i],
          `=C${i + 2}-B${i + 2}`,
        ]),
      ]),
      sheet("Transects", [
        ["Sample", "Site", "Temperature", "Visibility", "Fish count", "Cover"],
        ...Array.from({ length: 60 }, (_, i) => [
          `T-${String(i + 1).padStart(2, "0")}`,
          sites[i % 6],
          +(22 + (i % 7) * 0.35).toFixed(2),
          +(7 + (i % 9) * 0.7).toFixed(1),
          9 + (i % 6) * 2 + Math.floor(i / 12),
          35 + (i % 6) * 3 + Math.floor(i / 6) * 1.5,
        ]),
      ]),
      sheet(
        "Summary",
        [
          ["Metric", "Value"],
          ["Mean survival before", "=AVERAGE('Paired sites'!B2:B7)"],
          ["Mean survival after", "=AVERAGE('Paired sites'!C2:C7)"],
          ["Percentage-point gain", "=B3-B2"],
          ["Mean fish count", "=AVERAGE(Transects!E2:E61)"],
          ["Fish count sample deviation", "=STDEV.S(Transects!E2:E61)"],
          [
            "Sites at least 90 percent",
            "=COUNTIF('Paired sites'!C2:C7,\">=90\")",
          ],
          ["Total survey area", "=SUM('Paired sites'!F2:F7)"],
        ],
        { "1": "number" },
      ),
    ]),
    book("Ocean telemetry", [
      sheet(
        "Daily",
        [
          ["Date", "Uptime", "Packets", "Battery", "Alerts"],
          ...Array.from({ length: 61 }, (_, i) => [
            addDays(date, i - 50),
            +(97.4 + (i % 9) * 0.2).toFixed(1),
            8200 + i * 28 + (i % 7) * 90,
            +(92 - i * 0.35).toFixed(2),
            i % 11 === 0 ? 4 : i % 3 === 0 ? 2 : 1,
          ]),
        ],
        { "0": "date" },
      ),
      sheet("Stations", [
        ["Station", "Readiness", "Battery", "Zone"],
        ...readiness.map((r, i) => [
          station(i),
          r,
          68 + i * 2,
          i < 6 ? "Inshore" : "Offshore",
        ]),
      ]),
      sheet("Summary", [
        ["Metric", "Value"],
        ["Average uptime", "=AVERAGE(Daily!B2:B62)"],
        ["Total packets", "=SUM(Daily!C2:C62)"],
        ["Maximum daily alerts", "=MAX(Daily!E2:E62)"],
        ["Stations at least 90 percent", '=COUNTIF(Stations!B2:B13,">=90")'],
      ]),
    ]),
    book("Expedition finances", [
      sheet(
        "Budget",
        [
          ["Project", "Planned", "Committed", "Remaining", "Utilization"],
          ...projectNames.map((p, i) => [
            p,
            [48000, 36000, 28000, 24000, 18000, 26000][i],
            [36500, 29400, 19800, 17200, 11400, 18600][i],
            `=B${i + 2}-C${i + 2}`,
            `=C${i + 2}/B${i + 2}`,
          ]),
        ],
        { "1": "currency", "2": "currency", "3": "currency", "4": "percent" },
      ),
      sheet(
        "Index",
        [
          ["Date", "Open", "High", "Low", "Close", "Volume"],
          ...Array.from({ length: 30 }, (_, i) => {
            const o = 100 + i * 0.55 + Math.sin(i) * 2,
              c = o + Math.cos(i) * 1.8;
            return [
              addDays(date, i - 29),
              +o.toFixed(2),
              +(Math.max(o, c) + 2).toFixed(2),
              +(Math.min(o, c) - 1.5).toFixed(2),
              +c.toFixed(2),
              800 + (i % 9) * 80,
            ];
          }),
        ],
        { "0": "date" },
      ),
      sheet("Summary", [
        ["Metric", "Value"],
        ["Allocation", "=SUM(Budget!B2:B7)"],
        ["Committed", "=SUM(Budget!C2:C7)"],
        ["Remaining", "=B2-B3"],
        ["Utilization", "=B3/B2"],
      ]),
    ]),
  ];
  const data = (i: number, sheet: string): ChartDefinition["source"] => ({
    kind: "dataset",
    datasetId: state.datasets[i].id,
    sheet,
  });
  const chart = (
    title: string,
    type: ChartDefinition["type"],
    source: ChartDefinition["source"],
    x: string,
    ys: string[],
    extras: Partial<ChartDefinition> = {},
  ) =>
    chartSchema.parse({
      id: id(title),
      title,
      type,
      source,
      x,
      ys,
      colors,
      calendarYear: Number(date.slice(0, 4)),
      ...extras,
    });
  const financial = {
    open: "Open",
    high: "High",
    low: "Low",
    close: "Close",
    volume: "Volume",
    zeroBaseline: false,
  };
  state.charts = [
    chart("Ocean pulse", "line", data(1, "Daily"), "Date", ["Uptime"], {
      yMin: 96,
      yMax: 100,
      smooth: true,
      yTitle: "Uptime (%)",
    }),
    chart(
      "Nursery before and after",
      "slope",
      data(0, "Paired sites"),
      "Site",
      ["Survival before", "Survival after"],
      { yTitle: "Survival (%)" },
    ),
    chart(
      "Remaining by workstream",
      "bar",
      data(2, "Budget"),
      "Project",
      ["Remaining"],
      { labels: true },
    ),
    chart(
      "Live station readiness",
      "column",
      {
        kind: "query",
        query:
          'SELECT file.name, readiness\nFROM "03 Lantern"\nWHERE type = "station"\nSORT readiness DESC\nLIMIT 20',
      },
      "file.name",
      ["readiness"],
      { yMax: 100 },
    ),
    chart(
      "Temperature and observations",
      "scatter",
      data(0, "Transects"),
      "Temperature",
      ["Fish count"],
      { trend: "linear" },
    ),
    chart(
      "Nursery scale and survival",
      "bubble",
      data(0, "Paired sites"),
      "Survival after",
      ["Fish after"],
      { size: "Area", group: "Site" },
    ),
    chart(
      "Equipment index candles",
      "candlestick",
      data(2, "Index"),
      "Date",
      ["Close"],
      { ...financial, trend: "moving-average", window: 5 },
    ),
    chart(
      "Equipment index OHLC",
      "ohlc",
      data(2, "Index"),
      "Date",
      ["Close"],
      financial,
    ),
    chart(
      "Observation distribution",
      "histogram",
      data(0, "Transects"),
      "Fish count",
      ["Fish count"],
      { bins: 10 },
    ),
    chart(
      "Site variability",
      "boxplot",
      data(0, "Transects"),
      "Site",
      ["Fish count"],
      { group: "Site" },
    ),
    chart(
      "Observation density",
      "density",
      data(0, "Transects"),
      "Fish count",
      ["Fish count"],
    ),
    chart(
      "Environmental correlations",
      "heatmap",
      data(0, "Transects"),
      "Temperature",
      ["Temperature", "Visibility", "Fish count", "Cover"],
    ),
    chart("Packets across the calendar", "calendar", data(1, "Daily"), "Date", [
      "Packets",
    ]),
    chart(
      "Scorecard from Markdown",
      "column",
      { kind: "markdown", noteId: ref("Restoration scorecard").id, table: 0 },
      "Site",
      ["Before", "After"],
    ),
    chart("Allocation and commitment", "column", data(2, "Budget"), "Project", [
      "Planned",
      "Committed",
    ]),
  ];
  state.kanban = [
    "Lantern launch board",
    "Tideglass field board",
    "Portfolio review board",
  ].map((name, i) => {
    const projectId =
      i === 0 ? state.projects[1].id : i === 1 ? state.projects[0].id : null;
    const columns = (
      ["todo", "in-progress", "blocked", "done", "cancelled"] as const
    ).map((status, j) => ({
      id: id(`${name}:${status}`),
      title: [
        "Ready to start",
        "Under way",
        "Needs attention",
        "Reviewed",
        "Parked",
      ][j],
      status,
      color: colors[j],
    }));
    return {
      id: id(name),
      name,
      projectId,
      columns,
      cards: state.tasks
        .filter((t) => !projectId || t.projectId === projectId)
        .map((t) => ({
          taskId: t.id,
          columnId: columns.find((c) => c.status === t.status)!.id,
        })),
    };
  });
  const queries = [
    [
      "Nursery sites",
      'SELECT file.name, survival, baseline, fish\nFROM "02 Tideglass"\nWHERE type = "site"\nSORT survival DESC\nLIMIT 20',
    ],
    [
      "Station gates",
      'SELECT file.name, status, readiness, battery\nFROM "03 Lantern"\nWHERE type = "station"\nSORT readiness ASC\nLIMIT 20',
    ],
    [
      "Decisions under review",
      'SELECT file.name, status\nFROM "01 Strategy"\nWHERE type = "decision"\nSORT file.name ASC\nLIMIT 20',
    ],
    [
      "Field observations",
      'SELECT file.name, date, site, count\nFROM "04 Fieldwork"\nWHERE type = "observation"\nSORT date DESC\nLIMIT 15',
    ],
    [
      "Research concepts",
      'SELECT file.name, type, status\nFROM "06 Evidence"\nWHERE type = "concept"\nLIMIT 20',
    ],
    [
      "Journal agenda",
      'SELECT file.name, date, status\nFROM "08 Journal"\nWHERE type = "daily"\nSORT date DESC\nLIMIT 12',
    ],
  ];
  state.boards = [
    "Field observatory",
    "Atlas reading room",
    "Expedition planning",
  ].map((name, b) => ({
    id: id(name),
    name,
    cards: [
      [0, 1, 2, 3],
      [4, 2, 3],
      [5, 1, 0],
    ][b].map((q, i) => ({
      id: id(`${name}:${q}`),
      title: queries[q][0],
      query: queries[q][1],
      x: 40 + (i % 2) * 450,
      y: 40 + Math.floor(i / 2) * 350,
      width: 420,
      height: 310,
    })),
  }));
  state.documents = pdfs.map((pdf) => ({
    id: id(pdf.file),
    path: `Attachments/${pdf.file}`,
    fingerprint: createHash("sha256").update(pdf.data).digest("hex"),
    annotations: pdf.annotations.map((a, i) => ({
      ...a,
      id: id(`${pdf.file}:${i}`),
      color: colors[i % colors.length],
      width: a.kind === "ink" ? 2.5 : 2,
      createdAt: now,
      updatedAt: now,
    })),
  }));
  const pin = (target: ResourceTarget, parent: string) => {
    const n = ref(parent);
    const result = {
      id: id(`pin:${target.kind}:${target.id}`),
      target,
      folder: `${n.path.split("/")[0]}/Tools`,
      parentNoteId: n.id,
    };
    state.resources.push(result);
    return result;
  };
  state.datasets.forEach((d, i) =>
    pin({ kind: "dataset", id: d.id }, hubs[[0, 1, 3][i]]),
  );
  state.charts.forEach((c) =>
    pin(
      { kind: "chart", id: c.id },
      c.source.kind === "dataset"
        ? hubs[
            c.source.datasetId === state.datasets[2].id
              ? 3
              : c.source.datasetId === state.datasets[1].id
                ? 1
                : 0
          ]
        : c.source.kind === "query"
          ? hubs[1]
          : hubs[0],
    ),
  );
  state.projects.forEach((p, i) => pin({ kind: "project", id: p.id }, hubs[i]));
  state.kanban.forEach((b, i) =>
    pin(
      { kind: "kanban", id: b.id },
      i === 0 ? hubs[1] : i === 1 ? hubs[0] : "Mission control",
    ),
  );
  state.boards.forEach((b, i) =>
    pin(
      { kind: "canvas", id: b.id },
      ["Field expedition", hubs[2], "Mission control"][i],
    ),
  );
  state.documents.forEach((d, i) =>
    pin(
      { kind: "pdf", id: d.id },
      [
        "Reef report source",
        "Engineering report source",
        "Portfolio report source",
      ][i],
    ),
  );
  state.projects.forEach((_, i) =>
    pin({ kind: "task", id: state.tasks[i * 7].id }, hubs[i]),
  );
  pin({ kind: "calendar", id: "calendar" }, "Expedition journal");
  const tab = (
    key: string,
    kind: Surface,
    extras: Partial<WorkspaceTab> = {},
  ): WorkspaceTab => ({ id: id(`tab:${key}`), kind, ...extras });
  const pane = (key: string, tabs: WorkspaceTab[]): Layout => ({
    id: id(`pane:${key}`),
    type: "pane",
    tabs,
    active: tabs[0].id,
  });
  const tool = (key: string, target: ResourceTarget) =>
    pane(key, [tab(key, resourceSurface(target), { resource: target })]);
  const note = (key: string, title: string) =>
    pane(key, [tab(key, "note", { noteId: ref(title).id })]);
  const surface = (key: string, kind: Surface) => pane(key, [tab(key, kind)]);
  const split = (name: string, first: Layout, second: Layout, ratio = 0.6) => ({
    id: id(`layout:${name}`),
    name,
    layout: {
      id: id(`split:${name}`),
      type: "split" as const,
      axis: "horizontal" as const,
      ratio,
      first,
      second,
    },
  });
  state.workspace = {
    theme: "ocean",
    layout: pane("start", [
      tab("start-map", "graph"),
      tab("start-guide", "note", { noteId: ref("Welcome aboard").id }),
    ]),
    saved: [
      split(
        "Mission control",
        surface("mission-map", "graph"),
        note("mission-guide", "Welcome aboard"),
        0.64,
      ),
      split(
        "Evidence desk",
        tool("evidence-pdf", {
          kind: "pdf",
          id: state.documents[0].id,
          annotationId: state.documents[0].annotations[0].id,
          page: 1,
        }),
        note("evidence-note", "Expansion decision"),
      ),
      split(
        "Data studio",
        tool("data-chart", { kind: "chart", id: state.charts[1].id }),
        tool("data-book", { kind: "dataset", id: state.datasets[0].id }),
        0.52,
      ),
      split(
        "Launch room",
        tool("launch-board", { kind: "kanban", id: state.kanban[0].id }),
        surface("launch-calendar", "calendar"),
        0.65,
      ),
      split(
        "Research tree",
        surface("research-tree", "tree"),
        surface("research-navigator", "navigator"),
        0.66,
      ),
      split(
        "Ocean watch",
        tool("ocean-canvas", { kind: "canvas", id: state.boards[0].id }),
        tool("ocean-chart", { kind: "chart", id: state.charts[0].id }),
      ),
    ],
  };
  const settings = defaultSettings();
  settings.colors = Object.fromEntries(sectors.map((s) => [s[0], s[2]]));
  settings.nodeSize = 6;
  settings.linkOpacity = 27;
  const all = [...notes, ...resourceNotes(state, notes)],
    positions: Record<string, { x: number; y: number }> = {};
  sectors.forEach((s, group) => {
    const angle = ((group - 1) * Math.PI) / 4 - Math.PI / 2,
      cx = group ? Math.cos(angle) * 600 : 0,
      cy = group ? Math.sin(angle) * 410 : 0;
    const members = all
      .filter((n) => n.path.split("/")[0] === s[0])
      .sort((a, b) =>
        a.title === s[1]
          ? -1
          : b.title === s[1]
            ? 1
            : a.title.localeCompare(b.title),
      );
    members.forEach((n, i) => {
      const r = i ? 55 + Math.sqrt(i) * 21 : 0;
      positions[n.id] = {
        x: cx + Math.cos(i * 2.399963) * r,
        y: cy + Math.sin(i * 2.399963) * r,
      };
    });
  });
  settings.views = [
    ["mission", "Mission map", ""],
    ["reef", "Tideglass evidence", "tag:reef"],
    ["lantern", "Lantern launch", "tag:lantern"],
    ["tools", "Tools on map", "path:Tools"],
  ].map(([key, name, filter]) => ({
    id: key,
    name,
    filter,
    positions: structuredClone(positions),
    layout: "cluster" as const,
  }));
  settings.activeView = "mission";
  const evidenceRows = [
    [
      "Reef report source",
      "Expansion decision",
      "Nursery survival increased from 72% to 89%.",
    ],
    [
      "Engineering report source",
      "Deployment decision",
      "Deploy only after calibration, power and recovery checks.",
    ],
    [
      "Portfolio report source",
      "Budget review",
      "The portfolio allocation totals 180000 dollars.",
    ],
  ];
  settings.relations = evidenceRows.map(([source, target, quote], i) => ({
    id: id(`relation:${source}`),
    source: ref(source).id,
    target: ref(target).id,
    kind: "supports",
    evidence: [
      noteEvidence(ref(source), quote),
      pdfEvidence(state.documents[i], state.documents[i].annotations[0]),
    ].map((e, j) => ({
      ...e,
      id: id(`evidence:${source}:${j}`),
      capturedAt: now,
    })),
  }));
  return {
    name: demoName,
    date,
    notes,
    state: moduleStateSchema.parse(state),
    settings,
  };
}
