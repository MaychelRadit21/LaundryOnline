import { fileURLToPath } from 'node:url';
import { openDatabase } from './db.js';
import { seedIfEmpty } from './seed.js';

const file = process.env.DB_FILE || fileURLToPath(new URL('../data/laundry.db', import.meta.url));
const db = openDatabase(file);
console.log(seedIfEmpty(db) ? 'Data awal berhasil dimasukkan.' : 'Database sudah berisi data, seed dilewati.');
