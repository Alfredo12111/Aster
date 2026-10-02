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

Select a cell and edit its raw value or formula in the **ƒx** bar; Enter or leaving the field saves it. Double-click a cell or press F2 to focus that bar. Arrow keys and Tab move selection. Shift-click or drag selects a range. Paste tab-separated or CSV data into the grid, clear a range, append rows/columns, and add worksheets. Undo/redo retains the last ten workbook edits in the current editor session.

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

The **Functions** button lists registered functions. The engine combines fast-formula-parser and FormulaJS for arithmetic, references, logical, lookup, date, statistical, engineering and financial functions. This is not complete Excel compatibility: unsupported syntax/functions produce an error; edge cases have not all been conformance-tested. Named ranges, structured table references, external workbook links, spill arrays, macros and workbook formatting are not supported. Prefix text with an apostrophe to retain a literal value.

Dependent cells recalculate across worksheets. Cycles, division by zero and invalid references produce cell errors. Formulas run in a disposable worker with bounded reference counts, depth and execution time; external/network function calls are blocked.

## Mathematical conventions

- Summary variance and standard deviation use the sample denominator **n−1**; fewer than two values produce no sample deviation.
- Quartiles use inclusive linear interpolation, equivalent to the common type-7 estimator.
- Polynomial regression uses centered/scaled inputs and a QR solve, with degree 2–5. Linear, exponential and logarithmic regressions report R² on original Y values. Exponential fits require positive Y; logarithmic fits require positive X.
- Line trends use category positions, not inferred date intervals. Scatter trends use numeric X. Moving averages use a trailing window.
- Missing/nonnumeric values are excluded or replaced according to the chart setting; currencies or thousands separators are not silently parsed as numbers.
- Financial results use floating-point arithmetic. There is no arbitrary-precision accounting or rounding-policy engine.

## Export and limits

Charts export **PNG**, **SVG**, and their source **Data CSV** through a native save dialog. Worksheet exports support CSV and XLSX calculated values. XLSX export does not preserve formulas, formatting, macros, source chart objects or links. CSV export prefixes potentially executable text with an apostrophe; numeric negative values remain numbers.

Limits: 10 MB per import, 50 MB declared expanded XLSX data, 20 sheets per workbook, 10,000 rows and 100 columns per sheet, 100,000 cells per workbook, 4,000 characters per stored cell, 12 selected value series, 100 groups and 10,000 categorical heatmap intersections. Charts and datasets live in the vault's revisioned module sidecar, currently limited to 50 MB. These are protective ceilings, not measured performance guarantees.

All local charting works without an AI key or network service. Imported data stays in the vault; export only occurs when requested.
