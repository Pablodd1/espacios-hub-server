/** Central config — everything comes from env; see .env.example */
function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const env = {
  SIIGO_USERNAME: req('SIIGO_USERNAME', ''),
  SIIGO_ACCESS_KEY: req('SIIGO_ACCESS_KEY', ''),
  SIIGO_PARTNER_ID: req('SIIGO_PARTNER_ID', 'EspaciosHub'),
  SIIGO_SANDBOX: (process.env.SIIGO_SANDBOX ?? 'true') === 'true',
  SUPABASE_URL: req('SUPABASE_URL', ''),
  SUPABASE_SERVICE_KEY: req('SUPABASE_SERVICE_KEY', ''),
  SYNC_INTERVAL_MIN: Number(process.env.SYNC_INTERVAL_MIN ?? 15),
  PORT: Number(process.env.PORT ?? 3100),
  WEBHOOK_SECRET: req('WEBHOOK_SECRET', 'change_me'),
  BANK_MAP: JSON.parse(process.env.BANK_MAP_JSON ?? '{}') as Record<string, string>,
} as const;

export function assertConfigured() {
  const missing: string[] = [];
  if (!env.SIIGO_USERNAME) missing.push('SIIGO_USERNAME');
  if (!env.SIIGO_ACCESS_KEY) missing.push('SIIGO_ACCESS_KEY');
  if (!env.SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!env.SUPABASE_SERVICE_KEY) missing.push('SUPABASE_SERVICE_KEY');
  return missing;
}
