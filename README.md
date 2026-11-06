# Rameza Stock

Aplikasi web untuk mengelola persediaan bahan makanan warung makan. Seluruh pembaruan stok dilakukan **manual**; tidak ada pengurangan otomatis dari penjualan.

## Fitur
- Login pengguna (sesi berbasis cookie HttpOnly, kata sandi di-hash PBKDF2-SHA256)
- Dashboard: ringkasan stok, nilai persediaan, peringatan stok menipis/habis, aktivitas terbaru
- Tambah, edit, hapus bahan; pencarian dan filter status
- Update stok manual: stok masuk, stok keluar, koreksi (stok opname) dengan catatan
- Riwayat perubahan stok (tetap tersimpan walau bahan dihapus), dengan filter
- Laporan persediaan per kategori, ekspor CSV, cetak/PDF
- Desain responsif (desktop dan ponsel)

## Teknologi
HTML/CSS/JavaScript (frontend) · Cloudflare Workers (backend/API) · Cloudflare D1 (database SQLite permanen)

## Struktur Folder
```
rameza-stock/
├── public/          Frontend (index.html, style.css, app.js)
├── src/             Backend Worker (index.js = API, crypto.js = hash sandi)
├── db/              schema.sql (tabel) dan seed.sql (dummy data + akun demo)
├── scripts/hash.mjs Pembuat hash kata sandi baru
├── test/            Uji API otomatis (npm test)
├── wrangler.toml    Konfigurasi Cloudflare
└── package.json
```

## Menjalankan di VS Code
Prasyarat: [Node.js](https://nodejs.org) versi 20 atau lebih baru.

1. Ekstrak ZIP, lalu buka folder `rameza-stock` di VS Code (**File → Open Folder**).
2. Buka terminal (**Terminal → New Terminal**) dan jalankan:
   ```bash
   npm install
   npm run db:init
   npm run dev
   ```
   - `npm run db:init` membuat database D1 lokal dan mengisi dummy data. Jika diminta konfirmasi, ketik `y`.
   - `npm run dev` menjalankan aplikasi di **http://localhost:8787**.
3. Login dengan akun demo:

| Username | Kata sandi |
|----------|------------|
| `admin`  | `Rameza123` |
| `kasir`  | `Rameza123` |

Data tersimpan permanen di folder `.wrangler/state` selama folder tersebut tidak dihapus. Untuk mengembalikan data ke kondisi awal, jalankan ulang `npm run db:init`.

## Menguji API
```bash
npm test
```
Menjalankan 15 skenario (login, CRUD, update stok, riwayat, laporan, logout) pada database SQLite sementara.

## Deploy ke Cloudflare (opsional)
```bash
npx wrangler login
npx wrangler d1 create rameza-stock-db     # salin database_id ke wrangler.toml
npm run db:remote
npm run deploy
```
**Penting:** sebelum deploy, ganti kata sandi akun demo. Buat hash baru dengan `npm run hash -- "sandiBaru"`, lalu perbarui `password_hash` pada `db/seed.sql` sebelum menjalankan `npm run db:remote`.

## Endpoint API
| Metode | Path | Fungsi |
|---|---|---|
| POST | `/api/login`, `/api/logout` | Masuk / keluar |
| GET | `/api/dashboard` | Ringkasan dan peringatan |
| GET, POST | `/api/items` | Daftar / tambah bahan |
| PUT, DELETE | `/api/items/:id` | Edit / hapus bahan |
| POST | `/api/items/:id/stock` | Update stok manual (`masuk`, `keluar`, `koreksi`) |
| GET | `/api/history?q=&type=` | Riwayat stok |
| GET | `/api/report` | Laporan persediaan |

## Aturan Status Stok
- **Habis**: stok = 0
- **Menipis**: stok ≤ stok minimum
- **Aman**: stok > stok minimum
