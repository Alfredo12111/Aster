import { describe, it, expect } from 'vitest';
import { scanText } from '../scripts/audit-publish.mjs';

describe('publication guard', () => {
  it('detects representative credentials without returning their values', () => {
    for (const [value, rule] of [
      ['ghp_' + 'a'.repeat(36), 'GitHub token'],
      ['github_pat_' + 'b'.repeat(60), 'GitHub token'],
      ['sk-proj-' + 'c'.repeat(48), 'AI provider key'],
      ['sk-ant-api03-' + 'd'.repeat(48), 'AI provider key'],
      ['AKIA' + 'E'.repeat(16), 'AWS access key'],
      ['npm_' + 'f'.repeat(36), 'npm token'],
      ['-----BEGIN ' + 'PRIVATE KEY-----', 'private key'],
      ['https://' + 'name:secret' + '@example.test', 'authenticated URL'],
    ]) {
      expect(scanText(value)).toContain(rule);
      expect(scanText(value).join(' ')).not.toContain(value);
    }
  });
  it('detects machine-specific paths and allows documentation placeholders', () => {
    for (const separator of ['\\', '\\\\', '/']) {
      expect(scanText(['C:', 'Users', 'fixture', 'private.txt'].join(separator))).toContain('personal Windows path');
    }
    expect(scanText(['', 'home', 'fixture', 'notes.md'].join('/'))).toContain('personal Unix path');
    expect(scanText('unit-test-key; process.env.GH_TOKEN; .aster/modules.json; https://github.com/example/project')).toEqual([]);
  });
});
