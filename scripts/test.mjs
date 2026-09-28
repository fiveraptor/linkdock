import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function run(script){
 const result=spawnSync(process.execPath,[script],{cwd:root,stdio:'inherit'});
 if(result.status!==0)process.exit(result.status || 1);
}
run('scripts/build.mjs');
run('scripts/check-public.mjs');
run('scripts/validate.mjs');
for(const file of fs.readdirSync(path.join(root,'tests')).sort()){
 if(file==='fake-bookmarks.mjs'||!(/\.(mjs|cjs)$/.test(file)))continue;
 run(`tests/${file}`);
}
console.log('All LinkDock tests passed. Browser APIs are simulated; see docs/development.md.');
