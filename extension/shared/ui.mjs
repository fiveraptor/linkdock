import {ext} from './browser.mjs';
export async function send(type, extra = {}) {
  const result = await ext.runtime.sendMessage({type, ...extra});
  if (!result?.ok) throw Error(result?.error || 'LinkDock antwortet nicht. Bitte Erweiterung neu laden.');
  return result.data;
}
export const el = id => document.getElementById(id);
export function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}
