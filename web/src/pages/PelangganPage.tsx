import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { useAsync, useDebounced } from '../lib/hooks';
import { tanggal } from '../lib/format';
import type { Pelanggan, PelangganInput } from '../lib/types';
import { useToast } from '../components/Toast';
import { ConfirmDialog, Modal } from '../components/Modal';
import { EmptyState, ErrorState, Field, Loading, PageHeader, Pager } from '../components/ui';

const EMPTY: PelangganInput = { nama: '', telepon: '', email: '', alamat: '' };

function PelangganForm({ initial, onClose, onSaved }: { initial: Pelanggan | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState<PelangganInput>(
    initial ? { nama: initial.nama, telepon: initial.telepon, email: initial.email ?? '', alamat: initial.alamat ?? '' } : EMPTY,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof PelangganInput) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      if (initial) await api.pelanggan.update(initial.id, form);
      else await api.pelanggan.create(form);
      toast('success', initial ? 'Pelanggan diperbarui' : 'Pelanggan ditambahkan');
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
      title={initial ? 'Ubah Pelanggan' : 'Tambah Pelanggan'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Batal</button>
          <button form="form-pelanggan" className="btn btn-primary" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
        </>
      }
    >
      <form id="form-pelanggan" className="form" onSubmit={submit} noValidate>
        <Field label="Nama lengkap" error={errors.nama}>
          <input value={form.nama} onChange={set('nama')} autoFocus placeholder="Contoh: Budi Santoso" />
        </Field>
        <Field label="No. telepon" error={errors.telepon} hint="Format Indonesia, contoh 081234567890">
          <input value={form.telepon} onChange={set('telepon')} inputMode="tel" placeholder="081234567890" />
        </Field>
        <Field label="Email (opsional)" error={errors.email}>
          <input value={form.email} onChange={set('email')} type="email" placeholder="nama@email.com" />
        </Field>
        <Field label="Alamat (opsional)" error={errors.alamat}>
          <textarea value={form.alamat} onChange={set('alamat')} rows={3} />
        </Field>
      </form>
    </Modal>
  );
}

export default function PelangganPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounced(search);
  const [editing, setEditing] = useState<Pelanggan | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Pelanggan | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useAsync(() => api.pelanggan.list({ search: q, page, limit: 8 }), [q, page]);

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.pelanggan.remove(deleting.id);
      toast('success', 'Pelanggan dihapus');
      setDeleting(null);
      reload();
    } catch (e) {
      toast('error', (e as Error).message);
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Pelanggan"
        subtitle="Kelola data pelanggan laundry"
        action={<button className="btn btn-primary" onClick={() => setEditing('new')}>+ Tambah Pelanggan</button>}
      />
      <div className="card">
        <div className="toolbar">
          <input
            className="search"
            placeholder="Cari nama, telepon, atau email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            aria-label="Cari pelanggan"
          />
        </div>
        {loading && !data ? <Loading /> : error ? <ErrorState message={error} onRetry={reload} /> : data && data.data.length === 0 ? (
          <EmptyState title="Belum ada pelanggan" text={q ? 'Coba kata kunci lain.' : 'Klik “Tambah Pelanggan” untuk memulai.'} />
        ) : data && (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Nama</th><th>Telepon</th><th>Email</th><th>Alamat</th><th>Pesanan</th><th>Terdaftar</th><th /></tr>
                </thead>
                <tbody>
                  {data.data.map((p) => (
                    <tr key={p.id}>
                      <td><strong>{p.nama}</strong></td>
                      <td>{p.telepon}</td>
                      <td>{p.email ?? '—'}</td>
                      <td className="clip">{p.alamat ?? '—'}</td>
                      <td>{p.jumlah_pesanan}</td>
                      <td>{tanggal(p.created_at)}</td>
                      <td className="actions">
                        <button className="btn btn-sm" onClick={() => setEditing(p)}>Ubah</button>
                        <button className="btn btn-sm btn-danger-ghost" onClick={() => setDeleting(p)}>Hapus</button>
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
        <PelangganForm
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Hapus pelanggan?"
          message={`Pelanggan “${deleting.nama}” akan dihapus permanen.`}
          busy={busy}
          onConfirm={remove}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  );
}
