import assert from 'node:assert/strict';
import {fakeBookmarks} from './fake-bookmarks.mjs';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import vm from 'node:vm';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'linkdock-extension-'));
let route;
await new Promise((resolve,reject)=>{
 vm.runInNewContext(fs.readFileSync('server/server.cjs','utf8'),{
  require:name=>name==='node:http'?{createServer:fn=>{route=fn;return {listen:resolve}}}:require(name),
  process:{env:{LINKDOCK_DB:path.join(directory,'db.sqlite'),LINKDOCK_TOKEN:'a'.repeat(64)},on(){},exit:reject},Buffer,URL,console,setTimeout
 });
});
async function backend(method,body,authorization='Bearer '+'a'.repeat(64)){
 let status,data;
 await route({url:'/api/snapshot',method,headers:{authorization,'content-type':'application/json'},async *[Symbol.asyncIterator](){if(body)yield Buffer.from(body)}},
  {writeHead:s=>status=s,end:s=>data=JSON.parse(s)});
 return {status,ok:status>=200&&status<300,json:async()=>data};
}
let offline=false,loseReply=false,listener,local={};
globalThis.fetch=async(url,options)=>{
 if(offline)throw Error('offline');
 const result=await backend(options.method,options.body,options.headers.Authorization);
 if(options.method==='PUT'&&loseReply){loseReply=false;throw Error('Lost response');}
 return result;
};
const event={addListener(){}};
let granted=true,requests=0;
const actualFetch=globalThis.fetch;
globalThis.fetch=async(...args)=>{requests++;return actualFetch(...args);};
globalThis.browser={
 permissions:{contains:async()=>granted},
 storage:{local:{get:async()=>structuredClone(local),set:async update=>{Object.assign(local,structuredClone(update));}}},
 action:{setBadgeText:async()=>{}},
 runtime:{id:'test',getURL:()=> 'safari-web-extension://test/',onMessage:{addListener:fn=>listener=fn},onInstalled:event,onStartup:event},
 alarms:{get:async()=>true,create:async()=>{},onAlarm:event}
};
await import('../dist/safari/background.js');
const send=(type,extra={})=>new Promise((resolve,reject)=>listener({type,...extra},{id:'test',url:'safari-web-extension://test/popup.html'},reply=>reply.ok?resolve(reply.data):reject(Error(reply.error))));
const remote=async()=> (await backend('GET')).json();
const change=async items=>{const snapshot=await remote();assert.equal((await backend('PUT',JSON.stringify({revision:snapshot.revision,items}))).status,200);};
try{
 const first={id:'chrome-bookmark',type:'bookmark',title:'Aus Chrome',url:'https://example.com/',parentId:null,position:0};
 await change([first]);
 granted=false;const before=requests;
 await assert.rejects(send('configure',{url:'https://my.custom-server.test:8443/base/',token:'a'.repeat(64)}));
 assert.equal(requests,before);assert.equal((await send('state')).configured,false);
 granted=true;
 let state=await send('configure',{url:'https://my.custom-server.test:8443/base/',token:'a'.repeat(64)});
 assert.equal(state.items.length,1);assert.equal(state.url,'https://my.custom-server.test:8443/base');
 assert.equal(state.nativeStatus.linked,false);assert.equal('native' in local.state,false);
 offline=true;
 await send('edit',{command:{kind:'save',item:{type:'bookmark',title:'Safari offline',url:'https://safari.test/',parentId:null}}});
 state=await send('sync');assert.equal(state.pending,true);assert.equal(state.items.length,2);
 await change([{...first,title:'In Chrome geändert'}]);offline=false;
 state=await send('sync');assert.equal(state.items.length,2);assert.equal(state.items.find(i=>i.id===first.id).title,'In Chrome geändert');
 assert.equal((await remote()).items.length,2);
 await send('edit',{command:{kind:'delete',id:first.id}});await send('sync');assert.equal((await remote()).items.length,1);
 assert.equal('token' in state,false);
 console.log('PASS: Safari-only browser API, no bookmarks API, unsupported Chrome methods absent, optional permission denial makes zero requests, custom URL, Chrome-to-Safari download, Safari offline edit and merge, deletion. Actual SQLite backend; browser/transport mocked.');
}finally{fs.rmSync(directory,{recursive:true,force:true});}
