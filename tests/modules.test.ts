import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { readMetadata, metadataTags } from "../packages/core/metadata";
import { parseQuery, executeQuery } from "../packages/core/query";
import {
  metadataTree,
  folderTree,
  flattenTree,
} from "../packages/core/hierarchy";
import {
  addDays,
  dateSchema,
  monthDates,
  weekDates,
} from "../packages/core/modules";
import type { Note } from "../packages/core/types";
const note = (
  title: string,
  metadata: Record<string, unknown> = {},
  folder = "Research",
): Note => ({
  id: randomUUID(),
  title,
  path: `${folder}/${title}.md`,
  content: "",
  metadata,
  tags: metadataTags(metadata),
  revision: "a".repeat(64),
  modifiedAt: 1,
});
describe("frontmatter", () => {
  it("preserves typed dates, lists, nested values and tags without executing YAML tags", () => {
    expect(
      readMetadata(
        "---\ndate: 2026-10-01\npriority: 3\nactive: true\ntags: [rag, research]\nsource:\n  author: Ada\n---\nBody",
      ).fields,
    ).toEqual({
      date: "2026-10-01",
      priority: 3,
      active: true,
      tags: ["rag", "research"],
      source: { author: "Ada" },
    });
    expect(
      readMetadata("---\nvalue: !!js/function >\n  alert(1)\n---").error,
    ).toBeTruthy();
  });
  it("reports malformed metadata without inventing fields", () => {
    expect(readMetadata("---\na: 1\na: 2\n---").error).toBeTruthy();
    expect(readMetadata("---\na: 1").error).toContain("closing");
    expect(readMetadata("---\n__proto__: bad\n---").error).toBeTruthy();
    expect(readMetadata("Plain Markdown")).toEqual({ fields: {} });
  });
});
describe("calendar date-only arithmetic", () => {
  it("handles leap days, year boundaries, DST and both week starts", () => {
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(weekDates("2026-10-01", 1)[0]).toBe("2026-09-28");
    expect(weekDates("2026-10-01", 0)[0]).toBe("2026-09-27");
    expect(monthDates("2024-02-10")).toContain("2024-02-29");
    expect(monthDates("2024-02-10")).toHaveLength(42);
    expect(dateSchema.safeParse("2026-02-30").success).toBe(false);
  });
});
describe("Aster Query", () => {
  const notes = [
    note("B", {
      status: "active",
      rating: 5,
      tags: ["rag"],
      date: "2026-10-02",
    }),
    note("A", {
      status: "active",
      rating: 3,
      tags: ["rag"],
      date: "2026-10-01",
    }),
    note("C", { status: "archived", rating: 10 }, "Other"),
  ];
  it("combines folder and typed metadata filters, sorting and result limits", () => {
    const result = executeQuery(
      notes,
      'SELECT file.name, rating, date\nFROM "Research"\nWHERE status = "active"\nWHERE rating >= 3\nWHERE tags contains "rag"\nSORT date DESC\nLIMIT 1',
    );
    expect(result.total).toBe(2);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].values).toEqual(["B", 5, "2026-10-02"]);
  });
  it("uses folder boundaries and rejects arbitrary code or unsupported syntax", () => {
    expect(executeQuery(notes, 'SELECT file.name\nFROM "Res"').rows).toEqual(
      [],
    );
    for (const query of [
      "eval(alert(1))",
      "SELECT file.name\nWHERE rating = (() => 1)()",
      "SELECT file.name\nLIMIT 999999",
      "SELECT file.name\nGROUP BY status",
    ])
      expect(() => parseQuery(query)).toThrow();
  });
  it("reflects updated metadata and exposes an explicit match count beyond the page", () => {
    const updated = notes.map((n) => ({
      ...n,
      metadata: { ...n.metadata, status: "archived" },
    }));
    expect(
      executeQuery(updated, 'SELECT file.name\nWHERE status = "active"').total,
    ).toBe(0);
  });
});
describe("hierarchy", () => {
  it("keeps missing parents and cycles visible, preserving matching child ancestors", () => {
    const root = note("Root"),
      child = note("Child", { parent: "[[Root]]" }),
      orphan = note("Orphan", { parent: "[[Missing]]" }),
      a = note("Cycle A", { parent: "[[Cycle B]]" }),
      b = note("Cycle B", { parent: "[[Cycle A]]" });
    const roots = metadataTree([root, child, orphan, a, b]);
    const all = flattenTree(
      roots,
      new Set([root.id, "__issues", a.id, b.id, orphan.id]),
    );
    expect(all.filter((r) => r.node.noteId)).toHaveLength(5);
    expect(all.filter((r) => r.node.issue)).toHaveLength(3);
    expect(
      flattenTree(roots, new Set(), new Set([child.id])).map(
        (r) => r.node.label,
      ),
    ).toEqual(["Root", "Child"]);
  });
  it("handles a 10,000-note hierarchy without recursive stack overflow", () => {
    const notes = Array.from({ length: 10000 }, (_, i) =>
      note(`N${i}`, i ? { parent: `[[N${i - 1}]]` } : {}),
    );
    const tree = metadataTree(notes);
    const rows = flattenTree(tree, new Set(notes.map((n) => n.id)));
    expect(rows).toHaveLength(10000);
    expect(rows.at(-1)!.depth).toBe(9999);
    expect(
      flattenTree(folderTree(notes), new Set(["folder:Research"])),
    ).toHaveLength(10001);
  });
});
