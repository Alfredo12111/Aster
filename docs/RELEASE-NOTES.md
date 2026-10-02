# Aster 0.4.0: Connected research workspace

Bring your tools and their sources into the same map:

- Pin existing workbooks, charts, Kanban boards, Canvas boards, projects, tasks, PDFs and Calendar. Nodes open the original item and share its current data.
- Switch to an organized visual Tree with folder or parent-metadata branches, regular spacing, zoom and collapse controls. The freeform graph remains available.
- Attach exact note passages and PDF annotation snapshots to manual connections. Jump to their sources and review changed or missing evidence.
- Workbooks gain filtering, sorting, range summaries, relative fill, row/column insertion and deletion, sheet management, column number formats, visible CSV and formula XLSX exports.
- Structural edits and worksheet renames update linked charts. Undo restores affected chart references too. Fixed statistical functions masked by empty parser stubs.

Calendar, tasks, PDF annotation, live Canvas queries, Navigator, thirteen chart types, Kanban, resizable panes, themes, optional BYOK suggestions and Markdown RAG export remain included. All seven modules start enabled in new vaults; existing saved choices are respected.

## Download and run

1. Download **Aster-0.4.0-windows-x64.zip**.
2. Extract the entire ZIP and open **Aster.exe**.
3. Keep the accompanying files together. Your existing profile and vaults are stored separately.

No Node.js or developer tools are needed. This is an unsigned Windows x64 alpha. Compare the ZIP against **SHA256SUMS.txt** and back up the entire vault before updating. GitHub's Source code archives are not the runnable app. Setup instructions are included in the app folder.

Start with **Tree view** or **Add tool node** in the graph. Use **Evidence** on a manual connection and **Charts** for workbook controls.

## Validation and limits

66 automated tests and four isolated desktop suites cover calculations, sources, map navigation, evidence selection, imports/exports, Kanban, split panes, themes, PDF geometry, restart persistence and 1,500-note navigation. Release workflows repeat the suites against the packaged executable and audit the distribution before upload.

The workbook is a bounded analysis tool, not complete Excel compatibility. Pivot tables, named ranges, spill arrays, macros, legacy XLS and full formatting preservation remain unsupported. The diagram caps visible cards at 600. Source review compares saved records; PDF byte checks happen on open. Cloud sync, persistent large-vault indexing, OCR, annotated PDF export and automatic updates remain future work.

[Feature guide](https://github.com/Alfredo12111/Aster/blob/main/docs/FEATURES.md) · [Connected workspace](https://github.com/Alfredo12111/Aster/blob/main/docs/CONNECTED-WORKSPACE.md) · [Workbook controls](https://github.com/Alfredo12111/Aster/blob/main/docs/CHARTS.md) · [Validation](https://github.com/Alfredo12111/Aster/blob/main/docs/VALIDATION.md)
