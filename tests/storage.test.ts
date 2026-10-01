import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { VaultRepository } from '../packages/storage-fs/vault';
let root: string; let repo: VaultRepository;
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'aster-tests-')); repo = new VaultRepository(root); await repo.initialize(); });
afterEach(async () => { const resolved = path.resolve(root); if (resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(root).startsWith('aster-tests-')) await fs.rm(root, { recursive: true, force: true }); });
describe('filesystem vault', () => {
  it('retains Markdown, IDs, graph settings and nested folders across reopening', async () => {
    let v = await repo.createNote('Research/Notes/First'); const n = v.notes[0];
    await repo.saveNote({ id: n.id, content: '# Updated\n\n#research', revision: n.revision });
    v.settings.views[0].positions[n.id] = { x: 12, y: 42 }; await repo.saveSettings(v.settings);
    const reopened = await new VaultRepository(root).initialize();
    expect(reopened.notes[0].id).toBe(n.id); expect(reopened.notes[0].tags).toEqual(['research']);
    expect(reopened.settings.views[0].positions[n.id]).toEqual({ x: 12, y: 42 });
    expect(await fs.readFile(path.join(root, n.path), 'utf8')).toContain('# Updated');
    expect(await fs.readdir(path.join(root, '.aster/history', n.id))).toHaveLength(1);
  });
  it('never overwrites an external change and rejects simultaneous stale saves', async () => {
    const n = (await repo.createNote('A')).notes[0];
    const results = await Promise.allSettled([repo.saveNote({ id: n.id, content: 'first', revision: n.revision }), repo.saveNote({ id: n.id, content: 'second', revision: n.revision })]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const current = (await repo.snapshot()).notes[0]; await fs.writeFile(path.join(root, 'A.md'), 'external');
    await expect(repo.saveNote({ id: n.id, content: 'stale', revision: current.revision })).rejects.toThrow('Save conflict');
    expect(await fs.readFile(path.join(root, 'A.md'), 'utf8')).toBe('external');
  });
  it('rejects traversal, absolute paths, metadata access, and reserved Windows names', async () => {
    for (const input of ['../outside.md', 'a/../../outside', 'C:/outside', '.aster/vault.json', 'CON', 'notes/AUX.md', 'trailing.']) await expect(repo.createNote(input)).rejects.toThrow();
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'aster-outside-'));
    try { await fs.symlink(outside, path.join(root, 'escape'), 'junction'); await expect(repo.createNote('escape/test')).rejects.toThrow('Symbolic'); expect(await fs.readdir(outside)).toEqual([]); }
    finally { await fs.unlink(path.join(root, 'escape')).catch(() => {}); if (path.resolve(outside).startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(outside).startsWith('aster-outside-')) await fs.rm(outside, { recursive: true, force: true }); }
  });
  it('moves notes without overwriting and retains deleted content in trash', async () => {
    const n = (await repo.createNote('A')).notes[0]; await repo.createNote('B');
    await expect(repo.moveNote({ id: n.id, path: 'B.md' })).rejects.toThrow();
    const moved = await repo.moveNote({ id: n.id, path: 'nested/Renamed.md' }); expect(moved.notes.find(n2 => n2.id === n.id)?.path).toBe('nested/Renamed.md');
    const deleted = await repo.trashNote(n.id); expect(deleted.notes.some(n2 => n2.id === n.id)).toBe(false);
    expect(await fs.readdir(path.join(root, '.aster/trash'))).toHaveLength(1);
  });
  it('preserves corrupt manifests for recovery', async () => {
    const file = path.join(root, '.aster/vault.json'); await fs.writeFile(file, 'broken');
    await expect(new VaultRepository(root).initialize()).rejects.toThrow('preserved'); expect(await fs.readFile(file, 'utf8')).toBe('broken');
  });
});
