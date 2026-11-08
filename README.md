# Rinso Laundry — Sistem Laundry (Web React TypeScript + REST API Node.js)

Proyek UTS PBAD 2026/2027. Domain: **Laundry** (Pelanggan, Layanan, Pesanan). Web client berkomunikasi dua arah dengan API server (CRUD) dan database SQLite terpusat.

## Struktur

```
server/   REST API (Node.js + Express + SQLite) + tes
web/      Web client (React 18 + TypeScript + Vite)
docs/     Dokumentasi UTS; laporan lengkap (Word) ada di docs/laporan/Laporan_UTS_Laundry.docx
```

## Prasyarat

- **Node.js 22.13 atau lebih baru** (memakai `node:sqlite` bawaan, tanpa kompilasi native) dan npm.

## Menjalankan

Windows: klik dua kali **`Mulai Laundry.cmd`** (install otomatis, menjalankan, dan membuka browser).

Manual:

```sh
npm install
npm run dev        # API di :3001 + web di http://127.0.0.1:5173
```

Mode produksi (satu server, web ikut disajikan Express):

```sh
npm start          # build web lalu buka http://localhost:3001
```

Perintah lain: `npm test` (tes API), `npm run build` (type-check + build web), `npm run seed` (isi data awal bila database kosong).

Database tersimpan di `server/data/laundry.db` dan otomatis berisi data contoh saat pertama kali dijalankan. Hapus berkas itu untuk mengatur ulang. Variabel opsional: `PORT`, `DB_FILE`.

## Fitur

- CRUD Pelanggan, Layanan, dan Pesanan dengan validasi server dan pesan error per kolom
- Total harga otomatis, kode pesanan otomatis (`LDR-YYYYMMDD-NNN`), harga dikunci saat pesanan dibuat
- Alur status pesanan + pembatalan, penanda pembayaran
- Pencarian, filter, dan pagination; dashboard statistik dengan grafik
- Tema terang/gelap otomatis, responsif, status loading/error/kosong, toast

## Ringkasan API (`/api`)

| Resource | Endpoint |
|----------|----------|
| Pelanggan | `GET/POST /pelanggan`, `GET/PUT/DELETE /pelanggan/:id` |
| Layanan | `GET/POST /layanan`, `GET/PUT/DELETE /layanan/:id` |
| Pesanan | `GET/POST /pesanan`, `GET/PUT/DELETE /pesanan/:id`, `PATCH /pesanan/:id/status`, `PATCH /pesanan/:id/bayar` |
| Lainnya | `GET /stats`, `GET /health` |

Tabel lengkap (Method, Endpoint, Request, Response) ada di [`docs/DOKUMENTASI.md`](docs/DOKUMENTASI.md).

## Catatan Tim

Setiap anggota wajib melakukan commit dari akun GitHub masing-masing. API ini tanpa autentikasi dan hanya untuk penggunaan lokal/akademik.
