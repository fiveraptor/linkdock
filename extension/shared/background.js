import {ext, nativeSync} from './browser.mjs';
import {serverAddress, serverOrigin} from './server-address.mjs';
import {normalize, same, merge, editItems} from './core.mjs';
import {capture, apply, recover, compact} from './native.mjs';
let writingChrome = false, importingChrome = false, nativeTimer;
async function applyChrome(state) {
  writingChrome = true;
  try { await apply(state, store); }
  catch (error) {
    writingChrome = false;
    state.error = error.message;
    await store(state);
    throw error;
  } finally { writingChrome = false; }
}
const fresh = () => ({base: [], items: [], revision: 0, lastSync: null, error: '', conflicts: []});
let queue = Promise.resolve();
const exclusive = task => {
  const job = queue.then(task);
  queue = job.catch(() => {});
  return job;
};
async function load() {
  const stored = await ext.storage.local.get(['state','settings']);
  return {state: stored.state || fresh(), settings: stored.settings || null};
}
async function store(state) {
  await ext.storage.local.set({state});
  await ext.action.setBadgeBackgroundColor?.({color: state.conflicts.length ? '#b54726' : '#176957'});
  await ext.action.setBadgeText({text: state.conflicts.length || state.native?.conflicts?.length || (state.native?.pending && !writingChrome) ? '!' : !same(state.items,state.base) ? '•' : ''});
}
async function api(settings, method = 'GET', body) {
  let response;
  try {
    response = await fetch(`${settings.url}/api/snapshot`, {
      method, headers: {'Authorization': `Bearer ${settings.token}`, 'Content-Type':'application/json'},
      ...(body ? {body: JSON.stringify(body)} : {}), signal: AbortSignal.timeout(8000),
      cache: 'no-store', redirect: 'error', credentials: 'omit'
    });
  } catch { throw Error('Server nicht erreichbar. Deine Änderungen bleiben lokal gespeichert.'); }
  if (response.status === 401) throw Error('Zugangsschlüssel ungültig. Bitte Einstellungen prüfen.');
  if (response.status === 409) return null;
  if (!response.ok) throw Error(`Serverfehler ${response.status}. Änderungen bleiben lokal gespeichert.`);
  let data;
  try { data = await response.json(); } catch { throw Error('Der Server liefert keine gültige LinkDock-Antwort.'); }
  if (!Number.isSafeInteger(data.revision) || data.revision < 0) throw Error('Ungültige Serverversion.');
  if (method === 'GET') data.items = normalize(data.items);
  return data;
}
async function publicState() {
  const {state, settings} = await load();
  const {native, ...visible} = state;
  return {...visible, nativeStatus: {linked: !!native, paused: (!!native?.pending && !writingChrome) || !!native?.conflicts?.length, skipped: native?.skipped || 0}, configured: !!settings, url: settings?.url || '', pending: !same(state.items, state.base)};
}
async function sync() {
  const {state, settings} = await load();
  if (!settings || importingChrome) return publicState();
  try {
    if (nativeSync && !state.native) {
      // Load the server first so an existing collection can be matched against
      // Chrome on every device's first import instead of duplicating it.
      const remote = await api(settings);
      const initial = merge(state.base, state.items, remote.items);
      if (initial.conflicts.length) {
        state.conflicts = initial.conflicts;
        throw Error('Vor der ersten Chrome-Verknüpfung bestehen Konflikte mit dem Server. Bitte lokale Favoriten exportieren und den Konflikt klären.');
      }
      state.items = initial.items;
      state.base = remote.items;
      state.revision = remote.revision;
    }
    await capture(state);
    await store(state);
    await applyChrome(state);
    for (let attempt = 0; attempt < 3; attempt++) {
      const remote = await api(settings);
      const combined = merge(state.base, state.items, remote.items);
      if (!combined.conflicts.length) combined.items = compact(combined.items);
      if (combined.conflicts.length) {
        state.conflicts = combined.conflicts;
        state.error = 'Auf beiden Geräten wurde derselbe Eintrag unterschiedlich geändert. Bitte Konflikt in den Einstellungen lösen.';
        await store(state);
        return publicState();
      }
      let revision = remote.revision;
      if (!same(combined.items, remote.items)) {
        const result = await api(settings, 'PUT', {revision, items: combined.items});
        if (!result) continue;
        revision = result.revision;
      }
      Object.assign(state, {base: combined.items, items: combined.items, revision,
        lastSync: Date.now(), error: '', conflicts: []});
      await store(state);
      await applyChrome(state);
      return publicState();
    }
    throw Error('Server wurde gleichzeitig geändert. Der nächste Abgleich versucht es erneut.');
  } catch (error) {
    state.error = error.message;
    await store(state);
    return publicState();
  }
}
async function handle(message) {
  if (message.type === 'sync') return sync();
  if (message.type === 'backup') {
    const data = await ext.storage.local.get(['initialBackup', 'recoveryBackup']);
    const {state} = await load();
    return {...data, interruptedWrite:state.native?.writeBackup || null};
  }
  if (message.type === 'recoverChrome') {
    const {state} = await load();
    await recover(state, message.choice);
    await store(state);
    return sync();
  }
  if (message.type === 'edit') {
    const {state, settings} = await load();
    if (!settings) throw Error('Bitte zuerst den Server verbinden.');
    state.items = editItems(state.items, message.command);
    await store(state); // Commit locally before any network access.
    void exclusive(sync);
    return publicState();
  }
  if (message.type === 'configure') {
    const url = serverAddress(message.url);
    if (!await ext.permissions.contains({origins:[serverOrigin(url)]}))
      throw Error('Bitte den Zugriff auf diese Serveradresse in den Einstellungen erlauben.');
    const {settings, state} = await load();
    const token = String(message.token || settings?.token || '').trim();
    if (!/^[a-f0-9]{64}$/.test(token)) throw Error('Der Schlüssel muss aus 64 Zeichen bestehen (LINKDOCK_TOKEN).');
    const next = {url, token};
    await api(next); // Do not store unverified credentials.
    await ext.storage.local.set({settings: next});
    state.error = '';
    await store(state);
    return sync();
  }
  if (message.type === 'resolve') {
    const {state, settings} = await load();
    if (!settings) throw Error('Kein Server verbunden.');
    await capture(state);
    await store(state);
    const remote = await api(settings);
    let items, revision;
    if (message.choice === 'remote') {
      items = compact(remote.items);
      revision = remote.revision;
    } else if (message.choice === 'local') {
      items = normalize(state.items);
      const result = await api(settings, 'PUT', {revision: remote.revision, items});
      if (!result) throw Error('Server inzwischen geändert. Bitte erneut abgleichen.');
      revision = result.revision;
    } else throw Error('Ungültige Auswahl.');
    Object.assign(state, {items, base: items, revision, lastSync: Date.now(), error: '', conflicts: []});
    await store(state);
    await applyChrome(state);
    return publicState();
  }
  throw Error('Unbekannte Aktion.');
}
ext.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== ext.runtime.id || !sender.url?.startsWith(ext.runtime.getURL(''))) return false;
  const work = message?.type === 'state' ? publicState() : exclusive(() => handle(message));
  work.then(data => respond({ok:true, data}), error => respond({ok:false, error:error.message}));
  return true;
});
async function setup() {
  await ext.storage.local.setAccessLevel?.({accessLevel:'TRUSTED_CONTEXTS'});
  if (!await ext.alarms.get('linkdock-sync')) await ext.alarms.create('linkdock-sync', {periodInMinutes:1});
}
ext.runtime.onInstalled.addListener(() => { void setup().then(() => exclusive(sync)).catch(console.error); });
ext.runtime.onStartup.addListener(() => { void setup().then(() => exclusive(sync)).catch(console.error); });
ext.alarms.onAlarm.addListener(alarm => { if (alarm.name === 'linkdock-sync') void exclusive(sync).catch(console.error); });
void setup().catch(console.error);

function chromeChanged() {
  if (writingChrome || importingChrome) return;
  clearTimeout(nativeTimer);
  nativeTimer = setTimeout(() => { void exclusive(sync).catch(console.error); }, 400);
}
if (nativeSync) {
for (const event of [ext.bookmarks.onCreated, ext.bookmarks.onChanged, ext.bookmarks.onMoved, ext.bookmarks.onRemoved, ext.bookmarks.onChildrenReordered]) event.addListener(chromeChanged);
ext.bookmarks.onImportBegan.addListener(() => { importingChrome = true; });
ext.bookmarks.onImportEnded.addListener(() => { importingChrome = false; chromeChanged(); });

}
