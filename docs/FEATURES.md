# Aster feature guide

Aster 0.5 includes the complete [Pelagic Labs demo](DEMO.md) on first launch. It connects tools to the graph and a new visual tree, adds evidence-backed relationships, and expands workbook editing alongside charts, Kanban, flexible workspaces, and themes with Calendar, Tasks & Projects, PDF annotation, live Canvas queries, and metadata navigation. This guide describes shipped behavior. See [remaining roadmap](ADDON-ROADMAP.md) for future work.

Open **Built-in modules** (the puzzle icon on the activity bar) to manage the tools for this vault. All seven switches start on for a new vault. Existing saved switches are respected; missing switches default to enabled. Disabling a module preserves its records. Creating a task from a note explicitly enables Tasks & Projects if needed. Everything here works locally without plugins, an account, an AI key, or a cloud service.

## Flexible workspaces

Use **＋ View** to add Web, Tree, Text, Calendar, Tasks, Projects, PDF Annotation, Canvas, Navigator, Charts or Kanban to a pane. Split right or below, then drag the divider to change proportions. A divider supports arrow keys, Home, and double-click to return to 50/50. Drag tabs between panes or reorder them. Closing a pane's last tab collapses its split; one pane always remains.

Up to eight panes and twelve tabs per pane are supported. **Save layout** stores a named arrangement with tabs and proportions; the dropdown restores it. Manage up to twenty layouts in that dialog. The current layout persists on restart. Layouts save surfaces, note IDs, and tool targets opened from the map. Evidence links retain the requested annotation/page. Temporary searches, tree zoom/collapse/hierarchy choices, and manual PDF-page browsing are session state.

All module panes share one write queue so edits use the latest successful revision. Chart calculations and query evaluation run in background workers.

## Connected tools, tree and evidence

The graph can include existing workbooks, charts, Kanban boards, Canvas boards, projects, tasks, PDFs and Calendar as linked tool nodes. Their native module remains the source of truth. The separate Tree view organizes notes and tools by folders or parent metadata with regular spacing and right-angle branches. Manual relationships can carry exact note passages and PDF annotation snapshots. See [Connected workspace](CONNECTED-WORKSPACE.md) for the controls, persistence and review rules.

## Themes

Native dropdown lists use dark backgrounds and light lettering matched to each theme, including the lighter Lavender and Paper themes.

Open **Appearance & themes** on the activity bar. Choose **Aster**, **Cyber** (green/black), **Lavender** (purple/light gray), **Deep Ocean**, **Paper**, or **Rosewood**. The theme applies immediately and persists per vault. Editor and chart colors adapt; custom graph colors and original PDF page colors remain intact.

## Charts

Thirteen chart types, live query/Markdown sources, CSV/XLSX imports, editable worksheets, formulas, summaries, regression, and image/data exports are included. See [Charts and calculations](CHARTS.md) for controls, conventions, formula coverage, and compatibility limits.

## Kanban

Create a board for all tasks or one project. Existing tasks appear automatically. Cards are native tasks, with a source note, context, due date, priority, status, and project. Create cards in columns, select their title to edit, and open their linked note.

Drag cards between columns or reorder them. Column selectors and up/down buttons support keyboard movement. Moving a card changes its task status everywhere. Rename columns, choose colors, map them to statuses, and move columns left to arrange them. Multiple columns may share a status; explicit placement remains until an external task status change requires remapping.

Removing a column preserves its tasks, which appear in the matching status column or **Other statuses**. Deleting a board preserves tasks and notes. Delete tasks through the Tasks module. Project boards show only matching tasks.

## Calendar

Choose **Day**, **Week**, or **Month**. Use Today, previous/next period, or the date picker to navigate. Select a day to see its notes and tasks in the agenda. **Open or create daily note** opens the existing note or creates one without overwriting its contents.

The default path is `Daily/YYYY-MM-DD.md`. Calendar settings let you change the daily-note folder and choose Monday or Sunday as the first weekday. Dates are date-only strings, with arithmetic at local noon to avoid DST shifts.

Any note with a `date` frontmatter field appears on that date, regardless of its folder or filename:

```yaml
---
date: 2026-10-01
type: research
---
```

Due tasks appear when Tasks & Projects is enabled. Complete tasks directly in the date agenda. This is a date organizer; time-of-day appointments, recurring events, calendar-account sync and reminders are not included.

## Tasks & Projects

Use the **Create task from this note** button in the editor. Selected text supplies a title and source excerpt (up to 4,000 characters). The source note remains linked by its stable Aster ID. You can also create tasks in the Tasks view.

Every task has a title, optional source note/context, optional due date, status, priority and optional project. Statuses are `todo`, `in-progress`, `blocked`, `done`, and `cancelled`; priorities are `low`, `normal`, `high`, and `urgent`. Edit a task by selecting its title or edit icon. A completion checkbox and status selector support quick updates. Filter by text, status, priority, project, due today, overdue or upcoming. Completed and cancelled tasks are excluded from overdue results.

Create or edit a project in **Projects**, attach related notes, and see its tasks in the same view. A note can also join a project using a `project` value equal to the project name, ID, or `[[Project name]]`. Source notes moved inside Aster retain their task links; externally renamed or missing notes display a missing-source state.

Tasks are independent records in the sidecar. Markdown checkbox synchronization, dependencies, recurring tasks and project deletion are not implemented. Deleting a task retains the earlier sidecar in recovery history.

## Canvas and Aster Query

Create a board, then **Pin query card**. Use the query builder or write Aster Query directly. Cards render live tables; their first column opens the source note. Drag a header to move a card and drag its lower-right corner to resize. A focused resize handle also accepts arrow keys. Board identity, query text and card geometry are saved in the vault. Query result rows are derived, not saved as stale copies.

Aster Query is its own language. It does not execute JavaScript, SQL, functions or arbitrary expressions. Use one clause per line:

```text
SELECT file.name, status, date, source.author
FROM "Research"
WHERE status = "active"
WHERE tags contains "rag"
SORT date DESC
LIMIT 50
```

| Clause | Behavior |
| --- | --- |
| `SELECT` | Required first line; up to 12 comma-separated field names. |
| `FROM "Folder/Subfolder"` | Optional folder scope, including its descendants; defaults to the whole vault. |
| `WHERE field operator value` | Up to 10 filters combined with AND. Operators: `=`, `!=`, `>`, `>=`, `<`, `<=`, `contains`. |
| `SORT field ASC` / `DESC` | One sort field; defaults to `file.name ASC`. |
| `LIMIT 50` | 1–500 displayed rows; defaults to 50. The card also shows the total matching count. |

Values use JSON syntax: `"active"`, `3`, `true`, `false`, `null`. Equality preserves types. Comparisons require matching string or number types. `contains` performs a case-insensitive substring search in a string or array item. Missing values compare as null and display as an em dash. Date strings in `YYYY-MM-DD` form sort chronologically.

Built-in fields: `file.name` (also `title`), `file.path`, `file.folder`, `file.tags` (also `tags`), and `file.modified` (ISO timestamp). Other fields come from frontmatter; dot notation reads nested maps. Query field names are case-sensitive; clauses are case-insensitive. The builder edits the first filter and preserves additional WHERE clauses entered in the language editor. Quote a numeric-looking string to keep it a string.

Queries run in a Web Worker and refresh after in-app or watched external note changes. Current queries cover notes and their metadata, not sidecar task/annotation tables. Each active board can contain up to 100 cards. All cards on that board re-query on a changed note snapshot; field-level incremental subscriptions are future infrastructure work.

## Metadata navigator

Choose **Frontmatter parent** or **Folder structure**. Filter with a folder, metadata field/value, or note-title/path/tag search. Filters retain matching notes' ancestors so the hierarchy stays understandable. Expand/collapse branches or use Expand all/Collapse all. Arrow keys navigate; Enter opens a focused note.

```yaml
---
parent: "[[Topics/Retrieval]]"
status: active
tags: [rag, research]
---
```

Change the parent field name to use another scalar frontmatter field. Parent targets follow Aster's sibling-path, vault-path, then unambiguous-basename resolution. This hierarchy is independent of graph links and does not move files. Multiple parents, missing/ambiguous targets and cycles remain visible under **Hierarchy issues**. A note has one primary parent; multi-parent membership is not silently guessed.

The navigator renders a window of rows rather than mounting the full tree. Core tests exercise a 10,000-note chain without recursive stack overflow. This does not remove the app's current full-snapshot limits or prove interactive performance on every large vault.

## PDF annotation and navigation

Import a PDF through the native picker. Aster copies it into `Attachments/`, assigns a document ID, and fingerprints its bytes. Identical bytes deduplicate to the existing document. Select a document from the library selector.

Use page controls, zoom, and view rotation. The renderer loads one visible page at a time. Fonts, CMaps and decoders ship with the app; ordinary reading does not require a network connection. Tools:

- **Highlight**, **underline**, **strike through:** drag over selectable text.
- **Area comment:** drag a region, then write and save its comment in the right panel.
- **Freehand ink:** draw directly on the page, with color and stroke-width controls.
- **Select:** click a mark or its annotation-list entry; edit its comment or delete it.
- **Undo/redo:** the last 50 annotation edits for the current document session. Durable recovery history also survives restarts.

The per-document annotation panel lists all annotations in page order, with type, quote/comment preview, text search and type filtering. Selecting an entry loads its page, scrolls to its position, and selects its mark and comment editor.

Annotations store native PDF page coordinates, not screen pixels. Text and region marks use quadrilaterals; ink stores page-space points. PDF viewport transforms preserve their positions across zoom, crop boxes, rotation and reopen. Page numbers are one-based. The original PDF is not modified. A changed document fingerprint produces a visible error; import revised bytes as a new document to avoid applying old anchors to unrelated pages.

Scanned PDFs support area comments and ink; text markup requires an existing text layer. OCR, password entry, annotation-object import from other PDF editors, and automatic reconciliation of replaced PDFs are not included. Editable sidecars are implemented; annotated PDF export is deferred as requested. Full PDF text and standalone annotation indexing are not included in Markdown RAG export. Captured annotation evidence on an exported note-to-note relationship is included with that relationship.

## Persistence and recovery

```text
Vault/
  Daily/2026-10-01.md
  Attachments/source-<id>.pdf
  .aster/
    vault.json                 # note IDs, graph views and relationships
    modules.json               # version 1: flags, calendar, tasks, projects, boards, documents/annotations, charts, datasets, Kanban, workspace, resource pins
    module-history/<hash>.json # previous module state before each write/import
```

Frontmatter stays in Markdown. YAML parsing is bounded and reports malformed/unsupported metadata on its note. Module records have validated UUID identities; duplicate IDs, invalid dates, invalid paths and missing annotation geometry are rejected. Sidecar writes are serialized, checked against an expected SHA-256 revision, and atomically replace the saved file. An external conflict preserves the saved version and shows a reload action; it is not merged silently. A queued save uses the latest successful revision. Corrupt sidecars are preserved rather than reset.

Back up the entire vault, including `.aster` and `Attachments`. For manual recovery, close Aster, copy the current sidecar somewhere safe, replace `.aster/modules.json` with a chosen valid file from `.aster/module-history`, and reopen the vault. Recovery changes all module records to that snapshot; it does not undo Markdown/PDF file changes. There is no in-app history browser or automatic retention policy yet.

The sidecar is editable JSON. Preserve IDs, schema version, PDF fingerprint and geometry. App/schema validation still applies to manual edits. Current protective ceilings include 50 MB of module JSON and 100 MB per imported PDF. They are limits, not performance guarantees. The module store is a single revisioned file; fine-grained multi-device operations and a rebuildable local database remain future scaling work. Optional cloud sync is not connected in this build.

## Verification

See [VALIDATION.md](VALIDATION.md) for the recorded checks and their limits. Automated desktop coverage includes all requested module workflows, watched-file query refresh, card movement/resizing, rotated/cropped PDFs, annotation editing/search/navigation/undo, and a full application restart.

Rendering and coordinate conversion follow [PDF.js's documented viewport model](https://mozilla.github.io/pdf.js/examples/). Text-layer styles are scoped to PDF pages, with their upstream Apache-2.0 notice retained.
