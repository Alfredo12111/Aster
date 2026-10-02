# Pelagic Labs: a working organization inside Aster

Restore a reef, prepare an ocean sensor network, and keep decisions attached to their evidence. Pelagic Labs is a fictional research organization, represented entirely by editable Aster data. The graph, spreadsheets, charts, tasks, boards, queries, and annotations are real application records, not pictures of interfaces.

## Open the demo

A new app profile opens Pelagic Labs automatically. Existing users can choose **Open demo** beneath the vault name. Aster creates a separate copy the first time, then reopens that same copy with your edits intact. It never inserts demo content into an existing vault. **New vault** still creates an empty personal vault.

The copy is stored in the application profile. Use the folder button beside **Stored on this device** to reveal its location. Back up the whole vault, including `.aster` and `Attachments`.

The release also includes **Pelagic-Labs-demo.zip** for a fresh, portable copy. Extract the entire archive, including `.aster`, and use **Open** to select its Pelagic Labs folder. App-created copies center dates on their creation day; the downloadable edition uses October 2, 2026. No dates shift on restart.

## What is inside

| Native content | Included |
| --- | --- |
| Markdown notes | 128, organized into nine folders with metadata and wikilinks |
| Connected map | 168 items: 128 notes and 40 tool nodes, with 717 connections |
| Workbooks | Three, with nine sheets, formulas, cross-sheet summaries, dates, currency, and percentages |
| Charts | 15 populated charts spanning all 13 supported chart families |
| Projects and tasks | Six projects, 42 tasks with statuses, priorities, sources, and due dates |
| Kanban | Three boards backed by those same tasks |
| Calendar | 21 daily notes plus dated observations, station reviews, and task deadlines |
| Canvas | Three boards with ten live query cards |
| PDF Library | Three original reports, eight pages, and all five annotation types |
| Evidence | Three supports relationships, each with a captured note passage and PDF annotation |
| Saved layouts | Mission control, Evidence desk, Data studio, Launch room, Research tree, Ocean watch |
| Graph views | Mission map, Tideglass evidence, Lantern launch, Tools on map |

All names, measurements, prices, plans, and people are synthetic. The demo needs no network, account, provider key, or plugin. It illustrates how a group can structure its work; it does not add multi-user collaboration or cloud sync.

## A connected ten-minute tour

1. **Mission control.** Choose this saved layout and use the book icon to read Welcome aboard. Follow the portfolio links, inspect the graph neighborhoods, and double-click a square tool node. It opens its original tool. Its data is not copied into the graph.
2. **Data studio.** The Ecology workbook sits beside Nursery before and after. Edit a paired-site value in the formula bar. Gain, the cross-sheet Summary, and the chart recalculate. Other workbooks contain telemetry and project finances. Their summary sheets demonstrate AVERAGE, SUM, COUNTIF, STDEV.S, and arithmetic. Use the existing range, sorting, filtering, formatting, fill, undo, and export controls.
3. **Live note data.** Change the `readiness` field in Station L-07 from 62 to 74. Live station readiness and the Canvas Station gates query update after saving. The Ocean telemetry workbook is a separately labeled snapshot, so its cells do not silently change.
4. **Launch room.** Move Inspect L-07 spare connector from Needs attention to Under way. The same task changes in Tasks and Projects. Inspect its source note and due date. Calendar offers day, week, month, and daily notes.
5. **Evidence desk.** Read the reef report in Aster's PDF viewer beside Expansion decision. Select an annotation to jump to its page. Highlights, underlines, strikeouts, area comments, and freehand ink remain editable. Follow the supports connection from Reef report source to inspect its captured passage and annotation. Evidence records provenance, not proof of causality.
6. **Research tree.** Switch between folders and Parent metadata. Filter the graph for `path:Farwater` and choose Fit tree: field survey notes sit below their site through metadata, despite living in another folder. Navigator provides folder, text, and metadata filters. Clear the filter to return to the full collection.
7. **Ocean watch.** Move and resize live query cards for nursery sites, station gates, decisions, and surveys. Edit their Aster Query source or select another Canvas board.
8. **Make it yours.** Resize panes, move tabs, save another layout, recolor graph groups, or choose another theme. The Aster field guide includes in-app instructions for each feature, optional AI suggestions, and RAG export.

## Chart gallery

| Chart | Source | Question |
| --- | --- | --- |
| Ocean pulse | Telemetry / Daily | How does uptime vary over the window? |
| Nursery before and after | Ecology / Paired sites | How do paired survival values differ? |
| Remaining by workstream | Finances / Budget | Where is uncommitted allocation? |
| Live station readiness | Aster Query | Which station notes have the highest readiness? |
| Temperature and observations | Ecology / Transects | Is the synthetic relationship informative? |
| Nursery scale and survival | Ecology / Paired sites | How do area, survival, and fish counts compare? |
| Equipment index candles / OHLC | Finances / Index | What do fictional price intervals look like? |
| Observation distribution / density | Ecology / Transects | How are counts distributed? |
| Site variability | Ecology / Transects | How do group distributions compare? |
| Environmental correlations | Ecology / Transects | Which numeric fields co-vary? |
| Packets across the calendar | Telemetry / Daily | Where are activity concentrations? |
| Scorecard from Markdown | Restoration scorecard table | How can a note drive a chart? |
| Allocation and commitment | Finances / Budget | What portion is committed? |

The financial index is invented. The ecological data is an illustration, not research findings. PDF annotations remain sidecars; annotated PDF export is still planned. RAG export covers attributed Markdown chunks and relationship evidence, not automatic extraction of every workbook or PDF. Cloud suggestions remain an explicit opt-in action with your own key.

## Rebuild and verify

The canonical demo content is in `packages/demo/notes.ts` and `packages/demo/pelagic.ts`. Bundled PDF sources and their coordinate anchors are in `public/demo`. `scripts/create-demo-pdfs.py` regenerates those sources with ReportLab; normal builds use the checked-in PDFs and need no Python.

Run `npm run demo:export` on Windows to create the audited downloadable vault in `artifacts`. `npm run test:demo` launches the real app with an isolated new profile, exercises shared records and restart preservation, and captures screenshots. The four earlier desktop suites use their own explicit small regression fixture so they do not depend on the demo's size or story. CI repeats all five suites against the packaged release.
