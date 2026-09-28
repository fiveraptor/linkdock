import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {version}=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const common=JSON.parse(fs.readFileSync(path.join(root,'extension/manifest.json'),'utf8'));
for(const platform of ['chrome','safari']){
  const destination=path.join(root,'dist',platform);
  fs.mkdirSync(destination,{recursive:true});
  // This script owns only dist/chrome and dist/safari, never browser profiles.
  fs.rmSync(destination,{recursive:true,force:true});
  fs.cpSync(path.join(root,'extension/shared'),destination,{recursive:true});
  fs.cpSync(path.join(root,'extension/platform',platform),destination,{recursive:true});
  const manifest={...common,version,
    permissions:['storage','alarms','activeTab','unlimitedStorage',...(platform==='chrome'?['bookmarks','favicon']:[])],
    background:platform==='chrome'?{service_worker:'background.js',type:'module'}:{scripts:['background.js'],type:'module',persistent:false},
    ...(platform==='chrome'?{minimum_chrome_version:'120'}:{})};
  fs.writeFileSync(path.join(destination,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
}
console.log(`Built Chrome and Safari ${version} in dist/.`);
