/**
 * Mapping layer: SIIGO payloads -> Espacios Hub schema rows.
 * Tables: terceros, bancos, documentos, reconciliacion (see supabase/espacios_hub_init_schema.sql)
 */
import type { SiigoJournal, SiigoPaymentReceipt, SiigoPurchase, SiigoVoucher } from './siigo/endpoints.js';
import { env } from './config.js';

export type TipoDocumento = 'egreso' | 'recibo_caja' | 'compra' | 'factura' | 'causacion' | 'anticipo';

export interface DocumentoRow {
  tipo: TipoDocumento;
  sistema_origen: 'SIIGO';
  numero: string;
  tercero_id: string | null;   // resolved via terceros lookup (nit)
  banco_id: string | null;     // resolved via BANK_MAP / bancos table
  fecha: string;
  valor: number;
  base: number;
  iva: number;
  retencion: number;
  estado: 'pendiente' | 'sincronizado' | 'diferencia' | 'error';
  sincronizado_hgi: boolean;
  idempotency_key: string;
  notas: string | null;
}

export interface TerceroRow {
  nit: string;
  nombre: string;
  tipo: 'cliente' | 'proveedor' | 'proveedor_exterior';
  email: string | null;
  whatsapp: string | null;
  zona: string | null;
}

/** Idempotency: deterministic per SIIGO doc so retries never duplicate */
export function idemKey(tipo: TipoDocumento, siigoId: string | undefined, numero: string) {
  return `siigo:${tipo}:${siigoId ?? numero}`;
}

export function mapPaymentReceipt(p: SiigoPaymentReceipt): DocumentoRow {
  const numero = `E-${p.document?.id ?? ''}-${p.number ?? ''}`;
  const total = p.total ?? p.payments?.reduce((s, x) => s + x.value, 0) ?? 0;
  // resolve bank from payment account name via BANK_MAP (env-configurable)
  const bancoNombre = p.name ?? '';
  return {
    tipo: 'egreso',
    sistema_origen: 'SIIGO',
    numero,
    tercero_id: p.customer?.identification ?? null,
    banco_id: env.BANK_MAP[bancoNombre] ? bancoNombre : null,
    fecha: p.date,
    valor: total,
    base: p.items?.reduce((s, i) => s + i.value, 0) ?? total,
    iva: 0,
    retencion: 0,
    estado: 'pendiente',
    sincronizado_hgi: false,
    idempotency_key: idemKey('egreso', p.id, numero),
    notas: p.observations ?? null,
  };
}

export function mapVoucher(v: SiigoVoucher): DocumentoRow {
  const numero = `RC-${v.document?.id ?? ''}-${v.number ?? ''}`;
  const total = v.payments.reduce((s, x) => s + x.value, 0);
  return {
    tipo: v.type === 'advance_payment' ? 'anticipo' : 'recibo_caja',
    sistema_origen: 'SIIGO',
    numero,
    tercero_id: v.customer.identification,
    banco_id: null,
    fecha: v.date,
    valor: total,
    base: total,
    iva: 0,
    retencion: 0,
    estado: 'pendiente',
    sincronizado_hgi: false,
    idempotency_key: idemKey('recibo_caja', v.id, numero),
    notas: v.observations ?? null,
  };
}

export function mapJournal(j: SiigoJournal): DocumentoRow {
  const numero = `CA-${j.document?.id ?? ''}-${j.number ?? ''}`;
  const debit = j.items.filter((i) => i.account.movement === 'Debit').reduce((s, i) => s + i.value, 0);
  const tercero = j.items.find((i) => i.customer)?.customer?.identification ?? null;
  return {
    tipo: 'causacion',
    sistema_origen: 'SIIGO',
    numero,
    tercero_id: tercero,
    banco_id: null,
    fecha: j.date,
    valor: debit,
    base: debit,
    iva: 0,
    retencion: 0,
    estado: 'pendiente',
    sincronizado_hgi: false,
    idempotency_key: idemKey('causacion', j.id, numero),
    notas: j.observations ?? null,
  };
}

export function mapPurchase(p: SiigoPurchase): DocumentoRow {
  const numero = `OC-${p.document?.id ?? ''}-${p.number ?? ''}`;
  const total = p.total ?? p.items.reduce((s, i) => s + i.quantity * i.price, 0);
  return {
    tipo: 'compra',
    sistema_origen: 'SIIGO',
    numero,
    tercero_id: p.supplier.identification,
    banco_id: null,
    fecha: p.date,
    valor: total,
    base: total,
    iva: 0,
    retencion: 0,
    estado: 'pendiente',
    sincronizado_hgi: false,
    idempotency_key: idemKey('compra', p.id, numero),
    notas: null,
  };
}
