import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// A focused publication guard. Findings print paths/rule names, never matched secrets.
export const rules = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9_]{24,}|github_pat_[A-Za-z0-9_]{30,})\b/],
  ['AI provider key', /\bsk-(?:proj-|ant-api\d{2}-)?[A-Za-z0-9_-]{24,}\b/],
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['npm token', /\bnpm_[A-Za-z0-9]{30,}\b/],
  ['authenticated URL', /https?:\/\/[^\s/"'<>]+:[^\s/@"'<>]+@/],
  ['personal Windows path', /\b[A-Z]:(?:\\{1,2}|\/)Users(?:\\{1,2}|\/)[^\s"'<>]+/i],
  ['personal Unix path', /\/(?:Users|home)\/[a-zA-Z0-9_.-]+\//],
];
export function scanText(text) {
  return rules.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
}
const forbidden = /(?:^|\/)(?:node_modules|test-results|\.tools|artifacts|\.aster|\.aws|\.ssh|\.codex|dist|dist-electron|release(?:-[^/]+)?)\/|(?:^|\/)(?:ai\.json|workspace\.json|\.env(?:\..*)?|[^/]+\.(?:pem|key|p12|pfx|dmp|log|zip))$/i;
export async function auditSource() {
  const files = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {encoding:'utf8'}).split('\0').filter(Boolean))];
  if (!files.length) throw new Error('No publishable source files found.');
  const failures=[];
  for (const file of files) {
    if (forbidden.test(file)) failures.push(`${file}: private/generated file must not be published`);
    const bytes=await fs.readFile(file);
    if (bytes.length>5_000_000) failures.push(`${file}: unexpectedly large source asset`);
    if (bytes.includes(0)) continue;
    for (const rule of scanText(bytes.toString('utf8'))) failures.push(`${file}: ${rule}`);
  }
  if(failures.length) throw new Error(`Publication audit failed:\n${failures.join('\n')}`);
  console.log(`Publication audit passed: ${files.length} source files; no matching credential or personal-path findings. Images require visual review. This is not a security certification.`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await auditSource().catch(e=>{console.error(e.message);process.exitCode=1;});
}
