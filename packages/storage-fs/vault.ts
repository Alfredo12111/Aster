import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { defaultSettings, extractTags, titleOf, type Note, type VaultSettings, type VaultSnapshot } from '../core/types';
import { SAMPLE_NOTES } from '../core/sample';
import { metadataTags, readMetadata } from '../core/metadata';
import { dateSchema, emptyModuleState, moduleStateSchema, type ModuleSnapshot, type ModuleState } from '../core/modules';

const id = z.string().uuid();
const point = z.object({ x: z.number().finite(), y: z.number().finite() });
export const settingsSchema = z.object({
  views: z.array(z.object({ id: z.string().min(1).max(100), name: z.string().min(1).max(100), positions: z.record(z.string(), point), layout: z.enum(['cluster', 'radial', 'force']), filter: z.string().max(500) })).min(1).max(100),
  activeView: z.string().max(100), colors: z.record(z.string(), z.string().regex(/^#[0-9a-f]{6}$/i)), noteColors: z.record(z.string(), z.string().regex(/^#[0-9a-f]{6}$/i)),
  relations: z.array(z.object({ id: z.string().max(100), source: id, target: id, kind: z.string().trim().min(1).max(60) })).max(100000),
  nodeSize: z.number().min(3).max(16), linkOpacity: z.number().min(5).max(100), showLabels: z.boolean(), showArrows: z.boolean(),
});
const manifestSchema = z.object({ version: z.literal(1), id, noteIds: z.record(z.string(), id), settings: settingsSchema });
type Manifest = z.infer<typeof manifestSchema>;
export const revisionOf = (text: string) => createHash('sha256').update(text).digest('hex');
export async function atomicWrite(file: string, content: string) {
  const temp = `${file}.${randomUUID()}.tmp`;
  const handle = await fs.open(temp, 'wx', 0o600);
  try { await handle.writeFile(content, 'utf8'); await handle.sync(); } finally { await handle.close(); }
  try { await fs.rename(temp, file); } catch (error) { await fs.unlink(temp).catch(() => {}); throw error; }
}
export class VaultRepository {
  readonly root: string;
  private manifest!: Manifest;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(root: string) { this.root = path.resolve(root); }
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const result = this.queue.then(work); this.queue = result.catch(() => {}); return result;
  }
  async safePath(relative: string, internal = false) {
    const segments = relative.replace(/\\/g, '/').split('/');
    if (!relative || path.isAbsolute(relative) || segments.some(s => !s || s === '.' || s === '..' || /[<>:"|?*\x00-\x1f]/.test(s) || /[. ]$/.test(s) || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(s) || (!internal && s.startsWith('.')))) throw new Error('Use a relative path with ordinary file or folder names.');
    const full = path.resolve(this.root, ...segments);
    if (!full.startsWith(this.root + path.sep)) throw new Error('Path is outside the vault.');
    let cursor = this.root;
    for (const segment of segments) {
      cursor = path.join(cursor, segment);
      try { if ((await fs.lstat(cursor)).isSymbolicLink()) throw new Error('Symbolic links are not supported inside vaults.'); }
      catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
    }
    return full;
  }
  private async persist() { await atomicWrite(await this.safePath('.aster/vault.json', true), JSON.stringify(this.manifest, null, 2)); }
  async initialize(seed = false): Promise<VaultSnapshot> {
    await fs.mkdir(this.root, { recursive: true });
    if ((await fs.lstat(this.root)).isSymbolicLink()) throw new Error('Choose a real folder, not a symbolic link.');
    const meta = await this.safePath('.aster', true); await fs.mkdir(meta, { recursive: true });
    const manifestFile = await this.safePath('.aster/vault.json', true);
    try { this.manifest = manifestSchema.parse(JSON.parse(await fs.readFile(manifestFile, 'utf8'))); }
    catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('The .aster/vault.json file is invalid. It was preserved; restore a valid copy before opening this vault.');
      this.manifest = { version: 1, id: randomUUID(), noteIds: {}, settings: defaultSettings() };
      await this.persist();
      if (seed) for (const [relative, content] of Object.entries(SAMPLE_NOTES)) {
        const file = await this.safePath(relative); await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file, content, { encoding: 'utf8', flag: 'wx' }).catch(e => { if (e.code !== 'EEXIST') throw e; });
      }
    }
    return this.snapshot();
  }
  async snapshot(): Promise<VaultSnapshot> { return this.serial(() => this.scan()); }
  private async scan(): Promise<VaultSnapshot> {
    const files: string[] = []; const folders: string[] = [];
    const walk = async (relative = '') => {
      const entries = await fs.readdir(relative ? await this.safePath(relative) : this.root, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.isSymbolicLink() || entry.name === 'node_modules') continue;
        const child = relative ? `${relative}/${entry.name}` : entry.name;
        if (entry.isDirectory()) { folders.push(child); await walk(child); }
        else if (entry.isFile() && /\.md$/i.test(child)) files.push(child);
        if (files.length > 20000) throw new Error('This alpha supports up to 20,000 Markdown files per vault. Split the vault before opening it.');
      }
    };
    await walk(); let changed = false; let totalBytes = 0; const notes: Note[] = [];
    for (let i = 0; i < files.length; i += 16) {
      const batch = await Promise.all(files.slice(i, i + 16).map(async relative => {
        const file = await this.safePath(relative); const stat = await fs.stat(file);
        totalBytes += stat.size;
        if (stat.size > 2_000_000 || totalBytes > 100_000_000) throw new Error('This alpha supports notes up to 2 MB and vault text up to 100 MB. Your files were not changed.');
        const content = await fs.readFile(file, 'utf8');
        if (!this.manifest.noteIds[relative]) { this.manifest.noteIds[relative] = randomUUID(); changed = true; }
        const metadata = readMetadata(content);
        return { id: this.manifest.noteIds[relative], path: relative, title: titleOf(relative), content, revision: revisionOf(content), modifiedAt: stat.mtimeMs, tags: [...new Set([...extractTags(content), ...metadataTags(metadata.fields)])], metadata: metadata.fields, metadataError: metadata.error };
      })); notes.push(...batch);
    }
    if (changed) await this.persist();
    return { id: this.manifest.id, name: path.basename(this.root), root: this.root, notes: notes.sort((a,b)=>a.path.localeCompare(b.path)), folders: folders.sort(), settings: structuredClone(this.manifest.settings) };
  }
  private pathFor(id: string) {
    const relative = Object.keys(this.manifest.noteIds).find(p => this.manifest.noteIds[p] === id);
    if (!relative) throw new Error('Note not found in this vault.'); return relative;
  }
  async saveNote(input: { id: string; content: string; revision: string }): Promise<Note> {
    return this.serial(async () => {
      z.object({ id, content: z.string().max(2_000_000), revision: z.string().length(64) }).parse(input);
      const relative = this.pathFor(input.id); const file = await this.safePath(relative);
      const previous = await fs.readFile(file, 'utf8');
      if (revisionOf(previous) !== input.revision) throw new Error('Save conflict: this note changed on disk. Your draft is still here. Copy it, then reload the vault to compare.');
      const history = await this.safePath(`.aster/history/${input.id}`, true); await fs.mkdir(history, { recursive: true });
      await atomicWrite(path.join(history, `${input.revision}.md`), previous);
      await atomicWrite(file, input.content);
      const metadata = readMetadata(input.content);
      return { id: input.id, path: relative, title: titleOf(relative), content: input.content, revision: revisionOf(input.content), modifiedAt: Date.now(), tags: [...new Set([...extractTags(input.content), ...metadataTags(metadata.fields)])], metadata: metadata.fields, metadataError: metadata.error };
    });
  }
  async createNote(relative: string) {
    return this.serial(async () => {
      relative = relative.replace(/\\/g, '/'); await this.safePath(relative); if (!/\.md$/i.test(relative)) relative += '.md';
      const file = await this.safePath(relative); await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, `# ${titleOf(relative)}\n\n`, { encoding: 'utf8', flag: 'wx' }).catch(e => { throw new Error(e.code === 'EEXIST' ? 'A note already exists at that path.' : 'Could not create the note.'); });
      return this.scan();
    });
  }
  async createFolder(relative: string) {
    return this.serial(async () => { await fs.mkdir(await this.safePath(relative), { recursive: true }); return this.scan(); });
  }
  async moveNote(input: { id: string; path: string }) {
    return this.serial(async () => {
      const previous = this.pathFor(input.id); const next = input.path.replace(/\\/g, '/').replace(/\.md$/i, '') + '.md';
      if (next === previous) return this.scan();
      const source = await this.safePath(previous), target = await this.safePath(next);
      await fs.mkdir(path.dirname(target), { recursive: true });
      // Exclusive copy avoids overwriting any existing note, including case-insensitive collisions.
      await fs.copyFile(source, target, fs.constants.COPYFILE_EXCL);
      try { await fs.unlink(source); } catch (e) { await fs.unlink(target); throw e; }
      delete this.manifest.noteIds[previous]; this.manifest.noteIds[next] = input.id; await this.persist();
      return this.scan();
    });
  }
  async trashNote(noteId: string) {
    return this.serial(async () => {
      const relative = this.pathFor(noteId), file = await this.safePath(relative);
      const trash = await this.safePath('.aster/trash', true); await fs.mkdir(trash, { recursive: true });
      await fs.rename(file, path.join(trash, `${Date.now()}-${noteId}-${path.basename(relative)}`));
      delete this.manifest.noteIds[relative]; await this.persist(); return this.scan();
    });
  }
  async saveSettings(settings: VaultSettings) {
    return this.serial(async () => {
      const validated = settingsSchema.parse(settings);
      if (!validated.views.some(v => v.id === validated.activeView)) throw new Error('Unknown graph view.');
      this.manifest.settings = validated; await this.persist();
    });
  }
  private assertVault(vaultId: string) { if (vaultId !== this.manifest.id) throw new Error('The active vault changed. Reopen this module and try again.'); }
  private async readModules(): Promise<ModuleSnapshot> {
    let text: string;
    try { text = await fs.readFile(await this.safePath('.aster/modules.json', true), 'utf8'); }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; text = JSON.stringify(emptyModuleState()); }
    if (text.length > 50_000_000) throw new Error('Module data is too large to load.');
    try { return { vaultId: this.manifest.id, revision: revisionOf(text), state: moduleStateSchema.parse(JSON.parse(text)) }; }
    catch { throw new Error('The module sidecar is invalid. It has been preserved for recovery.'); }
  }
  loadModules() { return this.serial(() => this.readModules()); }
  private async writeModules(input: ModuleState, previous: ModuleSnapshot) {
    const state = moduleStateSchema.parse(input);
    state.calendar.dailyFolder = state.calendar.dailyFolder.replace(/\\/g, '/');
    await this.safePath(state.calendar.dailyFolder);
    for (const doc of state.documents) { if (!/\.pdf$/i.test(doc.path)) throw new Error('Documents must be PDF files.'); await this.safePath(doc.path); }
    const text = JSON.stringify(state, null, 2);
    if (Buffer.byteLength(text, 'utf8') > 50_000_000) throw new Error('Module data exceeds the 50 MB sidecar limit. Your saved data has not changed.');
    const history = await this.safePath('.aster/module-history', true); await fs.mkdir(history, { recursive: true });
    await atomicWrite(path.join(history, `${previous.revision}.json`), JSON.stringify(previous.state));
    await atomicWrite(await this.safePath('.aster/modules.json', true), text);
    return { vaultId: this.manifest.id, revision: revisionOf(text), state };
  }
  async saveModules(input: { vaultId: string; revision: string; state: ModuleState }) {
    return this.serial(async () => {
      this.assertVault(input.vaultId); const previous = await this.readModules();
      if (previous.revision !== input.revision) throw new Error('Module data changed outside this view. Reload modules before saving again.');
      return this.writeModules(input.state, previous);
    });
  }
  async openDailyNote(input: { vaultId: string; date: string }) {
    return this.serial(async () => {
      this.assertVault(input.vaultId); const date = dateSchema.parse(input.date); const modules = await this.readModules();
      const relative = `${modules.state.calendar.dailyFolder.replace(/\\/g, '/')}/${date}.md`; const file = await this.safePath(relative);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, `---\ntype: daily\ndate: ${date}\n---\n\n# ${date}\n\n`, { encoding: 'utf8', flag: 'wx' }).catch(e => { if (e.code !== 'EEXIST') throw e; });
      const vault = await this.scan(); return { vault, noteId: vault.notes.find(n => n.path === relative)!.id };
    });
  }
  async importPdf(source: string) {
    return this.serial(async () => {
      const stat = await fs.stat(source); if (stat.size > 100_000_000) throw new Error('PDFs must be 100 MB or smaller.');
      const bytes = await fs.readFile(source); if (!bytes.subarray(0,1024).includes(Buffer.from('%PDF-'))) throw new Error('This file is not a PDF.');
      const fingerprint = createHash('sha256').update(bytes).digest('hex'); const snapshot = await this.readModules();
      if (snapshot.state.documents.some(d => d.fingerprint === fingerprint)) return snapshot;
      const relative = `Attachments/${path.basename(source).replace(/\.pdf$/i, '')}-${randomUUID().slice(0,8)}.pdf`;
      const file = await this.safePath(relative); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, bytes, { flag: 'wx' });
      const state = structuredClone(snapshot.state);
      state.documents.push({ id: randomUUID(), path: relative, fingerprint, annotations: [] }); state.enabled.pdf = true;
      try { return await this.writeModules(state, snapshot); }
      catch (e) { await fs.unlink(file).catch(() => {}); throw e; }
    });
  }
  async readPdf(input: { vaultId: string; documentId: string }) {
    return this.serial(async () => {
      this.assertVault(input.vaultId); const snapshot = await this.readModules(); const doc = snapshot.state.documents.find(d => d.id === input.documentId);
      if (!doc) throw new Error('PDF not found in this vault.');
      const file = await this.safePath(doc.path); const stat = await fs.stat(file); if (stat.size > 100_000_000) throw new Error('PDF is larger than 100 MB.');
      const data = await fs.readFile(file), fingerprint = createHash('sha256').update(data).digest('hex');
      if (fingerprint !== doc.fingerprint) throw new Error('This PDF changed on disk. Import the revised PDF as a new document to keep existing annotations attached to the original revision.');
      return { data: new Uint8Array(data), fingerprint };
    });
  }
}
