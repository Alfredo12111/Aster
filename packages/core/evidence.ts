import { z } from "zod";
import type { Note } from "./types";
import type { Annotation, ModuleState } from "./modules";
const base = {
  id: z.string().uuid(),
  quote: z.string().min(1).max(10000),
  capturedAt: z.number(),
};
export const evidenceSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...base,
      kind: z.literal("note"),
      noteId: z.string().uuid(),
      revision: z.string().max(100),
      start: z.number().int().min(0),
      end: z.number().int().min(1),
    })
    .refine(
      (e) => e.end - e.start === e.quote.length,
      "Evidence offsets must match the captured passage",
    ),
  z.object({
    ...base,
    kind: z.literal("pdf"),
    documentId: z.string().uuid(),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    annotationId: z.string().uuid(),
    annotationVersion: z.string().max(100),
    page: z.number().int().positive(),
  }),
]);
export type Evidence = z.infer<typeof evidenceSchema>;
// A change detector for annotation metadata and geometry, not a security signature.
export function annotationVersion(a: Annotation) {
  const text = JSON.stringify([
    a.kind,
    a.page,
    a.quote,
    a.comment,
    a.quads,
    a.points,
    a.color,
    a.width,
  ]);
  let x = 2166136261,
    y = 5381;
  for (let i = 0; i < text.length; i++) {
    x = Math.imul(x ^ text.charCodeAt(i), 16777619);
    y = Math.imul(y, 33) ^ text.charCodeAt(i);
  }
  return `${a.updatedAt}:${x >>> 0}:${y >>> 0}`;
}
export function noteEvidence(
  note: Note,
  quote: string,
  start?: number,
): Evidence {
  if (start === undefined) {
    start = note.content.indexOf(quote);
    if (start >= 0 && note.content.indexOf(quote, start + 1) >= 0)
      throw new Error(
        "This passage occurs more than once. Include more surrounding text to identify the source.",
      );
  }
  if (
    !quote.trim() ||
    start < 0 ||
    note.content.slice(start, start + quote.length) !== quote
  )
    throw new Error("Choose an exact passage from the saved note.");
  return evidenceSchema.parse({
    id: crypto.randomUUID(),
    kind: "note",
    noteId: note.id,
    quote,
    start,
    end: start + quote.length,
    revision: note.revision,
    capturedAt: Date.now(),
  });
}
export function pdfEvidence(
  document: ModuleState["documents"][number],
  annotation: Annotation,
): Evidence {
  return evidenceSchema.parse({
    id: crypto.randomUUID(),
    kind: "pdf",
    documentId: document.id,
    fingerprint: document.fingerprint,
    annotationId: annotation.id,
    annotationVersion: annotationVersion(annotation),
    page: annotation.page,
    quote: (
      annotation.quote ||
      annotation.comment ||
      `${annotation.kind} annotation on page ${annotation.page}`
    ).slice(0, 10000),
    capturedAt: Date.now(),
  });
}
export function evidenceStatus(
  e: Evidence,
  notes: Note[],
  state: ModuleState,
): "current" | "changed" | "missing" {
  if (e.kind === "note") {
    const note = notes.find((n) => n.id === e.noteId);
    if (!note) return "missing";
    return note.revision === e.revision &&
      note.content.slice(e.start, e.end) === e.quote
      ? "current"
      : "changed";
  }
  const doc = state.documents.find((d) => d.id === e.documentId),
    a = doc?.annotations.find((a) => a.id === e.annotationId);
  if (!doc || !a) return "missing";
  return doc.fingerprint === e.fingerprint &&
    annotationVersion(a) === e.annotationVersion
    ? "current"
    : "changed";
}
