import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { createD1 } from './d1-shim.mjs';

const env = { DB: createD1(['../db/schema.sql', '../db/seed.sql']) };
let cookie = '';
const call = async (method, path, body) => {
  const res = await worker.fetch(new Request('http://localhost' + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body ? JSON.stringify(body) : undefined }), env);
  const sc = res.headers.get('Set-Cookie'); if (sc) cookie = sc.split(';')[0];
  return { status: res.status, data: await res.json() };
};
let n = 0; const ok = (name) => console.log(`✔ ${++n}. ${name}`);

assert.equal((await call('GET', '/api/items')).status, 401); ok('API menolak akses tanpa login');
assert.equal((await call('POST', '/api/login', { username: 'admin', password: 'salah' })).status, 401); ok('Login dengan sandi salah ditolak');
assert.equal((await call('POST', '/api/login', { username: 'admin', password: 'Rameza123' })).status, 200); ok('Login akun demo berhasil');

let r = await call('GET', '/api/dashboard');
assert.equal(r.data.summary.total, 15); assert.equal(r.data.summary.habis, 2); assert.ok(r.data.summary.menipis >= 3);
assert.ok(r.data.alerts.some((a) => a.name === 'Cabai Merah' && a.status === 'habis')); ok('Dashboard: ringkasan dan peringatan stok benar');

r = await call('POST', '/api/items', { name: 'Garam Halus', category: 'Bumbu', unit: 'kg', stock: 5, min_stock: 2, price: 8000 });
assert.equal(r.status, 201); const id = r.data.id; ok('Tambah bahan');
assert.equal((await call('POST', '/api/items', { name: '', unit: 'kg' })).status, 400); ok('Validasi input kosong ditolak');
assert.equal((await call('PUT', `/api/items/${id}`, { name: 'Garam Halus', category: 'Bumbu', unit: 'kg', min_stock: 6, price: 8500 })).status, 200);
r = await call('GET', '/api/items'); assert.equal(r.data.items.find((i) => i.id === id).status, 'menipis'); ok('Edit bahan (stok minimum 6 → status menipis)');

assert.equal((await call('POST', `/api/items/${id}/stock`, { type: 'masuk', qty: 10, note: 'Belanja' })).data.stock, 15); ok('Stok masuk manual');
assert.equal((await call('POST', `/api/items/${id}/stock`, { type: 'keluar', qty: 3 })).data.stock, 12); ok('Stok keluar manual');
assert.equal((await call('POST', `/api/items/${id}/stock`, { type: 'koreksi', qty: 0 })).data.stock, 0); ok('Koreksi stok ke 0 (habis)');
assert.equal((await call('POST', `/api/items/${id}/stock`, { type: 'keluar', qty: 1 })).status, 400); ok('Stok tidak boleh minus');
r = await call('GET', '/api/items'); assert.equal(r.data.items.find((i) => i.id === id).status, 'habis');

r = await call('GET', '/api/history?q=Garam Halus'); assert.equal(r.data.history.length, 4);
assert.deepEqual(r.data.history.map((h) => h.type), ['koreksi', 'keluar', 'masuk', 'awal']); ok('Riwayat perubahan tercatat lengkap');

r = await call('GET', '/api/report'); assert.ok(r.data.total_nilai > 0 && r.data.kategori.length >= 4); ok('Laporan persediaan');
assert.equal((await call('DELETE', `/api/items/${id}`)).status, 200);
r = await call('GET', '/api/history?q=Garam Halus'); assert.equal(r.data.history[0].type, 'hapus'); ok('Hapus bahan; riwayat tetap tersimpan');

assert.equal((await call('POST', '/api/logout')).status, 200); cookie = '';
assert.equal((await call('GET', '/api/items')).status, 401); ok('Logout');
console.log(`\nSemua ${n} pengujian lulus.`);
