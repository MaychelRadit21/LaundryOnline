import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/db.js';
import { seedIfEmpty } from '../src/seed.js';

let server;
let base;

before(async () => {
  const db = openDatabase(':memory:');
  seedIfEmpty(db);
  server = createApp(db).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());

const call = async (method, path, body) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
};

test('health check', async () => {
  const r = await call('GET', '/health');
  assert.equal(r.status, 200);
  assert.equal(r.body.data.status, 'ok');
});

test('pelanggan: CRUD lengkap + validasi', async () => {
  const bad = await call('POST', '/pelanggan', { nama: 'A', telepon: '123' });
  assert.equal(bad.status, 422);
  assert.ok(bad.body.error.details.nama && bad.body.error.details.telepon);

  const created = await call('POST', '/pelanggan', { nama: 'Tono Wijaya', telepon: '081299990000' });
  assert.equal(created.status, 201);
  const id = created.body.data.id;

  const dup = await call('POST', '/pelanggan', { nama: 'Lain', telepon: '081299990000' });
  assert.equal(dup.status, 409);

  const upd = await call('PUT', `/pelanggan/${id}`, { nama: 'Tono W.', telepon: '081299990000', alamat: 'Bandung' });
  assert.equal(upd.body.data.alamat, 'Bandung');

  const search = await call('GET', '/pelanggan?search=Tono');
  assert.equal(search.body.meta.total, 1);

  assert.equal((await call('DELETE', `/pelanggan/${id}`)).status, 200);
  assert.equal((await call('GET', `/pelanggan/${id}`)).status, 404);
});

test('pelanggan dengan pesanan tidak boleh dihapus', async () => {
  const r = await call('DELETE', '/pelanggan/1');
  assert.equal(r.status, 409);
});

test('layanan: buat, ubah, nonaktif, hapus', async () => {
  const c = await call('POST', '/layanan', { nama: 'Cuci Sepatu', harga: 30000, satuan: 'pcs', estimasi_hari: 2 });
  assert.equal(c.status, 201);
  const id = c.body.data.id;
  const u = await call('PUT', `/layanan/${id}`, { nama: 'Cuci Sepatu', harga: 35000, satuan: 'pcs', estimasi_hari: 2, aktif: false });
  assert.equal(u.body.data.aktif, 0);
  const order = await call('POST', '/pesanan', { pelanggan_id: 1, layanan_id: id, jumlah: 1 });
  assert.equal(order.status, 422);
  assert.equal((await call('DELETE', `/layanan/${id}`)).status, 200);
});

test('pesanan: hitung total, alur status, pembayaran', async () => {
  const c = await call('POST', '/pesanan', { pelanggan_id: 1, layanan_id: 1, jumlah: 3.5, catatan: 'tes' });
  assert.equal(c.status, 201);
  assert.equal(c.body.data.total_harga, 21000);
  assert.match(c.body.data.kode, /^LDR-\d{8}-\d{3}$/);
  const id = c.body.data.id;

  const skip = await call('PATCH', `/pesanan/${id}/status`, { status: 'Selesai' });
  assert.equal(skip.status, 409);

  for (const s of ['Dicuci', 'Disetrika', 'Selesai', 'Diambil']) {
    const r = await call('PATCH', `/pesanan/${id}/status`, { status: s });
    assert.equal(r.body.data.status, s);
  }
  assert.equal((await call('PUT', `/pesanan/${id}`, { pelanggan_id: 1, layanan_id: 1, jumlah: 1 })).status, 409);
  assert.equal((await call('DELETE', `/pesanan/${id}`)).status, 409);
});

test('pesanan: validasi referensi, ubah, hapus, filter', async () => {
  const bad = await call('POST', '/pesanan', { pelanggan_id: 999, layanan_id: 1, jumlah: 1 });
  assert.equal(bad.status, 422);
  assert.ok(bad.body.error.details.pelanggan_id);

  const c = await call('POST', '/pesanan', { pelanggan_id: 2, layanan_id: 2, jumlah: 2 });
  const id = c.body.data.id;
  const u = await call('PUT', `/pesanan/${id}`, { pelanggan_id: 2, layanan_id: 2, jumlah: 4, dibayar: true });
  assert.equal(u.body.data.total_harga, 40000);
  assert.equal(u.body.data.dibayar, 1);

  const f = await call('GET', '/pesanan?status=Diterima&limit=2');
  assert.ok(f.body.data.every((o) => o.status === 'Diterima'));
  assert.equal(f.body.meta.limit, 2);

  assert.equal((await call('DELETE', `/pesanan/${id}`)).status, 200);
});

test('statistik dan penanganan error', async () => {
  const s = await call('GET', '/stats');
  assert.equal(s.status, 200);
  assert.ok(s.body.data.pesanan >= 9);
  assert.ok('Diterima' in s.body.data.per_status);

  assert.equal((await call('GET', '/tidak-ada')).status, 404);
  assert.equal((await call('GET', '/pesanan/abc')).status, 400);
  const res = await fetch(`${base}/pelanggan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{rusak' });
  assert.equal(res.status, 400);
});
