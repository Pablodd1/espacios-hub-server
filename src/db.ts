/** Supabase persistence layer (service role — server only, never expose key client-side) */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './config.js';
import type { DocumentoRow } from './mapping.js';

let _db: SupabaseClient | null = null;

/** Lazy client: only created when configured; throws a clear error otherwise. */
function db(): SupabaseClient {
  if (!_db) {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
      throw new Error('Supabase not configured — set SUPABASE_URL and SUPABASE_SERVICE_KEY (see .env.example)');
    }
    _db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  }
  return _db;
}

/** Upsert documentos by idempotency_key — safe to re-run forever */
export async function upsertDocumentos(rows: DocumentoRow[]) {
  if (!rows.length) return { inserted: 0 };
  const { error, count } = await db()
    .from('documentos')
    .upsert(rows, { onConflict: 'idempotency_key', ignoreDuplicates: true, count: 'exact' });
  if (error) throw new Error(`upsert documentos: ${error.message}`);
  return { inserted: count ?? rows.length };
}

export async function logSyncJob(modulo: string, docsProcesados: number, docsError: number, mensaje: string, estado: string) {
  await db().from('sync_jobs').insert({
    modulo,
    direccion: 'SIIGO->HUB',
    docs_procesados: docsProcesados,
    docs_error: docsError,
    estado,
    mensaje,
    finished_at: new Date().toISOString(),
  });
}

export async function audit(accion: string, entidad: string, entidadId: string, detalle: unknown) {
  await db().from('audit_log').insert({
    actor: 'sync-engine',
    accion,
    entidad,
    entidad_id: entidadId,
    detalle: detalle as object,
  });
}
