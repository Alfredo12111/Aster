import { z } from "zod";

export const surfaceNames = [
  "graph",
  "note",
  "modules",
  "calendar",
  "tasks",
  "projects",
  "pdf",
  "canvas",
  "navigator",
  "charts",
  "kanban",
] as const;
export type Surface = (typeof surfaceNames)[number];
export const themeNames = [
  "aster",
  "cyber",
  "lavender",
  "ocean",
  "paper",
  "rose",
] as const;
export type ThemeName = (typeof themeNames)[number];
export type WorkspaceTab = { id: string; kind: Surface; noteId?: string };
export type Pane = {
  id: string;
  type: "pane";
  tabs: WorkspaceTab[];
  active: string;
};
export type Split = {
  id: string;
  type: "split";
  axis: "horizontal" | "vertical";
  ratio: number;
  first: Layout;
  second: Layout;
};
export type Layout = Pane | Split;
const tabSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(surfaceNames),
  noteId: z.string().uuid().optional(),
});
const paneSchema = z
  .object({
    id: z.string().uuid(),
    type: z.literal("pane"),
    tabs: z.array(tabSchema).min(1).max(12),
    active: z.string().uuid(),
  })
  .refine(
    (p) => p.tabs.some((t) => t.id === p.active),
    "Active tab is missing",
  );
const treeSchema = (depth: number): z.ZodType<Layout> =>
  depth === 0
    ? paneSchema
    : z.union([
        paneSchema,
        z.object({
          id: z.string().uuid(),
          type: z.literal("split"),
          axis: z.enum(["horizontal", "vertical"]),
          ratio: z.number().min(0.1).max(0.9),
          first: treeSchema(depth - 1),
          second: treeSchema(depth - 1),
        }),
      ]);
export const layoutSchema = treeSchema(7).refine((layout) => {
  const panes = leaves(layout),
    ids: string[] = [];
  visit(layout, (n) => {
    ids.push(n.id);
    if (n.type === "pane") ids.push(...n.tabs.map((t) => t.id));
  });
  return panes.length <= 8 && new Set(ids).size === ids.length;
}, "A workspace supports eight panes with unique pane and tab identities");
export const workspaceSchema = z
  .object({
    layout: layoutSchema.nullable().default(null),
    saved: z
      .array(
        z.object({
          id: z.string().uuid(),
          name: z.string().trim().min(1).max(80),
          layout: layoutSchema,
        }),
      )
      .max(20)
      .default([]),
    theme: z.enum(themeNames).default("aster"),
  })
  .default({ layout: null, saved: [], theme: "aster" });
export function visit(layout: Layout, fn: (node: Layout) => void) {
  fn(layout);
  if (layout.type === "split") {
    visit(layout.first, fn);
    visit(layout.second, fn);
  }
}
export function leaves(layout: Layout): Pane[] {
  return layout.type === "pane"
    ? [layout]
    : [...leaves(layout.first), ...leaves(layout.second)];
}
export function makePane(kind: Surface, noteId?: string): Pane {
  const tab: WorkspaceTab = {
    id: crypto.randomUUID(),
    kind,
    ...(noteId ? { noteId } : {}),
  };
  return { id: crypto.randomUUID(), type: "pane", tabs: [tab], active: tab.id };
}
export function mapLayout(
  layout: Layout,
  id: string,
  fn: (node: Layout) => Layout,
): Layout {
  if (layout.id === id) return fn(layout);
  return layout.type === "pane"
    ? layout
    : {
        ...layout,
        first: mapLayout(layout.first, id, fn),
        second: mapLayout(layout.second, id, fn),
      };
}
export function removePane(layout: Layout, id: string): Layout {
  if (layout.type === "pane") return layout;
  if (layout.first.id === id) return layout.second;
  if (layout.second.id === id) return layout.first;
  return {
    ...layout,
    first: removePane(layout.first, id),
    second: removePane(layout.second, id),
  };
}
export function moveTab(
  layout: Layout,
  tabId: string,
  targetId: string,
  index?: number,
): Layout {
  const source = leaves(layout).find((p) => p.tabs.some((t) => t.id === tabId)),
    target = leaves(layout).find((p) => p.id === targetId);
  if (
    !source ||
    !target ||
    (source.id !== target.id && target.tabs.length >= 12)
  )
    return layout;
  const tab = source.tabs.find((t) => t.id === tabId)!;
  let next = mapLayout(layout, source.id, (node) => {
    const p = node as Pane,
      tabs = p.tabs.filter((t) => t.id !== tabId);
    return {
      ...p,
      tabs,
      active: p.active === tabId ? (tabs[0]?.id ?? "") : p.active,
    };
  });
  next = mapLayout(next, target.id, (node) => {
    const p = node as Pane,
      tabs = [...p.tabs];
    tabs.splice(index ?? tabs.length, 0, tab);
    return { ...p, tabs, active: tab.id };
  });
  if (source.id !== target.id && source.tabs.length === 1)
    next = removePane(next, source.id);
  return next;
}
