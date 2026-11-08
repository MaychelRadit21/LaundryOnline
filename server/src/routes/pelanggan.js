import { Router } from 'express';
import { ApiError, ok, parseId, parsePaging, pagingMeta, validate, PHONE } from '../http.js';

const rules = {
  nama: { label: 'Nama', required: true, min: 2, max: 80 },
  telepon: { label: 'Telepon', required: true, pattern: PHONE, message: 'Telepon harus nomor Indonesia yang valid (contoh 081234567890)' },
  email: { label: 'Email', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Format email tidak valid', max: 100 },
  alamat: { label: 'Alamat', max: 200 },
};

export function pelangganRouter(db) {
  const r = Router();

  const find = (id) => {
    const row = db.prepare(`
      SELECT p.*, (SELECT COUNT(*) FROM pesanan o WHERE o.pelanggan_id = p.id) AS jumlah_pesanan
      FROM pelanggan p WHERE p.id = ?`).get(id);
    if (!row) throw new ApiError(404, 'Pelanggan tidak ditemukan');
    return row;
  };
  const assertPhoneFree = (telepon, exceptId = 0) => {
    const dup = db.prepare('SELECT id FROM pelanggan WHERE telepon = ? AND id != ?').get(telepon, exceptId);
    if (dup) throw new ApiError(409, 'Nomor telepon sudah terdaftar', { telepon: 'Nomor telepon sudah terdaftar' });
  };

  r.get('/', (req, res) => {
    const { page, limit, offset } = parsePaging(req.query);
    const q = `%${String(req.query.search || '').trim()}%`;
    const where = "WHERE p.nama LIKE ? OR p.telepon LIKE ? OR IFNULL(p.email,'') LIKE ?";
    const total = db.prepare(`SELECT COUNT(*) AS n FROM pelanggan p ${where}`).get(q, q, q).n;
    const rows = db.prepare(`
      SELECT p.*, (SELECT COUNT(*) FROM pesanan o WHERE o.pelanggan_id = p.id) AS jumlah_pesanan
      FROM pelanggan p ${where} ORDER BY p.nama COLLATE NOCASE LIMIT ? OFFSET ?`).all(q, q, q, limit, offset);
    ok(res, rows, pagingMeta(page, limit, total));
  });

  r.get('/:id', (req, res) => ok(res, find(parseId(req.params.id))));

  r.post('/', (req, res) => {
    const d = validate(req.body, rules);
    assertPhoneFree(d.telepon);
    const info = db.prepare('INSERT INTO pelanggan (nama, telepon, email, alamat) VALUES (?,?,?,?)')
      .run(d.nama, d.telepon, d.email, d.alamat);
    ok(res, find(Number(info.lastInsertRowid)), undefined, 201);
  });

  r.put('/:id', (req, res) => {
    const id = parseId(req.params.id);
    find(id);
    const d = validate(req.body, rules);
    assertPhoneFree(d.telepon, id);
    db.prepare('UPDATE pelanggan SET nama=?, telepon=?, email=?, alamat=? WHERE id=?')
      .run(d.nama, d.telepon, d.email, d.alamat, id);
    ok(res, find(id));
  });

  r.delete('/:id', (req, res) => {
    const id = parseId(req.params.id);
    const row = find(id);
    if (row.jumlah_pesanan > 0) {
      throw new ApiError(409, `Pelanggan tidak dapat dihapus karena memiliki ${row.jumlah_pesanan} pesanan`);
    }
    db.prepare('DELETE FROM pelanggan WHERE id = ?').run(id);
    ok(res, { id });
  });

  return r;
}
