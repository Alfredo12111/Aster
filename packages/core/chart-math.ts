export const numeric = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (
    typeof value !== "string" ||
    !value.trim() ||
    !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())
  )
    return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
export function quantile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * Math.max(0, Math.min(1, p)),
    low = Math.floor(index),
    fraction = index - low;
  return (
    sorted[low] + ((sorted[low + 1] ?? sorted[low]) - sorted[low]) * fraction
  );
}
export function statistics(values: number[]) {
  const data = values.filter(Number.isFinite),
    sorted = [...data].sort((a, b) => a - b);
  let mean = 0,
    m2 = 0,
    sum = 0,
    correction = 0,
    n = 0;
  for (const x of data) {
    n++;
    const d = x - mean;
    mean += d / n;
    m2 += d * (x - mean);
    const y = x - correction,
      t = sum + y;
    correction = t - sum - y;
    sum = t;
  }
  const variance = n > 1 ? Math.max(0, m2 / (n - 1)) : null;
  return {
    count: n,
    sum,
    mean: n ? mean : null,
    min: sorted[0] ?? null,
    max: sorted.at(-1) ?? null,
    median: quantile(sorted, 0.5),
    q1: quantile(sorted, 0.25),
    q3: quantile(sorted, 0.75),
    variance,
    stddev: variance === null ? null : Math.sqrt(variance),
  };
}
export function aggregate(values: number[], kind: string): number | null {
  const s = statistics(values);
  if (!values.length) return kind === "count" ? 0 : null;
  return kind === "count"
    ? s.count
    : kind === "sum"
      ? s.sum
      : kind === "mean"
        ? s.mean
        : kind === "median"
          ? s.median
          : kind === "min"
            ? s.min
            : kind === "max"
              ? s.max
              : values[0];
}
export function histogram(values: number[], bins: number) {
  const data = values.filter(Number.isFinite);
  if (!data.length) return [];
  const min = Math.min(...data),
    max = Math.max(...data),
    width = max === min ? 1 : (max - min) / bins,
    start = max === min ? min - 0.5 : min;
  const result = Array.from({ length: max === min ? 1 : bins }, (_, i) => ({
    low: start + i * width,
    high: start + (i + 1) * width,
    count: 0,
  }));
  for (const value of data)
    result[
      Math.max(
        0,
        Math.min(result.length - 1, Math.floor((value - start) / width)),
      )
    ].count++;
  return result;
}
export function boxplot(values: number[]) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const q1 = quantile(sorted, 0.25)!,
    median = quantile(sorted, 0.5)!,
    q3 = quantile(sorted, 0.75)!,
    iqr = q3 - q1;
  const inside = sorted.filter(
    (v) => v >= q1 - 1.5 * iqr && v <= q3 + 1.5 * iqr,
  );
  return {
    values: [inside[0], q1, median, q3, inside.at(-1)!],
    outliers: sorted.filter((v) => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr),
  };
}
export function density(values: number[], points = 100) {
  const s = statistics(values);
  if (s.count < 2) return [];
  const spread =
    Math.min(s.stddev ?? 0, ((s.q3 ?? 0) - (s.q1 ?? 0)) / 1.34) ||
    s.stddev ||
    Math.max(Math.abs(s.mean ?? 0) * 0.01, 1);
  const bandwidth = 0.9 * spread * Math.pow(s.count, -0.2),
    from = s.min! - 3 * bandwidth,
    to = s.max! + 3 * bandwidth;
  return Array.from({ length: points }, (_, i) => {
    const x = from + ((to - from) * i) / (points - 1);
    let sum = 0;
    for (const v of values) sum += Math.exp(-0.5 * ((x - v) / bandwidth) ** 2);
    return [x, sum / (s.count * bandwidth * Math.sqrt(2 * Math.PI))];
  });
}
export function correlation(pairs: number[][]): number | null {
  if (pairs.length < 2) return null;
  const mx = statistics(pairs.map((p) => p[0])).mean!,
    my = statistics(pairs.map((p) => p[1])).mean!;
  let xx = 0,
    yy = 0,
    xy = 0;
  for (const [x, y] of pairs) {
    xx += (x - mx) ** 2;
    yy += (y - my) ** 2;
    xy += (x - mx) * (y - my);
  }
  return xx && yy ? Math.max(-1, Math.min(1, xy / Math.sqrt(xx * yy))) : null;
}
export function movingAverage(points: number[][], window: number) {
  return points
    .slice(window - 1)
    .map((p, i) => [
      p[0],
      statistics(points.slice(i, i + window).map((v) => v[1])).mean!,
    ]);
}
export function regression(
  points: number[][],
  kind: string,
  degree = 2,
  evaluateAt?: number[],
): { points: number[][]; r2: number; equation: string } | null {
  const data = points.filter(
    ([x, y]) =>
      Number.isFinite(x) &&
      Number.isFinite(y) &&
      (kind !== "exponential" || y > 0) &&
      (kind !== "logarithmic" || x > 0),
  );
  const power = kind === "polynomial" ? degree : 1;
  if (data.length < power + 1) return null;
  const xs = data.map((p) => (kind === "logarithmic" ? Math.log(p[0]) : p[0])),
    ys = data.map((p) => (kind === "exponential" ? Math.log(p[1]) : p[1]));
  const center = statistics(xs).mean!,
    scale = Math.max(...xs.map((x) => Math.abs(x - center)));
  if (!scale) return null;
  const columns = Array.from({ length: power + 1 }, (_, k) =>
    xs.map((x) => ((x - center) / scale) ** k),
  );
  const q: number[][] = [],
    r = Array.from({ length: power + 1 }, () => Array(power + 1).fill(0));
  for (let k = 0; k <= power; k++) {
    const v = [...columns[k]];
    for (let j = 0; j < k; j++) {
      r[j][k] = q[j].reduce((sum, x, i) => sum + x * v[i], 0);
      for (let i = 0; i < v.length; i++) v[i] -= r[j][k] * q[j][i];
    }
    r[k][k] = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
    if (r[k][k] < 1e-10) return null;
    q.push(v.map((x) => x / r[k][k]));
  }
  const beta = q.map((v) => v.reduce((sum, x, i) => sum + x * ys[i], 0));
  for (let k = power; k >= 0; k--) {
    for (let j = k + 1; j <= power; j++) beta[k] -= r[k][j] * beta[j];
    beta[k] /= r[k][k];
  }
  const predict = (x: number) => {
    const t = ((kind === "logarithmic" ? Math.log(x) : x) - center) / scale;
    const y = beta.reduce((sum, b, k) => sum + b * t ** k, 0);
    return kind === "exponential" ? Math.exp(y) : y;
  };
  const mean = statistics(data.map((p) => p[1])).mean!,
    sst = data.reduce((s, p) => s + (p[1] - mean) ** 2, 0),
    sse = data.reduce((s, p) => s + (p[1] - predict(p[0])) ** 2, 0);
  const min = Math.min(...data.map((p) => p[0])),
    max = Math.max(...data.map((p) => p[0]));
  return {
    points: (
      evaluateAt ??
      Array.from({ length: 80 }, (_, i) => min + ((max - min) * i) / 79)
    ).map((x) => [x, predict(x)]),
    r2: sst ? 1 - sse / sst : 1,
    equation: kind + " fit",
  };
}
