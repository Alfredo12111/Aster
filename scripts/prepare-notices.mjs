import fs from 'node:fs/promises';
import path from 'node:path';
// Include license notices for installed project dependencies, including tooling.
// Electron's binary distribution supplies its separate LICENSE and Chromium notices.
const lock=JSON.parse(await fs.readFile('package-lock.json','utf8'));
const sections=['ASTER THIRD-PARTY NOTICES\n\nThe Aster project includes software developed by the following projects. This inventory includes build/test tooling as well as runtime libraries; listing a package does not imply it is shipped in the application. Upstream license terms apply to their respective components. Electron/Chromium notices are also included with the Windows distribution.\n'];
for (const relative of Object.keys(lock.packages).filter(p=>p.startsWith('node_modules/')).sort()) {
  const directory=path.resolve(relative);
  let manifest;try{manifest=JSON.parse(await fs.readFile(path.join(directory,'package.json'),'utf8'));}catch{continue;}
  const names=(await fs.readdir(directory)).filter(n=>/^(?:licen[sc]e|copying|notice)(?:[.-].*)?$/i.test(n)).sort();
  const texts=[];
  for(const name of names){const file=path.join(directory,name);if((await fs.stat(file)).isFile())texts.push(`${name}\n${await fs.readFile(file,'utf8')}`);}
  sections.push(`\n${'='.repeat(78)}\n${manifest.name} ${manifest.version}\nDeclared license: ${typeof manifest.license==='string'?manifest.license:JSON.stringify(manifest.license??manifest.licenses??'See upstream')}\n${texts.join('\n\n')||'License text is not distributed at this package root; refer to the upstream project.'}\n`);
}
await fs.writeFile('THIRD-PARTY-NOTICES.txt',sections.join('\n'));
console.log(`Prepared third-party notices for ${sections.length-1} installed packages.`);
