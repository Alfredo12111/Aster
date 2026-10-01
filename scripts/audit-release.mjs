import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listPackage, statFile, extractFile } from '@electron/asar';
import { scanText } from './audit-publish.mjs';

export async function auditRelease() {
  const manifest=JSON.parse(await fs.readFile('package.json','utf8'));
  const directory=path.resolve(manifest.build.directories.output,'win-unpacked');
  const archive=path.join(directory,'resources/app.asar');
  const files=listPackage(archive).map(s=>s.replace(/\\/g,'/').replace(/^\//,''));
  const failures=[];
  let checked=0;
  for (const file of files) {
    const archivePath=path.normalize(file);
    const entry=statFile(archive,archivePath);
    if ('files' in entry) continue;
    checked++;
    if (!/^(?:dist\/|dist-electron\/|package\.json$|LICENSE$|THIRD-PARTY-NOTICES\.txt$)/.test(file)) failures.push(`${file}: unexpected app-archive entry`);
    if (/(?:^|\/)(?:ai\.json|workspace\.json|\.env|\.aster|test-results|\.tools|\.git)(?:$|\/)/.test(file)) failures.push(`${file}: private runtime data`);
    if (/\.(?:map|log|dmp)$/i.test(file)) failures.push(`${file}: debug artifact`);
    if (entry.size>15_000_000) failures.push(`${file}: oversized application resource`);
    const bytes=extractFile(archive,archivePath);
    if(bytes.includes(0)) continue;
    for(const rule of scanText(bytes.toString('utf8'))) failures.push(`${file}: ${rule}`);
  }
  const rootEntries=await fs.readdir(directory);
  for(const entry of rootEntries) if(/^(?:\.env|\.aster|\.git|test-results|user.?data|ai\.json|workspace\.json)$/i.test(entry)) failures.push(`${entry}: private data alongside app`);
  for(const required of ['Aster.exe','resources','locales']) if(!rootEntries.includes(required)) failures.push(`Missing ${required}`);
  if(failures.length)throw new Error(`Release audit failed:\n${failures.join('\n')}`);
  console.log(`Release audit passed: ${checked} app-archive files; expected build-only contents, no matching credential/personal-path findings or debug maps. Electron runtime binaries are upstream distribution files.`);
  return directory;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await auditRelease().catch(e=>{console.error(e.message);process.exitCode=1;});
