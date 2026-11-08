export type Status = 'Diterima' | 'Dicuci' | 'Disetrika' | 'Selesai' | 'Diambil' | 'Dibatalkan';

export const STATUS_LIST: Status[] = ['Diterima', 'Dicuci', 'Disetrika', 'Selesai', 'Diambil', 'Dibatalkan'];

export const NEXT_STATUS: Record<Status, Status[]> = {
  Diterima: ['Dicuci', 'Dibatalkan'],
  Dicuci: ['Disetrika', 'Dibatalkan'],
  Disetrika: ['Selesai', 'Dibatalkan'],
  Selesai: ['Diambil'],
  Diambil: [],
  Dibatalkan: [],
};

export interface Pelanggan {
  id: number;
  nama: string;
  telepon: string;
  email: string | null;
  alamat: string | null;
  created_at: string;
  jumlah_pesanan: number;
}
export type PelangganInput = Pick<Pelanggan, 'nama' | 'telepon'> & { email: string; alamat: string };

export interface Layanan {
  id: number;
  nama: string;
  deskripsi: string | null;
  harga: number;
  satuan: 'kg' | 'pcs';
  estimasi_hari: number;
  aktif: 0 | 1;
  jumlah_pesanan: number;
}
export interface LayananInput {
  nama: string;
  deskripsi: string;
  harga: number | '';
  satuan: 'kg' | 'pcs';
  estimasi_hari: number | '';
  aktif: boolean;
}

export interface Pesanan {
  id: number;
  kode: string;
  pelanggan_id: number;
  layanan_id: number;
  pelanggan_nama: string;
  pelanggan_telepon: string;
  layanan_nama: string;
  layanan_satuan: 'kg' | 'pcs';
  jumlah: number;
  harga_satuan: number;
  total_harga: number;
  status: Status;
  dibayar: 0 | 1;
  catatan: string | null;
  tanggal_masuk: string;
  tanggal_estimasi: string;
  updated_at: string;
}
export interface PesananInput {
  pelanggan_id: number | '';
  layanan_id: number | '';
  jumlah: number | '';
  catatan: string;
  dibayar: boolean;
}

export interface Stats {
  pelanggan: number;
  layanan_aktif: number;
  pesanan: number;
  dalam_proses: number;
  siap_diambil: number;
  pendapatan: number;
  belum_dibayar: number;
  per_status: Record<Status, number>;
  layanan_teratas: { nama: string; jumlah_pesanan: number; pendapatan: number }[];
  harian: { tanggal: string; jumlah: number; nilai: number }[];
}

export interface Paged<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
