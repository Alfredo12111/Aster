import { parseDocument } from "yaml";
import type { Note } from "./types";
export type Metadata = Record<string, unknown>;
export function readMetadata(content: string): {
  fields: Metadata;
  error?: string;
} {
  const match = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)(?:\r?\n|$)/.exec(
    content,
  );
  if (!match)
    return content.startsWith("---\n") || content.startsWith("---\r\n")
      ? { fields: {}, error: "Frontmatter has no closing delimiter." }
      : { fields: {} };
  if (match[1].length > 100000)
    return { fields: {}, error: "Frontmatter exceeds 100 KB." };
  try {
    const doc = parseDocument(match[1], { schema: "core", uniqueKeys: true });
    if (doc.errors.length || doc.warnings.length)
      throw new Error([...doc.errors, ...doc.warnings][0].message);
    const fields = doc.toJS({ maxAliasCount: 20 });
    if (fields === null) return { fields: {} };
    if (typeof fields !== "object" || Array.isArray(fields))
      throw new Error("Frontmatter must be a mapping.");
    const validate = (obj: unknown, depth = 0) => {
      if (depth > 12) throw new Error("Frontmatter nesting is too deep.");
      if (obj && typeof obj === "object")
        for (const [key, value] of Object.entries(obj)) {
          if (["__proto__", "constructor", "prototype"].includes(key))
            throw new Error("Unsupported metadata key.");
          validate(value, depth + 1);
        }
    };
    validate(fields);
    return { fields };
  } catch (e) {
    return {
      fields: {},
      error:
        e instanceof Error ? e.message.split("\n")[0] : "Invalid frontmatter.",
    };
  }
}
export function noteMetadata(note: Note) {
  return note.metadata ?? readMetadata(note.content).fields;
}
export function metadataTags(fields: Metadata) {
  const raw = fields.tags;
  return (
    Array.isArray(raw)
      ? raw
      : typeof raw === "string"
        ? raw.split(/[,\s]+/)
        : []
  )
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.replace(/^#/, ""));
}
export function fieldValue(note: Note, field: string): unknown {
  if (field === "file.name" || field === "title") return note.title;
  if (field === "file.path") return note.path;
  if (field === "file.folder")
    return note.path.includes("/")
      ? note.path.slice(0, note.path.lastIndexOf("/"))
      : "";
  if (field === "file.tags" || field === "tags") return note.tags;
  if (field === "file.modified") return new Date(note.modifiedAt).toISOString();
  return field
    .split(".")
    .reduce<unknown>(
      (v, k) =>
        v && typeof v === "object" && Object.hasOwn(v, k)
          ? (v as Metadata)[k]
          : undefined,
      noteMetadata(note),
    );
}
