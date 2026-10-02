import { flattenTree, type TreeItem } from "./hierarchy";
export function diagramLayout(
  roots: TreeItem[],
  expanded: Set<string>,
  matching?: Set<string>,
  limit = 600,
) {
  const all = flattenTree(roots, expanded, matching),
    rows = all.slice(0, limit);
  const visible = new Set(rows.map((r) => r.node.id)),
    width = new Map<string, number>(),
    positions = new Map<string, { x: number; y: number }>();
  const parent = new Map<string, string>();
  for (const { node } of rows)
    for (const c of node.children)
      if (visible.has(c.id)) parent.set(c.id, node.id);
  for (let i = rows.length - 1; i >= 0; i--) {
    const node = rows[i].node;
    width.set(
      node.id,
      Math.max(
        228,
        node.children
          .filter((c) => visible.has(c.id))
          .reduce((sum, c) => sum + (width.get(c.id) ?? 228), 0),
      ),
    );
  }
  const offsets = new Map<string, number>();
  let rootOffset = 24;
  for (const { node, depth, count } of rows) {
    const p = parent.get(node.id),
      left = p ? offsets.get(p)! : rootOffset,
      w = width.get(node.id)!;
    positions.set(node.id, { x: left + w / 2 - 102, y: 24 + depth * 122 });
    offsets.set(node.id, left);
    if (p) offsets.set(p, left + w);
    else rootOffset += w;
  }
  return {
    nodes: rows.map((row) => ({ ...row, ...positions.get(row.node.id)! })),
    edges: [...parent].map(([child, parent]) => ({
      child,
      parent,
      from: positions.get(parent)!,
      to: positions.get(child)!,
    })),
    width: Math.max(300, rootOffset + 24),
    height: Math.max(180, ...rows.map((r) => 48 + (r.depth + 1) * 122)),
    truncated: all.length > limit,
    total: all.length,
  };
}
