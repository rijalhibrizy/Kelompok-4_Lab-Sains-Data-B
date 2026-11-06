import { verifyPassword, randomToken } from './crypto.js';

const SESSION_MS = 7 * 24 * 3600 * 1000;
const STATUS = `CASE WHEN stock <= 0 THEN 'habis' WHEN stock <= min_stock THEN 'menipis' ELSE 'aman' END`;
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
const fail = (msg, status = 400) => json({ error: msg }, status);

function cookie(request, name) {
  const m = (request.headers.get('Cookie') || '').match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? m[1] : null;
}
function setCookie(request, value, maxAge) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `rs_session=${value}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}
async function currentUser(request, env) {
  const t = cookie(request, 'rs_session');
  if (!t) return null;
  return env.DB.prepare('SELECT u.id, u.username, u.name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?')
    .bind(t, Date.now()).first();
}
function parseItem(b, partial = false) {
  const name = String(b.name ?? '').trim();
  const unit = String(b.unit ?? '').trim();
  const category = String(b.category ?? 'Lainnya').trim() || 'Lainnya';
  const nums = {};
  for (const k of ['stock', 'min_stock', 'price']) {
    if (partial && k === 'stock') continue;
    const v = Number(b[k] ?? 0);
    if (!Number.isFinite(v) || v < 0) return { error: `Nilai ${k === 'stock' ? 'stok' : k === 'min_stock' ? 'stok minimum' : 'harga'} tidak valid` };
    nums[k] = v;
  }
  if (!name || name.length > 80) return { error: 'Nama bahan wajib diisi (maks. 80 karakter)' };
  if (!unit || unit.length > 20) return { error: 'Satuan wajib diisi (maks. 20 karakter)' };
  return { name, unit, category, ...nums };
}
const addHistory = (db, row) =>
  db.prepare('INSERT INTO stock_history (item_id, item_name, unit, type, qty, stock_before, stock_after, note, user_name) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(row.item_id, row.item_name, row.unit, row.type, row.qty, row.before, row.after, row.note || null, row.user);

async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  const method = request.method;
  const db = env.DB;
  let body = {};
  if (['POST', 'PUT'].includes(method)) body = await request.json().catch(() => ({}));

  if (path === '/api/login' && method === 'POST') {
    const u = await db.prepare('SELECT * FROM users WHERE username = ?').bind(String(body.username || '').trim().toLowerCase()).first();
    if (!u || !(await verifyPassword(String(body.password || ''), u.password_hash))) return fail('Username atau kata sandi salah', 401);
    await db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(Date.now()).run();
    const token = randomToken();
    await db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)').bind(token, u.id, Date.now() + SESSION_MS).run();
    return json({ user: { id: u.id, username: u.username, name: u.name } }, 200, { 'Set-Cookie': setCookie(request, token, SESSION_MS / 1000) });
  }
  if (path === '/api/logout' && method === 'POST') {
    const t = cookie(request, 'rs_session');
    if (t) await db.prepare('DELETE FROM sessions WHERE token = ?').bind(t).run();
    return json({ ok: true }, 200, { 'Set-Cookie': setCookie(request, '', 0) });
  }

  const user = await currentUser(request, env);
  if (!user) return fail('Silakan login terlebih dahulu', 401);
  if (path === '/api/me') return json({ user });

  if (path === '/api/dashboard' && method === 'GET') {
    const s = await db.prepare(`SELECT COUNT(*) total, COALESCE(SUM(stock*price),0) nilai,
      COALESCE(SUM(CASE WHEN stock<=0 THEN 1 ELSE 0 END),0) habis,
      COALESCE(SUM(CASE WHEN stock>0 AND stock<=min_stock THEN 1 ELSE 0 END),0) menipis FROM items`).first();
    const alerts = await db.prepare(`SELECT id, name, unit, stock, min_stock, ${STATUS} status FROM items WHERE stock <= min_stock ORDER BY stock/(CASE WHEN min_stock=0 THEN 1 ELSE min_stock END) ASC, name`).all();
    const recent = await db.prepare('SELECT * FROM stock_history ORDER BY id DESC LIMIT 8').all();
    return json({ summary: { ...s, aman: s.total - s.habis - s.menipis }, alerts: alerts.results, recent: recent.results });
  }

  if (path === '/api/items' && method === 'GET') {
    const r = await db.prepare(`SELECT *, ${STATUS} status FROM items ORDER BY name COLLATE NOCASE`).all();
    return json({ items: r.results });
  }
  if (path === '/api/items' && method === 'POST') {
    const d = parseItem(body);
    if (d.error) return fail(d.error);
    const res = await db.prepare('INSERT INTO items (name, category, unit, stock, min_stock, price) VALUES (?,?,?,?,?,?)')
      .bind(d.name, d.category, d.unit, d.stock, d.min_stock, d.price).run();
    const id = res.meta.last_row_id;
    await addHistory(db, { item_id: id, item_name: d.name, unit: d.unit, type: 'awal', qty: d.stock, before: 0, after: d.stock, note: 'Bahan baru ditambahkan', user: user.name }).run();
    return json({ id }, 201);
  }

  const m = path.match(/^\/api\/items\/(\d+)(\/stock)?$/);
  if (m) {
    const id = Number(m[1]);
    const item = await db.prepare('SELECT * FROM items WHERE id = ?').bind(id).first();
    if (!item) return fail('Bahan tidak ditemukan', 404);

    if (m[2] && method === 'POST') {
      const qty = Number(body.qty);
      const type = body.type;
      if (!['masuk', 'keluar', 'koreksi'].includes(type)) return fail('Jenis pembaruan tidak valid');
      if (!Number.isFinite(qty) || qty < 0 || (type !== 'koreksi' && qty === 0)) return fail('Jumlah tidak valid');
      const after = type === 'masuk' ? item.stock + qty : type === 'keluar' ? item.stock - qty : qty;
      if (after < 0) return fail(`Stok tidak cukup. Stok saat ini ${item.stock} ${item.unit}`);
      await db.batch([
        db.prepare("UPDATE items SET stock = ?, updated_at = datetime('now') WHERE id = ?").bind(after, id),
        addHistory(db, { item_id: id, item_name: item.name, unit: item.unit, type, qty, before: item.stock, after, note: String(body.note || '').slice(0, 200), user: user.name }),
      ]);
      return json({ stock: after });
    }
    if (!m[2] && method === 'PUT') {
      const d = parseItem(body, true);
      if (d.error) return fail(d.error);
      await db.prepare("UPDATE items SET name=?, category=?, unit=?, min_stock=?, price=?, updated_at=datetime('now') WHERE id=?")
        .bind(d.name, d.category, d.unit, d.min_stock, d.price, id).run();
      return json({ ok: true });
    }
    if (!m[2] && method === 'DELETE') {
      await db.batch([
        addHistory(db, { item_id: id, item_name: item.name, unit: item.unit, type: 'hapus', qty: item.stock, before: item.stock, after: 0, note: 'Bahan dihapus', user: user.name }),
        db.prepare('DELETE FROM items WHERE id = ?').bind(id),
      ]);
      return json({ ok: true });
    }
  }

  if (path === '/api/history' && method === 'GET') {
    const q = url.searchParams, where = [], args = [];
    if (q.get('type')) { where.push('type = ?'); args.push(q.get('type')); }
    if (q.get('q')) { where.push('item_name LIKE ?'); args.push(`%${q.get('q')}%`); }
    const r = await db.prepare(`SELECT * FROM stock_history ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT 300`).bind(...args).all();
    return json({ history: r.results });
  }

  if (path === '/api/report' && method === 'GET') {
    const items = (await db.prepare(`SELECT id, name, category, unit, stock, min_stock, price, stock*price nilai, ${STATUS} status FROM items ORDER BY category, name COLLATE NOCASE`).all()).results;
    const kategori = (await db.prepare('SELECT category, COUNT(*) jumlah, SUM(stock*price) nilai FROM items GROUP BY category ORDER BY category').all()).results;
    return json({ generated_at: new Date().toISOString(), items, kategori, total_nilai: items.reduce((a, b) => a + b.nilai, 0) });
  }
  return fail('Endpoint tidak ditemukan', 404);
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (!pathname.startsWith('/api/')) return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 });
    try { return await route(request, env); }
    catch (e) { console.error(e); return fail('Terjadi kesalahan pada server', 500); }
  },
};
