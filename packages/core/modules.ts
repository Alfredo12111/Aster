import { z } from "zod";
export const moduleNames = [
  "calendar",
  "tasks",
  "pdf",
  "canvas",
  "navigator",
] as const;
export type ModuleName = (typeof moduleNames)[number];
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(`${v}T12:00:00Z`);
    return !isNaN(+d) && d.toISOString().slice(0, 10) === v;
  }, "Enter a valid date");
const id = z.string().uuid();
const uniqueIds = (rows: { id: string }[]) =>
  new Set(rows.map((row) => row.id)).size === rows.length;
export const taskSchema = z.object({
  id,
  title: z.string().trim().min(1).max(500),
  noteId: id.nullable(),
  excerpt: z.string().max(4000).default(""),
  due: dateSchema.nullable(),
  status: z.enum(["todo", "in-progress", "blocked", "done", "cancelled"]),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  projectId: id.nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export const projectSchema = z.object({
  id,
  name: z.string().trim().min(1).max(160),
  description: z.string().max(10000),
  noteIds: z.array(id).max(20000),
  createdAt: z.number(),
});
export const cardSchema = z.object({
  id,
  title: z.string().max(160),
  query: z.string().max(5000),
  x: z.number().min(-100000).max(100000),
  y: z.number().min(-100000).max(100000),
  width: z.number().min(280).max(2000),
  height: z.number().min(180).max(2000),
});
export const boardSchema = z.object({
  id,
  name: z.string().trim().min(1).max(160),
  cards: z.array(cardSchema).max(100).refine(uniqueIds, "Duplicate card IDs"),
});
const point = z.object({ x: z.number().finite(), y: z.number().finite() });
export const annotationSchema = z
  .object({
    id,
    page: z.number().int().positive(),
    kind: z.enum(["highlight", "underline", "strikeout", "comment", "ink"]),
    color: z.string().regex(/^#[a-f\d]{6}$/i),
    width: z.number().min(0.5).max(20),
    quads: z.array(z.array(point).length(4)).max(1000),
    points: z.array(point).max(20000),
    quote: z.string().max(10000),
    comment: z.string().max(10000),
    createdAt: z.number(),
    updatedAt: z.number(),
  })
  .refine(
    (a) => (a.kind === "ink" ? a.points.length >= 2 : a.quads.length > 0),
    "Annotation geometry is required",
  );
export const documentSchema = z.object({
  id,
  path: z.string().min(1).max(500),
  fingerprint: z.string().regex(/^[a-f\d]{64}$/),
  annotations: z
    .array(annotationSchema)
    .max(50000)
    .refine(uniqueIds, "Duplicate annotation IDs"),
});
export const moduleStateSchema = z.object({
  version: z.literal(1),
  enabled: z.object({
    calendar: z.boolean(),
    tasks: z.boolean(),
    pdf: z.boolean(),
    canvas: z.boolean(),
    navigator: z.boolean(),
  }),
  calendar: z.object({
    dailyFolder: z.string().min(1).max(300),
    weekStartsOn: z.union([z.literal(0), z.literal(1)]),
  }),
  tasks: z
    .array(taskSchema)
    .max(100000)
    .refine(uniqueIds, "Duplicate task IDs"),
  projects: z
    .array(projectSchema)
    .max(10000)
    .refine(uniqueIds, "Duplicate project IDs"),
  boards: z
    .array(boardSchema)
    .max(1000)
    .refine(uniqueIds, "Duplicate board IDs"),
  documents: z
    .array(documentSchema)
    .max(10000)
    .refine(uniqueIds, "Duplicate document IDs"),
});
export type Task = z.infer<typeof taskSchema>;
export type Project = z.infer<typeof projectSchema>;
export type QueryCard = z.infer<typeof cardSchema>;
export type Board = z.infer<typeof boardSchema>;
export type Annotation = z.infer<typeof annotationSchema>;
export type PdfDocument = z.infer<typeof documentSchema>;
export type ModuleState = z.infer<typeof moduleStateSchema>;
export type ModuleSnapshot = {
  vaultId: string;
  revision: string;
  state: ModuleState;
};
export const emptyModuleState = (): ModuleState => ({
  version: 1,
  enabled: {
    calendar: false,
    tasks: false,
    pdf: false,
    canvas: false,
    navigator: false,
  },
  calendar: { dailyFolder: "Daily", weekStartsOn: 1 },
  tasks: [],
  projects: [],
  boards: [],
  documents: [],
});
export const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const dateObject = (date: string) => new Date(`${date}T12:00:00`);
export function addDays(date: string, count: number) {
  const d = dateObject(date);
  d.setDate(d.getDate() + count);
  return localDate(d);
}
export function weekDates(date: string, firstDay = 1) {
  const start = addDays(
    date,
    -((dateObject(date).getDay() - firstDay + 7) % 7),
  );
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}
export function monthDates(date: string, firstDay = 1) {
  const first = date.slice(0, 8) + "01";
  const start = weekDates(first, firstDay)[0];
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}
