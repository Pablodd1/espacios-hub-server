/**
 * SIIGO API client — auth, rate limiting, retries, idempotency.
 * Docs: https://siigoapi.docs.apiary.io · Base: https://api.siigo.com/v1
 * Auth: POST https://api.siigo.com/auth { username, access_key } -> { access_token }
 * Every call needs headers: Authorization + Partner-Id. Limit: 100 req/min/company.
 */
import { env } from '../config.js';

interface TokenCache { token: string | null; expiresAt: number }
const cache: TokenCache = { token: null, expiresAt: 0 };

const BASE = 'https://api.siigo.com/v1';
const AUTH_URL = 'https://api.siigo.com/auth';

async function authenticate(): Promise<string> {
  if (cache.token && Date.now() < cache.expiresAt - 60_000) return cache.token;
  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Partner-Id': env.SIIGO_PARTNER_ID },
    body: JSON.stringify({ username: env.SIIGO_USERNAME, access_key: env.SIIGO_ACCESS_KEY }),
  });
  if (!res.ok) throw new Error(`SIIGO auth failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; expires_in?: number };
  cache.token = data.access_token;
  cache.expiresAt = Date.now() + (data.expires_in ?? 86_400) * 1000;
  return cache.token;
}

// naive token bucket: 100 req/min -> ~600ms spacing
let lastCall = 0;
async function throttle() {
  const wait = Math.max(0, 620 - (Date.now() - lastCall));
  if (wait) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

export class SiigoError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function siigoRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  opts: { idempotencyKey?: string; retries?: number } = {},
): Promise<T> {
  const token = await authenticate();
  await throttle();
  const headers: Record<string, string> = {
    Authorization: token,
    'Partner-Id': env.SIIGO_PARTNER_ID,
    'Content-Type': 'application/json',
  };
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

  const attempts = (opts.retries ?? 2) + 1;
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(`${BASE}${path}`, {
      method, headers, body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429 || res.status >= 500) {
      if (i < attempts - 1) { await new Promise((r) => setTimeout(r, 1000 * 2 ** i)); continue; }
    }
    if (!res.ok) throw new SiigoError(res.status, `SIIGO ${method} ${path}: ${res.status} ${await res.text()}`);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }
  throw new SiigoError(0, 'unreachable');
}

export const siigoGet = <T>(path: string) => siigoRequest<T>('GET', path);
export const siigoPost = <T>(path: string, body: unknown, idempotencyKey: string) =>
  siigoRequest<T>('POST', path, body, { idempotencyKey });
