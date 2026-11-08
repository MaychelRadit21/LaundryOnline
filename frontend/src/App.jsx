import { useCallback, useEffect, useState } from 'react'
import 'bootstrap/dist/css/bootstrap.min.css'
import './App.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const money = value => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(value)
const date = value => new Date(value.endsWith('Z') ? value : `${value}Z`).toLocaleString('id-ID')
const statuses = ['Diterima', 'Dicuci', 'Dikeringkan', 'Disetrika', 'Siap Diambil', 'Selesai']

async function request(path, token, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...options.headers },
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(response.status === 401 ? 'Sesi tidak valid atau kredensial salah.' : text || `Permintaan gagal (${response.status})`)
  }
  return response.status === 204 ? null : response.json()
}

function App() {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('laundrySession')) } catch { return null }
  })
  const [register, setRegister] = useState(false)
  const [tab, setTab] = useState('dashboard')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [services, setServices] = useState([])
  const [customers, setCustomers] = useState([])
  const [orders, setOrders] = useState([])
  const [membership, setMembership] = useState(null)
  const [report, setReport] = useState(null)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [editingService, setEditingService] = useState(null)
  const [receipt, setReceipt] = useState(null)
  const staff = session && session.user.role !== 'Pelanggan'

  const load = useCallback(async () => {
    if (!session) return
    try {
      const [serviceData, orderData, extra] = await Promise.all([
        request('/services', session.token), request('/orders', session.token),
        request(staff ? '/customers' : '/membership', session.token),
      ])
      setServices(serviceData); setOrders(orderData)
      if (staff) setCustomers(extra); else setMembership(extra)
    } catch (e) { setError(e.message) }
  }, [session, staff])
  useEffect(() => { load() }, [load])

  async function action(path, method, body, message, after) {
    setError(''); setNotice('')
    try {
      const result = await request(path, session?.token, { method, ...(body ? { body: JSON.stringify(body) } : {}) })
      if (message) setNotice(message)
      if (after) after(result)
      if (session) await load()
      return true
    } catch (e) { setError(e.message); return false }
  }
  async function authSubmit(e) {
    e.preventDefault()
    const form = Object.fromEntries(new FormData(e.currentTarget))
    if (register) {
      if (await action('/auth/register', 'POST', form, 'Registrasi berhasil. Silakan masuk.')) setRegister(false)
    } else {
      await action('/auth/login', 'POST', form, '', result => {
        sessionStorage.setItem('laundrySession', JSON.stringify(result)); setSession(result); setTab('dashboard')
      })
    }
  }
  function logout() { sessionStorage.removeItem('laundrySession'); setSession(null); setError(''); setNotice(''); setReceipt(null) }
  async function customerSubmit(e) {
    e.preventDefault()
    const form = e.currentTarget
    const data = Object.fromEntries(new FormData(form))
    const body = editingCustomer ? { name: data.name, phone: data.phone, isMember: data.isMember === 'on' } : data
    if (await action(editingCustomer ? `/customers/${editingCustomer.id}` : '/customers', editingCustomer ? 'PUT' : 'POST', body, 'Pelanggan disimpan.')) {
      setEditingCustomer(null); form.reset()
    }
  }
  async function serviceSubmit(e) {
    e.preventDefault()
    const form = e.currentTarget
    const data = Object.fromEntries(new FormData(form)); data.pricePerKg = Number(data.pricePerKg)
    if (await action(editingService ? `/services/${editingService.id}` : '/services', editingService ? 'PUT' : 'POST', data, 'Layanan disimpan.')) {
      setEditingService(null); form.reset()
    }
  }
  async function orderSubmit(e) {
    e.preventDefault()
    const form = e.currentTarget; const data = Object.fromEntries(new FormData(form))
    const body = { customerId: Number(data.customerId || 0), serviceId: Number(data.serviceId), weightKg: Number(data.weightKg), useMembership: data.useMembership === 'on' }
    if (await action('/orders', 'POST', body, 'Pesanan berhasil dibuat.')) form.reset()
  }
  async function reportSubmit(e) {
    e.preventDefault()
    const params = new URLSearchParams([...new FormData(e.currentTarget)].filter(([, value]) => value))
    try { setError(''); setReport(await request(`/reports?${params}`, session.token)) } catch (err) { setError(err.message) }
  }
  async function remove(path) {
    if (window.confirm('Hapus data ini?')) await action(path, 'DELETE', null, 'Data dihapus.')
  }

  if (!session) return <main className="container auth-container py-5">
    <h1>Laundry Online</h1><p className="text-secondary">Kelola laundry dengan mudah.</p>
    {error && <div className="alert alert-danger" role="alert">{error}</div>}
    {notice && <div className="alert alert-success" role="status">{notice}</div>}
    <form className="card card-body shadow-sm" onSubmit={authSubmit}>
      <h2 className="h4">{register ? 'Registrasi pelanggan' : 'Masuk'}</h2>
      {register && <><label className="form-label">Nama<input className="form-control" name="name" required maxLength="100" /></label>
        <label className="form-label">Telepon<input className="form-control" name="phone" maxLength="30" /></label></>}
      <label className="form-label">Email<input className="form-control" name="email" type="email" required maxLength="200" /></label>
      <label className="form-label">Password<input className="form-control" name="password" type="password" required minLength="8" maxLength="200" /></label>
      <button className="btn btn-primary">{register ? 'Daftar' : 'Masuk'}</button>
      <button type="button" className="btn btn-link mt-2" onClick={() => { setRegister(!register); setError(''); setNotice('') }}>{register ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar'}</button>
    </form>
  </main>

  const tabs = [['dashboard', 'Dashboard'], ...(staff ? [['customers', 'Pelanggan'], ['services', 'Layanan']] : []), ['orders', 'Pesanan & Riwayat'], ...(staff ? [['reports', 'Laporan']] : []), ...(session.user.role === 'Admin' ? [['staff', 'Kasir']] : [])]
  return <>
    <div className="app-content">
      <header className="bg-primary text-white py-3"><div className="container d-flex justify-content-between align-items-center gap-3">
        <div><h1 className="h4 mb-0">Laundry Online</h1><small>{session.user.name} · {session.user.role}</small></div>
        <button className="btn btn-outline-light btn-sm" onClick={logout}>Keluar</button>
      </div></header>
      <main className="container py-4">
        <nav className="nav nav-pills gap-2 mb-4" aria-label="Menu utama">{tabs.map(([key, label]) => <button key={key} className={`nav-link ${tab === key ? 'active' : ''}`} onClick={() => { setTab(key); setError(''); setNotice('') }}>{label}</button>)}</nav>
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        {notice && <div className="alert alert-success" role="status">{notice}</div>}
        {tab === 'dashboard' && <section><h2>Dashboard {session.user.role}</h2>
          <div className="row g-3 mt-1">
            <div className="col-md-4"><div className="card card-body"><strong>Pesanan</strong><span className="fs-3">{orders.length}</span></div></div>
            <div className="col-md-4"><div className="card card-body"><strong>Dalam proses</strong><span className="fs-3">{orders.filter(o => o.status !== 'Selesai').length}</span></div></div>
            {staff ? <div className="col-md-4"><div className="card card-body"><strong>Pelanggan</strong><span className="fs-3">{customers.length}</span></div></div>
              : <div className="col-md-4"><div className="card card-body"><strong>Membership ({membership?.monthUtc} UTC)</strong><span>{membership?.isMember ? `Terpakai ${membership.usedKg} / 300 kg; sisa ${membership.remainingKg} kg` : 'Tidak aktif'}</span></div></div>}
          </div></section>}
        {tab === 'customers' && staff && <section><h2>Pelanggan</h2>
          <form key={editingCustomer?.id || 'new'} className="card card-body mb-4" onSubmit={customerSubmit}>
            <h3 className="h5">{editingCustomer ? 'Ubah pelanggan' : 'Tambah pelanggan'}</h3>
            <div className="row g-2">
              <div className="col-md"><label className="form-label w-100">Nama<input className="form-control" name="name" defaultValue={editingCustomer?.name} required maxLength="100" /></label></div>
              <div className="col-md"><label className="form-label w-100">Telepon<input className="form-control" name="phone" defaultValue={editingCustomer?.phone} maxLength="30" /></label></div>
              {!editingCustomer && <><div className="col-md"><label className="form-label w-100">Email<input className="form-control" name="email" type="email" required maxLength="200" /></label></div><div className="col-md"><label className="form-label w-100">Password<input className="form-control" name="password" type="password" required minLength="8" maxLength="200" /></label></div></>}
            </div>
            {editingCustomer && <label className="form-check mb-2"><input className="form-check-input" type="checkbox" name="isMember" defaultChecked={editingCustomer.isMember} /> Membership aktif</label>}
            <div><button className="btn btn-primary me-2">Simpan</button>{editingCustomer && <button type="button" className="btn btn-secondary" onClick={() => setEditingCustomer(null)}>Batal</button>}</div>
          </form>
          <div className="table-responsive"><table className="table table-striped"><thead><tr><th>Nama</th><th>Email</th><th>Telepon</th><th>Membership</th><th>Aksi</th></tr></thead><tbody>{customers.map(c => <tr key={c.id}><td>{c.name}</td><td>{c.email}</td><td>{c.phone}</td><td>{c.isMember ? 'Aktif' : 'Tidak'}</td><td><button className="btn btn-sm btn-outline-primary me-1" onClick={() => setEditingCustomer(c)}>Ubah</button><button className="btn btn-sm btn-outline-danger" onClick={() => remove(`/customers/${c.id}`)}>Hapus</button></td></tr>)}</tbody></table></div>
        </section>}
        {tab === 'services' && staff && <section><h2>Layanan & harga</h2>
          <form key={editingService?.id || 'new'} className="card card-body mb-4" onSubmit={serviceSubmit}>
            <h3 className="h5">{editingService ? 'Ubah layanan' : 'Tambah layanan'}</h3><div className="row g-2">
              <div className="col-md"><label className="form-label w-100">Nama<input name="name" className="form-control" defaultValue={editingService?.name} required maxLength="100" /></label></div>
              <div className="col-md"><label className="form-label w-100">Harga per kg<input name="pricePerKg" className="form-control" type="number" min="0" max="100000000" step="0.01" defaultValue={editingService?.pricePerKg} required /></label></div></div>
            <div><button className="btn btn-primary me-2">Simpan</button>{editingService && <button type="button" className="btn btn-secondary" onClick={() => setEditingService(null)}>Batal</button>}</div>
          </form>
          <div className="table-responsive"><table className="table table-striped"><thead><tr><th>Nama</th><th>Harga/kg</th><th>Aksi</th></tr></thead><tbody>{services.map(s => <tr key={s.id}><td>{s.name}</td><td>{money(s.pricePerKg)}</td><td><button className="btn btn-sm btn-outline-primary me-1" onClick={() => setEditingService(s)}>Ubah</button><button className="btn btn-sm btn-outline-danger" onClick={() => remove(`/services/${s.id}`)}>Hapus</button></td></tr>)}</tbody></table></div>
        </section>}
        {tab === 'orders' && <section><h2>Pesanan & riwayat</h2>
          <form className="card card-body mb-4" onSubmit={orderSubmit}><h3 className="h5">Pesanan baru</h3><div className="row g-2">
            {staff && <div className="col-md"><label className="form-label w-100">Pelanggan<select name="customerId" className="form-select" required defaultValue=""><option value="" disabled>Pilih pelanggan</option>{customers.map(c => <option value={c.id} key={c.id}>{c.name} ({c.email})</option>)}</select></label></div>}
            <div className="col-md"><label className="form-label w-100">Layanan<select name="serviceId" className="form-select" required defaultValue=""><option value="" disabled>Pilih layanan</option>{services.map(s => <option value={s.id} key={s.id}>{s.name} - {money(s.pricePerKg)}/kg</option>)}</select></label></div>
            <div className="col-md"><label className="form-label w-100">Berat (kg)<input className="form-control" name="weightKg" type="number" min="0.01" max="10000" step="0.01" required /></label></div></div>
            <label className="form-check mb-2"><input className="form-check-input" type="checkbox" name="useMembership" /> Gunakan kuota membership</label>
            <div><button className="btn btn-primary">Buat pesanan</button></div>
          </form>
          <div className="table-responsive"><table className="table table-striped"><thead><tr><th>No.</th><th>Pelanggan</th><th>Layanan</th><th>Berat</th><th>Total</th><th>Status</th><th>Pembayaran</th><th>Nota</th></tr></thead><tbody>{orders.map(o => <tr key={o.id}><td>#{o.id}<br /><small>{date(o.createdAt)}</small></td><td>{o.customer}</td><td>{o.service}{o.usesMembership && ' (membership)'}</td><td>{o.weightKg} kg</td><td>{money(o.total)}</td><td>{staff ? <select aria-label={`Status pesanan ${o.id}`} className="form-select form-select-sm" value={o.status} onChange={e => action(`/orders/${o.id}/status`, 'PUT', { status: e.target.value }, 'Status diperbarui.')}>{statuses.map(s => <option key={s}>{s}</option>)}</select> : o.status}</td><td>{o.payment ? `Lunas (${o.payment.method})` : staff ? <select aria-label={`Bayar pesanan ${o.id}`} className="form-select form-select-sm" value="" onChange={e => action(`/orders/${o.id}/payment`, 'POST', { method: e.target.value }, 'Pembayaran dicatat.')}><option value="" disabled>Bayar...</option><option>Tunai</option><option>Transfer</option></select> : 'Belum dibayar'}</td><td><button className="btn btn-sm btn-outline-primary" onClick={() => setReceipt(o)}>Lihat</button></td></tr>)}</tbody></table></div>
        </section>}
        {tab === 'reports' && staff && <section><h2>Laporan transaksi</h2><p>Filter berdasarkan tanggal pembayaran (UTC).</p><form className="d-flex flex-wrap gap-2 align-items-end mb-3" onSubmit={reportSubmit}>
          <label>Dari<input className="form-control" type="date" name="from" /></label><label>Sampai<input className="form-control" type="date" name="to" /></label><button className="btn btn-primary">Tampilkan</button></form>
          {report && <><p>{report.count} pembayaran · Total {money(report.total)}</p><div className="table-responsive"><table className="table"><thead><tr><th>Pesanan</th><th>Pelanggan</th><th>Waktu</th><th>Metode</th><th>Total</th></tr></thead><tbody>{report.transactions.map(t => <tr key={t.orderId}><td>#{t.orderId}</td><td>{t.customer}</td><td>{date(t.paidAt)}</td><td>{t.method}</td><td>{money(t.amount)}</td></tr>)}</tbody></table></div></>}
        </section>}
        {tab === 'staff' && session.user.role === 'Admin' && <section><h2>Tambah kasir</h2><form className="card card-body" onSubmit={async e => { e.preventDefault(); const form = e.currentTarget; if (await action('/staff', 'POST', Object.fromEntries(new FormData(form)), 'Kasir berhasil dibuat.')) form.reset() }}>
          <label className="form-label">Nama<input className="form-control" name="name" required maxLength="100" /></label><label className="form-label">Email<input className="form-control" name="email" type="email" required maxLength="200" /></label><label className="form-label">Telepon<input className="form-control" name="phone" maxLength="30" /></label><label className="form-label">Password<input className="form-control" name="password" type="password" required minLength="8" maxLength="200" /></label><div><button className="btn btn-primary">Tambah</button></div></form></section>}
      </main>
    </div>
    {receipt && <div className="receipt-overlay"><section className="card card-body receipt" aria-label="Nota"><h2>Nota #{receipt.id}</h2><p>{date(receipt.createdAt)}<br />Pelanggan: {receipt.customer}<br />Layanan: {receipt.service}<br />Berat: {receipt.weightKg} kg<br />Harga/kg: {money(receipt.pricePerKg)}<br />Membership: {receipt.usesMembership ? 'Ya' : 'Tidak'}<br /><strong>Total: {money(receipt.total)}</strong><br />{receipt.payment ? `Lunas · ${receipt.payment.method} · ${date(receipt.payment.paidAt)}` : 'Belum dibayar'}</p><div className="receipt-actions"><button className="btn btn-primary me-2" onClick={() => window.print()}>Cetak</button><button className="btn btn-secondary" onClick={() => setReceipt(null)}>Tutup</button></div></section></div>}
  </>
}

export default App
