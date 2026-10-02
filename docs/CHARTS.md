# Charts, worksheets and calculations

Open **Charts** from Built-in modules. It is enabled by default in new vaults. Use **Try sample data** for a fictional dataset, **New workbook** for a blank sheet, or **Import CSV / Excel** for UTF-8 CSV/TSV or XLSX.

## Three data sources

- **Workbook:** select an imported or native workbook and worksheet. Edits inside Aster recalculate dependent formulas and charts. Imports are snapshots; changes to the original external file are not watched.
- **Markdown table:** select a note and its table number. Editing the note, including through another editor, refreshes the chart after the vault watcher loads the change.
- **Live Aster Query:** query note frontmatter and built-in file fields. Queries return up to 500 rows and display a truncation message when more notes match. [Query language](FEATURES.md#canvas-and-aster-query).

The first row in a source range supplies headers. Use an A1 range such as **B3:F20**, or leave it blank for all data. Empty and repeated headers receive unique names. Choose X/categories and one or more numeric value series. Mappings reset when the new source lacks the previously chosen columns.

## Chart families

| Type | Data and behavior |
| --- | --- |
| Line | Category X and numeric series, gaps/zero handling, optional smoothing and trendlines. |
| Slope | A label column and exactly two numeric columns; up to 100 rows. |
| Bar / Column | Horizontal/vertical categorical values, grouping, aggregation, sorting and optional stacking. |
| X–Y scatter | Numeric X/Y pairs, optional grouping and fitted trends. |
| Bubble | Scatter data plus a nonnegative size column; bubble area scales with values, subject to visible size limits. |
| Candlestick / OHLC | Category/date, open, high, low, close; optional volume panel and moving average. Inconsistent price ranges are excluded with a message. |
| Histogram | Common equal-width bins across chosen series; the last bin includes its upper endpoint. |
| Box plot | Inclusive quartiles, median, 1.5 × IQR whiskers and separately drawn outliers. Optional groups use the first value column. |
| Density | Gaussian kernel estimate using Silverman's bandwidth rule; requires at least two numeric values. |
| Heatmap | Category intersections with aggregation, or a Pearson correlation matrix when no group field is selected. |
| Calendar heatmap | ISO dates or Excel serial dates and a value column, grouped by day for the chosen year. |

Controls include colors, legend, labels, axis titles and bounds, logarithmic values, missing-value handling, category order, grouping, and sum/mean/median/min/max/count aggregation where relevant. Pan/zoom and legend interaction are built into the chart. Controls apply to families that support them: stacking affects bars/columns, smoothing affects lines, and a financial moving average uses closing prices.

Valid settings autosave after a short pause; **Save chart** saves immediately. Chart drafts survive moving tabs. Invalid settings need fixing or discarding before closing their view. Stale chart edits from another pane are rejected rather than silently replacing the other edit.

## Worksheet editing

Select a cell and edit its raw value or formula in the **ƒx** bar; Enter or leaving the field saves it. Double-click a cell or press F2 to focus that bar. Arrow keys and Tab move selection. Shift-click or drag selects a range. Paste tab-separated or CSV data into the grid, clear a range, append or insert/delete rows and columns, and add worksheets. Rename workbooks and worksheets, duplicate a sheet, or delete a sheet not used by a chart. Undo/redo retains the last ten workbook edits in the current editor session.

**Chart selection** uses the first selected row as headers. Worksheets page through 25 rows at a time. The grid shows calculated values; the formula bar shows the saved expression.

~~~~text
=SUM(B2:B10)
=AVERAGE(B2:B10)
=IF(C2>0,B2/C2,0)
=ROUND(B2*1.15,2)
=Sheet2!B2*2
=PMT(0.01,12,1000)
=NPV(0.1,100,100)
~~~~

The **Functions** button lists registered functions. The engine combines fast-formula-parser and FormulaJS for arithmetic, references, logical, lookup, date, statistical, engineering and financial functions. This is not complete Excel compatibility: unsupported syntax/functions produce an error; edge cases have not all been conformance-tested. Named ranges, structured table references, external workbook links, spill arrays, macros and arbitrary workbook formatting are not supported. Prefix text with an apostrophe to retain a literal value.

Dependent cells recalculate across worksheets. Cycles, division by zero and invalid references produce cell errors. Formulas run in a disposable worker with bounded reference counts, depth and execution time; external/network function calls are blocked.

## Research and analysis controls

- Filter calculated values across all columns or one column using contains, equals, greater than or less than. Sort one column in either direction. The first row stays the header. These are view operations: original row addresses and formula references stay fixed. Single-cell edits still write to their source row; reset the view before multirow changes or range-based charts. **Export visible CSV** exports the current filtered/sorted view.
- Enter **A1:D20** in the range box. The selection summary reports filled cells, errors, sum, mean, minimum and maximum. **Fill down/right** copies from the first selected row/column and shifts relative A1 references while preserving dollar anchors.
- Inserting/deleting rows or columns repairs bounded A1 formulas, including cross-sheet references. Linked chart ranges change in the same save. A chart's header row or entire source cannot be removed without first changing that chart. Whole-row/whole-column formula references must be converted to bounded ranges before structural edits.
- Renaming a worksheet repairs qualified formula references and linked chart sources. Undo/redo restores workbook data and affected chart references together. If another pane changed a chart source, a conflicting undo is rejected.
- Column display formats include general, number, percent, USD currency, Excel-serial date, and text. Formatting does not change stored values; prefix a literal value with an apostrophe. These are column formats, not a full cell styling system.
- Workbooks and charts can be pinned to the knowledge map. A pinned chart automatically connects to its pinned source workbook or Markdown note. Open the same item from a map node to edit it.

## Mathematical conventions

- Summary variance and standard deviation use the sample denominator **n−1**; fewer than two values produce no sample deviation.
- Quartiles use inclusive linear interpolation, equivalent to the common type-7 estimator.
- Polynomial regression uses centered/scaled inputs and a QR solve, with degree 2–5. Linear, exponential and logarithmic regressions report R² on original Y values. Exponential fits require positive Y; logarithmic fits require positive X.
- Line trends use category positions, not inferred date intervals. Scatter trends use numeric X. Moving averages use a trailing window.
- Missing/nonnumeric values are excluded or replaced according to the chart setting; currencies or thousands separators are not silently parsed as numbers.
- Financial results use floating-point arithmetic. There is no arbitrary-precision accounting or rounding-policy engine.

## Export and limits

Charts export **PNG**, **SVG**, and their source **Data CSV** through a native save dialog. **Excel** exports calculated values; **Excel with formulas** exports supported formulas with cached values and requests recalculation on open. Supported column number formats are exported. Unsupported/error/external formulas export their calculated text rather than executable formulas. Formatting import is not a round trip: original cell styles, merged cells, pivot tables, macros, source chart objects and workbook links are not preserved. CSV export prefixes potentially executable text with an apostrophe; numeric negative values remain numbers.

Limits: 10 MB per import, 50 MB declared expanded XLSX data, 20 sheets per workbook, 10,000 rows and 100 columns per sheet, 100,000 cells per workbook, 4,000 characters per stored cell, 12 selected value series, 100 groups and 10,000 categorical heatmap intersections. Charts and datasets live in the vault's revisioned module sidecar, currently limited to 50 MB. These are protective ceilings, not measured performance guarantees.

All local charting works without an AI key or network service. Imported data stays in the vault; export only occurs when requested.
