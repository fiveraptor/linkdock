'use strict';
const http = require('node:http');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execute = promisify(execFile);
const database = process.env.LINKDOCK_DB || '/var/lib/linkdock/linkdock.sqlite';
const token = process.env.LINKDOCK_TOKEN || '';
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
const maxBytes = 1024 * 1024;
if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('LINKDOCK_TOKEN must contain 64 random hexadecimal characters');
const expected = crypto.createHash('sha256').update(`Bearer ${token}`).digest();
const sqlText = value => `CAST(X'${Buffer.from(value, 'utf8').toString('hex')}' AS TEXT)`;
async function sql(statement) {
  const result = await execute(process.env.SQLITE_BIN || 'sqlite3',
    ['-batch', '-bail', '-json', '-cmd', '.timeout 5000', database, statement],
    { maxBuffer: 8 * maxBytes, timeout: 10000 });
  return result.stdout.trim() ? JSON.parse(result.stdout) : [];
}
function reply(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'" });
  res.end(JSON.stringify(body));
}
function reject(status, message) { return Object.assign(new Error(message), { status }); }
async function readBody(req) {
  let length = 0;
  const chunks = [];
  for await (const chunk of req) {
    length += chunk.length;
    if (length > maxBytes) throw reject(413, 'Request too large');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw reject(400, 'Invalid JSON'); }
}
function validate(body) {
  if (!body || !Number.isSafeInteger(body.revision) || body.revision < 0 ||
      !Array.isArray(body.items) || body.items.length > 5000) throw reject(400, 'Invalid snapshot');
  const byId = new Map();
  const items = body.items.map(item => {
    if (!item || typeof item.id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(item.id) ||
        byId.has(item.id) || !['bookmark', 'folder'].includes(item.type) ||
        typeof item.title !== 'string' || item.title.length > 1000 ||
        !(item.parentId === null || typeof item.parentId === 'string') ||
        !Number.isSafeInteger(item.position) || item.position < 0) throw reject(400, 'Invalid item');
    let url = null;
    if (item.type === 'bookmark') {
      if (typeof item.url !== 'string' || item.url.length > 8192) throw reject(400, 'Invalid URL');
      try { url = new URL(item.url); } catch { throw reject(400, 'Invalid URL'); }
      if (!['http:', 'https:'].includes(url.protocol)) throw reject(400, 'Only HTTP(S) bookmarks are supported');
      url = item.url;
    }
    const clean = { id: item.id, type: item.type, title: item.title,
      parentId: item.parentId, position: item.position, url };
    byId.set(clean.id, clean);
    return clean;
  });
  for (const item of items) {
    const seen = new Set([item.id]);
    let parentId = item.parentId;
    while (parentId !== null) {
      const parent = byId.get(parentId);
      if (!parent || parent.type !== 'folder' || seen.has(parentId)) throw reject(400, 'Invalid folder hierarchy');
      seen.add(parentId);
      parentId = parent.parentId;
    }
  }
  return items;
}
async function main() {
  await sql(`PRAGMA journal_mode=WAL;`);
  await sql(`CREATE TABLE IF NOT EXISTS snapshot (
    id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL,
    document TEXT NOT NULL, updated_at TEXT NOT NULL);
    INSERT OR IGNORE INTO snapshot VALUES (1, 0, '[]', strftime('%Y-%m-%dT%H:%M:%fZ','now'));`);
  const server = http.createServer(async (req, res) => {
    try {
      const path = req.url;
      if (req.method === 'GET' && path === '/health') {
        await sql('SELECT id FROM snapshot WHERE id=1;');
        return reply(res, 200, { ok: true, service: 'LinkDock', version: '0.1.0' });
      }
      const actual = crypto.createHash('sha256').update(req.headers.authorization || '').digest();
      if (!crypto.timingSafeEqual(actual, expected)) return reply(res, 401, { error: 'Unauthorized' });
      if (path !== '/api/snapshot') return reply(res, 404, { error: 'Not found' });
      if (req.method === 'GET') {
        const [row] = await sql('SELECT revision, document, updated_at FROM snapshot WHERE id=1;');
        return reply(res, 200, { revision: row.revision, items: JSON.parse(row.document), updatedAt: row.updated_at });
      }
      if (req.method !== 'PUT') return reply(res, 405, { error: 'Use GET or PUT' });
      if ((req.headers['content-type'] || '').split(';')[0].trim() !== 'application/json')
        return reply(res, 415, { error: 'Use application/json' });
      const body = await readBody(req);
      const items = validate(body);
      // Compare-and-swap is a single atomic SQLite statement, including concurrent requests.
      const rows = await sql(`UPDATE snapshot SET revision=revision+1,
        document=${sqlText(JSON.stringify(items))}, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
        WHERE id=1 AND revision=${body.revision} RETURNING revision, updated_at;`);
      if (!rows.length) return reply(res, 409, { error: 'Revision conflict; fetch latest snapshot and merge before retrying' });
      return reply(res, 200, { revision: rows[0].revision, updatedAt: rows[0].updated_at });
    } catch (error) {
      if (!error.status) console.error('Request failed:', error.code || error.name);
      if (!res.destroyed) reply(res, error.status || 500, { error: error.status ? error.message : 'Internal server error' });
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.timeout = 20000;
  server.listen(port, host, () => console.log(`LinkDock listening on ${host}:${server.address().port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  });
}
main().catch(error => { console.error('Startup failed:', error.message); process.exit(1); });
