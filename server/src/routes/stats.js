import { Router } from 'express';
import { STATUS_LIST } from '../db.js';
import { ok } from '../http.js';

export function statsRouter(db) {
  const r = Router();

  r.get('/', (_req, res) => {
    const one = (sql) => db.prepare(sql).get();
    const aktif = "status NOT IN ('Dibatalkan')";

    const totals = one(`SELECT
      (SELECT COUNT(*) FROM pelanggan) AS pelanggan,
      (SELECT COUNT(*) FROM layanan WHERE aktif = 1) AS layanan_aktif,
      (SELECT COUNT(*) FROM pesanan) AS pesanan,
      (SELECT COUNT(*) FROM pesanan WHERE status IN ('Diterima','Dicuci','Disetrika')) AS dalam_proses,
      (SELECT COUNT(*) FROM pesanan WHERE status = 'Selesai') AS siap_diambil,
      IFNULL((SELECT SUM(total_harga) FROM pesanan WHERE dibayar = 1 AND ${aktif}), 0) AS pendapatan,
      IFNULL((SELECT SUM(total_harga) FROM pesanan WHERE dibayar = 0 AND ${aktif}), 0) AS belum_dibayar`);

    const perStatus = Object.fromEntries(STATUS_LIST.map((s) => [s, 0]));
    db.prepare('SELECT status, COUNT(*) AS n FROM pesanan GROUP BY status').all()
      .forEach((row) => { perStatus[row.status] = row.n; });

    const layananTeratas = db.prepare(`
      SELECT l.nama, COUNT(o.id) AS jumlah_pesanan, IFNULL(SUM(o.total_harga), 0) AS pendapatan
      FROM layanan l JOIN pesanan o ON o.layanan_id = l.id AND o.status != 'Dibatalkan'
      GROUP BY l.id ORDER BY jumlah_pesanan DESC, pendapatan DESC LIMIT 5`).all();

    const harian = db.prepare(`
      SELECT tanggal_masuk AS tanggal, COUNT(*) AS jumlah, IFNULL(SUM(total_harga), 0) AS nilai
      FROM pesanan WHERE tanggal_masuk >= date('now','localtime','-6 days') AND status != 'Dibatalkan'
      GROUP BY tanggal_masuk ORDER BY tanggal_masuk`).all();

    ok(res, { ...totals, per_status: perStatus, layanan_teratas: layananTeratas, harian });
  });

  return r;
}
