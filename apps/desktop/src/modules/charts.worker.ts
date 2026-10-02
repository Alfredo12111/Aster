import {
  resolveChartSource,
  evaluateWorkbook,
  formulaFunctions,
} from "../../../../packages/core/chart-data";
import { buildChart } from "../../../../packages/core/chart-options";
import {
  chartSchema,
  datasetSchema,
} from "../../../../packages/core/chart-model";
self.onmessage = async (event) => {
  const { id, kind } = event.data;
  try {
    let result: unknown;
    if (kind === "chart") {
      const chart = chartSchema.parse(event.data.chart),
        table = resolveChartSource(
          chart,
          event.data.datasets,
          event.data.notes,
        );
      result = { table, ...buildChart(chart, table) };
    } else if (kind === "source") {
      const chart = chartSchema.parse(event.data.chart);
      result = resolveChartSource(chart, event.data.datasets, event.data.notes);
    } else if (kind === "workbook")
      result = evaluateWorkbook(datasetSchema.parse(event.data.dataset));
    else if (kind === "functions") result = formulaFunctions();
    else if (kind === "import") {
      const { importWorkbook } =
        await import("../../../../packages/core/workbook-io");
      result = await importWorkbook(event.data.name, event.data.bytes);
    } else if (kind === "export") {
      const { exportWorkbook } =
        await import("../../../../packages/core/workbook-io");
      result = await exportWorkbook(
        datasetSchema.parse(event.data.dataset),
        event.data.formulas === true,
      );
    } else throw new Error("Unknown data operation.");
    self.postMessage({ id, result });
  } catch (e) {
    self.postMessage({ id, error: e instanceof Error ? e.message : String(e) });
  }
};
