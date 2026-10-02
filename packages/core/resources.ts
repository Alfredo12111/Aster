import { z } from "zod";
import type { ModuleState } from "./modules";
import type { Note, GraphEdge } from "./types";

export const resourceKinds = [
  "dataset",
  "chart",
  "kanban",
  "canvas",
  "project",
  "task",
  "pdf",
  "calendar",
] as const;
export const resourceTargetSchema = z.object({
  kind: z.enum(resourceKinds),
  id: z.string().min(1).max(100),
  annotationId: z.string().uuid().optional(),
  page: z.number().int().positive().optional(),
});
export type ResourceTarget = z.infer<typeof resourceTargetSchema>;
export const resourceLabels: Record<ResourceTarget["kind"], string> = {
  dataset: "Workbook",
  chart: "Chart",
  kanban: "Kanban",
  canvas: "Canvas",
  project: "Project",
  task: "Task",
  pdf: "PDF",
  calendar: "Calendar",
};
export const resourcePinSchema = z.object({
  id: z.string().uuid(),
  target: resourceTargetSchema,
  folder: z
    .string()
    .trim()
    .max(300)
    .refine(
      (v) => !v.split(/[\\/]/).some((p) => p === ".." || p === "."),
      "Use folder names without dot segments",
    )
    .default("Tools"),
  parentNoteId: z.string().uuid().optional(),
});
export type ResourcePin = z.infer<typeof resourcePinSchema>;
export const resourceKey = (target: ResourceTarget) =>
  target.kind + ":" + target.id;
export function resourceCatalog(state: ModuleState) {
  const list: { target: ResourceTarget; title: string; detail: string }[] = [];
  const add = (
    kind: ResourceTarget["kind"],
    id: string,
    title: string,
    detail = "",
  ) => list.push({ target: { kind, id }, title, detail });
  state.datasets.forEach((d) =>
    add("dataset", d.id, d.name, `${d.sheets.length} worksheets`),
  );
  state.charts.forEach((d) => add("chart", d.id, d.title, d.type));
  state.kanban.forEach((d) =>
    add("kanban", d.id, d.name, `${d.columns.length} columns`),
  );
  state.boards.forEach((d) =>
    add("canvas", d.id, d.name, `${d.cards.length} query cards`),
  );
  state.projects.forEach((d) => add("project", d.id, d.name, d.description));
  state.tasks.forEach((d) => add("task", d.id, d.title, d.status));
  state.documents.forEach((d) =>
    add(
      "pdf",
      d.id,
      d.path.split("/").pop()!,
      `${d.annotations.length} annotations`,
    ),
  );
  add("calendar", "calendar", "Calendar", "Daily notes and due dates");
  return list;
}
export function resourceNotes(state: ModuleState, notes: Note[]): Note[] {
  const catalog = new Map(
    resourceCatalog(state).map((r) => [resourceKey(r.target), r]),
  );
  const noteById = new Map(notes.map((n) => [n.id, n]));
  return state.resources.map((pin) => {
    const resource = catalog.get(resourceKey(pin.target));
    const title =
      resource?.title ??
      `Missing ${resourceLabels[pin.target.kind].toLowerCase()}`;
    const parent = pin.parentNoteId
      ? noteById.get(pin.parentNoteId)
      : undefined;
    return {
      id: pin.id,
      title,
      path: [pin.folder.replaceAll("\\", "/"), title.replaceAll("/", "∕")]
        .filter(Boolean)
        .join("/"),
      content: resource?.detail ?? "The source item was removed",
      revision: "resource",
      modifiedAt: 0,
      tags: [pin.target.kind],
      metadata: {
        asterResource: pin.target.kind,
        missing: !resource,
        ...(pin.parentNoteId
          ? {
              parent: parent
                ? `[[${parent.path.replace(/\.md$/i, "")}]]`
                : "[[Missing parent]]",
            }
          : {}),
      },
    };
  });
}
export function resourceSurface(target: ResourceTarget) {
  return (
    {
      dataset: "charts",
      chart: "charts",
      kanban: "kanban",
      canvas: "canvas",
      project: "projects",
      task: "tasks",
      pdf: "pdf",
      calendar: "calendar",
    } as const
  )[target.kind];
}
export function resourceEdges(state: ModuleState, notes: Note[]): GraphEdge[] {
  const result: GraphEdge[] = [],
    byTarget = new Map(
      state.resources.map((p) => [resourceKey(p.target), p.id]),
    ),
    noteIds = new Set(notes.map((n) => n.id));
  for (const pin of state.resources) {
    const add = (target: string | undefined, kind: string) => {
      if (target && target !== pin.id)
        result.push({
          id: `resource:${pin.id}:${target}:${kind}`,
          source: pin.id,
          target,
          kind,
          origin: "resource",
        });
    };
    if (pin.parentNoteId && noteIds.has(pin.parentNoteId))
      add(pin.parentNoteId, "organized under");
    if (pin.target.kind === "chart") {
      const c = state.charts.find((c) => c.id === pin.target.id);
      if (c?.source.kind === "dataset")
        add(byTarget.get("dataset:" + c.source.datasetId), "uses data from");
      if (c?.source.kind === "markdown" && noteIds.has(c.source.noteId))
        add(c.source.noteId, "uses table from");
    }
    if (pin.target.kind === "task") {
      const t = state.tasks.find((t) => t.id === pin.target.id);
      if (t?.noteId && noteIds.has(t.noteId)) add(t.noteId, "created from");
      if (t?.projectId)
        add(byTarget.get("project:" + t.projectId), "belongs to");
    }
    if (pin.target.kind === "project") {
      const p = state.projects.find((p) => p.id === pin.target.id);
      p?.noteIds
        .filter((id) => noteIds.has(id))
        .forEach((id) => add(id, "includes note"));
    }
    if (pin.target.kind === "kanban") {
      const b = state.kanban.find((b) => b.id === pin.target.id);
      if (b?.projectId)
        add(byTarget.get("project:" + b.projectId), "organizes");
    }
  }
  return result;
}
