import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { useAsync, useDebounced } from '../lib/hooks';
import { angka, rupiah, tanggal } from '../lib/format';
import { NEXT_STATUS, STATUS_LIST, type Pesanan, type PesananInput, type Status } from '../lib/types';
import { useToast } from '../components/Toast';
import { ConfirmDialog, Modal } from '../components/Modal';
import { EmptyState, ErrorState, Field, Loading, PageHeader, Pager, PayBadge, StatusBadge } from '../components/ui';

const FLOW: Status[] = ['Diterima', 'Dicuci', 'Disetrika', 'Selesai', 'Diambil'];

function PesananForm({ initial, onClose, onSaved }: { initial: Pesanan | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const pelanggan = useAsync(() => api.pelanggan.list({ limit: 100 }), []);
  const layanan = useAsync(() => api.layanan.list({ limit: 100 }), []);
  const [form, setForm] = useState<PesananInput>(
    initial
      ? { pelanggan_id: initial.pelanggan_id, layanan_id: initial.layanan_id, jumlah: initial.jumlah, catatan: initial.catatan ?? '', dibayar: !!initial.dibayar }
      : { pelanggan_id: '', layanan_id: '', jumlah: '', catatan: '', dibayar: false },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const selected = layanan.data?.data.find((l) => l.id === form.layanan_id);
  const unitPrice = initial && initial.layanan_id === form.layanan_id ? initial.harga_satuan : selected?.harga;
  const total = unitPrice !== undefined && form.jumlah !== '' ? Math.round(unitPrice * Number(form.jumlah)) : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      if (initial) await api.pesanan.update(initial.id, form);
      else await api.pesanan.create(form);
      toast('success', initial ? 'Pesanan diperbarui' : 'Pesanan berhasil dibuat');
      onSaved();
    } catch (err) {
      const ex = err as ApiError;
      setErrors(ex.details);
      if (!Object.keys(ex.details).length) toast('error', ex.message);
    } finally {
      setBusy(false);
    }
  };

  const loadingRefs = pelanggan.loading || layanan.loading;
  const refError = pelanggan.error || layanan.error;

  return (
    <Modal
      title={initial ? `Ubah Pesanan ${initial.kode}` : 'Pesanan Baru'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Batal</button>
          <button form="form-pesanan" className="btn btn-primary" disabled={busy || loadingRefs || !!refError}>
            {busy ? 'Menyimpan…' : 'Simpan Pesanan'}
          </button>
        </>
      }
    >
      {refError ? <ErrorState message={refError} /> : (
        <form id="form-pesanan" className="form" onSubmit={submit} noValidate>
          <Field label="Pelanggan" error={errors.pelanggan_id}>
            <select value={form.pelanggan_id} onChange={(e) => setForm({ ...form, pelanggan_id: e.target.value ? Number(e.target.value) : '' })}>
              <option value="">— Pilih pelanggan —</option>
              {pelanggan.data?.data.map((p) => <option key={p.id} value={p.id}>{p.nama} · {p.telepon}</option>)}
            </select>
          </Field>
          <Field label="Layanan" error={errors.layanan_id}>
            <select value={form.layanan_id} onChange={(e) => setForm({ ...form, layanan_id: e.target.value ? Number(e.target.value) : '' })}>
              <option value="">— Pilih layanan —</option>
              {layanan.data?.data
                .filter((l) => l.aktif || l.id === initial?.layanan_id)
                .map((l) => <option key={l.id} value={l.id}>{l.nama} — {rupiah(l.harga)}/{l.satuan}</option>)}
            </select>
          </Field>
          <Field label={`Jumlah (${selected?.satuan ?? 'kg / pcs'})`} error={errors.jumlah} hint="Boleh desimal, contoh 2.5">
            <input type="number" step="0.1" min="0.1" value={form.jumlah} onChange={(e) => setForm({ ...form, jumlah: e.target.value === '' ? '' : Number(e.target.value) })} />
          </Field>
          <Field label="Catatan (opsional)" error={errors.catatan}>
            <textarea rows={2} value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} placeholder="Contoh: pisahkan baju putih" />
          </Field>
          <label className="check">
            <input type="checkbox" checked={form.dibayar} onChange={(e) => setForm({ ...form, dibayar: e.target.checked })} />
            Sudah dibayar
          </label>
          <div className="total-box">
            <span>Total harga</span>
            <strong>{total === null ? '—' : rupiah(total)}</strong>
          </div>
        </form>
      )}
    </Modal>
  );
}

function PesananDetail({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [order, setOrder] = useState<Pesanan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.pesanan.get(id).then(setOrder).catch((e: Error) => setError(e.message));
  }, [id]);

  const run = async (fn: () => Promise<Pesanan>, msg: string) => {
    setBusy(true);
    try {
      setOrder(await fn());
      toast('success', msg);
      onChanged();
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Detail Pesanan" onClose={onClose} wide>
      {error ? <ErrorState message={error} /> : !order ? <Loading /> : (
        <div className="detail">
          <div className="detail-head">
            <div>
              <div className="muted">Kode pesanan</div>
              <h3 className="mono">{order.kode}</h3>
            </div>
            <div className="row"><StatusBadge status={order.status} /><PayBadge paid={!!order.dibayar} /></div>
          </div>

          {order.status !== 'Dibatalkan' && (
            <ol className="stepper">
              {FLOW.map((s, i) => {
                const cur = FLOW.indexOf(order.status);
                return <li key={s} className={i < cur ? 'done' : i === cur ? 'current' : ''}><span>{i + 1}</span>{s}</li>;
              })}
            </ol>
          )}

          <dl className="facts">
            <div><dt>Pelanggan</dt><dd>{order.pelanggan_nama}<br /><span className="muted">{order.pelanggan_telepon}</span></dd></div>
            <div><dt>Layanan</dt><dd>{order.layanan_nama}</dd></div>
            <div><dt>Jumlah</dt><dd>{angka(order.jumlah)} {order.layanan_satuan} × {rupiah(order.harga_satuan)}</dd></div>
            <div><dt>Total</dt><dd><strong>{rupiah(order.total_harga)}</strong></dd></div>
            <div><dt>Tanggal masuk</dt><dd>{tanggal(order.tanggal_masuk)}</dd></div>
            <div><dt>Estimasi selesai</dt><dd>{tanggal(order.tanggal_estimasi)}</dd></div>
            <div className="wide"><dt>Catatan</dt><dd>{order.catatan || '—'}</dd></div>
          </dl>

          <div className="row detail-actions">
            {NEXT_STATUS[order.status].map((s) => (
              <button
                key={s}
                disabled={busy}
                className={`btn ${s === 'Dibatalkan' ? 'btn-danger-ghost' : 'btn-primary'}`}
                onClick={() => run(() => api.pesanan.setStatus(order.id, s), `Status diubah ke ${s}`)}
              >
                {s === 'Dibatalkan' ? 'Batalkan pesanan' : `Tandai ${s}`}
              </button>
            ))}
            {order.status !== 'Dibatalkan' && (
              <button
                className="btn"
                disabled={busy}
                onClick={() => run(() => api.pesanan.setBayar(order.id, !order.dibayar), order.dibayar ? 'Pembayaran dibatalkan' : 'Ditandai lunas')}
              >
                {order.dibayar ? 'Tandai belum bayar' : 'Tandai lunas'}
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function PesananPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dibayar, setDibayar] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounced(search);
  const [editing, setEditing] = useState<Pesanan | 'new' | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<Pesanan | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useAsync(
    () => api.pesanan.list({ search: q, status, dibayar, page, limit: 8 }),
    [q, status, dibayar, page],
  );

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.pesanan.remove(deleting.id);
      toast('success', 'Pesanan dihapus');
      reload();
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setBusy(false);
      setDeleting(null);
    }
  };

  const filter = (fn: () => void) => { fn(); setPage(1); };
  const canEdit = (o: Pesanan) => o.status !== 'Diambil' && o.status !== 'Dibatalkan';
  const canDelete = (o: Pesanan) => o.status === 'Diterima' || o.status === 'Dibatalkan';

  return (
    <>
      <PageHeader
        title="Pesanan"
        subtitle="Catat dan pantau pesanan laundry"
        action={<button className="btn btn-primary" onClick={() => setEditing('new')}>+ Pesanan Baru</button>}
      />
      <div className="card">
        <div className="toolbar">
          <input className="search" placeholder="Cari kode, pelanggan, atau layanan…" value={search}
            onChange={(e) => filter(() => setSearch(e.target.value))} aria-label="Cari pesanan" />
          <select value={status} onChange={(e) => filter(() => setStatus(e.target.value))} aria-label="Filter status">
            <option value="">Semua status</option>
            {STATUS_LIST.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select value={dibayar} onChange={(e) => filter(() => setDibayar(e.target.value))} aria-label="Filter pembayaran">
            <option value="">Semua pembayaran</option>
            <option value="1">Lunas</option>
            <option value="0">Belum bayar</option>
          </select>
        </div>

        {loading && !data ? <Loading /> : error ? <ErrorState message={error} onRetry={reload} /> : data && data.data.length === 0 ? (
          <EmptyState title="Tidak ada pesanan" text="Ubah filter atau buat pesanan baru." />
        ) : data && (
          <>
            <div className={`table-wrap${loading ? ' dim' : ''}`}>
              <table>
                <thead>
                  <tr><th>Kode</th><th>Pelanggan</th><th>Layanan</th><th>Jumlah</th><th>Total</th><th>Status</th><th>Bayar</th><th>Estimasi</th><th /></tr>
                </thead>
                <tbody>
                  {data.data.map((o) => (
                    <tr key={o.id}>
                      <td className="mono"><button className="link" onClick={() => setDetailId(o.id)}>{o.kode}</button></td>
                      <td>{o.pelanggan_nama}</td>
                      <td>{o.layanan_nama}</td>
                      <td>{angka(o.jumlah)} {o.layanan_satuan}</td>
                      <td>{rupiah(o.total_harga)}</td>
                      <td><StatusBadge status={o.status} /></td>
                      <td><PayBadge paid={!!o.dibayar} /></td>
                      <td>{tanggal(o.tanggal_estimasi)}</td>
                      <td className="actions">
                        <button className="btn btn-sm" onClick={() => setDetailId(o.id)}>Detail</button>
                        {canEdit(o) && <button className="btn btn-sm" onClick={() => setEditing(o)}>Ubah</button>}
                        {canDelete(o) && <button className="btn btn-sm btn-danger-ghost" onClick={() => setDeleting(o)}>Hapus</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onPage={setPage} />
          </>
        )}
      </div>

      {editing && (
        <PesananForm initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />
      )}
      {detailId !== null && <PesananDetail id={detailId} onClose={() => setDetailId(null)} onChanged={reload} />}
      {deleting && (
        <ConfirmDialog
          title="Hapus pesanan?"
          message={`Pesanan ${deleting.kode} atas nama ${deleting.pelanggan_nama} akan dihapus permanen.`}
          busy={busy}
          onConfirm={remove}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  );
}
