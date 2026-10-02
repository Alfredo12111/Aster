# Aster — remaining addon roadmap

Completed Calendar, Tasks & Projects, PDF annotation/navigation, Canvas queries, Navigator, Charts, Kanban, split workspaces, themes, linked tool nodes, the visual tree, captured connection evidence, research workbook controls, and the full in-app Pelagic Labs demo have been removed from this pending list. Their documentation is in the [feature guide](FEATURES.md) and [changelog](../CHANGELOG.md).

Remaining work, without scheduled phases or promised dates:

- **PDF export and extraction:** annotated PDF export, OCR and attributed document passages in RAG exports.
- **Deeper worksheet compatibility:** broader formula conformance, array/spill formulas, named ranges, pivot tables, cell styling/import-format preservation and workbook-object preservation. Legacy XLS and macros remain unsupported.
- **More chart controls:** combination charts, secondary axes, error bars, confidence bands and additional financial indicators.
- **Calendar/tasks:** timed events, recurrence, reminders, Markdown checkbox sync and task dependencies.
- **Live queries:** task/annotation records, incremental subscriptions and aggregate query clauses.
- **Large vaults:** rebuildable SQLite/FTS indexes, paginated loading, explorer virtualization, graph detail levels, bounded history and realistic memory/latency benchmarks.
- **Retrieval:** persistent local embeddings, source freshness checks during retrieval, provenance-aware retrieval previews and an end-to-end answering pipeline.
- **Optional cloud sync:** authenticated service, device keys, encrypted transfer, conflict handling, quotas and operational tests. Local vaults must work without an account.
- **Distribution/accessibility:** signed installers/updates, macOS/Linux validation, keyboard/screen-reader review and high-DPI coverage.

See [Architecture](ARCHITECTURE.md) for infrastructure constraints. These items are not included in the current download.
