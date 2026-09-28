import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
for(const platform of ['chrome','safari']){
 const directory=path.join(root,'dist',platform);
 const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
 const referenced=[manifest.action.default_popup,manifest.options_page,...Object.values(manifest.icons),...(manifest.background.scripts||[manifest.background.service_worker])];
 for(const name of referenced)if(!fs.existsSync(path.join(directory,name)))throw Error(`Missing manifest resource: ${platform}/${name}`);
 for(const file of fs.readdirSync(directory)){
  if(!/\.(?:js|mjs)$/.test(file))continue;
  const result=spawnSync(process.execPath,['--check',path.join(directory,file)],{stdio:'inherit'});
  if(result.status!==0)process.exit(1);
  const text=fs.readFileSync(path.join(directory,file),'utf8');
  for(const match of text.matchAll(/(?:from\s+|import\s*)['"](\.\/[^'"]+)['"]/g))
   if(!fs.existsSync(path.join(directory,match[1])))throw Error(`Missing module: ${platform}/${match[1]}`);
 }
 for(const name of ['popup','options']){
  const html=fs.readFileSync(path.join(directory,`${name}.html`),'utf8');
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
  if(new Set(ids).size!==ids.length)throw Error(`Duplicate HTML ID in ${name}`);
  const script=fs.readFileSync(path.join(directory,`${name}.js`),'utf8');
  for(const match of script.matchAll(/el\('([^']+)'\)/g))if(!ids.includes(match[1]))throw Error(`Missing UI element: ${platform}/${match[1]}`);
  for(const match of html.matchAll(/(?:src|href)="([^":#]+)"/g))if(!fs.existsSync(path.join(directory,match[1])))throw Error(`Missing HTML resource: ${match[1]}`);
 }
}
console.log('Both manifests, JavaScript syntax, module imports and UI bindings are valid.');
