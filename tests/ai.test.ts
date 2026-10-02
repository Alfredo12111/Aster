import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
vi.mock('electron', () => ({ safeStorage: { isEncryptionAvailable: () => true, getSelectedStorageBackend: () => 'gnome_libsecret', encryptString: (s: string) => Buffer.from('test-encryption:' + s), decryptString: (b: Buffer) => b.toString().replace('test-encryption:', '') } }));
import { AiService } from '../apps/desktop/electron/ai';
import { safeStorage } from 'electron';
import { defaultSettings, type VaultSnapshot } from '../packages/core/types';
let root: string;
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'aster-ai-')); });
afterEach(async () => { vi.unstubAllGlobals(); if (path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(root).startsWith('aster-ai-')) await fs.rm(root, { recursive: true, force: true }); });
const sourceId = randomUUID(), candidateId = randomUUID();
const vault: VaultSnapshot = { id: randomUUID(), root: '/test', name: 'Test', folders: [], settings: defaultSettings(), notes: [sourceId, candidateId].map((id, i) => ({ id, path: `${i}.md`, title: `${i}`, content: 'Semantic retrieval #retrieval', revision: 'a'.repeat(64), modifiedAt: 1, tags: ['retrieval'] })) };
describe('optional BYOK AI boundary', () => {
  it('never exposes keys in settings and validates provider suggestions against the candidate set', async () => {
    const ai = new AiService(root); const saved = await ai.save({ provider: 'openai', model: 'test-model', key: 'unit-test-key' });
    expect(saved).toEqual({ provider: 'openai', model: 'test-model', hasKey: true });
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ suggestions: [{ noteId: candidateId, reason: 'Shared retrieval concepts.' }, { noteId: 'invented', reason: 'Should be rejected' }, { noteId: candidateId, reason: 'Duplicate' }] }) }] }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    expect(await ai.suggest(vault, sourceId)).toEqual([{ noteId: candidateId, reason: 'Shared retrieval concepts.', score: 0, origin: 'ai' }]);
    const request = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(request[0]).toBe('https://api.openai.com/v1/responses');
    expect(JSON.parse(request[1].body as string).store).toBe(false);
    expect(request[1].redirect).toBe('error');
    await ai.save({ provider: 'openai', model: 'test-model', key: '' });
    expect((await ai.settings()).hasKey).toBe(false);
  });
  it('makes no request without a key and never mutates a vault on invalid model output', async () => {
    const ai = new AiService(root); const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    await expect(ai.suggest(vault, sourceId)).rejects.toThrow('Add an API key'); expect(fetcher).not.toHaveBeenCalled();
    await ai.save({ provider: 'anthropic', model: 'test-model', key: 'unit-test-key' });
    fetcher.mockResolvedValue(new Response(JSON.stringify({ content: [{ type: 'text', text: 'not valid JSON' }] }), { status: 200 }));
    await expect(ai.suggest(vault, sourceId)).rejects.toThrow('No connections were changed');
    expect(vault.settings.relations).toEqual([]);
  });
  it('refuses to save a key when the Linux plaintext storage backend is active', async () => {
    const platform = vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    const backend = (safeStorage as { getSelectedStorageBackend?: () => string }).getSelectedStorageBackend;
    (safeStorage as { getSelectedStorageBackend?: () => string }).getSelectedStorageBackend = () => 'basic_text';
    try {
      const ai = new AiService(root);
      await expect(ai.save({ provider: 'openai', model: 'test-model', key: 'unit-test-key' })).rejects.toThrow('Secure key storage is unavailable');
      expect((await ai.settings()).hasKey).toBe(false);
    } finally {
      platform.mockRestore();
      (safeStorage as { getSelectedStorageBackend?: () => string }).getSelectedStorageBackend = backend;
    }
  });
});
