# Aster 0.3.2 — Built-in tools ready to use

All seven built-in modules now start enabled in new vaults. Existing vaults retain their saved switches, and modules can still be disabled without deleting their data.

Included in Aster's local Markdown workspace:

- Thirteen chart types from live queries, Markdown tables and imported CSV/XLSX data.
- Editable worksheets with formulas, cross-sheet references, statistics, financial functions, regression and image/data exports.
- Kanban cards connected to tasks, notes and projects; drag, reorder and customize columns.
- Combine any tools in resizable panes, move tabs, and save layouts.
- Cyber, Lavender, Deep Ocean, Paper, Rosewood and the original Aster theme.

Calendar, Tasks & Projects, PDF annotation/navigation, live Canvas queries, metadata navigation, BYOK suggestions and RAG JSONL export remain included.

The previous release's fix for reopening a selected note from Graph, including previously saved layouts, is included.

## Download and run

1. Download **Aster-0.3.2-windows-x64.zip**.
2. Extract the entire ZIP.
3. Open **Aster.exe**. Keep its accompanying files together.

No Node.js or developer tools are required. This is an unsigned Windows x64 alpha. Compare the ZIP's SHA-256 hash with **SHA256SUMS.txt**. The archive includes setup instructions; GitHub's generated Source code downloads are not the runnable app.

All seven modules now start enabled in new vaults. Existing vaults retain their saved choices. Use the puzzle icon to manage modules, **＋ View** and split buttons to arrange tools, and **Appearance & themes** to choose a theme. Back up your entire vault before updating.

## Validation and limits

56 automated tests and three desktop suites cover chart families, financial calculations, import/export, live updates, Kanban dragging, pane sizing, tab movement, themes, restart persistence, rotated/cropped PDF geometry and 1,500-note navigation. Release workflows run these against the packaged executable and audit the distribution before upload.

The worksheet engine has documented formula coverage, not full Excel compatibility. Imports are snapshots; workbook formatting, macros, legacy XLS, named ranges and spill arrays are unsupported. Cloud sync, persistent large-vault indexes, OCR, annotated PDF export and automatic updates remain future work.

[Feature guide](https://github.com/Alfredo12111/Aster/blob/main/docs/FEATURES.md) · [Charts and limits](https://github.com/Alfredo12111/Aster/blob/main/docs/CHARTS.md) · [Validation](https://github.com/Alfredo12111/Aster/blob/main/docs/VALIDATION.md)
