import type { ChartDefinition, DataTable } from "./chart-model";
import {
  aggregate,
  boxplot,
  correlation,
  density,
  histogram,
  movingAverage,
  numeric,
  regression,
  statistics,
} from "./chart-math";
export const chartLabels: Record<ChartDefinition["type"], string> = {
  line: "Line",
  slope: "Slope",
  bar: "Bar",
  column: "Column",
  scatter: "X–Y scatter",
  bubble: "Bubble",
  candlestick: "Candlestick",
  ohlc: "OHLC",
  histogram: "Histogram",
  boxplot: "Box plot",
  density: "Density",
  heatmap: "Heatmap",
  calendar: "Calendar heatmap",
};
export function buildChart(chart: ChartDefinition, table: DataTable) {
  if (
    chart.logY &&
    ((chart.yMin !== null && chart.yMin <= 0) ||
      (chart.yMax !== null && chart.yMax <= 0))
  )
    throw new Error("Logarithmic axis bounds must be positive.");
  const { columns, rows } = table,
    warnings = [...table.warnings],
    index = (name: string) => {
      const i = columns.indexOf(name);
      if (i < 0)
        throw new Error(
          'Column "' + name + '" is missing. Update the chart mapping.',
        );
      return i;
    };
  const yIndices = chart.ys.map(index),
    xIndex = chart.x ? index(chart.x) : -1,
    groupIndex = chart.group ? index(chart.group) : -1;
  const stats = chart.ys.map((name, i) => ({
    name,
    ...statistics(
      rows
        .map((r) => numeric(r[yIndices[i]]))
        .filter((v): v is number => v !== null),
    ),
  }));
  let excluded = 0,
    fit: string[] = [];
  const value = (v: unknown) => {
    const n = numeric(v);
    if (n === null) {
      excluded++;
      return chart.missing === "zero" ? 0 : null;
    }
    if (chart.logY && n <= 0) {
      excluded++;
      return null;
    }
    return n;
  };
  const yAxis: any = {
    type: chart.logY ? "log" : "value",
    name: chart.yTitle,
    scale: !chart.zeroBaseline,
    min: chart.yMin ?? undefined,
    max: chart.yMax ?? undefined,
    splitLine: { lineStyle: { opacity: 0.15 } },
  };
  const option: any = {
    animation: false,
    color: chart.colors,
    backgroundColor: "transparent",
    tooltip: { trigger: "axis", renderMode: "richText", confine: true },
    legend: { show: chart.legend, top: 0, type: "scroll" },
    grid: { top: 48, left: 56, right: 28, bottom: 64, containLabel: true },
    xAxis: { type: "category", name: chart.xTitle },
    yAxis,
    series: [],
    dataZoom: [
      { type: "inside", filterMode: "none" },
      { type: "slider", height: 16, bottom: 10 },
    ],
    aria: { enabled: true },
    toolbox: { show: false },
  };
  const style = {
    label: { show: chart.labels },
    emphasis: { focus: "series" },
  };
  if (["candlestick", "ohlc"].includes(chart.type)) {
    if (xIndex < 0) throw new Error("Choose a date/category column.");
    const [o, h, l, c] = [chart.open, chart.high, chart.low, chart.close].map(
        index,
      ),
      vol = chart.volume ? index(chart.volume) : -1;
    const valid = rows
      .map((r) => ({
        x: String(r[xIndex] ?? ""),
        values: [numeric(r[o]), numeric(r[c]), numeric(r[l]), numeric(r[h])],
        volume: vol >= 0 ? numeric(r[vol]) : null,
      }))
      .filter((r) => {
        const [open, close, low, high] = r.values,
          ok =
            r.x &&
            open !== null &&
            close !== null &&
            low !== null &&
            high !== null &&
            low <= Math.min(open, close) &&
            high >= Math.max(open, close) &&
            (!chart.logY || low > 0);
        if (!ok) excluded++;
        return ok;
      });
    if (chart.sort !== "source")
      valid.sort(
        (a, b) =>
          a.x.localeCompare(b.x) * (chart.sort === "ascending" ? 1 : -1),
      );
    option.xAxis.data = valid.map((r) => r.x);
    option.series = [
      {
        type: "candlestick",
        name: chart.title,
        data: valid.map((r) => r.values),
        itemStyle: {
          color: chart.colors[0],
          color0: chart.colors[1] ?? "#df8b97",
          borderColor: chart.colors[0],
          borderColor0: chart.colors[1] ?? "#df8b97",
        },
      },
    ];
    if (chart.type === "ohlc")
      option.series = [
        {
          type: "custom",
          name: chart.title,
          data: valid.map((r, i) => [i, ...r.values]),
          encode: { x: 0, y: [1, 2, 3, 4] },
          asterOhlc: true,
        },
      ];
    if (chart.trend === "moving-average")
      option.series.push({
        type: "line",
        name: "Moving average (" + chart.window + ")",
        data: valid.map((_r, i) =>
          i < chart.window - 1
            ? null
            : statistics(
                valid
                  .slice(i - chart.window + 1, i + 1)
                  .map((r) => r.values[1]!),
              ).mean,
        ),
        showSymbol: false,
      });
    if (vol >= 0) {
      option.grid = [
        { top: 48, left: 56, right: 28, bottom: 150, containLabel: true },
        { left: 56, right: 28, height: 65, bottom: 58, containLabel: true },
      ];
      option.xAxis = [
        { ...option.xAxis },
        {
          type: "category",
          data: valid.map((r) => r.x),
          gridIndex: 1,
          axisLabel: { show: false },
        },
      ];
      option.yAxis = [
        yAxis,
        {
          type: "value",
          gridIndex: 1,
          name: "Volume",
          splitLine: { show: false },
        },
      ];
      option.series.push({
        type: "bar",
        name: "Volume",
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: valid.map((r) => r.volume),
        itemStyle: { opacity: 0.4 },
      });
      option.dataZoom.forEach((z: any) => (z.xAxisIndex = [0, 1]));
    }
  } else if (chart.type === "scatter" || chart.type === "bubble") {
    if (xIndex < 0) throw new Error("Choose an X column.");
    const sizeIndex = chart.type === "bubble" ? index(chart.size) : -1;
    option.xAxis = {
      type: "value",
      name: chart.xTitle || chart.x,
      scale: true,
    };
    option.tooltip.trigger = "item";
    const groups =
      groupIndex < 0
        ? [""]
        : [...new Set(rows.map((r) => String(r[groupIndex] ?? "")))];
    if (groups.length > 100)
      throw new Error("Choose a grouping column with at most 100 groups.");
    for (const group of groups)
      for (const [i, y] of yIndices.entries()) {
        const points = rows
            .filter(
              (r) => groupIndex < 0 || String(r[groupIndex] ?? "") === group,
            )
            .flatMap((r) => {
              const x = numeric(r[xIndex]),
                v = value(r[y]),
                size = sizeIndex < 0 ? 1 : numeric(r[sizeIndex]);
              if (x === null || v === null || size === null || size < 0) {
                excluded++;
                return [];
              }
              return [[x, v, size]];
            }),
          maxSize = Math.max(1, ...points.map((p) => p[2]));
        option.series.push({
          type: "scatter",
          name: chart.ys[i] + (group ? " · " + group : ""),
          ...style,
          data: points.map((p) => ({
            value: p,
            symbolSize:
              chart.type === "bubble"
                ? Math.max(6, 50 * Math.sqrt(p[2] / maxSize))
                : 9,
          })),
        });
        if (chart.trend !== "none") {
          const sorted = [...points].sort((a, b) => a[0] - b[0]),
            result =
              chart.trend === "moving-average"
                ? { points: movingAverage(sorted, chart.window), r2: null }
                : regression(sorted, chart.trend, chart.degree);
          if (result) {
            option.series.push({
              type: "line",
              name: chart.ys[i] + " trend" + (group ? " · " + group : ""),
              data: result.points,
              symbol: "none",
              lineStyle: { type: "dashed", width: 2 },
            });
            if (result.r2 !== null)
              fit.push(chart.ys[i] + ": R² = " + result.r2.toFixed(5));
          } else
            warnings.push(
              "Not enough valid, distinct X values for the requested trend.",
            );
        }
      }
  } else if (chart.type === "histogram") {
    const sets = yIndices.map((i) =>
        rows.map((r) => numeric(r[i])).filter((v): v is number => v !== null),
      ),
      bins = histogram(sets.flat(), chart.bins);
    option.xAxis.data = bins.map(
      (b, i) =>
        b.low.toPrecision(4) +
        "–" +
        b.high.toPrecision(4) +
        (i === bins.length - 1 ? " inclusive" : ""),
    );
    option.yAxis.name = chart.yTitle || "Frequency";
    option.series = sets.map((values, i) => ({
      name: chart.ys[i],
      type: "bar",
      ...style,
      data: bins.map(
        (b, j) =>
          values.filter(
            (v) =>
              v >= b.low &&
              (v < b.high || (j === bins.length - 1 && v <= b.high)),
          ).length,
      ),
      stack: chart.stacked ? "values" : undefined,
    }));
  } else if (chart.type === "boxplot") {
    const groups =
      groupIndex >= 0
        ? [...new Set(rows.map((r) => String(r[groupIndex] ?? "")))]
        : chart.ys;
    const boxes = groups.map((group, i) =>
      boxplot(
        (groupIndex >= 0
          ? rows
              .filter((r) => String(r[groupIndex] ?? "") === group)
              .map((r) => numeric(r[yIndices[0]]))
          : rows.map((r) => numeric(r[yIndices[i]]))
        ).filter((v): v is number => v !== null),
      ),
    );
    option.xAxis.data = groups;
    option.tooltip.trigger = "item";
    option.series = [
      {
        name: "Distribution",
        type: "boxplot",
        data: boxes.map((b) => b?.values ?? []),
      },
      {
        name: "Outliers",
        type: "scatter",
        data: boxes.flatMap((b, i) => b?.outliers.map((v) => [i, v]) ?? []),
      },
    ];
  } else if (chart.type === "density") {
    option.xAxis = { type: "value", name: chart.xTitle, scale: true };
    option.yAxis.name = chart.yTitle || "Probability density";
    option.series = yIndices.map((col, i) => ({
      type: "line",
      name: chart.ys[i],
      data: density(
        rows.map((r) => numeric(r[col])).filter((v): v is number => v !== null),
      ),
      showSymbol: false,
      areaStyle: { opacity: 0.1 },
    }));
  } else if (chart.type === "heatmap") {
    delete option.dataZoom;
    option.tooltip.trigger = "item";
    const data: number[][] = [];
    let x: string[] = [],
      y: string[] = [];
    if (groupIndex < 0) {
      if (chart.ys.length < 2)
        throw new Error(
          "Choose at least two numeric columns for a correlation heatmap, or choose a category/group column.",
        );
      x = [...chart.ys];
      y = [...chart.ys];
      for (let i = 0; i < yIndices.length; i++)
        for (let j = 0; j < yIndices.length; j++) {
          const pairs = rows.flatMap((r) => {
              const a = numeric(r[yIndices[i]]),
                b = numeric(r[yIndices[j]]);
              return a === null || b === null ? [] : [[a, b]];
            }),
            v = correlation(pairs);
          if (v !== null) data.push([i, j, v]);
        }
      option.visualMap = {
        min: -1,
        max: 1,
        calculable: true,
        orient: "horizontal",
        bottom: 0,
        left: "center",
        inRange: {
          color: [chart.colors[0], "#eeeeee", chart.colors[1] ?? "#df8b97"],
        },
      };
    } else {
      if (xIndex < 0) throw new Error("Choose an X category.");
      x = [...new Set(rows.map((r) => String(r[xIndex] ?? "")))];
      y = [...new Set(rows.map((r) => String(r[groupIndex] ?? "")))];
      if (x.length * y.length > 10000)
        throw new Error(
          "Heatmap supports at most 10,000 category intersections.",
        );
      for (let i = 0; i < x.length; i++)
        for (let j = 0; j < y.length; j++) {
          const values = rows
            .filter(
              (r) =>
                String(r[xIndex] ?? "") === x[i] &&
                String(r[groupIndex] ?? "") === y[j],
            )
            .map((r) => numeric(r[yIndices[0]]))
            .filter((v): v is number => v !== null);
          if (values.length)
            data.push([
              i,
              j,
              aggregate(
                values,
                chart.aggregation === "none" ? "sum" : chart.aggregation,
              )!,
            ]);
        }
      option.visualMap = {
        min: Math.min(0, ...data.map((p) => p[2])),
        max: Math.max(1, ...data.map((p) => p[2])),
        calculable: true,
        orient: "horizontal",
        bottom: 0,
        left: "center",
        inRange: { color: ["#eef3f8", ...chart.colors.slice(0, 2)] },
      };
    }
    option.xAxis = {
      type: "category",
      data: x,
      splitArea: { show: true },
      name: chart.xTitle,
    };
    option.yAxis = { type: "category", data: y, name: chart.yTitle };
    option.series = [
      {
        type: "heatmap",
        data,
        label: { show: chart.labels },
        emphasis: { itemStyle: { borderWidth: 1 } },
      },
    ];
  } else if (chart.type === "calendar") {
    if (xIndex < 0) throw new Error("Choose a date column.");
    const days = new Map<string, number[]>();
    for (const row of rows) {
      const raw = row[xIndex],
        date =
          typeof raw === "number"
            ? Number.isFinite(raw) && raw >= 1 && raw <= 110000
              ? new Date(Date.UTC(1899, 11, 30) + raw * 86400000)
                  .toISOString()
                  .slice(0, 10)
              : ""
            : String(raw ?? "").slice(0, 10),
        v = numeric(row[yIndices[0]]);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        isNaN(Date.parse(date)) ||
        new Date(date).toISOString().slice(0, 10) !== date ||
        v === null
      ) {
        excluded++;
        continue;
      }
      if (!date.startsWith(String(chart.calendarYear))) continue;
      days.set(date, [...(days.get(date) ?? []), v]);
    }
    const data = [...days].map(([date, values]) => [
      date,
      aggregate(
        values,
        chart.aggregation === "none" ? "sum" : chart.aggregation,
      ),
    ]);
    delete option.xAxis;
    delete option.yAxis;
    delete option.dataZoom;
    option.tooltip.trigger = "item";
    option.calendar = {
      range: String(chart.calendarYear),
      top: 80,
      left: 50,
      right: 30,
      cellSize: ["auto", 24],
      yearLabel: { show: false },
      dayLabel: { firstDay: 1 },
      itemStyle: { borderWidth: 2, borderColor: "transparent" },
    };
    option.visualMap = {
      min: Math.min(0, ...data.map((d) => Number(d[1]))),
      max: Math.max(1, ...data.map((d) => Number(d[1]))),
      calculable: true,
      orient: "horizontal",
      bottom: 30,
      left: "center",
      inRange: { color: ["#e6eef3", ...chart.colors.slice(0, 2)] },
    };
    option.series = [{ type: "heatmap", coordinateSystem: "calendar", data }];
  } else if (chart.type === "slope") {
    if (xIndex < 0 || chart.ys.length !== 2)
      throw new Error(
        "Slope charts need labels and exactly two value columns.",
      );
    if (rows.length > 100)
      throw new Error("Limit a slope chart to 100 rows for readable labels.");
    option.xAxis.data = chart.ys;
    option.series = rows.map((r) => ({
      type: "line",
      name: String(r[xIndex] ?? ""),
      data: yIndices.map((i) => value(r[i])),
      ...style,
      symbolSize: 8,
      endLabel: { show: true, formatter: "{a}" },
      labelLayout: { moveOverlap: "shiftY" },
    }));
  } else {
    if (xIndex < 0) throw new Error("Choose a category column.");
    let categories: string[] = [],
      series: { name: string; data: (number | null)[] }[] = [];
    if (chart.aggregation !== "none" || groupIndex >= 0) {
      categories = [...new Set(rows.map((r) => String(r[xIndex] ?? "")))];
      const groups =
        groupIndex < 0
          ? [""]
          : [...new Set(rows.map((r) => String(r[groupIndex] ?? "")))];
      if (groups.length > 100)
        throw new Error("Choose at most 100 series groups.");
      const grouped = new Map<string, Map<string, typeof rows>>();
      for (const row of rows) {
        const group = groupIndex < 0 ? "" : String(row[groupIndex] ?? ""),
          category = String(row[xIndex] ?? "");
        let byCategory = grouped.get(group);
        if (!byCategory) {
          byCategory = new Map();
          grouped.set(group, byCategory);
        }
        const bucket = byCategory.get(category);
        if (bucket) bucket.push(row);
        else byCategory.set(category, [row]);
      }
      for (const group of groups)
        for (const [i, col] of yIndices.entries())
          series.push({
            name: chart.ys[i] + (group ? " · " + group : ""),
            data: categories.map((category) => {
              const values = (grouped.get(group)?.get(category) ?? [])
                .map((r) => value(r[col]))
                .filter((v): v is number => v !== null);
              return aggregate(
                values,
                chart.aggregation === "none" ? "sum" : chart.aggregation,
              );
            }),
          });
    } else {
      categories = rows.map((r) => String(r[xIndex] ?? ""));
      series = yIndices.map((col, i) => ({
        name: chart.ys[i],
        data: rows.map((r) => value(r[col])),
      }));
    }
    if (chart.sort !== "source") {
      const order = categories
        .map((_, i) => i)
        .sort(
          (a, b) =>
            categories[a].localeCompare(categories[b], undefined, {
              numeric: true,
            }) * (chart.sort === "ascending" ? 1 : -1),
        );
      categories = order.map((i) => categories[i]);
      series = series.map((s) => ({ ...s, data: order.map((i) => s.data[i]) }));
    }
    option.xAxis.data = categories;
    option.series = series.map((s) => ({
      ...s,
      type: chart.type === "line" ? "line" : "bar",
      ...style,
      stack: chart.stacked ? "values" : undefined,
      smooth: chart.smooth,
      connectNulls: false,
      showSymbol: categories.length < 100,
    }));
    if (chart.type === "line" && chart.trend !== "none") {
      for (const s of series) {
        const points = s.data.flatMap((v, i) => (v === null ? [] : [[i, v]]));
        if (chart.trend === "moving-average")
          option.series.push({
            type: "line",
            name: s.name + " moving average",
            data: s.data.map((_v, i) =>
              i < chart.window - 1 ||
              s.data.slice(i - chart.window + 1, i + 1).some((v) => v === null)
                ? null
                : statistics(
                    s.data.slice(i - chart.window + 1, i + 1) as number[],
                  ).mean,
            ),
            showSymbol: false,
            lineStyle: { type: "dashed" },
          });
        else {
          const result = regression(
            points,
            chart.trend,
            chart.degree,
            categories.map((_, i) => i),
          );
          if (result) {
            fit.push(s.name + ": R² = " + result.r2.toFixed(5));
            option.series.push({
              type: "line",
              name: s.name + " trend",
              data: result.points.map((p) =>
                Number.isFinite(p[1]) ? p[1] : null,
              ),
              showSymbol: false,
              lineStyle: { type: "dashed" },
            });
          }
        }
      }
    }
    if (chart.type === "bar") {
      option.xAxis = yAxis;
      option.yAxis = { type: "category", data: categories, name: chart.xTitle };
      option.dataZoom.forEach((z: any) => {
        z.yAxisIndex = 0;
        z.orient = "vertical";
      });
      option.dataZoom[1] = {
        type: "slider",
        yAxisIndex: 0,
        width: 14,
        right: 2,
      };
    }
  }
  if (excluded)
    warnings.push(
      excluded +
        " missing, nonnumeric, or invalid values were excluded" +
        (chart.missing === "zero" ? " or replaced by zero." : "."),
    );
  if (!rows.length) warnings.push("The source has no data rows.");
  return { option, statistics: stats, warnings, fit, rowCount: rows.length };
}
