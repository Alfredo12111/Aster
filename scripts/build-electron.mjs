import { build } from 'esbuild';
await build({entryPoints:['apps/desktop/electron/main.ts'],bundle:true,platform:'node',target:'node22',format:'cjs',external:['electron'],outfile:'dist-electron/main.cjs'});
await build({entryPoints:['apps/desktop/electron/preload.ts'],bundle:true,platform:'node',target:'node22',format:'cjs',external:['electron'],outfile:'dist-electron/preload.cjs'});
