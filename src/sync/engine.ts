/**
 * Sync engine — pulls each SIIGO module, maps, upserts into the Hub DB.
 * Runs on a cron schedule and can be triggered manually via HTTP.
 */
import { siigoGet, siigoRequest } from '../siigo/client.js';
import { endpoints } from '../siigo/endpoints.js';
import type { Paged, SiigoJournal, SiigoPaymentReceipt, SiigoPurchase, SiigoVoucher } from '../siigo/endpoints.js';
import { mapJournal, mapPaymentReceipt, mapPurchase, mapVoucher, type DocumentoRow } from '../mapping.js';
import { audit, logSyncJob, upsertDocumentos } from '../db.js';

export type ModuleName = 'tesoreria' | 'cartera' | 'contabilidad' | 'logistica';

interface ModuleSpec {
  path: string;
  map: (raw: never) => DocumentoRow;
  label: string;
}

const MODULES: Record<ModuleName, ModuleSpec> = {
  tesoreria:    { path: endpoints.paymentReceipts, map: mapPaymentReceipt as never, label: 'Tesoreria (egresos)' },
  cartera:      { path: endpoints.vouchers,        map: mapVoucher as never,        label: 'Cartera (recibos)' },
  contabilidad: { path: endpoints.journals,        map: mapJournal as never,        label: 'Contabilidad (causaciones)' },
  logistica:    { path: endpoints.purchases,       map: mapPurchase as never,       label: 'Logistica (compras)' },
};

export interface SyncResult {
  modulo: ModuleName;
  fetched: number;
  upserted: number;
  errors: number;
  message: string;
}

export async function syncModule(modulo: ModuleName, sinceDate?: string): Promise<SyncResult> {
  const spec = MODULES[modulo];
  let fetched = 0, upserted = 0, errors = 0;
  const notes: string[] = [];
  try {
    // SIIGO list endpoints paginate with ?page=&page_size=; created_since supported on most
    const qs = new URLSearchParams({ page: '1', page_size: '100' });
    if (sinceDate) qs.set('created_since', sinceDate);
    const page = await siigoGet<Paged<unknown>>(`${spec.path}?${qs}`);
    const rows = (page.results ?? []).map((raw) => spec.map(raw as never));
    fetched = rows.length;
    const res = await upsertDocumentos(rows);
    upserted = res.inserted;
    notes.push(`${spec.label}: ${fetched} docs leidos, ${upserted} nuevos`);
  } catch (e) {
    errors = 1;
    notes.push(`ERROR ${spec.label}: ${(e as Error).message}`);
  }
  const result: SyncResult = { modulo, fetched, upserted, errors, message: notes.join(' | ') };
  await logSyncJob(spec.label, fetched, errors, result.message, errors ? 'error' : 'completado');
  await audit('sincronizó', 'sync', modulo, result);
  return result;
}

export async function syncAll(sinceDate?: string): Promise<SyncResult[]> {
  const out: SyncResult[] = [];
  for (const m of Object.keys(MODULES) as ModuleName[]) {
    out.push(await syncModule(m, sinceDate));
  }
  return out;
}

/**
 * Push a locally-created document BACK to SIIGO (write path).
 * Uses Idempotency-Key so retries never duplicate the asiento.
 */
export async function pushToSiigo(modulo: ModuleName, payload: unknown, idempotencyKey: string) {
  const spec = MODULES[modulo];
  return siigoRequest('POST', spec.path, payload, { idempotencyKey });
}
