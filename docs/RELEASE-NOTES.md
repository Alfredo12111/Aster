# Aster 0.5.0: Pelagic Labs

Open Aster and step into a complete fictional coastal research organization. Pelagic Labs demonstrates how notes, evidence, data, and project work fit together, entirely inside the app.

- **128 linked notes and 40 tool nodes** across nine neighborhoods, with four saved graph views.
- **Three workbooks, nine sheets, and 15 populated charts**, covering all 13 chart types plus workbook, Markdown table, and live query sources. Formulas and cross-sheet summaries calculate real results from synthetic data.
- **Six projects, 42 tasks, three Kanban boards, and 21 daily notes.** Boards share native tasks with Projects and Calendar.
- **Three live Canvas boards** for field observations, research, and expedition planning.
- **Three original PDFs** with highlights, underlines, strikeouts, area comments, and ink. Captured passages and annotations support three reviewable decision connections.
- **Six saved workspace layouts** and a full in-app field guide. Explore the organized Tree, metadata Navigator, graph customization, themes, optional AI settings, and RAG export.
- **Open demo** creates a separate copy for existing users, then preserves edits on subsequent visits. Existing personal vaults are never reseeded.

Reading mode now hides valid frontmatter instead of treating it as prose. Charts opened from tool nodes leave more room for the visualization by starting with configuration collapsed. Slope labels avoid vertical overlap.

## Download and open

1. Download **Aster-0.5.0-windows-x64.zip**.
2. Extract the entire ZIP and open **Aster.exe**. Keep its accompanying files together.
3. New profiles open Pelagic Labs automatically. Existing users choose **Open demo**, then explore **Saved layouts**.

No Node.js, provider key, account, or network is required for the demo. **Pelagic-Labs-demo.zip** is an optional standalone vault copy; extract it, including `.aster`, and choose its folder using **Open**. App-created copies use the current date; the downloadable copy has an October 2, 2026 timeline.

This is an unsigned Windows x64 alpha. Verify assets against **SHA256SUMS.txt**. Vaults and profiles are stored separately from the app; back up the entire vault before updating. The app has no automatic updater.

## Validation and scope

71 automated tests and five isolated desktop suites cover the app and demo. The new suite checks actual first launch, shared Kanban/task state, live metadata queries, PDF navigation, persisted demo edits, and preservation of an existing vault. Release workflows repeat all five suites against the packaged executable and audit the distribution. GitHub screenshots show the working synthetic demo.

All people, observations, budgets, and prices are fictional. The demo illustrates group organization; real-time collaboration and cloud sync are not implemented. Full Excel compatibility, pivot tables, OCR, annotated PDF export, persistent large-vault indexing, and a hosted RAG answering service remain outside this release.

[Demo tour](https://github.com/Alfredo12111/Aster/blob/main/docs/DEMO.md) · [Feature guide](https://github.com/Alfredo12111/Aster/blob/main/docs/FEATURES.md) · [Setup](https://github.com/Alfredo12111/Aster/blob/main/docs/GETTING-STARTED.md)
