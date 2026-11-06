const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rp = (n) => 'Rp' + Math.round(n).toLocaleString('id-ID');
const num = (n) => Number(n).toLocaleString('id-ID', { maximumFractionDigits: 2 });
const tgl = (s) => new Date(s.replace(' ', 'T') + 'Z').toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
const LABEL = { aman: 'Aman', menipis: 'Menipis', habis: 'Habis', awal: 'Stok awal', masuk: 'Masuk', keluar: 'Keluar', koreksi: 'Koreksi', hapus: 'Dihapus' };
const badge = (k) => `<span class="badge ${k}">${LABEL[k]}</span>`;
let items = [], user = null, view = 'dashboard';

function toast(msg, err) {
  const d = document.createElement('div'); d.textContent = msg; if (err) d.className = 'err';
  $('#toast').append(d); setTimeout(() => d.remove(), 3200);
}
async function api(path, method = 'GET', body) {
  const r = await fetch('/api' + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && path !== '/login') { showLogin(); throw new Error(d.error); }
  if (!r.ok) throw new Error(d.error || 'Terjadi kesalahan');
  return d;
}
function showLogin() { $('#app').hidden = true; $('#login').hidden = false; }
function showApp() { $('#login').hidden = true; $('#app').hidden = false; $('#userName').textContent = user.name; go(view); }

$('#loginForm').onsubmit = async (e) => {
  e.preventDefault(); $('#loginErr').textContent = '';
  const f = new FormData(e.target);
  try { user = (await api('/login', 'POST', { username: f.get('username'), password: f.get('password') })).user; e.target.reset(); showApp(); }
  catch (err) { $('#loginErr').textContent = err.message; }
};
$('#logout').onclick = async () => { await api('/logout', 'POST'); user = null; showLogin(); };
$('#nav').onclick = (e) => e.target.dataset.v && go(e.target.dataset.v);

async function go(v) {
  view = v;
  document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('active', b.dataset.v === v));
  try { await ({ dashboard: vDashboard, bahan: vBahan, riwayat: vRiwayat, laporan: vLaporan })[v](); }
  catch (e) { if (e.message) toast(e.message, true); }
}

async function vDashboard() {
  const d = await api('/dashboard'), s = d.summary;
  const banner = s.habis ? `<div class="banner bad">⚠️ ${s.habis} bahan habis dan ${s.menipis} bahan menipis. Segera lakukan pembelian.</div>`
    : s.menipis ? `<div class="banner warn">⚠️ ${s.menipis} bahan stoknya menipis.</div>` : `<div class="banner ok">✅ Semua stok dalam kondisi aman.</div>`;
  $('#view').innerHTML = `<div class="head"><h2>Dashboard</h2></div>${banner}
  <div class="grid">
    <div class="card stat"><div class="n">${s.total}</div><div class="l">Total jenis bahan</div></div>
    <div class="card stat ok"><div class="n">${s.aman}</div><div class="l">Stok aman</div></div>
    <div class="card stat warn"><div class="n">${s.menipis}</div><div class="l">Stok menipis</div></div>
    <div class="card stat bad"><div class="n">${s.habis}</div><div class="l">Stok habis</div></div>
    <div class="card stat"><div class="n">${rp(s.nilai)}</div><div class="l">Nilai persediaan</div></div>
  </div>
  <div class="two">
    <div class="card"><h3>Peringatan stok</h3>${d.alerts.length ? d.alerts.map((a) => `<div class="alert"><div><b>${esc(a.name)}</b><br><span class="muted">${num(a.stock)} / min. ${num(a.min_stock)} ${esc(a.unit)}</span></div>${badge(a.status)}</div>`).join('') : '<div class="empty">Tidak ada peringatan</div>'}</div>
    <div class="card"><h3>Aktivitas terbaru</h3>${d.recent.map((h) => `<div class="alert"><div><b>${esc(h.item_name)}</b><br><span class="muted">${tgl(h.created_at)} · ${esc(h.user_name)}</span></div><div>${badge(h.type)}</div></div>`).join('')}</div>
  </div>`;
}

async function vBahan() {
  items = (await api('/items')).items;
  $('#view').innerHTML = `<div class="head"><h2>Data Bahan</h2><button class="btn primary" id="add">+ Tambah bahan</button></div>
  <div class="toolbar"><input id="q" placeholder="Cari bahan..."><select id="st"><option value="">Semua status</option><option value="aman">Aman</option><option value="menipis">Menipis</option><option value="habis">Habis</option></select></div>
  <div class="table-wrap"><table><thead><tr><th>Bahan</th><th>Kategori</th><th class="r">Stok</th><th class="r">Min.</th><th class="r">Harga/satuan</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="tb"></tbody></table></div>`;
  const draw = () => {
    const q = $('#q').value.toLowerCase(), st = $('#st').value;
    const list = items.filter((i) => i.name.toLowerCase().includes(q) && (!st || i.status === st));
    $('#tb').innerHTML = list.length ? list.map((i) => `<tr><td><b>${esc(i.name)}</b></td><td>${esc(i.category)}</td><td class="r">${num(i.stock)} ${esc(i.unit)}</td><td class="r">${num(i.min_stock)}</td><td class="r">${rp(i.price)}</td><td>${badge(i.status)}</td>
      <td class="actions"><button class="btn small primary" data-a="stok" data-id="${i.id}">Update stok</button><button class="btn small" data-a="edit" data-id="${i.id}">Edit</button><button class="btn small danger" data-a="hapus" data-id="${i.id}">Hapus</button></td></tr>`).join('')
      : '<tr><td colspan="7" class="empty">Tidak ada data</td></tr>';
  };
  draw(); $('#q').oninput = draw; $('#st').onchange = draw;
  $('#add').onclick = () => itemDialog();
  $('#tb').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const it = items.find((i) => i.id == b.dataset.id);
    if (b.dataset.a === 'edit') itemDialog(it);
    if (b.dataset.a === 'stok') stockDialog(it);
    if (b.dataset.a === 'hapus') confirmDelete(it);
  };
}

function dialog(html, onSubmit) {
  const d = $('#dlg'); d.innerHTML = html;
  d.querySelector('[data-close]').onclick = () => d.close();
  d.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    try { await onSubmit(Object.fromEntries(new FormData(e.target))); d.close(); }
    catch (err) { toast(err.message, true); }
  };
  d.showModal();
}
const foot = (ok) => `<div class="foot"><button type="button" class="btn" data-close>Batal</button><button class="btn primary">${ok}</button></div>`;

function itemDialog(it) {
  const cats = ['Bahan Pokok', 'Protein', 'Bumbu', 'Minuman', 'Lainnya'];
  dialog(`<form><h3>${it ? 'Edit' : 'Tambah'} bahan</h3>
    <label>Nama bahan<input name="name" required maxlength="80" value="${esc(it?.name)}"></label>
    <div class="row"><label>Kategori<select name="category">${cats.map((c) => `<option ${it?.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
    <label>Satuan<input name="unit" required maxlength="20" placeholder="kg, liter, pcs" value="${esc(it?.unit)}"></label></div>
    <div class="row">${it ? '' : '<label>Stok awal<input name="stock" type="number" min="0" step="any" value="0" required></label>'}
    <label>Stok minimum<input name="min_stock" type="number" min="0" step="any" value="${it?.min_stock ?? 0}" required></label></div>
    <label>Harga per satuan (Rp)<input name="price" type="number" min="0" step="any" value="${it?.price ?? 0}" required></label>${foot('Simpan')}</form>`,
    async (b) => { await api(it ? `/items/${it.id}` : '/items', it ? 'PUT' : 'POST', b); toast('Data bahan disimpan'); go('bahan'); });
}
function stockDialog(it) {
  dialog(`<form><h3>Update stok: ${esc(it.name)}</h3><p class="muted" style="margin:0">Stok saat ini: <b>${num(it.stock)} ${esc(it.unit)}</b></p>
    <label>Jenis pembaruan<select name="type"><option value="masuk">Stok masuk (tambah)</option><option value="keluar">Stok keluar (kurangi)</option><option value="koreksi">Koreksi (atur stok menjadi)</option></select></label>
    <label>Jumlah (${esc(it.unit)})<input name="qty" type="number" min="0" step="any" required></label>
    <label>Catatan<input name="note" maxlength="200" placeholder="Contoh: belanja pasar, stok opname"></label>${foot('Simpan')}</form>`,
    async (b) => { await api(`/items/${it.id}/stock`, 'POST', b); toast('Stok diperbarui'); go('bahan'); });
}
function confirmDelete(it) {
  dialog(`<form><h3>Hapus bahan?</h3><p>Bahan <b>${esc(it.name)}</b> akan dihapus. Riwayat stoknya tetap tersimpan.</p>${foot('Ya, hapus')}</form>`,
    async () => { await api(`/items/${it.id}`, 'DELETE'); toast('Bahan dihapus'); go('bahan'); });
}

async function vRiwayat() {
  $('#view').innerHTML = `<div class="head"><h2>Riwayat Perubahan Stok</h2></div>
  <div class="toolbar"><input id="q" placeholder="Cari nama bahan..."><select id="ty"><option value="">Semua jenis</option>${['awal', 'masuk', 'keluar', 'koreksi', 'hapus'].map((t) => `<option value="${t}">${LABEL[t]}</option>`).join('')}</select></div>
  <div class="table-wrap"><table><thead><tr><th>Waktu</th><th>Bahan</th><th>Jenis</th><th class="r">Jumlah</th><th class="r">Sebelum</th><th class="r">Sesudah</th><th>Catatan</th><th>Oleh</th></tr></thead><tbody id="tb"></tbody></table></div>`;
  const load = async () => {
    const p = new URLSearchParams({ q: $('#q').value, type: $('#ty').value });
    const h = (await api('/history?' + p)).history;
    $('#tb').innerHTML = h.length ? h.map((x) => `<tr><td>${tgl(x.created_at)}</td><td><b>${esc(x.item_name)}</b></td><td>${badge(x.type)}</td><td class="r">${num(x.qty)} ${esc(x.unit)}</td><td class="r">${num(x.stock_before)}</td><td class="r">${num(x.stock_after)}</td><td>${esc(x.note)}</td><td>${esc(x.user_name)}</td></tr>`).join('') : '<tr><td colspan="8" class="empty">Belum ada riwayat</td></tr>';
  };
  let t; $('#q').oninput = () => { clearTimeout(t); t = setTimeout(load, 250); }; $('#ty').onchange = load; load();
}

async function vLaporan() {
  const r = await api('/report');
  $('#view').innerHTML = `<div class="head"><div><h2>Laporan Persediaan</h2><span class="muted">Per ${new Date(r.generated_at).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}</span></div>
    <div class="no-print"><button class="btn" id="csv">Unduh CSV</button> <button class="btn primary" onclick="print()">Cetak / PDF</button></div></div>
  <div class="grid">${r.kategori.map((k) => `<div class="card stat"><div class="n">${rp(k.nilai)}</div><div class="l">${esc(k.category)} · ${k.jumlah} bahan</div></div>`).join('')}<div class="card stat ok"><div class="n">${rp(r.total_nilai)}</div><div class="l">Total nilai persediaan</div></div></div>
  <div class="table-wrap"><table><thead><tr><th>Bahan</th><th>Kategori</th><th class="r">Stok</th><th class="r">Min.</th><th class="r">Harga</th><th class="r">Nilai</th><th>Status</th></tr></thead><tbody>
  ${r.items.map((i) => `<tr><td><b>${esc(i.name)}</b></td><td>${esc(i.category)}</td><td class="r">${num(i.stock)} ${esc(i.unit)}</td><td class="r">${num(i.min_stock)}</td><td class="r">${rp(i.price)}</td><td class="r">${rp(i.nilai)}</td><td>${badge(i.status)}</td></tr>`).join('')}
  </tbody></table></div>`;
  $('#csv').onclick = () => {
    const rows = [['Bahan', 'Kategori', 'Satuan', 'Stok', 'Stok minimum', 'Harga', 'Nilai', 'Status'], ...r.items.map((i) => [i.name, i.category, i.unit, i.stock, i.min_stock, i.price, i.nilai, LABEL[i.status]])];
    const csv = rows.map((x) => x.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv' }));
    a.download = 'laporan-persediaan.csv'; a.click();
  };
}

(async () => { try { user = (await api('/me')).user; showApp(); } catch { showLogin(); } })();
