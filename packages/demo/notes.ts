import { createHash } from "node:crypto";
import { addDays } from "../core/modules";
import { readMetadata, metadataTags } from "../core/metadata";
import type { Note } from "../core/types";

export const demoId = (key: string) => {
  const h = createHash("sha256").update(`pelagic-v1:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
export const sectors = [
  ["00 Start here", "Welcome aboard", "#E6BB78"],
  ["01 Strategy", "Mission control", "#E6BB78"],
  ["02 Tideglass", "Tideglass reef program", "#79CDBB"],
  ["03 Lantern", "Lantern sensor network", "#79ACDB"],
  ["04 Fieldwork", "Field expedition", "#9BBFE0"],
  ["05 Operations", "Harbor operations", "#BCABD9"],
  ["06 Evidence", "Atlas evidence library", "#EAA5B7"],
  ["07 Playbook", "The Aster field guide", "#B4CC82"],
  ["08 Journal", "Expedition journal", "#D6B588"],
];
export const sites = [
  "Aster Cove",
  "Beacon Shoal",
  "Coral Steps",
  "Drift Garden",
  "Ember Reef",
  "Farwater",
];
export const before = [68, 70, 74, 72, 76, 72],
  after = [88, 90, 92, 87, 91, 86];
export const fishBefore = [10, 11, 12, 13, 14, 12],
  fishAfter = [17, 18, 21, 17, 19, 16];
export const areas = [120, 160, 110, 140, 175, 130];
export const readiness = [96, 92, 100, 88, 94, 86, 62, 90, 83, 97, 91, 85];
export const station = (i: number) =>
  `Station L-${String(i + 1).padStart(2, "0")}`;
export function makeNotes(date: string): Note[] {
  const notes: Note[] = [],
    now = +new Date(`${date}T12:00:00Z`);
  const put = (
    sector: number,
    title: string,
    body: string,
    meta: Record<string, unknown> = {},
  ) => {
    const fields = {
      type: "note",
      status: "active",
      demo: true,
      tags: ["pelagic"],
      ...(title !== "Welcome aboard"
        ? {
            parent: `[[${title === sectors[sector][1] ? "Welcome aboard" : sectors[sector][1]}]]`,
          }
        : {}),
      ...meta,
    };
    const content = `---\n${Object.entries(fields)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join("\n")}\n---\n\n# ${title}\n\n${body.trim()}\n`;
    if (notes.some((n) => n.title === title))
      throw new Error(`Duplicate demo title: ${title}`);
    notes.push({
      id: demoId(`note:${title}`),
      title,
      path: `${sectors[sector][0]}/${title}.md`,
      content,
      revision: createHash("sha256").update(content).digest("hex"),
      modifiedAt: now,
      metadata: readMetadata(content).fields,
      tags: metadataTags(fields),
    });
  };
  put(
    0,
    "Welcome aboard",
    `> **PELAGIC / LABS** · A living research atlas\n> Restore a reef. Launch a sensor network. Keep every decision connected to its evidence.\n\nPelagic Labs is a fictional coastal research team preparing its next island expedition. This is your own editable demo vault. Every person, site, measurement, price, and report is synthetic.\n\n## Start with the mission\n\nOpen [[Mission control]] for the six workstreams, then follow [[Expansion decision]] to its source report. The graph's squares are real tools: open a workbook, chart, board, project, task, PDF, or calendar directly from its node.\n\n## Six ways to explore\n\nUse **Saved layouts** in the workspace toolbar:\n\n| Layout | Explore |\n| --- | --- |\n| Mission control | The connected map beside this guide |\n| Evidence desk | Annotated reef report beside the expansion decision |\n| Data studio | Live before/after chart beside its workbook |\n| Launch room | Lantern Kanban and calendar |\n| Research tree | An orderly hierarchy beside Navigator |\n| Ocean watch | Live query cards beside telemetry |\n\n## Try a change that travels\n\n1. Open [[Station L-07]] and change its frontmatter readiness from 62 to 74. The live station chart and Canvas query update.\n2. Move **Inspect L-07 spare connector** on the Lantern board. Its status also changes in Tasks and Projects.\n3. Edit a number in the Ecology workbook. Its formulas and connected charts recalculate.\n4. Follow an evidence-backed connection to an exact PDF annotation.\n5. Switch Tree between folders and parent metadata. Observations move beneath their sites.\n\nThe workbook snapshots and note metadata are separate sources, intentionally labeled. Editing one does not silently overwrite the other.\n\n## Your workspace, your files\n\nAll modules are enabled. Notes are Markdown; tool state lives in the vault's .aster folder; reports are in Attachments. Dates are anchored to the day this copy was created. Your edits survive restarts and **Open demo** reopens this copy without resetting it. Use **New vault** when ready to start your own.\n\nSee [[The Aster field guide]] for the complete tour. [[AI and privacy]] explains optional suggestions with your own key. No API key or cloud service is required for this demo.`,
    { type: "guide", tags: ["pelagic", "start"] },
  );
  put(
    1,
    "Mission control",
    `## The next tide\n\nOur next expedition has one central question: can a bounded reef pilot expand while its sensor network remains dependable? [[Tideglass reef program]] measures the ecological signal. [[Lantern sensor network]] tests the instruments. [[Atlas evidence library]] keeps the reasoning inspectable.\n\n| Workstream | Allocation | Decision |\n| --- | ---: | --- |\n| Tideglass pilot | 48000 | [[Expansion decision]] |\n| Lantern deployment | 36000 | [[Deployment decision]] |\n| Atlas research | 28000 | [[Evidence review]] |\n| Harbor logistics | 24000 | [[Budget review]] |\n| Community access | 18000 | [[Community partnership]] |\n| Stewardship gate | 26000 | [[Stewardship review]] |\n\nThe total synthetic allocation is **$180,000**. Tasks, boards, charts, PDFs, and workbooks are pinned around their corresponding program hubs on the graph.\n\n## Open questions\n\n- Is the Farwater follow-up sufficient to support the next bounded trial?\n- Does L-07 have the connector needed for the deployment gate?\n- Have we separated measured improvement from causal interpretation?\n\nFollow [[Field expedition]] for the schedule and [[Harbor operations]] for supplies. [[Team directory]] records the fictional owners.`,
    { type: "portfolio", tags: ["pelagic", "strategy"] },
  );
  put(
    2,
    "Tideglass reef program",
    `## A small pilot with visible boundaries\n\nSix fictional nurseries show mean survival increasing from **72% to 89%**. That is an observed difference, not proof of regional causality. [[Restoration scorecard]] records the paired sites.\n\n${sites.map((s) => `- [[${s}]]`).join("\n")}\n\nThe **Ecology workbook** contains paired observations, transect data, formulas, and summary statistics. Its slope, scatter, bubble, distribution, and correlation charts are connected tool nodes.\n\nRead [[Reef report source]], inspect the annotated baseline PDF, then review [[Expansion decision]]. [[Sampling protocol]] and [[Sampling boundaries]] explain the limits.`,
    { type: "program", tags: ["pelagic", "reef", "tideglass"] },
  );
  put(
    3,
    "Lantern sensor network",
    `## Make the measurement trustworthy\n\nTwelve fictional stations connect observations to operational decisions. Readiness is structured note metadata, so the **Live station readiness** chart and Canvas station cards update when a station note changes. The **Ocean telemetry** workbook is a separate illustrative snapshot.\n\n${readiness.map((_, i) => `- [[${station(i)}]]`).join("\n")}\n\n[[Station L-07]] is blocked by a spare connector. Its task appears on the Lantern launch board and in the project view. [[Deployment decision]] requires calibration, power, and recovery checks. See [[Engineering report source]], [[Calibration protocol]], and [[Recovery protocol]].`,
    { type: "program", tags: ["pelagic", "lantern"] },
  );
  put(
    4,
    "Field expedition",
    `## A reviewable field window\n\nThe demo planning window centers on **${date}**. Calendar combines daily notes and task due dates. Past entries are fictional logs; future entries are plans.\n\nBefore a sortie, review [[Sampling protocol]], [[Weather window]], [[Vessel manifest]], and [[Field safety]]. Collect observations without replacing their context. Each survey links to its site, so the metadata Tree organizes observations beneath the nursery even though their files live in Fieldwork.\n\nSee [[Expedition journal]], [[Tideglass reef program]], and [[Lantern sensor network]]. These examples teach the software, not real marine operations.`,
    { type: "program", tags: ["pelagic", "fieldwork"] },
  );
  put(
    5,
    "Harbor operations",
    `## Keep the expedition supplied\n\nThe **Expedition finances** workbook connects planned allocation, committed spend, remaining balance, and utilization. Its fictional equipment index demonstrates candlestick and OHLC charts; it is not market data.\n\n[[Supply chain]] explains the L-07 connector dependency. [[Vessel manifest]] lists the expedition crates. [[Procurement rules]] and [[Budget review]] make ownership and variance explicit.\n\nThe Harbor project gathers related notes and tasks. Follow [[Mission control]] to see where the allocation fits in the portfolio.`,
    { type: "program", tags: ["pelagic", "operations"] },
  );
  put(
    6,
    "Atlas evidence library",
    `## Connections with receipts\n\nEvidence is attached to a relationship, so a reviewer can inspect the saved source passage or PDF annotation behind a claim. Source changes are flagged; a citation does not make a claim true.\n\nStart with [[Reef report source]] → [[Expansion decision]], [[Engineering report source]] → [[Deployment decision]], and [[Portfolio report source]] → [[Budget review]]. Their graph relationships include captured evidence.\n\n[[Evidence review]], [[Source freshness]], and [[Retrieval evaluation]] describe the review practice. [[Export for RAG]] explains portable chunks with citations and relationship evidence.`,
    { type: "program", tags: ["pelagic", "evidence"] },
  );
  put(
    7,
    "The Aster field guide",
    `## One ecosystem, several lenses\n\n- [[Graph and tool nodes]]: open real tools from the map.\n- [[Tree and Navigator]]: browse folders or metadata parents.\n- [[Workbook lab]]: formulas, formatting, sorting, filtering, and range summaries.\n- [[Chart atlas]]: every supported chart family and all three data sources.\n- [[Canvas query lab]]: live tables in a spatial workspace.\n- [[Boards and projects]]: connected task status and ownership.\n- [[Calendar and daily notes]]: day, week, month, and due dates.\n- [[PDF annotation lab]]: five annotation types and source navigation.\n- [[Layouts and themes]]: resizable panes, tabs, and saved arrangements.\n- [[AI and privacy]]: optional cloud suggestions with your key.\n- [[Export for RAG]]: transparent retrieval inputs.\n\nReturn to [[Welcome aboard]] or follow [[Mission control]] for the story.`,
    { type: "guide" },
  );
  put(
    8,
    "Expedition journal",
    `## The expedition, day by day\n\nThis copy begins around **${date}**. Open the calendar node on the graph to see 21 daily notes and the portfolio's due dates. Click a date to open its existing note or create a new one.\n\nToday's entry is [[${date}]]. Use [[Calendar and daily notes]] for the tour. [[Field expedition]] connects this timeline to the mission.`,
    { type: "journal" },
  );
  const guides: [string, string][] = [
    [
      "Graph and tool nodes",
      "The map mixes circular notes with square tool nodes. Select a tool and open its actual workbook, chart, Kanban, Canvas, project, task, PDF, or calendar. Pins have folder and parent metadata, so they also appear in Tree and Navigator. Drag nodes, change colors, filter, and save views. Try the Tools on map saved graph view, then return to Mission map. A pin is a shortcut to the original item, not a disconnected copy. Inspect Reef report source's supports relationship for evidence.",
    ],
    [
      "Tree and Navigator",
      "Open the Research tree layout. Folder mode follows file paths; parent mode follows frontmatter parent links. Survey notes under Fieldwork become children of nursery sites in parent mode. Tool pins follow their chosen parent too. Expand branches and use search; Navigator adds metadata filters and a minimap. The free graph retains its own saved positions.",
    ],
    [
      "Workbook lab",
      "Open Data studio and choose the Ecology workbook. Paired sites has a calculated Gain column. Summary references other sheets with AVERAGE, STDEV.S, COUNTIF, and SUM. Try the range tools for analysis, sort/filter columns, format numbers, fill formulas, and use undo/redo. Expedition finances includes currency and percent columns. Import CSV or Excel to add data; export a workbook to XLSX or a sheet to CSV. These are Aster workbooks, not a promise of complete Excel compatibility. The first row supplies chart column names. Workbook snapshots and note metadata remain separate data sources.",
    ],
    [
      "Chart atlas",
      "Fifteen populated charts cover line, slope, bar, column, scatter, bubble, candlestick, OHLC, histogram, boxplot, density, correlation heatmap, and calendar heatmap. Ecology drives the research charts. Expedition finances drives allocation and fictional price-index charts. Ocean telemetry drives the line and calendar. Live station readiness reads a vault query; Scorecard from Markdown reads the table in Restoration scorecard. Edit the corresponding source to watch the chart update. Configure series, aggregation, labels, axes, palettes, bins, and trend lines; export PNG or SVG. The equipment index is fictional, not financial guidance.",
    ],
    [
      "Canvas query lab",
      "Open Ocean watch. Field observatory holds live nursery, station, decision, and observation queries. Drag or resize cards. Edit Station L-07 readiness and return: the query output updates from the saved frontmatter. Atlas reading room and Expedition planning show other perspectives. Queries are Aster's own language. Each SELECT, FROM, WHERE, SORT, and LIMIT clause goes on its own line. A query card reads notes, not workbook cells.",
    ],
    [
      "Boards and projects",
      "Lantern launch board and Tideglass field board scope connected tasks to their project. Portfolio review board spans all projects. Move a card from Needs attention to Under way and inspect the same task in Tasks or Projects: its status changes everywhere. Reorder cards, rename columns, and add cards from existing notes. Tasks carry due dates and priorities; projects collect their notes and tasks. Demo cards are native tasks, not copied text.",
    ],
    [
      "Calendar and daily notes",
      "The calendar opens in the current month. Switch to week or day, click a task to inspect it, and open a date's daily note. This vault uses 08 Journal for daily notes, with 21 entries around its creation date. Task dates share this calendar. Dates remain stable after creation, so your history does not shift on restart.",
    ],
    [
      "PDF annotation lab",
      "Open Evidence desk. The reef report includes highlights, an underline, a rejected statement with strikeout, a location comment, and a freehand mark. The annotation list jumps to the correct page and position. Select text or draw a region to add your own annotations. These editable annotations live in the vault's .aster/modules.json sidecar; the source PDF remains intact. Annotated PDF export is not implemented yet. Evidence links can point at an annotation and track later changes.",
    ],
    [
      "Layouts and themes",
      "Use the saved layouts to pair any tools. Drag the divider to resize panes, split again, move tabs between panes, and save your arrangement. The demo opens with the Ocean theme; Settings offers Aster, Cyber, Lavender, Ocean, Paper, and Rose. Graph colors and saved positions belong to the vault. Closing a tool tab does not delete its data.",
    ],
    [
      "AI and privacy",
      "The complete demo works offline without credentials. Local link suggestions are available from note content. Cloud suggestions are optional: configure your own supported provider API key in Settings and explicitly request suggestions. Selected context then goes to that provider. No key is bundled, and the demo never makes an AI request automatically. Review suggestions before creating a connection and attach evidence when a relationship represents a claim. Cloud sync is not implemented.",
    ],
    [
      "Export for RAG",
      "Use the RAG export action to create JSONL chunks with source IDs, note paths, metadata, and relationship evidence. Inspect the result before using it in your own retrieval pipeline. Workbooks and PDFs can appear as graph tool nodes, but that does not automatically convert every binary document or worksheet into embedded chunks. Aster does not bundle a vector database or a hosted retrieval service. Start an evaluation with Expansion decision and ask whether its source limitation survives retrieval.",
    ],
  ];
  guides.forEach(([title, body]) =>
    put(
      7,
      title,
      `${body}\n\nSee [[The Aster field guide]] and [[Mission control]].`,
      { type: "guide", tags: ["pelagic", "guide"] },
    ),
  );
  const briefs: [number, string, string, string?][] = [
    [
      1,
      "Expansion decision",
      "Nursery survival increased from 72% to 89%. The six-site sample does not establish regional causality.\n\nApprove a bounded follow-up only after [[Farwater]] is inspected again. [[Reef report source]] supports the observed change; [[Sampling boundaries]] constrains the interpretation. Review the evidence on the supports connection and compare [[Restoration scorecard]].",
      "decision",
    ],
    [
      1,
      "Deployment decision",
      "Deploy only after calibration, power and recovery checks. Station L-07 remains blocked pending the spare connector.\n\nInspect [[Engineering report source]], [[Station L-07]], and [[Supply chain]]. The Lantern board tracks the gate work. A high average readiness score does not waive an individual station's gate.",
      "decision",
    ],
    [
      1,
      "Community partnership",
      "Run a fictional workshop that explains the pilot's limits in ordinary language. Invite feedback on what a useful public summary should show. Do not mistake attendance for consent to a real research program.\n\n[[Rae North]] owns the accessible brief. Link [[Sampling boundaries]], [[Expansion decision]], and [[Evidence review]] in the handoff.",
    ],
    [
      1,
      "Stewardship review",
      "Review budget, uncertainty, and ownership together before expanding scope. Each decision needs a named reviewer and an inspectable source.\n\nRead [[Budget review]], [[Expansion decision]], [[Deployment decision]], and [[Review ownership]]. A clean dashboard is not proof that all underlying assumptions are sound.",
    ],
    [
      5,
      "Budget review",
      "The portfolio allocation totals 180000 dollars. Reallocate only after the project owner reviews the variance.\n\nUse Expedition finances for calculated remaining balances and utilization. [[Portfolio report source]] records the allocation. [[Budget variance]] explains planned versus committed spend; [[Procurement rules]] describes the review step.",
      "decision",
    ],
    [
      5,
      "Supply chain",
      "The spare connector for [[Station L-07]] is the critical dependency. Mark its task complete only when the fictional inspection is recorded.\n\n[[Theo Reed]] coordinates the handoff with [[Ivo Chen]]. The same task appears on the Lantern board, in the project, and in the calendar. See [[Deployment decision]].",
    ],
    [
      5,
      "Vessel manifest",
      "| Crate | Contents | Review |\n| --- | --- | --- |\n| A | Sampling frames and labels | [[Sampling protocol]] |\n| B | Batteries and recovery spares | [[Recovery protocol]] |\n| C | Dry notebooks and calibration sheets | [[Calibration protocol]] |\n\n[[Nia Sol]] reconciles the manifest with [[Supply chain]]. This is a fictional inventory, not operational guidance.",
    ],
    [
      5,
      "Procurement rules",
      "Record planned allocation and committed spend separately. A purchase request links its project, note, and review task. A negative remaining balance calls for review, not automatic approval.\n\nUse [[Budget review]], [[Vessel manifest]], and [[Budget variance]] as context.",
    ],
    [
      4,
      "Sampling protocol",
      "Compare paired sites using the same fictional survey window and retain missing observations as missing. Keep visibility and sampling context beside the count.\n\nLink every record to its site and [[Paired comparisons]]. Review [[Missing observations]] before calculating averages. This demonstrates documentation structure and is not a real field protocol.",
    ],
    [
      3,
      "Calibration protocol",
      "Record the check date, station, reviewer, and uncertainty. Passing calibration alone does not satisfy the power and recovery gates.\n\nFollow [[Lantern sensor network]], [[Engineering report source]], and [[Deployment decision]]. This is fictional workflow documentation.",
    ],
    [
      3,
      "Recovery protocol",
      "A spare recovery beacon is required for offshore stations.\n\nRecord the check with the station and connect outstanding supplies to [[Supply chain]]. Review [[Deployment decision]] with [[Ivo Chen]]. The procedure is synthetic and should not be used for real equipment.",
    ],
    [
      4,
      "Weather window",
      "Treat the current planning date as a placeholder, not a weather forecast. Calendar dates coordinate fictional reviews and can be moved as tasks evolve.\n\n[[Field expedition]], [[Vessel manifest]], and [[Operational uncertainty]] keep dependencies visible.",
    ],
    [
      4,
      "Field safety",
      "This demo is a software tutorial, not boating, diving, electrical, or environmental safety guidance. Real operations require appropriate local expertise and procedures.\n\nThe fictional team uses [[Review ownership]] to prevent an unlabeled draft from becoming an approved procedure. See [[Field expedition]].",
    ],
    [
      6,
      "Evidence review",
      "Check the captured passage, its source freshness, and whether the conclusion overreaches. A graph edge labeled supports is a reviewable claim, not a fact certificate.\n\nInspect [[Reef report source]], [[Engineering report source]], [[Portfolio report source]], and [[Source freshness]]. Preserve a limitation alongside the result.",
    ],
    [
      6,
      "Reef report source",
      "Nursery survival increased from 72% to 89%.\n\nThe six-site sample does not establish regional causality. The attached reef baseline PDF contains the paired-site table and review notes. This note and the PDF both support [[Expansion decision]]. Compare [[Restoration scorecard]] and [[Farwater]].",
      "source",
    ],
    [
      6,
      "Engineering report source",
      "Deploy only after calibration, power and recovery checks.\n\nStation L-07 remains blocked pending the spare connector. The Lantern readiness PDF records the gate review. Its highlighted passage is attached to the relationship supporting [[Deployment decision]]. See [[Station L-07]] and [[Recovery protocol]].",
      "source",
    ],
    [
      6,
      "Portfolio report source",
      "The portfolio allocation totals 180000 dollars.\n\nThe expedition plan PDF records the six synthetic allocations. Its budget annotation supports [[Budget review]]. The Expedition finances workbook provides calculated balances. See [[Mission control]].",
      "source",
    ],
  ];
  briefs.forEach(([s, title, body, type]) =>
    put(s, title, body, {
      type: type ?? "brief",
      status: type === "decision" ? "review" : "active",
      tags: ["pelagic", ...(s === 6 ? ["evidence"] : [])],
    }),
  );
  put(
    2,
    "Restoration scorecard",
    `A readable snapshot from the synthetic baseline report. This table drives **Scorecard from Markdown**; it is separate from the Ecology workbook.\n\n| Site | Before | After | Fish before | Fish after |\n| --- | ---: | ---: | ---: | ---: |\n${sites.map((s, i) => `| ${s} | ${before[i]} | ${after[i]} | ${fishBefore[i]} | ${fishAfter[i]} |`).join("\n")}\n\nRead [[Reef report source]] and [[Expansion decision]] before interpreting the change.`,
    { type: "dataset", tags: ["pelagic", "reef"] },
  );
  sites.forEach((s, i) =>
    put(
      2,
      s,
      `## Nursery ${i + 1}\n\nSurvival changed from **${before[i]}%** to **${after[i]}%** across the paired fictional observation. The fish count changed from ${fishBefore[i]} to ${fishAfter[i]}. Survey area: ${areas[i]} square meters.\n\n${["Repeat the label check before the next survey.", "Compare shaded and open transects separately.", "Retain the unusually clear observation window in the interpretation.", "Review visibility before comparing fish counts.", "Check that the largest plot has comparable effort.", "A second inspection is required before expansion."][i]}\n\nSurvey notes live in Fieldwork but name this site as their metadata parent. Switch Tree to parent mode to see that organization.\n\nCompare [[${sites[(i + 1) % 6]}]], [[Restoration scorecard]], [[Sampling protocol]], and [[Expansion decision]].`,
      {
        type: "site",
        status: i === 5 ? "review" : "active",
        survival: after[i],
        baseline: before[i],
        fish: fishAfter[i],
        area: areas[i],
        date: addDays(date, i - 6),
        tags: ["pelagic", "reef", "tideglass"],
      },
    ),
  );
  for (let round = 1; round <= 6; round++)
    sites.forEach((s, i) => {
      const d = addDays(date, -12 + round * 2 + (i % 2)),
        count = fishBefore[i] + round + ((i + round) % 3) - 1;
      put(
        4,
        `${s} survey ${String(round).padStart(2, "0")}`,
        `**${d} · ${s} · round ${round}**\n\nThe synthetic observation recorded ${count} fish with visibility ${8 + ((i * 3 + round) % 9)} meters. Context: ${["morning light", "patchy shade", "a turbid tidal window", "steady visibility", "a label recheck", "a paired repeat"][round - 1]}.\n\nRetain that context before comparing the count with the next survey. ${round === 6 ? "This record awaits the final paired review." : "The fictional record has passed its transcription check."}\n\nLinks: [[${s}]], [[Sampling protocol]], [[Reef report source]], [[Missing observations]].`,
        {
          type: "observation",
          parent: `[[${s}]]`,
          date: d,
          site: s,
          count,
          visibility: 8 + ((i * 3 + round) % 9),
          status: round === 6 ? "review" : "checked",
          tags: ["pelagic", "reef", "survey"],
        },
      );
    });
  readiness.forEach((r, i) =>
    put(
      3,
      station(i),
      `## ${i < 6 ? "Inshore" : "Offshore"} station\n\nReadiness: **${r}%**. Battery reserve: **${68 + i * 2}%**. Associated nursery: [[${sites[i % 6]}]].\n\n${i === 6 ? "Blocked: the spare connector must pass inspection. The task is on the Lantern launch board; see [[Supply chain]]." : "Review calibration, power, and recovery separately before approving the deployment gate."}\n\nEdit readiness in this note's frontmatter to refresh the live station chart and Canvas query. The Ocean telemetry workbook is a separate snapshot.\n\nSee [[Calibration protocol]], [[Recovery protocol]], and [[Deployment decision]].`,
      {
        type: "station",
        status: i === 6 ? "blocked" : i % 3 === 0 ? "ready" : "review",
        readiness: r,
        battery: 68 + i * 2,
        zone: i < 6 ? "inshore" : "offshore",
        date: addDays(date, i - 5),
        tags: ["pelagic", "lantern", "station"],
      },
    ),
  );
  const concepts = [
    [
      "Paired comparisons",
      "Compare the same units before and after. Preserve the pairing instead of treating every survey as an independent replicate. [[Restoration scorecard]] and [[Sampling protocol]] show the context.",
    ],
    [
      "Missing observations",
      "An absent reading is not a measured zero. Record the reason and review how exclusions affect the conclusion. See [[Sampling protocol]] and [[Station L-07]].",
    ],
    [
      "Source freshness",
      "Captured evidence retains a revision or annotation version. When the source changes, revisit the relationship rather than assuming its old quote still supports the claim. See [[Evidence review]] and [[Reef report source]].",
    ],
    [
      "Operational uncertainty",
      "A schedule is a plan with dependencies. Keep uncertainty beside the due date, especially for supplies and field windows. Follow [[Weather window]] and [[Supply chain]].",
    ],
    [
      "Budget variance",
      "Remaining allocation equals planned minus committed spend. Utilization divides committed by planned. These describe this fictional budget, not project value. See [[Budget review]] and [[Procurement rules]].",
    ],
    [
      "Sampling boundaries",
      "Six paired sites support a narrow description of this pilot. They do not establish a regional causal effect. Preserve this boundary beside [[Expansion decision]] and [[Reef report source]].",
    ],
    [
      "Review ownership",
      "An explicit reviewer prevents a polished draft from being mistaken for an approved decision. Link the project, its tasks, and the responsible role. See [[Team directory]] and [[Stewardship review]].",
    ],
    [
      "Retrieval evaluation",
      "Ask whether a retrieved answer cites the result and its limitation. Use [[Expansion decision]] as a test question, then inspect [[Export for RAG]] and [[Sampling boundaries]].",
    ],
  ];
  concepts.forEach(([title, body]) =>
    put(6, title, body, { type: "concept", tags: ["pelagic", "methods"] }),
  );
  const people = [
    ["Mara Vale", "Research lead", "Tideglass reef program"],
    ["Ivo Chen", "Instrument lead", "Lantern sensor network"],
    ["Nia Sol", "Field coordinator", "Field expedition"],
    ["Theo Reed", "Operations lead", "Harbor operations"],
    ["Ada Finch", "Evidence editor", "Atlas evidence library"],
    ["Rae North", "Community liaison", "Community partnership"],
  ];
  put(
    1,
    "Team directory",
    `All people are fictional. Roles demonstrate ownership without real contact information.\n\n${people.map(([name, role, hub]) => `- [[${name}]]: ${role}, [[${hub}]].`).join("\n")}\n\nSee [[Review ownership]].`,
    { type: "directory" },
  );
  people.forEach(([name, role, hub]) =>
    put(
      1,
      name,
      `**${role} · fictional team member**\n\nOwns review coordination for [[${hub}]]. Connect open questions to the project's notes and tasks before requesting a decision.\n\nSee [[Team directory]], [[Review ownership]], and [[Mission control]].`,
      { type: "person", role, parent: "[[Team directory]]" },
    ),
  );
  for (let i = -10; i <= 10; i++) {
    const d = addDays(date, i),
      idx = (i + 12) % 6;
    put(
      8,
      d,
      `## ${i > 0 ? "Planned review" : "Expedition log"}\n\n${i > 0 ? "Plan" : "Fictional record"}: review [[${sites[idx]}]] alongside [[${station((i + 12) % 12)}]]. Check the relevant evidence before changing a task's status.\n\n### Agenda\n\n- Compare the latest site record with [[Restoration scorecard]].\n- Review [[Deployment decision]] and outstanding supplies.\n- Preserve any uncertainty in [[Evidence review]].\n\nNative task due dates appear beside this daily note in Calendar. See [[Field expedition]] and [[Expedition journal]].`,
      {
        type: "daily",
        date: d,
        status: i > 0 ? "planned" : "logged",
        tags: ["pelagic", "journal"],
      },
    );
  }
  return notes;
}
