import type { ChartDefinition, Dataset } from "./chart-model";
import { dataRange, columnName } from "./chart-data";
export type StructureEdit = {
  sheet: string;
  axis: "row" | "column";
  at: number;
  remove: boolean;
};
type Link = Pick<ChartDefinition, "source" | "range">;
export type ChartRestore = { id: string; expected: Link; value: Link };
const link = (chart: ChartDefinition): Link =>
  structuredClone({ source: chart.source, range: chart.range });
/** Update chart references in the same transaction as their workbook. Returns guarded undo patches. */
export function syncWorkbookCharts(
  charts: ChartDefinition[],
  previous: Dataset,
  next: Dataset,
  edit?: StructureEdit,
  restore: ChartRestore[] = [],
): ChartRestore[] {
  const inverse: ChartRestore[] = [];
  for (const chart of charts) {
    if (chart.source.kind !== "dataset" || chart.source.datasetId !== next.id)
      continue;
    const before = link(chart),
      patch = restore.find((p) => p.id === chart.id);
    if (patch) {
      if (JSON.stringify(before) !== JSON.stringify(patch.expected))
        throw new Error(
          "A linked chart changed. Undo would overwrite its source. Reopen the workbook before editing.",
        );
      chart.source = structuredClone(patch.value.source);
      chart.range = patch.value.range;
    } else {
      if (
        edit &&
        chart.source.sheet === edit.sheet &&
        !chart.range &&
        edit.remove &&
        edit.axis === "row" &&
        edit.at === 0
      )
        throw new Error(
          "A chart uses this row as its headers. Change its range before deleting the header row.",
        );
      if (edit && chart.source.sheet === edit.sheet && chart.range) {
        const old = previous.sheets.find((s) => s.name === edit.sheet)!;
        const { from, to } = dataRange(
          chart.range,
          old.rows.length,
          Math.max(...old.rows.map((r) => r.length)),
        );
        const key = edit.axis === "row" ? "row" : "col";
        if (edit.remove && from[key] === to[key] && from[key] === edit.at)
          throw new Error(
            "This selection is the entire source of a chart. Change its range or remove the chart first.",
          );
        if (edit.remove && edit.axis === "row" && from.row === edit.at)
          throw new Error(
            "A chart uses this row as its headers. Change the chart range before deleting its header row.",
          );
        if (edit.remove) {
          if (from[key] > edit.at) from[key]--;
          if (to[key] >= edit.at) to[key]--;
        } else {
          if (from[key] >= edit.at) from[key]++;
          if (to[key] >= edit.at) to[key]++;
        }
        chart.range =
          columnName(from.col) +
          (from.row + 1) +
          ":" +
          columnName(to.col) +
          (to.row + 1);
      }
      if (previous.sheets.length === next.sheets.length) {
        const index = previous.sheets.findIndex(
          (s) => s.name === (chart.source as { sheet: string }).sheet,
        );
        if (index >= 0) chart.source.sheet = next.sheets[index].name;
      }
    }
    if (
      chart.source.kind === "dataset" &&
      !next.sheets.some(
        (s) => s.name === (chart.source as { sheet: string }).sheet,
      )
    )
      throw new Error(
        "A chart uses this worksheet. Change its source or delete the chart before removing the worksheet.",
      );
    const after = link(chart);
    if (JSON.stringify(before) !== JSON.stringify(after))
      inverse.push({ id: chart.id, expected: after, value: before });
  }
  return inverse;
}
