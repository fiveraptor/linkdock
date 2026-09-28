export {compact} from './core.mjs';
import {ext} from './browser.mjs';
import {normalize, merge, ordered, same, compact} from './core.mjs';

// Native mutations cannot be atomic. Persist the intent before writing and pause
// on interrupted writes, rather than treating a half-applied tree as user deletions.
export async function tree() {
  const [root] = await ext.bookmarks.getTree();
  const bars = root.children.filter(node => node.folderType === 'bookmarks-bar' && !node.unmodifiable);
  const bar = bars.length === 1 ? bars[0] : bars.length === 0 ? root.children.find(node => node.id === '1' && !node.url && !node.unmodifiable) : null;
  if (!bar) throw Error('Chrome meldet mehrere oder keine eindeutige Lesezeichenleiste. Der Abgleich wurde angehalten.');
  const flat = [];
  const visit = node => {
    flat.push({id:node.id, parentId:node.parentId, index:node.index, title:node.title,
      url:node.url ?? null, managed:!!node.unmodifiable});
    if (!node.unmodifiable) for (const child of node.children || []) visit(child);
  };
  for (const child of bar.children || []) visit(child);
  return {barId:bar.id, flat};
}
const signature = snapshot => JSON.stringify(snapshot);
const supported = node => !node.managed && (node.url === null || /^https?:\/\//i.test(node.url));
function decode(snapshot, native, candidates = [], matchExisting = false) {
  const items = [], used = new Set();
  const byNative = new Map();
  let skipped = 0;
  for (const node of snapshot.flat) {
    if (!supported(node) || (node.parentId !== snapshot.barId && !byNative.has(node.parentId))) { skipped++; continue; }
    const parentId = node.parentId === snapshot.barId ? null : byNative.get(node.parentId);
    const type = node.url === null ? 'folder' : 'bookmark';
    let id = native.map[node.id];
    if (!id && matchExisting) id = candidates.find(item => !used.has(item.id) && item.parentId === parentId &&
      item.type === type && item.title === node.title &&
      (type === 'folder' || new URL(item.url).href === new URL(node.url).href))?.id;
    id ||= `c_${native.device}_${node.id}`;
    native.map[node.id] = id;
    used.add(id); byNative.set(node.id,id);
    items.push({id, parentId, type, title:node.title, url:node.url, position:node.index});
  }
  native.skipped = skipped;
  return compact(items);
}
export async function capture(state) {
  if (state.native?.pending) throw Error('Die Übertragung in Chrome wurde unterbrochen. Bitte in den Einstellungen die Wiederaufnahme auswählen.');
  const snapshot = await tree();
  let native = state.native;
  if (native && native.barId !== snapshot.barId) throw Error('Die Chrome-Lesezeichenleiste hat sich geändert. Der Abgleich wurde angehalten.');
  if (!native) {
    native = {device:crypto.randomUUID().replaceAll('-',''), map:{}, base:[], barId:snapshot.barId, skipped:0, pending:false};
    // Keep the very first Chrome tree and LinkDock collection for recovery/export.
    await ext.storage.local.set({initialBackup:{createdAt:Date.now(),chrome:snapshot,linkdock:structuredClone(state.items)}});
    const observed = decode(snapshot,native,state.items,true);
    const ids = new Set(observed.map(item=>item.id));
    const combined = [...observed];
    for (const item of state.items) if (!ids.has(item.id)) {
      combined.push({...item,position:Math.max(-1,...combined.filter(other=>other.parentId===item.parentId).map(other=>other.position))+1});
    }
    state.items = compact(combined);
    native.base = observed;
    state.native = native;
  } else {
    const observed = decode(snapshot,native);
    const result = merge(native.base,state.items,observed);
    if (result.conflicts.length) {
      native.conflicts = result.conflicts;
      throw Error('Chrome und LinkDock enthalten widersprüchliche Änderungen. Bitte in den Einstellungen auswählen, welche Sammlung übernommen wird.');
    }
    state.items = compact(result.items);
    native.base = observed;
  }
  native.raw = snapshot;
  native.conflicts = [];
}
export async function apply(state, save) {
  const native = state.native;
  if (!native) return;
  if (native.pending) throw Error('Unterbrochene Chrome-Übertragung: bitte Einstellungen öffnen.');
  const start = await tree();
  if (signature(start) !== signature(native.raw)) throw Error('Chrome wurde während des Abgleichs geändert. Beim nächsten Abgleich wird die Änderung berücksichtigt.');
  const target = compact(state.items);
  if (same(target, compact(native.base))) return;
  const desiredIds = new Set(target.map(item=>item.id));
  const currentIds = new Set(start.flat.map(node=>node.id));
  const reverse = new Map(Object.entries(native.map).filter(([id])=>currentIds.has(id)).map(([id,value])=>[value,id]));
  const parents = new Map(target.map(item=>[item.id,item.parentId]));
  const depth = item => {let count=0,id=item.parentId;while(id!==null){count++;id=parents.get(id);}return count;};
  const sorted = [...target].sort((a,b)=>depth(a)-depth(b)||a.position-b.position||a.id.localeCompare(b.id));
  native.pending = true;
  native.writeBackup = {createdAt:Date.now(),chrome:start,items:target};
  await save(state);
  try {
    // Create ancestors first; move surviving children out before removing folders.
    for (const item of sorted) {
      const parentId = item.parentId === null ? native.barId : reverse.get(item.parentId);
      if (!parentId) throw Error('Zielordner fehlt.');
      let id = reverse.get(item.id);
      if (!id) {
        const created = await ext.bookmarks.create({parentId,title:item.title,...(item.type==='bookmark'?{url:item.url}:{})});
        id=created.id;native.map[id]=item.id;reverse.set(item.id,id);
        await save(state); // Persist returned native IDs immediately.
      } else {
        const [existing] = await ext.bookmarks.get(id);
        if (!!existing.url !== (item.type==='bookmark') || existing.unmodifiable) throw Error('Chrome-Eintrag kann nicht verändert werden.');
        if (existing.parentId !== parentId) await ext.bookmarks.move(id,{parentId});
        if (existing.title !== item.title || (item.type==='bookmark' && existing.url !== item.url))
          await ext.bookmarks.update(id,{title:item.title,...(item.type==='bookmark'?{url:item.url}:{})});
      }
    }
    // Delete only mapped nodes in the selected bar. Never recursively remove a
    // subtree: an unexpected new or unsupported child must remain intact.
    for (const node of [...start.flat].reverse()) {
      const id = native.map[node.id];
      if (!id || desiredIds.has(id) || !supported(node)) continue;
      if (node.url === null && (await ext.bookmarks.getChildren(node.id)).length)
        throw Error('Ein zu löschender Ordner enthält neue oder nicht unterstützte Einträge. Diese wurden nicht gelöscht.');
      await ext.bookmarks.remove(node.id);
      delete native.map[node.id];
      await save(state);
    }
    // Reorder supported nodes, leaving unsupported bookmarks in Chrome.
    for (const parent of new Set(target.map(item=>item.parentId))) {
      const parentId=parent===null?native.barId:reverse.get(parent);
      const children=ordered(target.filter(item=>item.parentId===parent));
      for (let position=0;position<children.length;position++) {
        const actual=await ext.bookmarks.getChildren(parentId);
        const slots=actual.filter(node=>desiredIds.has(native.map[node.id]));
        const id=reverse.get(children[position].id);
        if(slots[position]?.id!==id) await ext.bookmarks.move(id,{parentId,index:slots[position]?.index ?? actual.length});
      }
    }
    const final=await tree();
    const observed=decode(final,native);
    // Detect unexpected browser edits during application. Do not silently adopt
    // them as the new shared baseline or delete them on the next pass.
    const result = compact(target);
    const comparable=items=>JSON.stringify([...items].sort((a,b)=>a.id.localeCompare(b.id)));
    if(comparable(observed)!==comparable(result)) throw Error('Chrome wurde während der Übertragung geändert. Bitte Wiederaufnahme in den Einstellungen prüfen.');
    native.base=observed;native.raw=final;native.pending=false;native.conflicts=[];
    delete native.writeBackup;
    await save(state);
  } catch(error) {
    throw Error(`Chrome-Abgleich angehalten: ${error.message}`);
  }
}
export async function recover(state,choice) {
  const snapshot=await tree();
  const native=state.native;
  if(!native) throw Error('Keine Chrome-Verknüpfung vorhanden.');
  if(native.barId!==snapshot.barId) throw Error('Die ursprüngliche Leiste ist nicht verfügbar.');
  await ext.storage.local.set({recoveryBackup:{createdAt:Date.now(),chrome:snapshot,linkdock:structuredClone(state.items),native:structuredClone(native)}});
  const observed=decode(snapshot,native,state.items,true);
  if(choice==='chrome') state.items=observed;
  else if(choice!=='linkdock') throw Error('Ungültige Auswahl.');
  native.base=observed;native.raw=snapshot;native.pending=false;native.conflicts=[];
  state.error='';
}
