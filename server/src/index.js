import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { openDatabase } from './db.js';
import { seedIfEmpty } from './seed.js';

const PORT = Number(process.env.PORT) || 3001;
const file = process.env.DB_FILE || fileURLToPath(new URL('../data/laundry.db', import.meta.url));

const db = openDatabase(file);
if (seedIfEmpty(db)) console.log('Database kosong, data awal dimasukkan.');

createApp(db).listen(PORT, () => {
  console.log(`API Laundry berjalan di http://localhost:${PORT}/api`);
});
