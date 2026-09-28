import {ext} from './browser.mjs';
export async function setTheme(value) {
  if (!['dark','light','system'].includes(value)) return;
  await ext.storage.local.set({uiTheme:value});
  apply(value);
}
function apply(value='dark') {
  document.documentElement.dataset.theme=value;
  const select=document.getElementById('theme');
  if(select)select.value=value;
}
ext.storage.local.get('uiTheme').then(data=>apply(data.uiTheme || 'dark')).catch(()=>apply());
ext.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.uiTheme)apply(changes.uiTheme.newValue || 'dark');});
