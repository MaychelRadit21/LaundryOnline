import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { useAsync, useDebounced } from '../lib/hooks';
import { rupiah } from '../lib/format';
import type { Layanan, LayananInput } from '../lib/types';
import { useToast } from '../components/Toast';
import { ConfirmDialog, Modal } from '../components/Modal';
import { EmptyState, ErrorState, Field, Loading, PageHeader } from '../components/ui';

const EMPTY: LayananInput = { nama: '', deskripsi: '', harga: '', satuan: 'kg', estimasi_hari: 2, aktif: true };

function LayananForm({ initial, onClose, onSaved }: { initial: Layanan | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState<LayananInput>(
    initial
      ? { nama: initial.nama, deskripsi: initial.deskripsi ?? '', harga: initial.harga, satuan: initial.satuan, estimasi_hari: initial.estimasi_hari, aktif: !!initial.aktif }
      : EMPTY,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const num = (v: string): number | '' => (v === '' ? '' : Number(v));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      if (initial) await api.layanan.update(initial.id, form);
      else await api.layanan.create(form);
      toast('success', initial ? 'Layanan diperbarui' : 'Layanan ditambahkan');
      onSaved();
    } catch (err) {
      const ex = err as ApiError;
      setErrors(ex.details);
      if (!Object.keys(ex.details).length) toast('error', ex.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={initial ? 'Ubah Layanan' : 'Tambah Layanan'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Batal</button>
          <button form="form-layanan" className="btn btn-primary" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
        </>
      }
    >
      <form id="form-layanan" className="form" onSubmit={submit} noValidate>
        <Field label="Nama layanan" error={errors.nama}>
          <input value={form.nama} autoFocus onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Contoh: Cuci Reguler" />
        </Field>
        <Field label="Deskripsi (opsional)" error={errors.deskripsi}>
          <textarea rows={2} value={form.deskripsi} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} />
        </Field>
        <div className="grid-3">
          <Field label="Harga (Rp)" error={errors.harga}>
            <input type="number" min={0} value={form.harga} onChange={(e) => setForm({ ...form, harga: num(e.target.value) })} />
          </Field>
          <Field label="Satuan" error={errors.satuan}>
            <select value={form.satuan} onChange={(e) => setForm({ ...form, satuan: e.target.value as 'kg' | 'pcs' })}>
              <option value="kg">per kg</option>
              <option value="pcs">per pcs</option>
            </select>
          </Field>
          <Field label="Estimasi (hari)" error={errors.estimasi_hari}>
            <input type="number" min={0} value={form.estimasi_hari} onChange={(e) => setForm({ ...form, estimasi_hari: num(e.target.value) })} />
          </Field>
        </div>
        <label className="check">
          <input type="checkbox" checked={form.aktif} onChange={(e) => setForm({ ...form, aktif: e.target.checked })} />
          Layanan aktif (dapat dipilih pada pesanan baru)
        </label>
      </form>
    </Modal>
  );
}

export default function LayananPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const [editing, setEditing] = useState<Layanan | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Layanan | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useAsync(() => api.layanan.list({ search: q }), [q]);

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.layanan.remove(deleting.id);
      toast('success', 'Layanan dihapus');
      reload();
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setBusy(false);
      setDeleting(null);
    }
  };

  const toggle = async (l: Layanan) => {
    try {
      await api.layanan.update(l.id, {
        nama: l.nama, deskripsi: l.deskripsi ?? '', harga: l.harga, satuan: l.satuan,
        estimasi_hari: l.estimasi_hari, aktif: !l.aktif,
      });
      toast('success', l.aktif ? 'Layanan dinonaktifkan' : 'Layanan diaktifkan');
      reload();
    } catch (e) {
      toast('error', (e as Error).message);
    }
  };

  return (
    <>
      <PageHeader
        title="Layanan"
        subtitle="Daftar layanan dan tarif laundry"
        action={<button className="btn btn-primary" onClick={() => setEditing('new')}>+ Tambah Layanan</button>}
      />
      <div className="toolbar">
        <input className="search" placeholder="Cari layanan…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Cari layanan" />
      </div>
      {loading && !data ? <div className="card"><Loading /></div> : error ? <div className="card"><ErrorState message={error} onRetry={reload} /></div> : data && data.data.length === 0 ? (
        <div className="card"><EmptyState title="Belum ada layanan" /></div>
      ) : data && (
        <div className="grid-cards">
          {data.data.map((l) => (
            <article key={l.id} className={`card service${l.aktif ? '' : ' inactive'}`}>
              <div className="service-top">
                <h3>{l.nama}</h3>
                <span className={`badge ${l.aktif ? 'st-lunas' : 'st-dibatalkan'}`}>{l.aktif ? 'Aktif' : 'Nonaktif'}</span>
              </div>
              <p className="muted service-desc">{l.deskripsi || 'Tanpa deskripsi'}</p>
              <div className="price">{rupiah(l.harga)} <small>/ {l.satuan}</small></div>
              <div className="muted">Estimasi {l.estimasi_hari} hari · {l.jumlah_pesanan} pesanan</div>
              <div className="row service-actions">
                <button className="btn btn-sm" onClick={() => setEditing(l)}>Ubah</button>
                <button className="btn btn-sm" onClick={() => toggle(l)}>{l.aktif ? 'Nonaktifkan' : 'Aktifkan'}</button>
                <button className="btn btn-sm btn-danger-ghost" onClick={() => setDeleting(l)}>Hapus</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <LayananForm initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />
      )}
      {deleting && (
        <ConfirmDialog
          title="Hapus layanan?"
          message={`Layanan “${deleting.nama}” akan dihapus permanen.`}
          busy={busy}
          onConfirm={remove}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  );
}
