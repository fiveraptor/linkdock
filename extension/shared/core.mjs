export const fields = ['id', 'type', 'title', 'parentId', 'position', 'url'];
export function normalize(items) {
  if (!Array.isArray(items) || items.length > 5000) throw Error('Ungültige Sammlung oder mehr als 5000 Einträge.');
  const byId = new Map();
  const clean = items.map(item => {
    if (!item || typeof item.id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(item.id) || byId.has(item.id) ||
        !['bookmark', 'folder'].includes(item.type) || typeof item.title !== 'string' || item.title.length > 1000 ||
        !(item.parentId === null || typeof item.parentId === 'string') ||
        !Number.isSafeInteger(item.position) || item.position < 0) throw Error('Ungültiger Favorit.');
    if (item.type === 'bookmark') {
      if (typeof item.url !== 'string' || item.url.length > 8192) throw Error('Ungültige Adresse.');
      let url;
      try { url = new URL(item.url); } catch { throw Error('Bitte eine vollständige Webadresse eingeben.'); }
      if (!['http:', 'https:'].includes(url.protocol)) throw Error('Nur http:// und https:// werden unterstützt.');
    }
    const result = Object.fromEntries(fields.map(key => [key, key === 'url' && item.type === 'folder' ? null : item[key]]));
    byId.set(result.id, result);
    return result;
  });
  for (const item of clean) {
    let id = item.parentId;
    const seen = new Set([item.id]);
    while (id !== null) {
      const parent = byId.get(id);
      if (!parent || parent.type !== 'folder' || seen.has(id)) throw Error('Ungültige Ordnerstruktur.');
      seen.add(id);
      id = parent.parentId;
    }
  }
  if (new TextEncoder().encode(JSON.stringify({revision: Number.MAX_SAFE_INTEGER, items: clean})).length > 1024 * 1024)
    throw Error('Die Sammlung überschreitet das Serverlimit von 1 MiB.');
  return clean;
}
const equalItem = (a, b) => a === b || (!!a && !!b && fields.every(key => a[key] === b[key]));
export function same(a, b) {
  if (a.length !== b.length) return false;
  const map = new Map(b.map(item => [item.id, item]));
  return a.every(item => equalItem(item, map.get(item.id)));
}
export function merge(base, local, remote) {
  const [b, l, r] = [base, local, remote].map(items => new Map(items.map(item => [item.id, item])));
  const items = [], conflicts = [];
  for (const id of new Set([...b.keys(), ...l.keys(), ...r.keys()])) {
    const original = b.get(id), ours = l.get(id), theirs = r.get(id);
    let result;
    if (equalItem(ours, theirs)) result = ours;
    else if (equalItem(original, ours)) result = theirs;
    else if (equalItem(original, theirs)) result = ours;
    else if (!original || !ours || !theirs) conflicts.push(id);
    else {
      result = {...original};
      for (const key of fields) {
        if (ours[key] === theirs[key]) result[key] = ours[key];
        else if (ours[key] === original[key]) result[key] = theirs[key];
        else if (theirs[key] === original[key]) result[key] = ours[key];
        else conflicts.push(id);
      }
    }
    if (result) items.push(result);
  }
  if (!conflicts.length) {
    try { return {items: normalize(items), conflicts: []}; }
    catch { return {items: [], conflicts: ['folder-structure']}; }
  }
  return {items: [], conflicts: [...new Set(conflicts)]};
}
export function descendants(items, rootId) {
  const ids = new Set([rootId]);
  let added;
  do {
    added = false;
    for (const item of items) if (ids.has(item.parentId) && !ids.has(item.id)) { ids.add(item.id); added = true; }
  } while (added);
  return ids;
}
export function editItems(items, command) {
  let result = structuredClone(items);
  if (command.kind === 'save') {
    const input = command.item;
    const index = result.findIndex(item => item.id === input.id);
    const existing = result[index];
    const parentId = input.parentId || null;
    const position = existing && existing.parentId === parentId ? existing.position :
      Math.max(-1, ...result.filter(item => item.parentId === parentId).map(item => item.position)) + 1;
    const item = {id: existing?.id || crypto.randomUUID(), type: existing?.type || input.type,
      title: input.title.trim(), url: input.url, parentId, position};
    if (!item.title) throw Error('Bitte einen Namen eingeben.');
    if (index < 0) result.push(item); else result[index] = item;
  } else if (command.kind === 'delete') {
    const ids = descendants(result, command.id);
    result = result.filter(item => !ids.has(item.id));
  } else if (command.kind === 'move') {
    const item = result.find(item => item.id === command.id);
    if (!item || ![-1,1].includes(command.direction)) throw Error('Eintrag nicht gefunden.');
    const siblings = ordered(result.filter(other => other.parentId === item.parentId));
    const index = siblings.findIndex(other => other.id === item.id);
    const target = index + command.direction;
    if (target >= 0 && target < siblings.length) [siblings[index], siblings[target]] = [siblings[target], siblings[index]];
    siblings.forEach((child, position) => { child.position = position; });
  } else throw Error('Unbekannte Änderung.');
  return normalize(result);
}
export const ordered = items => [...items].sort((a,b) => a.position - b.position || a.id.localeCompare(b.id));

export function compact(items) {
  const result = structuredClone(items);
  for (const item of result) if (item.type === 'bookmark') item.url = new URL(item.url).href;
  for (const parent of new Set(result.map(item => item.parentId)))
    ordered(result.filter(item => item.parentId === parent)).forEach((item, index) => { item.position = index; });
  return normalize(result);
}
