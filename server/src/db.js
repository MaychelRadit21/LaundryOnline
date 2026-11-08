import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS pelanggan (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nama       TEXT NOT NULL,
  telepon    TEXT NOT NULL UNIQUE,
  email      TEXT,
  alamat     TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS layanan (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nama          TEXT NOT NULL UNIQUE,
  deskripsi     TEXT,
  harga         INTEGER NOT NULL CHECK (harga >= 0),
  satuan        TEXT NOT NULL DEFAULT 'kg' CHECK (satuan IN ('kg','pcs')),
  estimasi_hari INTEGER NOT NULL DEFAULT 2 CHECK (estimasi_hari >= 0),
  aktif         INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS pesanan (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  kode           TEXT NOT NULL UNIQUE,
  pelanggan_id   INTEGER NOT NULL REFERENCES pelanggan(id) ON DELETE RESTRICT,
  layanan_id     INTEGER NOT NULL REFERENCES layanan(id) ON DELETE RESTRICT,
  jumlah         REAL NOT NULL CHECK (jumlah > 0),
  harga_satuan   INTEGER NOT NULL,
  total_harga    INTEGER NOT NULL,
  status         TEXT NOT NULL DEFAULT 'Diterima'
                 CHECK (status IN ('Diterima','Dicuci','Disetrika','Selesai','Diambil','Dibatalkan')),
  dibayar        INTEGER NOT NULL DEFAULT 0,
  catatan        TEXT,
  tanggal_masuk  TEXT NOT NULL,
  tanggal_estimasi TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_pesanan_status ON pesanan(status);
CREATE INDEX IF NOT EXISTS idx_pesanan_pelanggan ON pesanan(pelanggan_id);
`;

export function openDatabase(file = ':memory:') {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  return db;
}

export const STATUS_LIST = ['Diterima', 'Dicuci', 'Disetrika', 'Selesai', 'Diambil', 'Dibatalkan'];
