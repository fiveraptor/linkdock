const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('dist/safari/popup.js','utf8');
assert(!source.includes('confirm('));
const controls=new Map();
const el=id=>{
 if(!controls.has(id))controls.set(id,{disabled:false,textContent:'',open:false,listeners:{},focus(){this.focused=true},showModal(){this.open=true},close(){this.open=false;this.listeners.close?.()},addEventListener(name,callback){this.listeners[name]=callback}});
 return controls.get(id);
};
let calls=[],fail=false;
const context={deleting:null,state:{items:[]},el,document:{querySelectorAll:()=>[]},descendants:()=>new Set(['folder','child']),edit:async command=>{calls.push(command);if(fail)throw Error('Nicht gespeichert');}};
vm.createContext(context);vm.runInContext(source.slice(source.indexOf('function openDelete(item)')),context);
(async()=>{
 context.openDelete({id:'folder',type:'folder',title:'Testordner'});
 assert(el('delete-dialog').open);assert(el('delete-description').textContent.includes('1 enthaltenen'));assert(el('delete-cancel').focused);
 el('delete-cancel').onclick();await el('delete-form').onsubmit({preventDefault(){}});assert.equal(calls.length,0);
 context.openDelete({id:'link',type:'bookmark',title:'Testlink'});
 const first=el('delete-form').onsubmit({preventDefault(){}});
 await el('delete-form').onsubmit({preventDefault(){}});await first;
 assert.equal(calls.length,1);assert.equal(calls[0].id,'link');assert(!el('delete-dialog').open);
 fail=true;context.openDelete({id:'retry',type:'bookmark',title:'Retry'});await el('delete-form').onsubmit({preventDefault(){}});
 assert(el('delete-dialog').open);assert.equal(el('delete-error').textContent,'Nicht gespeichert');assert(!el('delete-confirm').disabled);
 console.log('PASS: actual deletion dialog handlers: open, cancel, explicit deletion, double-submit protection and error/retry. DOM simulated.');
})().catch(error=>{console.error(error);process.exitCode=1});
