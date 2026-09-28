import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
const directory=await mkdtemp(path.join(os.tmpdir(),'linkdock-http-'));
const token=randomBytes(32).toString('hex');
const server=spawn(process.execPath,['server/server.cjs'],{env:{...process.env,HOST:'127.0.0.1',PORT:'0',LINKDOCK_TOKEN:token,LINKDOCK_DB:path.join(directory,'data.sqlite')},stdio:['ignore','pipe','pipe']});
let diagnostics='';server.stderr.on('data',chunk=>{diagnostics+=chunk.toString();});
try{
 const base=await new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(Error('Server startup timeout')),10000);
  server.once('exit',()=>{clearTimeout(timeout);reject(Error(diagnostics||'Server exited early'));});
  server.once('error',error=>{clearTimeout(timeout);reject(error);});
  let output='';server.stdout.on('data',chunk=>{
   output+=chunk.toString();const match=output.match(/listening on 127\.0\.0\.1:(\d+)/);
   if(match){clearTimeout(timeout);resolve(`http://localhost:${match[1]}`);}
  });
 });
 const request=(method,body,key=token)=>fetch(`${base}/api/snapshot`,{method,headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await fetch(`${base}/health`)).status,200);
 assert.equal((await request('GET',null,'invalid')).status,401);
 const item={id:'http-example',type:'bookmark',title:'HTTP test',url:'https://example.com/',parentId:null,position:0};
 const first=await request('PUT',{revision:0,items:[item]});assert.equal(first.status,200);
 assert.equal((await (await request('GET')).json()).items.length,1);
 const results=await Promise.all([request('PUT',{revision:1,items:[]}),request('PUT',{revision:1,items:[item]})]);
 assert.deepEqual(results.map(result=>result.status).sort(),[200,409]);
 console.log('PASS: real HTTP listener, bearer authentication, read/write and concurrent revision checks.');
}finally{
 if(server.exitCode===null){server.kill('SIGTERM');await once(server,'exit');}
 await rm(directory,{recursive:true,force:true});
}
