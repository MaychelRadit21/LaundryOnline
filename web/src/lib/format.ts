export const rupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

export const tanggal = (s: string) =>
  new Date(s.length === 10 ? `${s}T00:00:00` : s.replace(' ', 'T')).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

export const angka = (n: number) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(n);

export const hariSingkat = (s: string) =>
  new Date(`${s}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'short' });

export const hariIni = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
