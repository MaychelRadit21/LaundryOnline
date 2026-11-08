# Laundry Online

Aplikasi tugas kuliah untuk admin, kasir, dan pelanggan. Frontend React/Vite menggunakan Bootstrap 5 dan Fetch API; backend ASP.NET Core Web API menggunakan Entity Framework Core dan SQL Server.

## Persyaratan

- .NET SDK 10
- Node.js 22.12+ dan npm
- SQL Server yang dapat diakses (akun database perlu izin membuat database untuk instalasi baru)

## Menjalankan

1. Siapkan SQL Server dan tentukan connection string untuk database baru dengan server, nama database, user ID, dan password Anda. `TrustServerCertificate=True` hanya untuk pengembangan lokal.
2. Pada terminal backend, dari root proyek, atur konfigurasi melalui environment variable (contoh Bash; pada PowerShell gunakan `$env:Nama = "nilai"`):

   ```bash
   export ConnectionStrings__Laundry='connection string SQL Server Anda'
   export Jwt__Key='kunci acak rahasia minimal 32 byte'
   export InitialAdmin__Email='email admin Anda'
   export InitialAdmin__Password='password admin Anda minimal 8 karakter'
   export ASPNETCORE_URLS='http://localhost:5000'
   dotnet restore backend/LaundryApi
   dotnet run --project backend/LaundryApi --no-launch-profile
   ```

   API membuat database dan tabel saat pertama dijalankan (`EnsureCreated`) dan membuat admin awal hanya jika belum ada admin. Simpan kunci dan password di luar repositori. Untuk database yang sudah berisi tabel atau untuk perubahan skema selanjutnya, gunakan database baru atau kelola migrasi secara terpisah; `EnsureCreated` tidak memperbarui skema yang ada.
3. Pada terminal lain:

   ```bash
   cd frontend
   npm ci
   npm run dev
   ```

   Buka **http://localhost:5173**. Login menggunakan admin awal; admin dapat membuat akun kasir. Pelanggan dapat mendaftar sendiri. Admin/kasir menambahkan layanan dan dapat mengaktifkan membership pada halaman pelanggan.

Frontend secara default mengakses `http://localhost:5000/api`. Atur `VITE_API_URL` sebelum menjalankan/membangun Vite jika alamat API berbeda. CORS default hanya mengizinkan `http://localhost:5173`; atur `FrontendOrigin` pada backend bila origin frontend berbeda, termasuk perbedaan `localhost` dan `127.0.0.1`. Gunakan HTTPS, secret acak yang kuat, pengelolaan secret dan konfigurasi SQL Server yang aman saat deployment; contoh HTTP di atas hanya untuk lokal.

### Aturan aplikasi

- Registrasi publik selalu menghasilkan peran Pelanggan; hanya Admin dapat membuat Kasir. Admin dan Kasir mengelola pelanggan, layanan, status, pembayaran dan laporan. Pelanggan hanya melihat pesanannya sendiri.
- Membership diaktifkan oleh staf. Pesanan yang memilih membership mengurangi kuota **300 kg per pelanggan per bulan kalender UTC**, saat pesanan dibuat; pesanan tersebut bernilai Rp0. Jika kuota tidak cukup, pesanan ditolak (pelanggan dapat membuat pesanan biasa). Nonaktif/aktif ulang membership tidak mereset pemakaian bulan yang sama.
- Harga dan nama layanan disimpan sebagai snapshot pada pesanan. Pembayaran dicatat sekali per pesanan, dengan total yang dihitung server; nota dapat dilihat dan dicetak dari riwayat. Pelanggan/layanan yang sudah memiliki transaksi tidak dapat dihapus.
- Status: `Diterima`, `Dicuci`, `Dikeringkan`, `Disetrika`, `Siap Diambil`, `Selesai`. Laporan menjumlahkan pembayaran berdasarkan tanggal pembayaran UTC, bukan tanggal pesanan.

## API

Base URL: `http://localhost:5000/api`. Request/response menggunakan JSON. Selain endpoint autentikasi, kirim header Authorization dengan skema `Bearer` diikuti token dari respons login. Token berlaku 8 jam. Peran: **A** = Admin, **K** = Kasir, **P** = Pelanggan.

| Metode dan path | Peran | Body / keterangan |
|---|---|---|
| POST `/auth/register` | Publik | `{ "name", "email", "password", "phone" }`; phone opsional |
| POST `/auth/login` | Publik | `{ "email", "password" }`; menghasilkan `{ token, user }` |
| POST `/staff` | A | `{ "name", "email", "password", "phone" }`; membuat kasir |
| GET `/customers`, `/customers/{id}` | A, K | Daftar/detail pelanggan |
| POST `/customers` | A, K | Body sama seperti registrasi |
| PUT `/customers/{id}` | A, K | `{ "name", "phone", "isMember": true }` |
| DELETE `/customers/{id}` | A, K | Hanya tanpa riwayat |
| GET `/services`, `/services/{id}` | A, K, P | Daftar/detail layanan |
| POST `/services` | A, K | `{ "name", "pricePerKg": 9000 }` |
| PUT `/services/{id}` | A, K | Body sama seperti POST |
| DELETE `/services/{id}` | A, K | Hanya tanpa riwayat |
| GET `/orders`, `/orders/{id}` | A, K, P | Pelanggan hanya mendapat pesanan sendiri; termasuk data pembayaran |
| POST `/orders` | A, K, P | `{ "customerId": 1, "serviceId": 1, "weightKg": 2.5, "useMembership": false }`; `customerId` diabaikan untuk Pelanggan |
| PUT `/orders/{id}/status` | A, K | `{ "status": "Dicuci" }` |
| POST `/orders/{id}/payment` | A, K | `{ "method": "Tunai" }` atau `"Transfer"` |
| GET `/membership` | A, K, P | Status dan pemakaian membership akun yang sedang login |
| GET `/reports?from=2026-01-01&to=2026-01-31` | A, K | Filter tanggal pembayaran UTC inklusif; keduanya opsional |

Respons sukses menggunakan 200, 201 (buat), atau 204 (hapus). Data tidak valid menghasilkan 400, kredensial salah 401, peran tidak diizinkan 403, data tidak ditemukan 404, dan email duplikat/pembayaran ganda/hapus data bertransaksi 409.

## Validasi

```bash
dotnet build backend/LaundryApi
cd frontend
npm run build
npm run lint
```

Struktur utama: `backend/LaundryApi/Models.cs` mendefinisikan tabel dan relasi (`Users` → `Orders` ← `Services`, `Orders` → `Payments` satu-ke-satu), `Program.cs` mendefinisikan API dan keamanan, dan `frontend/src` berisi antarmuka.
