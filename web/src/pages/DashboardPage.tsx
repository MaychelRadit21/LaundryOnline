import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync } from '../lib/hooks';
import { angka, hariSingkat, rupiah } from '../lib/format';
import { STATUS_LIST } from '../lib/types';
import { ErrorState, Loading, PageHeader } from '../components/ui';

function Stat({ label, value, tone, hint }: { label: string; value: string | number; tone: string; hint?: string }) {
  return (
    <div className={`card stat tone-${tone}`}>
      <span className="muted">{label}</span>
      <strong>{value}</strong>
      {hint && <small className="muted">{hint}</small>}
    </div>
  );
}

export default function DashboardPage() {
  const stats = useAsync(() => api.stats(), []);
  const recent = useAsync(() => api.pesanan.list({ limit: 5 }), []);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Ringkasan operasional laundry"
        action={<Link to="/pesanan" className="btn btn-primary">Lihat semua pesanan</Link>}
      />

      {stats.loading && !stats.data ? <div className="card"><Loading /></div> : stats.error ? (
        <div className="card"><ErrorState message={stats.error} onRetry={stats.reload} /></div>
      ) : stats.data && (
        <>
          <div className="grid-stats">
            <Stat label="Total pesanan" value={stats.data.pesanan} tone="blue" hint={`${stats.data.pelanggan} pelanggan terdaftar`} />
            <Stat label="Sedang diproses" value={stats.data.dalam_proses} tone="amber" hint="Diterima, dicuci, disetrika" />
            <Stat label="Siap diambil" value={stats.data.siap_diambil} tone="green" hint="Menunggu pelanggan" />
            <Stat label="Pendapatan (lunas)" value={rupiah(stats.data.pendapatan)} tone="teal" hint={`Belum dibayar ${rupiah(stats.data.belum_dibayar)}`} />
          </div>

          <div className="grid-2">
            <section className="card">
              <h2>Pesanan 7 hari terakhir</h2>
              {stats.data.harian.length === 0 ? <p className="muted">Belum ada pesanan pada 7 hari terakhir.</p> : (
                <div className="bars" role="img" aria-label="Grafik jumlah pesanan harian">
                  {(() => {
                    const max = Math.max(...stats.data.harian.map((h) => h.jumlah));
                    return stats.data.harian.map((h) => (
                      <div key={h.tanggal} className="bar-col" title={`${h.tanggal}: ${h.jumlah} pesanan · ${rupiah(h.nilai)}`}>
                        <span className="bar-val">{h.jumlah}</span>
                        <div className="bar" style={{ height: `${Math.max(8, (h.jumlah / max) * 100)}%` }} />
                        <span className="bar-label">{hariSingkat(h.tanggal)}</span>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </section>

            <section className="card">
              <h2>Pesanan per status</h2>
              <ul className="status-list">
                {STATUS_LIST.map((s) => {
                  const n = stats.data!.per_status[s] ?? 0;
                  const pct = stats.data!.pesanan ? (n / stats.data!.pesanan) * 100 : 0;
                  return (
                    <li key={s}>
                      <span className={`dot st-${s.toLowerCase()}`} />
                      <span className="grow">{s}</span>
                      <div className="meter"><div className={`st-${s.toLowerCase()}`} style={{ width: `${pct}%` }} /></div>
                      <strong>{n}</strong>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          <div className="grid-2">
            <section className="card">
              <h2>Pesanan terbaru</h2>
              {recent.loading && !recent.data ? <Loading /> : recent.error ? <ErrorState message={recent.error} onRetry={recent.reload} /> : (
                <ul className="plain-list">
                  {recent.data?.data.map((o) => (
                    <li key={o.id}>
                      <div>
                        <strong>{o.pelanggan_nama}</strong>
                        <div className="muted">{o.kode} · {o.layanan_nama}</div>
                      </div>
                      <div className="right">
                        <strong>{rupiah(o.total_harga)}</strong>
                        <div><span className={`badge st-${o.status.toLowerCase()}`}>{o.status}</span></div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card">
              <h2>Layanan terlaris</h2>
              {stats.data.layanan_teratas.length === 0 ? <p className="muted">Belum ada data.</p> : (
                <ul className="plain-list">
                  {stats.data.layanan_teratas.map((l, i) => (
                    <li key={l.nama}>
                      <div><span className="rank">{i + 1}</span> <strong>{l.nama}</strong></div>
                      <div className="right muted">{angka(l.jumlah_pesanan)} pesanan · {rupiah(l.pendapatan)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}
