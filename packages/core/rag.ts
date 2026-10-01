import { createHash } from 'node:crypto';
import { buildEdges } from './knowledge';
import type { VaultSnapshot } from './types';

/** Portable, character-budget chunks. Embedding pipelines should retokenize for their model. */
export function exportChunks(vault: VaultSnapshot, chunkSize = 1600, overlap = 200) {
  if (chunkSize < 100 || overlap < 0 || overlap >= chunkSize) throw new Error('Invalid chunk settings');
  const edges = buildEdges(vault);
  const adjacency = new Map<string, typeof edges>();
  for (const edge of edges) for (const id of [edge.source, edge.target]) { const list = adjacency.get(id) ?? []; list.push(edge); adjacency.set(id, list); }
  return vault.notes.flatMap(note => {
    const chunks = []; let start = 0; let ordinal = 0;
    while (start < note.content.length) {
      let end = Math.min(start + chunkSize, note.content.length);
      if (end < note.content.length) {
        const paragraph = note.content.lastIndexOf('\n\n', end);
        if (paragraph > start + chunkSize / 2) end = paragraph;
      }
      const text = note.content.slice(start, end);
      chunks.push({ schema_version: 1, chunker: { version: 1, unit: 'characters', size: chunkSize, overlap }, chunk_id: createHash('sha256').update(`${vault.id}:${note.id}:${note.revision}:paragraph-v1:${chunkSize}:${overlap}:${ordinal}`).digest('hex'),
        vault_id: vault.id, note_id: note.id, revision: note.revision, title: note.title, source_path: note.path,
        tags: note.tags, chunk_index: ordinal++, char_start: start, char_end: end, text,
        relationships: (adjacency.get(note.id) ?? []).map(e => ({ source: e.source, target: e.target, type: e.kind, origin: e.origin })) });
      if (end === note.content.length) break;
      start = Math.max(start + 1, end - overlap);
    }
    return chunks;
  });
}
