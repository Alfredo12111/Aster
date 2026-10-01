import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { buildEdges, buildResolver, wikiLinks, suggestConnections } from '../packages/core/knowledge';
import { exportChunks } from '../packages/core/rag';
import { defaultSettings, extractTags, titleOf, type Note, type VaultSnapshot } from '../packages/core/types';
const note = (path: string, content = ''): Note => ({ id: randomUUID(), path, content, title: titleOf(path), modifiedAt: 1, revision: 'a'.repeat(64), tags: extractTags(content) });
const vault = (notes: Note[]): VaultSnapshot => ({ id: randomUUID(), name: 'Test', root: '/test', notes, folders: [], settings: defaultSettings() });
describe('knowledge graph', () => {
  it('resolves paths, aliases and headings without guessing ambiguous basenames', () => {
    const a = note('one/Idea.md'), b = note('two/Idea.md'), src = note('one/Source.md'); const resolve = buildResolver([a, b, src]);
    expect(resolve('Idea', src)?.id).toBe(a.id); expect(resolve('two/Idea#Heading', src)?.id).toBe(b.id); expect(resolve('Idea')).toBeUndefined();
    expect(wikiLinks('[[two/Idea#Heading|my label]]')[0]).toMatchObject({ target: 'two/Idea#Heading', alias: 'my label' });
  });
  it('ignores code examples, deduplicates directed wikilinks and preserves typed edges', () => {
    const a = note('A.md', '[[B]] [[B|again]] `[[C]]`\n```md\n[[C]]\n```'), b = note('B.md'), c = note('C.md');
    const v = vault([a, b, c]); v.settings.relations.push({ id: 'edge', source: b.id, target: a.id, kind: 'supports' });
    expect(buildEdges(v)).toHaveLength(2); expect(buildEdges(v)[0]).toMatchObject({ source: a.id, target: b.id, origin: 'wikilink' });
  });
  it('suggests explainable unconnected notes and excludes existing neighbors', () => {
    const a = note('A.md', 'Semantic retrieval embeddings #search [[C]]'), b = note('B.md', 'Semantic retrieval evidence #search'), c = note('C.md', 'Semantic retrieval #search');
    const results = suggestConnections(vault([a, b, c]), a.id);
    expect(results.map(s => s.noteId)).toEqual([b.id]); expect(results[0].reason).toContain('#search');
  });
});
describe('RAG export', () => {
  it('preserves complete content with bounded overlapping chunks and stable source attribution', () => {
    const a = note('Sources/Example.md', 'Evidence and citations. '.repeat(190)); const v = vault([a]);
    const chunks = exportChunks(v, 500, 80); expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.every(c => c.text === a.content.slice(c.char_start, c.char_end) && c.text.length <= 500)).toBe(true);
    expect(chunks[0].char_start).toBe(0); expect(chunks.at(-1)!.char_end).toBe(a.content.length);
    for (let i = 1; i < chunks.length; i++) expect(chunks[i].char_start).toBeLessThan(chunks[i - 1].char_end);
    expect(exportChunks(v, 500, 80).map(c => c.chunk_id)).toEqual(chunks.map(c => c.chunk_id));
    expect(exportChunks(v, 600, 80)[0].chunk_id).not.toBe(chunks[0].chunk_id);
    expect(chunks[0]).toMatchObject({ note_id: a.id, source_path: a.path, revision: a.revision, schema_version: 1 });
    a.revision = 'b'.repeat(64); expect(exportChunks(v, 500, 80)[0].chunk_id).not.toBe(chunks[0].chunk_id);
  });
  it('exports directional typed and wiki relationships without conflating them', () => {
    const a = note('A.md', 'Evidence [[B]]'), b = note('B.md', 'Conclusion'); const v = vault([a,b]);
    v.settings.relations.push({ id: 'support', source: a.id, target: b.id, kind: 'supports' });
    expect(exportChunks(v)[0].relationships.map(e => e.origin)).toEqual(['wikilink', 'manual']);
  });
});
