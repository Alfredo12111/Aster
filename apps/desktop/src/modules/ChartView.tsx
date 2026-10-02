import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as echarts from "echarts";
import { themes } from "../themes";
import type { ThemeName } from "../../../../packages/core/workspace";
export type ChartViewHandle = { export(format: "png" | "svg"): string };
export default forwardRef<
  ChartViewHandle,
  { option: any; theme: ThemeName; title: string }
>(function ChartView({ option, theme, title }, ref) {
  const element = useRef<HTMLDivElement>(null),
    chart = useRef<echarts.ECharts | null>(null);
  useImperativeHandle(ref, () => ({
    export(format) {
      const active = chart.current;
      if (!active) throw new Error("Wait for the chart to render.");
      if (format === "svg") return (active as any).renderToSVGString();
      // The SVG renderer exports a PNG through a temporary canvas renderer.
      const container = document.createElement("div");
      container.style.cssText =
        "width:1400px;height:900px;position:fixed;left:-10000px";
      document.body.append(container);
      const image = echarts.init(container, undefined, {
        renderer: "canvas",
        width: 1400,
        height: 900,
      });
      try {
        image.setOption(active.getOption(), true);
        return image.getDataURL({
          type: "png",
          pixelRatio: 2,
          backgroundColor: themes[theme].bg,
        });
      } finally {
        image.dispose();
        container.remove();
      }
    },
  }));
  useEffect(() => {
    const target = element.current!;
    const instance = echarts.init(target, undefined, { renderer: "svg" });
    chart.current = instance;
    const resize = new ResizeObserver(() => instance.resize());
    resize.observe(target);
    return () => {
      resize.disconnect();
      instance.dispose();
      chart.current = null;
    };
  }, []);
  useEffect(() => {
    if (!chart.current) return;
    const palette = themes[theme],
      settings = structuredClone(option);
    settings.textStyle = { color: palette.text, fontFamily: "Segoe UI" };
    settings.legend = {
      ...settings.legend,
      textStyle: { color: palette.muted },
    };
    for (const axis of ["xAxis", "yAxis"])
      if (settings[axis])
        for (const item of Array.isArray(settings[axis])
          ? settings[axis]
          : [settings[axis]]) {
          item.axisLabel = { ...item.axisLabel, color: palette.muted };
          item.nameTextStyle = { color: palette.muted };
          item.axisLine = { lineStyle: { color: palette.line } };
        }
    if (settings.visualMap)
      settings.visualMap.textStyle = { color: palette.muted };
    settings.series = settings.series.map((series: any) => {
      if (!series.asterOhlc) return series;
      delete series.asterOhlc;
      return {
        ...series,
        renderItem: (_params: any, api: any) => {
          const index = api.value(0),
            open = api.coord([index, api.value(1)]),
            close = api.coord([index, api.value(2)]),
            low = api.coord([index, api.value(3)]),
            high = api.coord([index, api.value(4)]),
            width = Math.min(10, api.size([1, 0])[0] * 0.3),
            stroke =
              api.value(2) >= api.value(1)
                ? settings.color[0]
                : (settings.color[1] ?? "#df8b97");
          return {
            type: "group",
            children: [
              {
                type: "line",
                shape: { x1: low[0], y1: low[1], x2: high[0], y2: high[1] },
                style: { stroke, lineWidth: 2 },
              },
              {
                type: "line",
                shape: {
                  x1: open[0] - width,
                  y1: open[1],
                  x2: open[0],
                  y2: open[1],
                },
                style: { stroke, lineWidth: 2 },
              },
              {
                type: "line",
                shape: {
                  x1: close[0],
                  y1: close[1],
                  x2: close[0] + width,
                  y2: close[1],
                },
                style: { stroke, lineWidth: 2 },
              },
            ],
          };
        },
      };
    });
    chart.current.setOption(settings, { notMerge: true, lazyUpdate: false });
    chart.current.resize();
  }, [option, theme]);
  return (
    <div className="chart-plot" ref={element} role="img" aria-label={title} />
  );
});
