export function serverAddress(input) {
  let url;
  try { url = new URL(String(input).trim()); }
  catch { throw Error('Bitte eine vollständige Serveradresse mit http:// oder https:// eingeben.'); }
  if (!['http:','https:'].includes(url.protocol) || !url.hostname || url.username || url.password || url.search || url.hash)
    throw Error('Die Serveradresse muss HTTP(S) verwenden und darf keine Zugangsdaten, Suchparameter oder Fragmente enthalten.');
  return url.href.replace(/\/+$/, '');
}
export function serverOrigin(input) {
  const url = new URL(serverAddress(input));
  // Extension match patterns grant a host/scheme; the configured port remains
  // part of the actual request URL, not the host permission.
  return `${url.protocol}//${url.hostname}/*`;
}
