const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'linkdock-test-'));
const source=fs.readFileSync('server/server.cjs','utf8');
async function boot(){
 let handler;
 await new Promise((resolve,reject)=>{
  const fakeServer={listen:resolve};
  const fakeProcess={env:{LINKDOCK_TOKEN:'a'.repeat(64),LINKDOCK_DB:path.join(root,'db.sqlite')},on(){},exit:reject};
  vm.runInNewContext(source,{require:name=>name==='node:http'?{createServer:fn=>{handler=fn;return fakeServer}}:require(name),process:fakeProcess,Buffer,URL,console,setTimeout});
 });
 return async (method='GET',body,auth=true,url='/api/snapshot')=>{
  let status,data;
  const req={method,url,headers:{'content-type':'application/json',...(auth?{authorization:'Bearer '+'a'.repeat(64)}:{})},async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify(body));}};
  const res={writeHead:s=>status=s,end:text=>data=JSON.parse(text)};
  await handler(req,res);
  return {status,data};
 };
}
(async()=>{
 let call=await boot();
 assert.equal((await call('GET',null,false,'/health')).status,200);
 assert.equal((await call('GET',null,false)).status,401);
 assert.equal((await call()).data.revision,0);
 const item={id:'one',type:'bookmark',title:"O'Reilly 🦊",url:'https://example.com',parentId:null,position:0};
 assert.equal((await call('PUT',{revision:0,items:[item]})).status,200);
 assert.equal((await call()).data.items[0].title,item.title);
 assert.equal((await call('PUT',{revision:0,items:[]})).status,409);
 assert.equal((await call()).data.items.length,1);
 assert.equal((await call('PUT',{revision:1,items:[{...item,url:'javascript:alert(1)'}]})).status,400);
 assert.equal((await call('PUT',{revision:1,items:[{id:'f',type:'folder',title:'cycle',parentId:'f',position:0}]})).status,400);
 const concurrent=await Promise.all([call('PUT',{revision:1,items:[item]}),call('PUT',{revision:1,items:[item]})]);
 assert.deepEqual(concurrent.map(x=>x.status).sort(),[200,409]);
 assert.equal((await call('PUT',{revision:2,items:[]})).status,200);
 call=await boot();
 assert.equal((await call()).data.revision,3);
 assert.deepEqual((await call()).data.items,[]);
 console.log('PASS: health, authentication, Unicode/quotes, stale writes, URL/hierarchy validation, concurrent SQLite writers, deletion and database reopen. HTTP handler invoked in-process; no socket test.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>fs.rmSync(root,{recursive:true,force:true}));
