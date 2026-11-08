import { Router } from 'express';
import { ApiError, ok, parseId, parsePaging, pagingMeta, validate } from '../http.js';
import { STATUS_LIST } from '../db.js';

const rules = {
  pelanggan_id: { label: 'Pelanggan', required: true, type: 'number', int: true, min: 1 },
  layanan_id: { label: 'Layanan', required: true, type: 'number', int: true, min: 1 },
  jumlah: { label: 'Jumlah', required: true, type: 'number', min: 0.1, max: 1000 },
  catatan: { label: 'Catatan', max: 300 },
  dibayar: { label: 'Dibayar', type: 'boolean', default: 0 },
};

// Alur status: maju satu tahap; pembatalan hanya sebelum pesanan selesai.
const NEXT = {
  Diterima: ['Dicuci', 'Dibatalkan'],
  Dicuci: ['Disetrika', 'Dibatalkan'],
  Disetrika: ['Selesai', 'Dibatalkan'],
  Selesai: ['Diambil'],
  Diambil: [],
  Dibatalkan: [],
};

const pad = (n) => String(n).padStart(2, '0');
const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const SELECT = `
  SELECT o.*, p.nama AS pelanggan_nama, p.telepon AS pelanggan_telepon,
         l.nama AS layanan_nama, l.satuan AS layanan_satuan
  FROM pesanan o
  JOIN pelanggan p ON p.id = o.pelanggan_id
  JOIN layanan l ON l.id = o.layanan_id`;

export function pesananRouter(db) {
  const r = Router();

  const find = (id) => {
    const row = db.prepare(`${SELECT} WHERE o.id = ?`).get(id);
    if (!row) throw new ApiError(404, 'Pesanan tidak ditemukan');
    return row;
  };

  const refs = (d) => {
    const pel = db.prepare('SELECT id FROM pelanggan WHERE id = ?').get(d.pelanggan_id);
    if (!pel) throw new ApiError(422, 'Validasi gagal', { pelanggan_id: 'Pelanggan tidak ditemukan' });
    const lay = db.prepare('SELECT * FROM layanan WHERE id = ?').get(d.layanan_id);
    if (!lay) throw new ApiError(422, 'Validasi gagal', { layanan_id: 'Layanan tidak ditemukan' });
    return lay;
  };

  const nextCode = (dateStr) => {
    const prefix = `LDR-${dateStr.replaceAll('-', '')}-`;
    let n = db.prepare('SELECT COUNT(*) AS n FROM pesanan WHERE kode LIKE ?').get(`${prefix}%`).n + 1;
    while (db.prepare('SELECT 1 FROM pesanan WHERE kode = ?').get(prefix + String(n).padStart(3, '0'))) n++;
    return prefix + String(n).padStart(3, '0');
  };

  r.get('/', (req, res) => {
    const { page, limit, offset } = parsePaging(req.query);
    const conds = [];
    const params = [];
    const search = String(req.query.search || '').trim();
    if (search) {
      conds.push('(o.kode LIKE ? OR p.nama LIKE ? OR l.nama LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (req.query.status) {
      if (!STATUS_LIST.includes(req.query.status)) throw new ApiError(400, 'Status filter tidak valid');
      conds.push('o.status = ?');
      params.push(req.query.status);
    }
    if (req.query.pelanggan_id) {
      conds.push('o.pelanggan_id = ?');
      params.push(parseId(req.query.pelanggan_id));
    }
    if (req.query.dibayar === '0' || req.query.dibayar === '1') {
      conds.push('o.dibayar = ?');
      params.push(Number(req.query.dibayar));
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const from = `FROM pesanan o JOIN pelanggan p ON p.id = o.pelanggan_id JOIN layanan l ON l.id = o.layanan_id ${where}`;
    const total = db.prepare(`SELECT COUNT(*) AS n ${from}`).get(...params).n;
    const rows = db.prepare(`${SELECT} ${where} ORDER BY o.id DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
    ok(res, rows, pagingMeta(page, limit, total));
  });

  r.get('/:id', (req, res) => {
    const row = find(parseId(req.params.id));
    ok(res, { ...row, status_berikutnya: NEXT[row.status] });
  });

  r.post('/', (req, res) => {
    const d = validate(req.body, rules);
    const lay = refs(d);
    if (!lay.aktif) throw new ApiError(422, 'Validasi gagal', { layanan_id: 'Layanan sedang tidak aktif' });
    const now = new Date();
    const masuk = fmtDate(now);
    const est = fmtDate(new Date(now.getTime() + lay.estimasi_hari * 86400000));
    const total = Math.round(lay.harga * d.jumlah);
    const info = db.prepare(`INSERT INTO pesanan
      (kode, pelanggan_id, layanan_id, jumlah, harga_satuan, total_harga, dibayar, catatan, tanggal_masuk, tanggal_estimasi)
      VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(nextCode(masuk), d.pelanggan_id, d.layanan_id, d.jumlah, lay.harga, total, d.dibayar, d.catatan, masuk, est);
    ok(res, find(Number(info.lastInsertRowid)), undefined, 201);
  });

  r.put('/:id', (req, res) => {
    const id = parseId(req.params.id);
    const cur = find(id);
    if (cur.status === 'Diambil' || cur.status === 'Dibatalkan') {
      throw new ApiError(409, `Pesanan berstatus ${cur.status} tidak dapat diubah`);
    }
    const d = validate(req.body, rules);
    const lay = refs(d);
    // Harga dikunci saat pesanan dibuat; hanya dihitung ulang jika layanan diganti.
    const sameService = cur.layanan_id === d.layanan_id;
    const harga = sameService ? cur.harga_satuan : lay.harga;
    const est = sameService
      ? cur.tanggal_estimasi
      : fmtDate(new Date(new Date(cur.tanggal_masuk).getTime() + lay.estimasi_hari * 86400000));
    db.prepare(`UPDATE pesanan SET pelanggan_id=?, layanan_id=?, jumlah=?, harga_satuan=?, total_harga=?,
      dibayar=?, catatan=?, tanggal_estimasi=?, updated_at=datetime('now','localtime') WHERE id=?`)
      .run(d.pelanggan_id, d.layanan_id, d.jumlah, harga, Math.round(harga * d.jumlah), d.dibayar, d.catatan, est, id);
    ok(res, find(id));
  });

  r.patch('/:id/status', (req, res) => {
    const id = parseId(req.params.id);
    const cur = find(id);
    const { status } = validate(req.body, { status: { label: 'Status', required: true, oneOf: STATUS_LIST } });
    if (!NEXT[cur.status].includes(status)) {
      const allowed = NEXT[cur.status].join(', ') || 'tidak ada';
      throw new ApiError(409, `Status tidak dapat diubah dari ${cur.status} ke ${status}. Berikutnya: ${allowed}`);
    }
    db.prepare("UPDATE pesanan SET status=?, updated_at=datetime('now','localtime') WHERE id=?").run(status, id);
    const row = find(id);
    ok(res, { ...row, status_berikutnya: NEXT[row.status] });
  });

  r.patch('/:id/bayar', (req, res) => {
    const id = parseId(req.params.id);
    const cur = find(id);
    if (cur.status === 'Dibatalkan') throw new ApiError(409, 'Pesanan dibatalkan tidak dapat dibayar');
    const { dibayar } = validate(req.body, { dibayar: { label: 'Dibayar', type: 'boolean', default: 1 } });
    db.prepare("UPDATE pesanan SET dibayar=?, updated_at=datetime('now','localtime') WHERE id=?").run(dibayar, id);
    ok(res, find(id));
  });

  r.delete('/:id', (req, res) => {
    const id = parseId(req.params.id);
    const cur = find(id);
    if (cur.status !== 'Dibatalkan' && cur.status !== 'Diterima') {
      throw new ApiError(409, 'Hanya pesanan berstatus Diterima atau Dibatalkan yang dapat dihapus');
    }
    db.prepare('DELETE FROM pesanan WHERE id = ?').run(id);
    ok(res, { id });
  });

  return r;
}
