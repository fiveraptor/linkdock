import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const skip=new Set(['.git','node_modules','local']);
const problems=[];
function walk(directory){
 for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
  if(skip.has(entry.name))continue;
  const file=path.join(directory,entry.name), relative=path.relative(root,file);
  if(entry.isDirectory()){walk(file);continue;}
  if(entry.isSymbolicLink()){problems.push(`${relative}: symbolic link`);continue;}
  if(entry.name!=='.env.example' && /^(?:\.env(?:\..*)?|linkdock\.env)$|\.(?:sqlite(?:-.*)?|db(?:-.*)?|pem|key|p12|p8|mobileprovision|provisionprofile)$/i.test(entry.name))problems.push(`${relative}: runtime or credential file`);
  if(/\.(?:png|zip)$/.test(file))continue;
  const text=fs.readFileSync(file,'utf8');
  for(const value of text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g)||[]){
   if(value==='0.0.0.0'||value==='127.0.0.1')continue; // Generic bind/loopback, not deployment addresses.
   problems.push(`${relative}: non-placeholder IPv4 literal`);
  }
  if(/\/(?:Users|home)\/[A-Za-z0-9_-]+\//.test(text))problems.push(`${relative}: personal home path`);
  if(/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/.test(text))problems.push(`${relative}: GitHub credential pattern`);
  if(/-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/.test(text))problems.push(`${relative}: private key`);
  if(/\b[a-fA-F0-9]{64}\b/.test(text))problems.push(`${relative}: possible literal access token`);
 }
}
walk(root);
if(problems.length){console.error([...new Set(problems)].join('\n'));process.exit(1);}
console.log('Public-file checks passed. This is a heuristic check, not a secret-scanner guarantee.');
