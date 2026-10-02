# Changelog

## 0.3.2 — 2026-10-02

- All seven built-in modules are enabled by default in new vaults and when their saved switch is missing. Existing explicit switches remain respected, and users can still disable modules without deleting data.
- Updated the feature page, setup guide, module screen, and packaged desktop checks for the new defaults.

## 0.3.1 — 2026-10-02

- Fixed reopening a selected note after switching to Graph or restoring a graph-only layout. Graph/module tabs no longer masquerade as note editors, including previously saved layouts.
- Added a core identity test and desktop regression for both new and legacy presets. All 56 source tests and three packaged suites cover the release.

## 0.3.0 — 2026-10-02

- Built-in Charts: thirteen chart types; live Aster Query and Markdown tables; CSV/TSV/XLSX import; selected ranges and editable worksheets.
- Formula calculation with cross-sheet references, statistical and financial functions; summaries, aggregation, regression, moving averages, distributions and correlation heatmaps. PNG/SVG/CSV chart export and calculated-value XLSX export.
- Native Kanban with source-linked task cards, project scopes, configurable columns, drag/reorder, keyboard movement and shared task statuses.
- Arbitrary horizontal/vertical pane splits, draggable dividers, movable tabs, named layouts, and restart persistence.
- Six themes: Aster, Cyber, Lavender, Deep Ocean, Paper and Rosewood.
- Shared module queue, chart draft retention/autosave, stale chart/workbook checks, isolated calculation workers, bounded imports, and safer literal CSV export.
- Preserved existing modules; corrected single-pane height constraints and tested rotated PDF selection at a fitting zoom.
- Updated feature page, setup guide, chart reference and remaining-only roadmap. Added the visual desktop suite to CI and release gates.
- 55 core/storage/publication tests; discovery excludes local audit copies.

## 0.2.0 — 2026-10-01

### Knowledge workspace

- Local Markdown vaults, nested folders, search, editing and formatted preview.
- Wiki links, backlinks and labeled relationships in a customizable graph.
- Manual node positioning, saved views, colors and three graph layouts.
- Local connection suggestions, optional BYOK AI review, and source-attributed RAG JSONL export.

### Built-in optional modules

- Day/week/month Calendar with dated notes and task due dates.
- Tasks with status, priority, due date, source note and project assignment; project views collect related notes and work.
- PDF highlights, underlines, strikeouts, region comments and ink, saved as editable sidecar records.
- Annotation search, type filters, page/location navigation, comment editing, delete, undo and redo.
- Live Aster Query cards on movable, resizable Canvas boards.
- Virtualized folder/frontmatter hierarchy navigation with metadata filters and visible hierarchy diagnostics.

### Reliability and publication

- Released under the MIT license.

- Versioned module records, revision-checked saves, previous-state recovery history and PDF fingerprint validation.
- Offline PDF resources and scoped text-layer styles.
- 30 automated tests (including 28 core/storage/provider/protocol tests) plus packaged desktop workflows, restart/coordinate checks and a 1,500-note navigator scenario.
- GitHub project page, source/run instructions, contribution guidance, publication audits and Windows release packaging.
- Desktop PDF checks wait for interactive rendering and native text selection before validating saved annotations.
- PDF navigation reserves space for the sticky instructions bar; module tests exercise a 1280 × 720 viewport.

Cloud sync, persistent large-vault indexing, annotated PDF export, OCR and a signed installer remain outside this alpha.
