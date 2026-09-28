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
globalThis.chrome={
 permissions:{contains:async()=>true},
 bookmarks:fakeBookmarks(),
 storage:{local:{get:async()=>structuredClone(local),set:async update=>{Object.assign(local,structuredClone(update));},setAccessLevel:async()=>{}}},
 action:{setBadgeBackgroundColor:async()=>{},setBadgeText:async()=>{}},
 runtime:{id:'test',getURL:()=> 'chrome-extension://test/',onMessage:{addListener:fn=>listener=fn},onInstalled:event,onStartup:event},
 alarms:{get:async()=>true,create:async()=>{},onAlarm:event}
};
await import('../dist/chrome/background.js');
const send=(type,extra={})=>new Promise((resolve,reject)=>listener({type,...extra},{id:'test',url:'chrome-extension://test/popup.html'},reply=>reply.ok?resolve(reply.data):reject(Error(reply.error))));
const remote=async()=> (await backend('GET')).json();
const change=async items=>{
 const snapshot=await remote();
 assert.equal((await backend('PUT',JSON.stringify({revision:snapshot.revision,items}))).status,200);
};
try{
 await assert.rejects(send('configure',{url:'http://localhost:3000',token:'b'.repeat(64)}));
 assert.equal((await send('state')).configured,false);
 await send('configure',{url:'http://localhost:3000',token:'a'.repeat(64)});
 await send('edit',{command:{kind:'save',item:{type:'bookmark',title:'First',url:'https://example.com',parentId:null}}});
 let state=await send('sync');assert.equal(state.items.length,1);assert.equal(state.pending,false);
 const first=state.items[0];
 offline=true;
 await send('edit',{command:{kind:'save',item:{...first,title:'Offline edit'}}});
 state=await send('sync');assert.equal(state.pending,true);assert.ok(state.error);
 const second={id:'remote',type:'bookmark',title:'Second',url:'https://second.test',parentId:null,position:1};
 await change([first,second]);offline=false;
 state=await send('sync');assert.equal(state.items.length,2);assert.equal(state.items.find(i=>i.id===first.id).title,'Offline edit');assert.equal(state.pending,false);
 // Server acknowledges a write internally, but the network loses its response.
 loseReply=true;
 await send('edit',{command:{kind:'save',item:{...state.items[0],title:'Uncertain write'}}});
 state=await send('sync');assert.equal(state.pending,false);assert.equal(state.items.length,2);
 // Same field changed independently must stop, not overwrite.
 offline=true;
 await send('edit',{command:{kind:'save',item:{...state.items[0],title:'Local conflict'}}});
 await send('sync');
 const snapshot=await remote();await change(snapshot.items.map(i=>i.id===first.id?{...i,title:'Server conflict'}:i));
 offline=false;state=await send('sync');assert.equal(state.conflicts.length,1);assert.equal(state.items.find(i=>i.id===first.id).title,'Local conflict');
 state=await send('resolve',{choice:'remote'});assert.equal(state.items.find(i=>i.id===first.id).title,'Server conflict');assert.equal(state.pending,false);
 await send('edit',{command:{kind:'delete',id:second.id}});state=await send('sync');assert.equal(state.items.length,1);assert.equal((await remote()).items.length,1);
 // The UI-facing state never exposes the credential.
 assert.equal('native' in state,false);
 assert.equal((await chrome.bookmarks.getChildren('1')).length,1);
 assert.equal('token' in state,false);assert.equal(JSON.stringify(state).includes('a'.repeat(64)),false);
 // A real native event schedules synchronization without clicking the popup.
 const [barLink]=await chrome.bookmarks.getChildren('1');
 await chrome.bookmarks.update(barLink.id,{title:'Direct Chrome edit'});
 await new Promise(resolve=>setTimeout(resolve,450));
 state=await send('sync');assert.equal((await remote()).items[0].title,'Direct Chrome edit');
 // Second Chrome profile already containing the same bookmark must not duplicate it.
 const existing=(await remote()).items[0];
 local={};chrome.bookmarks=fakeBookmarks();
 await chrome.bookmarks.create({parentId:'1',title:existing.title,url:existing.url});
 state=await send('configure',{url:'http://localhost:3000',token:'a'.repeat(64)});
 assert.equal(state.items.length,1);assert.equal((await remote()).items.length,1);
 assert.equal((await chrome.bookmarks.getChildren('1')).length,1);
 assert.equal(state.items[0].id,existing.id);
 console.log('PASS: actual worker + actual server SQLite handlers: credential verification, save, offline recovery, independent-device merge, lost PUT response, conflict protection/resolution, deletion, secret isolation native bar output, event-triggered sync and second-profile deduplication. Chrome/transport mocked.');
}finally{fs.rmSync(directory,{recursive:true,force:true});}
