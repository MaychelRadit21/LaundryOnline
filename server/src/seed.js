const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

const PELANGGAN = [
  ['Budi Santoso', '081234567801', 'budi@example.com', 'Jl. Melati No. 12, Bandung'],
  ['Siti Rahmawati', '081234567802', 'siti@example.com', 'Jl. Kenanga No. 5, Bandung'],
  ['Andi Pratama', '081234567803', null, 'Perumahan Griya Asri Blok C3'],
  ['Dewi Lestari', '081234567804', 'dewi@example.com', 'Jl. Mawar No. 21, Cimahi'],
  ['Rizky Ramadhan', '081234567805', null, 'Kos Putra Cempaka, Jl. Dago 88'],
  ['Maya Anggraini', '081234567806', 'maya@example.com', 'Apartemen Skyline Lt. 7'],
];

const LAYANAN = [
  ['Cuci Reguler', 'Cuci dan lipat, selesai dalam 3 hari', 6000, 'kg', 3],
  ['Cuci Kilat', 'Cuci dan lipat, selesai dalam 1 hari', 10000, 'kg', 1],
  ['Cuci + Setrika', 'Cuci, setrika, dan lipat rapi', 8000, 'kg', 3],
  ['Setrika Saja', 'Layanan setrika untuk pakaian bersih', 4500, 'kg', 2],
  ['Dry Cleaning Jas', 'Pembersihan khusus jas dan blazer', 35000, 'pcs', 4],
  ['Cuci Bed Cover', 'Cuci selimut dan bed cover ukuran besar', 25000, 'pcs', 3],
];

const PESANAN = [
  // [pelanggan, layanan, jumlah, status, dibayar, catatan, hari yang lalu]
  [1, 1, 4.5, 'Diambil', 1, 'Pisahkan baju putih', 9],
  [2, 3, 3, 'Selesai', 1, null, 4],
  [3, 2, 2.5, 'Disetrika', 0, 'Mohon cepat, dipakai lusa', 2],
  [4, 5, 2, 'Dicuci', 0, 'Jas pernikahan, hati-hati noda', 1],
  [5, 1, 6, 'Diterima', 0, null, 0],
  [6, 6, 1, 'Diterima', 1, 'Bed cover king size', 0],
  [1, 3, 5, 'Dicuci', 0, null, 1],
  [2, 4, 3.5, 'Diambil', 1, null, 7],
  [4, 1, 7, 'Dibatalkan', 0, 'Dibatalkan oleh pelanggan', 6],
];

export function seedIfEmpty(db) {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM pelanggan').get();
  if (n > 0) return false;

  const insP = db.prepare('INSERT INTO pelanggan (nama, telepon, email, alamat) VALUES (?,?,?,?)');
  const insL = db.prepare('INSERT INTO layanan (nama, deskripsi, harga, satuan, estimasi_hari) VALUES (?,?,?,?,?)');
  const insO = db.prepare(`INSERT INTO pesanan
    (kode, pelanggan_id, layanan_id, jumlah, harga_satuan, total_harga, status, dibayar, catatan, tanggal_masuk, tanggal_estimasi)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`);

  db.exec('BEGIN');
  try {
    PELANGGAN.forEach((p) => insP.run(...p));
    LAYANAN.forEach((l) => insL.run(...l));
    const today = new Date();
    const perHari = {};
    PESANAN.forEach(([pel, lay, jumlah, status, dibayar, catatan, ago]) => {
      const l = LAYANAN[lay - 1];
      const masuk = addDays(today, -ago);
      const est = addDays(masuk, l[4]);
      const total = Math.round(l[2] * jumlah);
      const tgl = fmt(masuk);
      perHari[tgl] = (perHari[tgl] || 0) + 1;
      const kode = `LDR-${tgl.replaceAll('-', '')}-${String(perHari[tgl]).padStart(3, '0')}`;
      insO.run(kode, pel, lay, jumlah, l[2], total, status, dibayar, catatan, tgl, fmt(est));
    });
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return true;
}
