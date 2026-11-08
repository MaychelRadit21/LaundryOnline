import type {
  Layanan, LayananInput, Paged, Pelanggan, PelangganInput, Pesanan, PesananInput, Stats, Status,
} from './types';

export class ApiError extends Error {
  status: number;
  details: Record<string, string>;
  constructor(status: number, message: string, details?: Record<string, string>) {
    super(message);
    this.status = status;
    this.details = details ?? {};
  }
}

const BASE = import.meta.env.VITE_API_URL ?? '/api';

async function request<T>(method: string, path: string, body?: unknown): Promise<{ data: T; meta?: Paged<T>['meta'] }> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Tidak dapat terhubung ke API server. Pastikan server berjalan di port 3001.');
  }
  let json: any = null;
  try { json = await res.json(); } catch { /* respons bukan JSON */ }
  if (!res.ok || !json?.success) {
    throw new ApiError(res.status, json?.error?.message ?? `Permintaan gagal (${res.status})`, json?.error?.details);
  }
  return json;
}

const qs = (params: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') p.set(k, String(v)); });
  const s = p.toString();
  return s ? `?${s}` : '';
};

const list = async <T>(path: string, params: Record<string, string | number | undefined>): Promise<Paged<T>> => {
  const r = await request<T[]>('GET', path + qs(params));
  return { data: r.data, meta: r.meta! };
};
const one = async <T>(method: string, path: string, body?: unknown) => (await request<T>(method, path, body)).data;

export const api = {
  stats: () => one<Stats>('GET', '/stats'),

  pelanggan: {
    list: (p: { search?: string; page?: number; limit?: number }) => list<Pelanggan>('/pelanggan', p),
    create: (d: PelangganInput) => one<Pelanggan>('POST', '/pelanggan', d),
    update: (id: number, d: PelangganInput) => one<Pelanggan>('PUT', `/pelanggan/${id}`, d),
    remove: (id: number) => one<{ id: number }>('DELETE', `/pelanggan/${id}`),
  },

  layanan: {
    list: (p: { search?: string; aktif?: 1; page?: number; limit?: number }) => list<Layanan>('/layanan', p),
    create: (d: LayananInput) => one<Layanan>('POST', '/layanan', d),
    update: (id: number, d: LayananInput) => one<Layanan>('PUT', `/layanan/${id}`, d),
    remove: (id: number) => one<{ id: number }>('DELETE', `/layanan/${id}`),
  },

  pesanan: {
    list: (p: { search?: string; status?: string; dibayar?: string; page?: number; limit?: number }) =>
      list<Pesanan>('/pesanan', p),
    get: (id: number) => one<Pesanan>('GET', `/pesanan/${id}`),
    create: (d: PesananInput) => one<Pesanan>('POST', '/pesanan', d),
    update: (id: number, d: PesananInput) => one<Pesanan>('PUT', `/pesanan/${id}`, d),
    setStatus: (id: number, status: Status) => one<Pesanan>('PATCH', `/pesanan/${id}/status`, { status }),
    setBayar: (id: number, dibayar: boolean) => one<Pesanan>('PATCH', `/pesanan/${id}/bayar`, { dibayar }),
    remove: (id: number) => one<{ id: number }>('DELETE', `/pesanan/${id}`),
  },
};
