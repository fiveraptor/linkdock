import {ext, nativeFavicons} from './browser.mjs';
import './theme.mjs';
import {ordered, descendants} from './core.mjs';
import {send, el, node} from './ui.mjs';
let state, folder = null, editing = null, deleting = null;
function report(error) { el('message').textContent = error.message; }
function openSettings() { void ext.runtime.openOptionsPage(); }
el('settings').onclick = openSettings;
el('connect').onclick = openSettings;
function action(label, description, handler) {
  const button = node('button',label);
  button.title = description;
  button.setAttribute('aria-label',description);
  button.onclick = () => Promise.resolve().then(handler).catch(report);
  return button;
}
function folderPath(id) {
  const labels = [];
  let item = state.items.find(item => item.id === id);
  while (item) { labels.unshift(item.title); item = state.items.find(other => other.id === item.parentId); }
  return labels.join(' / ');
}
function render() {
  if (!state) return;
  if (folder && !state.items.some(item => item.id === folder && item.type === 'folder')) folder = null;
  el('welcome').hidden = state.configured;
  for (const id of ['save-page','new-link','new-folder','add','sync']) el(id).disabled = !state.configured;
  el('status').textContent = !state.configured ? 'Noch nicht verbunden' : state.conflicts.length ? 'Konflikt prüfen' : state.error ?
    (state.pending ? 'Lokal gespeichert · Abgleich offen' : 'Verbindung prüfen') : state.pending ? 'Abgleich ausstehend' :
    state.lastSync ? `Abgeglichen · ${new Date(state.lastSync).toLocaleTimeString('de-CH',{hour:'2-digit',minute:'2-digit'})}` : 'Bereit';
  el('status-dot').className = `dot ${state.error || state.pending ? 'warn' : state.lastSync ? 'ok' : ''}`;
  el('message').textContent = state.error || '';
  const crumbs = el('breadcrumbs'); crumbs.replaceChildren();
  crumbs.append(action('Alle Favoriten','Alle Favoriten',() => { folder=null; render(); }));
  const path = [];
  let current = state.items.find(item => item.id === folder);
  while (current) { path.unshift(current); current = state.items.find(item => item.id === current.parentId); }
  for (const item of path) crumbs.append(node('span','/'),action(item.title,item.title,() => { folder=item.id; render(); }));
  const query = el('search').value.trim().toLocaleLowerCase();
  const items = ordered(state.items.filter(item => query ? `${item.title} ${item.url || ''}`.toLocaleLowerCase().includes(query) : item.parentId === folder));
  const list = el('list'); list.replaceChildren();
  if (!items.length) {
    const empty=node('div',undefined,'empty');
    empty.append(node('strong',query ? 'Nichts gefunden.' : 'Noch keine Favoriten.'),node('span',query ? 'Versuche einen anderen Suchbegriff.' : 'Speichere eine Seite oder lege einen Ordner an.'));
    list.append(empty);
  }
  for (const item of items) {
    const row = node('div',undefined,`row ${item.type==='folder'?'folder-row':'link-row'}`);
    const entry = node(item.type === 'folder' ? 'button' : 'a',undefined,'entry');
    if (item.type === 'folder') entry.onclick = () => {folder=item.id;el('search').value='';render();};
    else {entry.href=item.url;entry.target='_blank';entry.rel='noopener noreferrer';}
    entry.title = item.type === 'folder' ? folderPath(item.id) : item.url;
    const label=node('span',undefined,'entry-label');
    label.append(node('strong',item.title),node('small',item.type === 'folder' ? `Ordner · ${state.items.filter(other=>other.parentId===item.id).length} Einträge` : new URL(item.url).hostname));
    const symbol=node('span',undefined,'symbol');
    symbol.append(icon(item.type==='folder'?'folder':'globe'));
    if(item.type==='bookmark' && nativeFavicons){
      const image=document.createElement('img');image.alt='';image.width=18;image.height=18;image.loading='lazy';
      const url=new URL(ext.runtime.getURL('_favicon/'));url.searchParams.set('pageUrl',item.url);url.searchParams.set('size','32');
      image.onload=()=>symbol.replaceChildren(image);
      image.onerror=()=>{image.remove();};
      image.src=url.href;
    }
    entry.append(symbol,label);
    if(item.type==='folder')entry.append(node('span','›','folder-arrow'));
    const actions=action('⋯',`${item.title}: Aktionen`,()=>{
      const menu=el('item-menu');menu.replaceChildren();
      function option(label,handler,danger=false){
        const button=action(label,label,()=>{menu.hidePopover();return handler();});
        button.setAttribute('role','menuitem');if(danger)button.className='danger';menu.append(button);
      }
      option('Bearbeiten',()=>openEditor(item));
      if(!query){
        option('Nach oben',()=>edit({kind:'move',id:item.id,direction:-1}));
        option('Nach unten',()=>edit({kind:'move',id:item.id,direction:1}));
      }
      menu.append(node('hr'));
      option('Löschen',()=>openDelete(item),true);
      showMenu(menu,actions);
    });
    actions.className='more';actions.setAttribute('aria-haspopup','menu');
    row.append(entry,actions);list.append(row);
  }
}
async function edit(command) { state=await send('edit',{command});render(); }
function openEditor(item) {
  for(const menu of document.querySelectorAll(':popover-open'))menu.hidePopover();
  editing=item;
  el('editor-title').textContent = item.id ? 'Eintrag bearbeiten' : item.type==='folder' ? 'Neuer Ordner' : 'Favorit speichern';
  el('item-title').value=item.title || '';
  el('item-url').value=item.url || '';
  el('url-field').hidden=item.type==='folder';
  el('item-url').required=item.type==='bookmark';
  const select=el('item-parent');select.replaceChildren(new Option('Alle Favoriten',''));
  const excluded=item.id ? descendants(state.items,item.id) : new Set();
  for (const parent of state.items.filter(other=>other.type==='folder'&&!excluded.has(other.id)).sort((a,b)=>folderPath(a.id).localeCompare(folderPath(b.id)))) select.add(new Option(folderPath(parent.id),parent.id));
  select.value=item.parentId || '';
  el('editor-error').textContent='';
  el('editor').showModal();el('item-title').focus();
}
el('new-folder').onclick=()=>openEditor({type:'folder',parentId:folder});
el('new-link').onclick=()=>openEditor({type:'bookmark',parentId:folder});
el('save-page').onclick=async()=>{
  try {
    const [tab]=await ext.tabs.query({active:true,currentWindow:true});
    if (!tab?.url || !/^https?:\/\//.test(tab.url)) throw Error('Diese Seite lässt sich nicht speichern. Öffne eine normale Webseite.');
    openEditor({type:'bookmark',title:tab.title || tab.url,url:tab.url,parentId:folder});
  } catch(error){report(error);}
};
el('cancel').onclick=()=>el('editor').close();
el('edit-form').onsubmit=async event=>{
  event.preventDefault();
  const button=event.submitter;button.disabled=true;
  try {
    await edit({kind:'save',item:{...editing,title:el('item-title').value,url:el('item-url').value.trim(),parentId:el('item-parent').value || null}});
    el('editor').close();
  } catch(error){el('editor-error').textContent=error.message;}
  finally{button.disabled=false;}
};
el('search').oninput=render;
async function sync(){el('sync').disabled=true;try{state=await send('sync');render();}catch(error){report(error);}finally{el('sync').disabled=!state?.configured;}}
el('sync').onclick=sync;
ext.storage.onChanged.addListener((changes,area)=>{
  if(area==='local'&&changes.state) void send('state').then(data=>{state=data;render();}).catch(report);
});
void send('state').then(data=>{state=data;render();if(state.configured)void sync();}).catch(report);

function icon(kind){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
  svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.7');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');
  const paths=kind==='folder'?['M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z']:['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z','M3 12h18M12 3c4 5 4 13 0 18-4-5-4-13 0-18Z'];
  for(const d of paths){const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',d);if(kind==='folder'){path.setAttribute('fill','currentColor');path.setAttribute('fill-opacity','.14');}svg.append(path);}
  return svg;
}
function showMenu(menu,anchor){
  menu.showPopover();
  const rect=anchor.getBoundingClientRect();
  menu.style.left=`${Math.max(8,Math.min(rect.right-menu.offsetWidth,document.documentElement.clientWidth-menu.offsetWidth-8))}px`;
  menu.style.top=`${Math.max(8,Math.min(rect.bottom+4,document.documentElement.clientHeight-menu.offsetHeight-8))}px`;
  menu.querySelector('button')?.focus();
  menu.onkeydown=event=>{
    const buttons=[...menu.querySelectorAll('button:not(:disabled)')];
    if(event.key==='Escape'){menu.hidePopover();anchor.focus();event.preventDefault();}
    else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
      event.preventDefault();let next=buttons.indexOf(document.activeElement)+(event.key==='ArrowUp'?-1:1);
      if(event.key==='Home')next=0;if(event.key==='End')next=buttons.length-1;
      buttons[(next+buttons.length)%buttons.length]?.focus();
    }
  };
}
el('add').onclick=()=>showMenu(el('add-menu'),el('add'));

function openDelete(item){
  for(const menu of document.querySelectorAll(':popover-open'))menu.hidePopover();
  deleting=item.id;
  const count=descendants(state.items,item.id).size;
  el('delete-description').textContent=`„${item.title}“${count>1?` mit ${count-1} enthaltenen Einträgen`:''} löschen? Die Löschung wird auf deine anderen Geräte übertragen.`;
  el('delete-title').textContent=item.type==='folder'?'Ordner löschen':'Favorit löschen';
  el('delete-error').textContent='';
  el('delete-confirm').disabled=false;
  el('delete-dialog').showModal();
  el('delete-cancel').focus();
}
el('delete-cancel').onclick=()=>el('delete-dialog').close();
el('delete-dialog').addEventListener('close',()=>{deleting=null;});
el('delete-form').onsubmit=async event=>{
  event.preventDefault();
  if(deleting===null || el('delete-confirm').disabled)return;
  const id=deleting;
  el('delete-confirm').disabled=true;
  try{
    await edit({kind:'delete',id});
    el('delete-dialog').close();
  }catch(error){
    el('delete-error').textContent=error.message;
  }finally{el('delete-confirm').disabled=false;}
};
