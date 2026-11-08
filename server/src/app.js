import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ApiError } from './http.js';
import { pelangganRouter } from './routes/pelanggan.js';
import { layananRouter } from './routes/layanan.js';
import { pesananRouter } from './routes/pesanan.js';
import { statsRouter } from './routes/stats.js';

const WEB_DIST = fileURLToPath(new URL('../../web/dist', import.meta.url));

export function createApp(db) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok', waktu: new Date().toISOString() } });
  });
  app.use('/api/pelanggan', pelangganRouter(db));
  app.use('/api/layanan', layananRouter(db));
  app.use('/api/pesanan', pesananRouter(db));
  app.use('/api/stats', statsRouter(db));

  app.use('/api', (_req, _res, next) => next(new ApiError(404, 'Endpoint tidak ditemukan')));

  // Mode produksi: Express juga menyajikan hasil build web (npm start).
  if (existsSync(WEB_DIST)) {
    app.use(express.static(WEB_DIST));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(`${WEB_DIST}/index.html`));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof ApiError) {
      return res.status(err.status).json({ success: false, error: { message: err.message, details: err.details } });
    }
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ success: false, error: { message: 'Body JSON tidak valid' } });
    }
    console.error(err);
    res.status(500).json({ success: false, error: { message: 'Terjadi kesalahan pada server' } });
  });

  return app;
}
