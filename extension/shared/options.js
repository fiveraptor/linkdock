import {serverAddress, serverOrigin} from './server-address.mjs';
import {ext, nativeSync} from './browser.mjs';
import {setTheme} from './theme.mjs';
import {send,el} from './ui.mjs';
let state;
el('build-label').textContent=`${nativeSync?'CHROME':'SAFARI'} · ${ext.runtime.getManifest().version}`;
el('chrome-card').hidden=!nativeSync;
if(!nativeSync)el('platform-description').textContent='Safari zeigt die gemeinsame Sammlung im LinkDock-Menü. Die eingebauten Safari-Lesezeichen bleiben unverändert. Links verwenden hier zunächst neutrale Websymbole.';
function render(){
  if(!state)return;
  el('sync-state').textContent=`${state.items.filter(item=>item.type==='bookmark').length} Favoriten · ${state.items.filter(item=>item.type==='folder').length} Ordner${state.lastSync ? ` · Letzter Abgleich: ${new Date(state.lastSync).toLocaleString('de-CH')}` : ''}${state.pending?' · Lokale Änderungen ausstehend':''}`;
  el('sync-message').textContent=state.error;
  el('conflicts').hidden=!state.conflicts.length;
  el('sync').disabled=!state.configured;
  const native=state.nativeStatus || {};
  el('chrome-status').textContent=native.paused?'Chrome-Abgleich angehalten – bitte Wiederaufnahme prüfen.':native.linked ? `Gesamte Leiste verbunden.${native.skipped ? ` ${native.skipped} spezielle oder verwaltete Einträge bleiben nur in Chrome.` : ''}`:'Die Leiste wird beim nächsten erfolgreichen Abgleich verbunden.';
  el('chrome-recovery').hidden=!native.paused;
}
el('server').oninput=el('server').onchange=()=>{el('transport').textContent=el('server').value.startsWith('http:')?'Lokaler Test: Der Zugangsschlüssel wird über HTTP unverschlüsselt übertragen.':'Verschlüsselte Verbindung über deinen Reverse-Proxy.';};
el('settings-form').onsubmit=async event=>{
  event.preventDefault();el('connect').disabled=true;
  const message=el('connection-message');message.className='message';message.textContent='Verbindung wird geprüft …';
  try{
    const url=serverAddress(el('server').value);
    // Request synchronously from this click handler to retain the user gesture.
    const granted=await ext.permissions.request({origins:[serverOrigin(url)]});
    if(!granted)throw Error('Der Zugriff auf den Server wurde nicht erlaubt.');
    state=await send('configure',{url,token:el('token').value});
    el('server').value=url;
    el('token').value='';message.textContent=state.error || 'Verbunden. Du kannst jetzt das LinkDock-Menü öffnen.';
    if(!state.error)message.classList.add('success');render();
  }catch(error){message.textContent=error.message;}finally{el('connect').disabled=false;}
};
el('sync').onclick=async()=>{
  el('sync').disabled=true;
  try{state=await send('sync');render();}catch(error){el('sync-message').textContent=error.message;}finally{el('sync').disabled=!state?.configured;}
};
el('export').onclick=async()=>{
  try{
    state=await send('state');
    const blob=new Blob([JSON.stringify({format:'linkdock-export-v1',exportedAt:new Date().toISOString(),items:state.items},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`linkdock-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
  }catch(error){el('sync-message').textContent=error.message;}
};
async function resolve(choice){
  const question=choice==='local'?'Die gesamte Serversammlung durch die lokale Sammlung ersetzen? Änderungen, die nur auf dem Server existieren, gehen dabei verloren.':'Die gesamte lokale Sammlung durch den Serverstand ersetzen? Noch nicht übertragene lokale Änderungen gehen dabei verloren.';
  if(!confirm(question))return;
  el('use-local').disabled=el('use-remote').disabled=true;
  try{state=await send('resolve',{choice});render();}catch(error){el('sync-message').textContent=error.message;}finally{el('use-local').disabled=el('use-remote').disabled=false;}
}
el('use-local').onclick=()=>resolve('local');el('use-remote').onclick=()=>resolve('remote');
ext.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.state)void send('state').then(data=>{state=data;render();}).catch(error=>{el('sync-message').textContent=error.message;});});
void send('state').then(data=>{state=data;if(state.url)el('server').value=state.url;el('server').onchange();render();}).catch(error=>{el('sync-message').textContent=error.message;});

el('export-backup').onclick=async()=>{
  try{
    const data=await send('backup');
    if(!data.initialBackup)throw Error('Noch keine Chrome-Sicherung vorhanden.');
    const url=URL.createObjectURL(new Blob([JSON.stringify({format:'linkdock-chrome-backup-v1',...data},null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='linkdock-chrome-sicherung.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
  }catch(error){el('chrome-message').textContent=error.message;}
};
async function recoverChrome(choice){
  if(!confirm(choice==='chrome'?'Die aktuelle Chrome-Leiste als lokale Sammlung übernehmen und mit dem Server abgleichen? Nur in LinkDock vorhandene lokale Änderungen können verworfen werden.':'Die LinkDock-Sammlung in die Chrome-Leiste übernehmen? Nur in Chrome vorhandene Änderungen können verworfen werden.'))return;
  el('use-chrome').disabled=el('continue-linkdock').disabled=true;
  try{state=await send('recoverChrome',{choice});render();el('chrome-message').textContent=state.error || 'Wiederaufnahme abgeschlossen.';}catch(error){el('chrome-message').textContent=error.message;}finally{el('use-chrome').disabled=el('continue-linkdock').disabled=false;}
}
el('use-chrome').onclick=()=>recoverChrome('chrome');
el('continue-linkdock').onclick=()=>recoverChrome('linkdock');

el('export-original').onclick=async()=>{
  try{
    const {initialBackup}=await send('backup');
    if(!initialBackup)throw Error('Noch keine Sicherung vorhanden.');
    const snapshot=initialBackup.chrome;
    const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
    const children=parent=>snapshot.flat.filter(item=>item.parentId===parent).sort((a,b)=>a.index-b.index).map(item=>item.url===null?`<DT><H3>${escape(item.title)}</H3>\n<DL><p>\n${children(item.id)}</DL><p>\n`:`<DT><A HREF="${escape(item.url)}">${escape(item.title)}</A>\n`).join('');
    const html='<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>LinkDock – ursprüngliche Chrome-Leiste</TITLE>\n<H1>LinkDock-Sicherung</H1>\n<DL><p>\n'+children(snapshot.barId)+'</DL><p>\n';
    const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download='linkdock-urspruengliche-leiste.html';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
  }catch(error){el('chrome-message').textContent=error.message;}
};

el('theme').onchange=()=>setTheme(el('theme').value).catch(error=>{el('connection-message').textContent=error.message;});
