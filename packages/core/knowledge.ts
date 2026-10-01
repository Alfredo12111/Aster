import type { GraphEdge, Note, Suggestion, VaultSnapshot } from './types';
import { folderOf } from './types';

export type WikiLink = { target: string; alias?: string; start: number; end: number };
export function wikiLinks(content: string): WikiLink[] {
  // Blank code ranges without changing offsets; examples inside code are not relationships.
  const prose = content.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`/g, s => ' '.repeat(s.length));
  return [...prose.matchAll(/\[\[([^\]\n]+)\]\]/g)].map(m => {
    const [target, alias] = m[1].split('|');
    return { target: target.trim(), alias, start: m.index!, end: m.index! + m[0].length };
  });
}
const normalized = (s: string) => s.replace(/\\/g, '/').replace(/\.md$/i, '').toLocaleLowerCase();
export function buildResolver(notes: Note[]) {
  const paths = new Map(notes.map(n => [normalized(n.path), n]));
  const titles = new Map<string, Note[]>();
  notes.forEach(n => { const key = normalized(n.title); titles.set(key, [...(titles.get(key) ?? []), n]); });
  return (target: string, source?: Note) => {
    const key = normalized(target.split('#')[0]);
    if (!key) return source;
    const sibling = source && paths.get(normalized(`${folderOf(source.path)}/${key}`.replace(/^\//, '')));
    if (sibling) return sibling;
    return paths.get(key) ?? (titles.get(key)?.length === 1 ? titles.get(key)![0] : undefined);
  };
}
export function buildEdges(vault: VaultSnapshot): GraphEdge[] {
  const resolve = buildResolver(vault.notes); const edges = new Map<string, GraphEdge>();
  for (const source of vault.notes) for (const link of wikiLinks(source.content)) {
    const target = resolve(link.target, source);
    if (target && target.id !== source.id) {
      const id = `wiki:${source.id}:${target.id}`;
      edges.set(id, { id, source: source.id, target: target.id, kind: 'links to', origin: 'wikilink' });
    }
  }
  const ids = new Set(vault.notes.map(n => n.id));
  for (const relation of vault.settings.relations) if (ids.has(relation.source) && ids.has(relation.target)) {
    edges.set(relation.id, { ...relation, origin: 'manual' });
  }
  return [...edges.values()];
}
const STOP = new Set('the and for with that this from are was were have has into your you its our can will about not but all using use how what when which than then also more some each they their them these those a an of to in is it on as be by at or we i'.split(' '));
export function terms(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}_-]{2,}/gu) ?? []).filter(s => !STOP.has(s));
}
export function suggestConnections(vault: VaultSnapshot, sourceId: string, limit = 6): Suggestion[] {
  const source = vault.notes.find(n => n.id === sourceId); if (!source) return [];
  const edges = buildEdges(vault);
  const connected = new Set(edges.filter(e => e.source === sourceId || e.target === sourceId).map(e => e.source === sourceId ? e.target : e.source));
  const docs = vault.notes.map(n => ({ note: n, terms: new Set(terms(`${n.title} ${n.content}`)) }));
  const counts = new Map<string, number>();
  for (const doc of docs) for (const term of doc.terms) counts.set(term, (counts.get(term) ?? 0) + 1);
  const idf = (term: string) => Math.log(1 + docs.length / (1 + (counts.get(term) ?? 0)));
  const sourceTerms = new Set(terms(`${source.title} ${source.content}`));
  const norm = (set: Set<string>) => Math.sqrt([...set].reduce((sum, t) => sum + idf(t) ** 2, 0)) || 1;
  return docs.filter(d => d.note.id !== sourceId && !connected.has(d.note.id)).map(d => {
    const common = [...d.terms].filter(t => sourceTerms.has(t));
    const sharedTags = d.note.tags.filter(t => source.tags.includes(t));
    const similarity = common.reduce((sum, t) => sum + idf(t) ** 2, 0) / (norm(sourceTerms) * norm(d.terms));
    common.sort((a, b) => idf(b) - idf(a));
    return { noteId: d.note.id, score: Math.min(1, similarity + sharedTags.length * .08), origin: 'local' as const,
      reason: sharedTags.length ? `Shared tags: ${sharedTags.map(t => '#' + t).join(', ')}` : `Shared concepts: ${common.slice(0, 3).join(', ')}` };
  }).filter(s => s.score > .035).sort((a, b) => b.score - a.score).slice(0, limit);
}
export function matchesNote(note: Note, query: string) {
  return query.toLowerCase().trim().split(/\s+/).every(term => term.startsWith('tag:') ? note.tags.some(t => t.toLowerCase().includes(term.slice(4))) : term.startsWith('path:') ? note.path.toLowerCase().includes(term.slice(5)) : `${note.title} ${note.content} ${note.path}`.toLowerCase().includes(term));
}
