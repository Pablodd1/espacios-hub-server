/**
 * SIIGO webhook receiver — real-time events instead of waiting for the next poll.
 * Register webhook URL in SIIGO developer portal: POST {PUBLIC_URL}/webhooks/siigo
 */
import { Router } from 'express';
import { env } from '../config.js';
import { audit } from '../db.js';
import { syncModule, type ModuleName } from './engine.js';

export const webhooksRouter = Router();

// Map SIIGO event topics to our modules (adjust to actual event names from portal)
const TOPIC_MAP: Record<string, ModuleName> = {
  'payment-receipt.created': 'tesoreria',
  'payment-receipt.updated': 'tesoreria',
  'voucher.created': 'cartera',
  'voucher.updated': 'cartera',
  'journal.created': 'contabilidad',
  'purchase.created': 'logistica',
  'purchase.updated': 'logistica',
};

webhooksRouter.post('/siigo', async (req, res) => {
  // TODO: verify SIIGO webhook signature once portal documents the scheme; secret gates casual hits
  const secret = req.header('x-webhook-secret');
  if (env.WEBHOOK_SECRET !== 'change_me' && secret !== env.WEBHOOK_SECRET) {
    res.status(401).json({ error: 'invalid webhook secret' });
    return;
  }
  const topic = (req.body?.event ?? req.body?.topic ?? '') as string;
  const modulo = TOPIC_MAP[topic];
  res.status(202).json({ received: true, topic, modulo: modulo ?? null }); // ack fast, SIIGO retries on timeout
  if (modulo) {
    try {
      await syncModule(modulo);
    } catch (e) {
      await audit('error', 'webhook', topic, { error: (e as Error).message });
    }
  } else {
    await audit('webhook_sin_mapear', 'webhook', topic || 'unknown', req.body);
  }
});
