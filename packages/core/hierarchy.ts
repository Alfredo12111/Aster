import type { Note } from "./types";
import { buildResolver } from "./knowledge";
import { noteMetadata } from "./metadata";
export type TreeItem = {
  id: string;
  label: string;
  noteId?: string;
  children: TreeItem[];
  issue?: string;
};
export function metadataTree(notes: Note[], field = "parent"): TreeItem[] {
  const resolve = buildResolver(notes),
    nodes = new Map(
      notes.map((n) => [
        n.id,
        { id: n.id, label: n.title, noteId: n.id, children: [] as TreeItem[] },
      ]),
    );
  const parent = new Map<string, string>(),
    issues = new Map<string, string>();
  for (const n of notes) {
    const raw = noteMetadata(n)[field];
    if (raw == null || raw === "") continue;
    if (Array.isArray(raw)) {
      issues.set(
        n.id,
        "Multiple parents: choose one parent for the hierarchy.",
      );
      continue;
    }
    if (typeof raw !== "string") {
      issues.set(n.id, "Parent must be a note link or path.");
      continue;
    }
    const target = resolve(raw.replace(/^\[\[|\]\]$/g, "").split("|")[0], n);
    if (!target) issues.set(n.id, "Parent is missing or ambiguous.");
    else parent.set(n.id, target.id);
  }
  // Linear-time cycle detection; cyclic nodes stay visible in the diagnostics branch.
  const finished = new Set<string>();
  for (const n of notes) {
    if (finished.has(n.id)) continue;
    const chain: string[] = [],
      seen = new Map<string, number>();
    let cursor: string | undefined = n.id;
    while (cursor && !finished.has(cursor)) {
      if (seen.has(cursor)) {
        chain
          .slice(seen.get(cursor))
          .forEach((id) => issues.set(id, "Cycle in parent metadata."));
        break;
      }
      seen.set(cursor, chain.length);
      chain.push(cursor);
      cursor = parent.get(cursor);
    }
    chain.forEach((id) => finished.add(id));
  }
  const roots: TreeItem[] = [],
    diagnostics: TreeItem = {
      id: "__issues",
      label: "Hierarchy issues",
      children: [],
    };
  for (const n of notes) {
    const node: TreeItem = nodes.get(n.id)!;
    if (issues.has(n.id)) {
      node.issue = issues.get(n.id);
      diagnostics.children.push(node);
    } else {
      const p = parent.get(n.id);
      if (p) nodes.get(p)!.children.push(node);
      else roots.push(node);
    }
  }
  const stack = [...roots, diagnostics];
  while (stack.length) {
    const node = stack.pop()!;
    node.children.sort((a, b) => a.label.localeCompare(b.label));
    stack.push(...node.children);
  }
  roots.sort((a, b) => a.label.localeCompare(b.label));
  if (diagnostics.children.length) roots.unshift(diagnostics);
  return roots;
}
export function folderTree(notes: Note[]): TreeItem[] {
  const root: TreeItem = { id: "folder:", label: "Vault", children: [] },
    folders = new Map<string, TreeItem>([["", root]]);
  for (const note of notes) {
    const parts = note.path.split("/");
    parts.pop();
    let prefix = "",
      parent = root;
    for (const part of parts) {
      prefix = prefix ? `${prefix}/${part}` : part;
      let folder = folders.get(prefix);
      if (!folder) {
        folder = { id: `folder:${prefix}`, label: part, children: [] };
        folders.set(prefix, folder);
        parent.children.push(folder);
      }
      parent = folder;
    }
    parent.children.push({
      id: note.id,
      label: note.title,
      noteId: note.id,
      children: [],
    });
  }
  for (const f of folders.values())
    f.children.sort(
      (a, b) =>
        Number(!!a.noteId) - Number(!!b.noteId) ||
        a.label.localeCompare(b.label),
    );
  return root.children;
}
export function flattenTree(
  roots: TreeItem[],
  expanded: Set<string>,
  matching?: Set<string>,
) {
  const keep = new Set<string>(),
    counts = new Map<string, number>();
  const post: { node: TreeItem; done: boolean }[] = roots.map((node) => ({
    node,
    done: false,
  }));
  while (post.length) {
    const { node, done } = post.pop()!;
    if (!done) {
      post.push({ node, done: true });
      for (const child of node.children)
        post.push({ node: child, done: false });
    } else {
      const self =
        node.noteId && (!matching || matching.has(node.noteId)) ? 1 : 0;
      const count =
        self + node.children.reduce((s, c) => s + (counts.get(c.id) ?? 0), 0);
      counts.set(node.id, count);
      if (count || (!matching && !node.noteId)) keep.add(node.id);
    }
  }
  const rows: { node: TreeItem; depth: number; count: number }[] = [],
    stack = roots
      .slice()
      .reverse()
      .map((node) => ({ node, depth: 0 }));
  while (stack.length) {
    const { node, depth } = stack.pop()!;
    if (!keep.has(node.id)) continue;
    rows.push({ node, depth, count: counts.get(node.id) ?? 0 });
    if (matching || expanded.has(node.id))
      for (let i = node.children.length - 1; i >= 0; i--)
        stack.push({ node: node.children[i], depth: depth + 1 });
  }
  return rows;
}
