import { Router } from 'express';
import { ApiError, ok, parseId, parsePaging, pagingMeta, validate } from '../http.js';

const rules = {
  nama: { label: 'Nama layanan', required: true, min: 2, max: 60 },
  deskripsi: { label: 'Deskripsi', max: 200 },
  harga: { label: 'Harga', required: true, type: 'number', int: true, min: 0, max: 10000000 },
  satuan: { label: 'Satuan', required: true, oneOf: ['kg', 'pcs'] },
  estimasi_hari: { label: 'Estimasi hari', required: true, type: 'number', int: true, min: 0, max: 30 },
  aktif: { label: 'Aktif', type: 'boolean', default: 1 },
};

export function layananRouter(db) {
  const r = Router();

  const find = (id) => {
    const row = db.prepare(`
      SELECT l.*, (SELECT COUNT(*) FROM pesanan o WHERE o.layanan_id = l.id) AS jumlah_pesanan
      FROM layanan l WHERE l.id = ?`).get(id);
    if (!row) throw new ApiError(404, 'Layanan tidak ditemukan');
    return row;
  };
  const assertNameFree = (nama, exceptId = 0) => {
    const dup = db.prepare('SELECT id FROM layanan WHERE nama = ? COLLATE NOCASE AND id != ?').get(nama, exceptId);
    if (dup) throw new ApiError(409, 'Nama layanan sudah digunakan', { nama: 'Nama layanan sudah digunakan' });
  };

  r.get('/', (req, res) => {
    const { page, limit, offset } = parsePaging({ limit: 100, ...req.query });
    const q = `%${String(req.query.search || '').trim()}%`;
    const onlyActive = req.query.aktif === '1' || req.query.aktif === 'true';
    const where = `WHERE (l.nama LIKE ? OR IFNULL(l.deskripsi,'') LIKE ?) ${onlyActive ? 'AND l.aktif = 1' : ''}`;
    const total = db.prepare(`SELECT COUNT(*) AS n FROM layanan l ${where}`).get(q, q).n;
    const rows = db.prepare(`
      SELECT l.*, (SELECT COUNT(*) FROM pesanan o WHERE o.layanan_id = l.id) AS jumlah_pesanan
      FROM layanan l ${where} ORDER BY l.nama COLLATE NOCASE LIMIT ? OFFSET ?`).all(q, q, limit, offset);
    ok(res, rows, pagingMeta(page, limit, total));
  });

  r.get('/:id', (req, res) => ok(res, find(parseId(req.params.id))));

  r.post('/', (req, res) => {
    const d = validate(req.body, rules);
    assertNameFree(d.nama);
    const info = db.prepare('INSERT INTO layanan (nama, deskripsi, harga, satuan, estimasi_hari, aktif) VALUES (?,?,?,?,?,?)')
      .run(d.nama, d.deskripsi, d.harga, d.satuan, d.estimasi_hari, d.aktif);
    ok(res, find(Number(info.lastInsertRowid)), undefined, 201);
  });

  r.put('/:id', (req, res) => {
    const id = parseId(req.params.id);
    find(id);
    const d = validate(req.body, rules);
    assertNameFree(d.nama, id);
    db.prepare('UPDATE layanan SET nama=?, deskripsi=?, harga=?, satuan=?, estimasi_hari=?, aktif=? WHERE id=?')
      .run(d.nama, d.deskripsi, d.harga, d.satuan, d.estimasi_hari, d.aktif, id);
    ok(res, find(id));
  });

  r.delete('/:id', (req, res) => {
    const id = parseId(req.params.id);
    const row = find(id);
    if (row.jumlah_pesanan > 0) {
      throw new ApiError(409, `Layanan tidak dapat dihapus karena dipakai ${row.jumlah_pesanan} pesanan. Nonaktifkan saja.`);
    }
    db.prepare('DELETE FROM layanan WHERE id = ?').run(id);
    ok(res, { id });
  });

  return r;
}
