import './build.mjs';
import './check-public.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {filesIn,zip} from './zip.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {version}=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const out=path.join(root,'dist/releases');fs.mkdirSync(out,{recursive:true});
const read=file=>fs.readFileSync(path.join(root,file));
zip(path.join(out,`linkdock-chrome-${version}.zip`),[
 ...filesIn(path.join(root,'dist/chrome'),'linkdock-chrome/'),
 {name:'linkdock-chrome/README.md',data:read('docs/chrome.md')}]);
zip(path.join(out,`linkdock-safari-${version}.zip`),[
 ...filesIn(path.join(root,'dist/safari'),'linkdock-safari/extension/'),
 {name:'linkdock-safari/README.md',data:read('docs/safari.md')},
 {name:'linkdock-safari/Xcode-Projekt-erstellen.command',data:read('scripts/safari-project.sh')}]);
zip(path.join(out,`linkdock-server-${version}.zip`),[
 ...filesIn(path.join(root,'server'),'linkdock-server/'),
 {name:'linkdock-server/README.md',data:read('docs/server.md')}]);
console.log(`Packaged Chrome, Safari and server in dist/releases/.`);
