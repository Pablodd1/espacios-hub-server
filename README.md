# Espacios Hub — Sync Server (SIIGO ↔ Hub ↔ HGI)

Servicio de sincronización real para Espacios Hub. Estado: **listo para credenciales** —
toda la lógica está implementada; al agregar las credenciales en `.env` queda operativo.

## Qué hace
- **Pull programado** (cada `SYNC_INTERVAL_MIN`, default 15 min): egresos (`/payment-receipts`),
  recibos de caja (`/vouchers`), causaciones (`/journals`), compras (`/purchases`) desde SIIGO →
  tabla `documentos` en Supabase (upsert por `idempotency_key`, jamás duplica).
- **Webhooks SIIGO** (`POST /webhooks/siigo`): sincronización en tiempo real por evento.
- **Push de escritura** hacia SIIGO con header `Idempotency-Key`.
- Registra `sync_jobs` + `audit_log` en cada ciclo.
- **HGI**: adaptador con contrato definido; pendiente licencia HGInet Web API (ver `docs/HGI_REQUEST_EMAIL.md`).
  Fallback de lectura vía SQL Server documentado en `src/hgi/adapter.ts`.

## Setup (15 min)
1. Crear app en https://developer.siigo.com → ambiente **sandbox** (gratis).
2. `cp .env.example .env` y completar: `SIIGO_USERNAME`, `SIIGO_ACCESS_KEY`,
   `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (service_role, solo servidor).
3. Provisionar la base: ejecutar en Supabase SQL editor, en orden:
   `supabase/espacios_hub_init_schema.sql` → `espacios_hub_seed_data.sql` → `espacios_hub_rls_policies.sql`.
4. `npm install && npm run dev` → `GET http://localhost:3100/health`.
5. Probar: `curl -X POST http://localhost:3100/sync/run/all` — revisa `sync_jobs` en Supabase.
6. Registrar webhook en el portal SIIGO: `{URL_PUBLICA}/webhooks/siigo`.
7. Producción: cambiar `SIIGO_SANDBOX=false` y usar credenciales productivas.

## Notas de ingeniería
- Rate limit SIIGO: 100 req/min/empresa — el cliente aplica throttle (~600ms) automáticamente.
- `Partner-Id: EspaciosHub` va en todos los headers (requerido por SIIGO).
- Reintentos con backoff en 429/5xx; `Idempotency-Key` en todos los POST.
- Los montos `base/iva/retencion` se enriquecen en Fase 2 con el trial balance (`/trial-balance-by-third`)
  para la conciliación fiscal diaria.
