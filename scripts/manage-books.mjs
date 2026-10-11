import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {build, root, safeFile} from './build-content.mjs';
const coverFiles = new Map();
function registerCover(id, base, relative) {
  if (!relative) return null;
  try {
    const file = safeFile(base, relative);
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(path.extname(file).toLowerCase())) return null;
    coverFiles.set(id, file);
    return `/api/cover?id=${encodeURIComponent(id)}`;
  } catch { return null; }
}

function jsonFiles(directory) {
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    if (entry.isSymbolicLink()) return [];
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? jsonFiles(file) : file.endsWith('.json') ? [file] : [];
  });
}
function snapshot() {
  coverFiles.clear();
  let validation;
  try { const result = build(root, {write: false}); validation = {ok: true, published: result.published}; }
  catch (error) { validation = {ok: false, message: error.message}; }
  const editions = [];
  for (const file of jsonFiles(path.join(root, 'content'))) {
    const edition = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (edition.kind !== 'edition') continue;
    const base = path.dirname(file);
    editions.push({id: edition.id, title: edition.title, locale: edition.locale, revision: edition.revision,
      status: edition.status, rights: edition.rights.status, offline: edition.rights.offlineAllowed,
      period: edition.publicationPeriod, description: edition.description || '', file: path.relative(root, file),
      cover: registerCover(edition.id, base, edition.cover),
      nodes: edition.nodes.map(node => {
        try { const body = fs.readFileSync(safeFile(base, node.file)); return {...node, bytes: body.length, preview: body.toString('utf8')}; }
        catch (error) { return {...node, error: error.message}; }
      })});
  }
  const assets = path.join(root, '..', 'sabatku-android', 'app', 'src', 'main', 'assets');
  for (const relative of ['church-manual/index.json', 'church-manual/en/index.json']) {
    const indexFile = path.join(assets, relative);
    if (!fs.existsSync(indexFile)) continue;
    const index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
    const book = index.book;
    editions.push({id: book.id, title: book.title, locale: book.locale, revision: book.revision,
      status: 'bundled', rights: book.rightsStatus, offline: true, description: book.description,
      cover: registerCover(book.id, assets, book.coverAssetPath),
      file: `sabatku-android/app/src/main/assets/${relative}`, nodes: index.nodes.map(node => {
        if (!node.contentAssetPath) return {...node, preview: ''};
        try {
          const body = fs.readFileSync(safeFile(assets, node.contentAssetPath));
          if (body.length !== node.bytes || crypto.createHash('sha256').update(body).digest('hex') !== node.sha256) throw Error(`Checksum mismatch: ${node.id}`);
          return {...node, preview: body.toString('utf8')};
        } catch (error) { validation = {ok: false, message: error.message}; return {...node, error: error.message}; }
      })});
  }
  const devotionals = path.join(assets, 'renungan');
  if (fs.existsSync(devotionals)) for (const name of fs.readdirSync(devotionals).filter(name => /^\d{4}\.json$/.test(name))) {
    const year = name.slice(0, 4);
    const readings = JSON.parse(fs.readFileSync(path.join(devotionals, name), 'utf8'));
    const seen = new Set();
    for (const entry of readings) {
      if (seen.has(entry.date) || !entry.title?.trim() || !entry.html?.trim()) validation = {ok: false, message: `Renungan ${year}: bacaan ganda atau kosong (${entry.date})`};
      seen.add(entry.date);
    }
    for (const date = new Date(`${year}-01-01T00:00:00Z`); date.getUTCFullYear() === Number(year); date.setUTCDate(date.getUTCDate() + 1)) {
      if (!seen.has(date.toISOString().slice(0, 10))) validation = {ok: false, message: `Renungan ${year}: tanggal belum tersedia (${date.toISOString().slice(0, 10)})`};
    }
    editions.push({id: `renungan:${year}`, title: `Renungan Harian ${year}`, locale: 'id', revision: 'bundled', status: 'bundled', rights: 'team-provided', offline: true,
      description: '', file: `sabatku-android/app/src/main/assets/renungan/${name}`,
      cover: registerCover(`renungan:${year}`, path.join(assets, '..', 'res'), `drawable-nodpi/renungan_${year}_cover.jpg`),
      nodes: readings.map(entry => ({id: entry.date, title: entry.title, readingDate: entry.date, preview: entry.html}))});
  }
  return {validation, editions: editions.sort((a, b) => a.title.localeCompare(b.title))};
}

const server = http.createServer((request, response) => {
  const host = request.headers.host;
  if (request.method !== 'GET' || host !== '127.0.0.1:4317') { response.writeHead(403); response.end(); return; }
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'");
  try {
    const url = new URL(request.url, 'http://127.0.0.1:4317');
    if (url.pathname === '/api/cover') {
      const file = coverFiles.get(url.searchParams.get('id'));
      if (!file) { response.writeHead(404); response.end(); return; }
      response.setHeader('Content-Type', path.extname(file).toLowerCase() === '.png' ? 'image/png' : path.extname(file).toLowerCase() === '.webp' ? 'image/webp' : 'image/jpeg');
      response.end(fs.readFileSync(file));
    } else if (url.pathname === '/api/books') {
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.end(JSON.stringify(snapshot()));
    } else {
      const assets = {'/': ['manager.html', 'text/html'], '/manager.js': ['manager.js', 'text/javascript'], '/manager.css': ['manager.css', 'text/css']};
      const asset = assets[url.pathname];
      if (!asset) { response.writeHead(404); response.end(); return; }
      response.setHeader('Content-Type', `${asset[1]}; charset=utf-8`);
      response.end(fs.readFileSync(path.join(root, 'scripts', 'manager', asset[0])));
    }
  } catch (error) { response.writeHead(500, {'Content-Type': 'application/json'}); response.end(JSON.stringify({error: error.message})); }
});
server.listen(4317, '127.0.0.1', () => console.log('Pengelola buku: http://127.0.0.1:4317'));
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
