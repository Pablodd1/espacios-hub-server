/** Espacios Hub sync server — bootstrap */
import express from 'express';
import cron from 'node-cron';
import { assertConfigured, env } from './config.js';
import { syncAll, syncModule, type ModuleName } from './sync/engine.js';
import { webhooksRouter } from './sync/webhooks.js';
import { hgi } from './hgi/adapter.js';
import { adminRouter } from './admin.js';

const app = express();
app.use(express.json({ limit: '2mb' }));

// CORS — the frontend lives on GitHub Pages; allow it to call the API.
// Set ALLOWED_ORIGIN in Vercel env (e.g. https://pablodd1.github.io); '*' default for testing.
const allowed = process.env.ALLOWED_ORIGIN ?? '*';
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  next();
});

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    mode: env.SIIGO_SANDBOX ? 'sandbox' : 'production',
    hgi: hgi.isConfigured() ? 'configured' : 'pending-license',
    syncIntervalMin: env.SYNC_INTERVAL_MIN,
    time: new Date().toISOString(),
  });
});

app.use('/webhooks', webhooksRouter);
app.use('/admin', adminRouter);

// Manual trigger: POST /sync/run/tesoreria|cartera|contabilidad|logistica|all
app.post('/sync/run/:modulo', async (req, res) => {
  const m = req.params.modulo;
  const since = req.query.since as string | undefined;
  try {
    if (m === 'all') res.json(await syncAll(since));
    else res.json(await syncModule(m as ModuleName, since));
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// On Vercel (serverless) there is no long-lived process: skip cron + listen.
// Vercel Cron Jobs can hit POST /sync/run/all on a schedule instead.
if (!process.env.VERCEL) {
  const missing = assertConfigured();
  if (missing.length) {
    console.warn(`[startup] Missing env vars: ${missing.join(', ')} — sync endpoints will fail until configured (see .env.example)`);
  } else {
    cron.schedule(`*/${env.SYNC_INTERVAL_MIN} * * * *`, async () => {
      console.log(`[cron] sync cycle ${new Date().toISOString()}`);
      try { await syncAll(); } catch (e) { console.error('[cron] sync failed', e); }
    });
    console.log(`[cron] scheduled every ${env.SYNC_INTERVAL_MIN} min`);
  }

  app.listen(env.PORT, () => console.log(`Espacios Hub sync server on :${env.PORT}`));
}

export default app;
