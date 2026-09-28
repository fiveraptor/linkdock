import assert from 'node:assert/strict';
import {fakeBookmarks} from './fake-bookmarks.mjs';
const bookmarks=fakeBookmarks();let stored={};globalThis.chrome={bookmarks,storage:{local:{set:async data=>{Object.assign(stored,structuredClone(data));}}}};
const {capture,apply,recover}=await import('../dist/chrome/native.mjs');
const folder=await bookmarks.create({parentId:'1',title:'Ordner'});
const link=await bookmarks.create({parentId:folder.id,title:'A',url:'https://a.test'});
const special=await bookmarks.create({parentId:'1',title:'Bookmarklet',url:'javascript:void(0)'});
const other=await bookmarks.create({parentId:'2',title:'Private',url:'https://other.test'});
const initial={id:'server',type:'bookmark',title:'A',url:'https://a.test',parentId:'server-folder',position:0};
const state={items:[{id:'server-folder',type:'folder',title:'Ordner',url:null,parentId:null,position:0},initial]};
const save=async state=>{stored.state=structuredClone(state);};
await capture(state);assert.equal(state.items.length,2);assert.equal(state.native.map[link.id],'server');assert.equal(state.native.skipped,1);assert.ok(stored.initialBackup);
let count=bookmarks.writes();await apply(state,save);assert.equal(bookmarks.writes(),count);
// Native edits reach local collection, including additions and ordering.
await bookmarks.update(link.id,{title:'Chrome rename'});await capture(state);assert.equal(state.items.find(i=>i.id==='server').title,'Chrome rename');
state.items.find(i=>i.id==='server').title='LinkDock rename';await apply(state,save);assert.equal((await bookmarks.get(link.id))[0].title,'LinkDock rename');
// Move survivor out, then remove its old folder.
state.items=state.items.filter(i=>i.type!=='folder').map(i=>({...i,parentId:null,position:0}));await apply(state,save);assert.equal((await bookmarks.get(link.id))[0].parentId,'1');await assert.rejects(bookmarks.get(folder.id));
assert.equal((await bookmarks.get(other.id))[0].parentId,'2');assert.equal((await bookmarks.get(special.id))[0].url,'javascript:void(0)');
// Recovery handles a native create that succeeded but returned no result.
state.items.push({id:'new',type:'bookmark',title:'New',url:'https://new.test',parentId:null,position:1});bookmarks.failNext(true);
await assert.rejects(apply(state,save));assert.equal(state.native.pending,true);assert.ok(state.native.writeBackup);await assert.rejects(capture(state));
bookmarks.clearFailure();await recover(state,'linkdock');await apply(state,save);assert.equal((await bookmarks.getChildren('1')).filter(i=>i.url==='https://new.test/').length,1);assert.equal(state.native.pending,false);
// User change while network request in progress: reject native overwrite.
await bookmarks.update(link.id,{title:'During network'});state.items.find(i=>i.id==='server').title='Remote rename';count=bookmarks.writes();await assert.rejects(apply(state,save));assert.equal(bookmarks.writes(),count);
await assert.rejects(capture(state));assert.ok(state.native.conflicts.length);await recover(state,'chrome');await apply(state,save);assert.equal(state.items.find(i=>i.id==='server').title,'During network');
// Never recursively delete a folder containing an unsupported bookmark.
const protectedFolder=await bookmarks.create({parentId:'1',title:'Special'});const protectedChild=await bookmarks.create({parentId:protectedFolder.id,title:'Local',url:'file:///local'});await capture(state);
const protectedId=state.native.map[protectedFolder.id];state.items=state.items.filter(i=>i.id!==protectedId);await assert.rejects(apply(state,save));assert.ok((await bookmarks.get(protectedChild.id))[0]);
console.log('PASS: first-import deduplication, no-op writes, bidirectional edits, move-before-delete, out-of-scope/special preservation, interrupted-create recovery, concurrent edits, protected-folder deletion');
