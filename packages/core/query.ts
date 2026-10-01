import { fieldValue } from "./metadata";
import type { Note } from "./types";
export type Filter = {
  field: string;
  op: "=" | "!=" | ">" | ">=" | "<" | "<=" | "contains";
  value: string | number | boolean | null;
};
export type QueryPlan = {
  columns: string[];
  folder: string;
  filters: Filter[];
  sort: string;
  direction: "ASC" | "DESC";
  limit: number;
};
const FIELD = /^[a-zA-Z_][a-zA-Z0-9_.-]*$/;
const literal = (s: string) => {
  try {
    const value = JSON.parse(s);
    if (
      value === null ||
      ["string", "number", "boolean"].includes(typeof value)
    )
      return value;
  } catch {}
  throw new Error(
    "Values must be quoted strings, numbers, true, false or null.",
  );
};
/** Aster Query 1: one clause per line; no code evaluation or arbitrary expressions. */
export function parseQuery(query: string): QueryPlan {
  if (query.length > 5000) throw new Error("Query is too long.");
  const lines = query
    .trim()
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const first = /^SELECT\s+(.+)$/i.exec(lines.shift() ?? "");
  if (!first)
    throw new Error(
      "Start with SELECT file.name, status (one clause per line).",
    );
  const columns = first[1].split(",").map((s) => s.trim());
  if (
    !columns.length ||
    columns.length > 12 ||
    columns.some((s) => !FIELD.test(s))
  )
    throw new Error("Choose up to 12 valid fields.");
  const plan: QueryPlan = {
    columns,
    folder: "",
    filters: [],
    sort: "file.name",
    direction: "ASC",
    limit: 50,
  };
  const seen = new Set<string>();
  for (const line of lines) {
    let m;
    if ((m = /^FROM\s+(.+)$/i.exec(line))) {
      if (seen.has("from"))
        throw new Error("Only one FROM clause is supported.");
      seen.add("from");
      const f = literal(m[1]);
      if (typeof f !== "string")
        throw new Error("FROM needs a quoted folder path.");
      plan.folder = f.replace(/\\/g, "/").replace(/\/$/, "");
    } else if (
      (m = /^WHERE\s+([\w.-]+)\s*(>=|<=|!=|=|>|<|contains)\s*(.+)$/i.exec(line))
    ) {
      if (!FIELD.test(m[1]) || plan.filters.length >= 10)
        throw new Error("Invalid filter or too many filters.");
      plan.filters.push({
        field: m[1],
        op: m[2].toLowerCase() as Filter["op"],
        value: literal(m[3]),
      });
    } else if ((m = /^SORT\s+([\w.-]+)(?:\s+(ASC|DESC))?$/i.exec(line))) {
      if (seen.has("sort") || !FIELD.test(m[1]))
        throw new Error("Use one valid SORT field.");
      seen.add("sort");
      plan.sort = m[1];
      plan.direction = (m[2]?.toUpperCase() ?? "ASC") as "ASC" | "DESC";
    } else if ((m = /^LIMIT\s+(\d+)$/i.exec(line))) {
      if (seen.has("limit")) throw new Error("Only one LIMIT is supported.");
      seen.add("limit");
      plan.limit = +m[1];
      if (plan.limit < 1 || plan.limit > 500)
        throw new Error("LIMIT must be between 1 and 500.");
    } else
      throw new Error(
        `Unsupported clause: ${line.slice(0, 100)}. Use SELECT, FROM, WHERE, SORT and LIMIT.`,
      );
  }
  return plan;
}
export function matchesFilter(value: unknown, f: Filter) {
  if (f.op === "contains")
    return Array.isArray(value)
      ? value.some((v) =>
          String(v).toLowerCase().includes(String(f.value).toLowerCase()),
        )
      : value != null &&
          String(value).toLowerCase().includes(String(f.value).toLowerCase());
  if (f.op === "=") return (value ?? null) === f.value;
  if (f.op === "!=") return (value ?? null) !== f.value;
  if (
    value == null ||
    f.value == null ||
    typeof value !== typeof f.value ||
    !["string", "number"].includes(typeof value)
  )
    return false;
  const a = value as string | number,
    b = f.value as string | number;
  return f.op === ">"
    ? a > b
    : f.op === ">="
      ? a >= b
      : f.op === "<"
        ? a < b
        : a <= b;
}
export function executeQuery(notes: Note[], query: string) {
  const plan = parseQuery(query);
  const matches = notes.filter(
    (n) =>
      (!plan.folder || n.path.startsWith(plan.folder + "/")) &&
      plan.filters.every((f) => matchesFilter(fieldValue(n, f.field), f)),
  );
  matches.sort((a, b) => {
    const va = fieldValue(a, plan.sort),
      vb = fieldValue(b, plan.sort);
    const c =
      typeof va === "number" && typeof vb === "number"
        ? va - vb
        : String(va ?? "").localeCompare(String(vb ?? ""), undefined, {
            numeric: true,
          });
    return (plan.direction === "DESC" ? -c : c) || a.path.localeCompare(b.path);
  });
  return {
    columns: plan.columns,
    total: matches.length,
    rows: matches
      .slice(0, plan.limit)
      .map((n) => ({
        id: n.id,
        title: n.title,
        values: plan.columns.map((c) => fieldValue(n, c) ?? null),
      })),
  };
}
export const displayValue = (v: unknown): string =>
  v == null
    ? "—"
    : typeof v === "object"
      ? Array.isArray(v)
        ? v.map(displayValue).join(", ")
        : JSON.stringify(v)
      : String(v);
