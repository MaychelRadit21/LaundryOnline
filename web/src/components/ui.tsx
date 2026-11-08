import type { ReactNode } from 'react';
import type { Status } from '../lib/types';

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`badge st-${status.toLowerCase()}`}>{status}</span>;
}

export function PayBadge({ paid }: { paid: boolean }) {
  return <span className={`badge ${paid ? 'st-lunas' : 'st-belum'}`}>{paid ? 'Lunas' : 'Belum bayar'}</span>;
}

export function Field({ label, error, children, hint }: { label: string; error?: string; children: ReactNode; hint?: string }) {
  return (
    <label className={`field${error ? ' has-error' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Loading({ text = 'Memuat data…' }: { text?: string }) {
  return (
    <div className="state"><span className="spinner" aria-hidden /> {text}</div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state state-error" role="alert">
      <strong>Gagal memuat data</strong>
      <span>{message}</span>
      {onRetry && <button className="btn" onClick={onRetry}>Coba lagi</button>}
    </div>
  );
}

export function EmptyState({ title, text }: { title: string; text?: string }) {
  return (
    <div className="state">
      <strong>{title}</strong>
      {text && <span className="muted">{text}</span>}
    </div>
  );
}

interface PagerProps { page: number; totalPages: number; total: number; onPage: (p: number) => void }
export function Pager({ page, totalPages, total, onPage }: PagerProps) {
  return (
    <div className="pager">
      <span className="muted">{total} data · Halaman {page} dari {totalPages}</span>
      <div className="row">
        <button className="btn btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>← Sebelumnya</button>
        <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Berikutnya →</button>
      </div>
    </div>
  );
}
