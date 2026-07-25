/**
 * HGI adapter — PLACEHOLDER.
 *
 * Status (verified research):
 * - HGInet Web API exists (official HGI integration layer: documentos compras/ventas/recaudos,
 *   consulta cartera clientes/proveedores, saldos inventario) but is a LICENSED module with no
 *   public endpoint docs — request via info@hgi.com.co / HGI channel partner.
 * - Fallback for reads: HGI on-premise runs on SQL Server — direct read-only queries are possible
 *   without any license (mssql driver + views). Writes MUST go through the official API.
 *
 * This file defines the contract the sync engine will use once either path is enabled.
 */

export interface HgiAdapter {
  /** Push a mapped egreso/recibo/causacion/compra into HGI */
  postDocumento(doc: unknown): Promise<{ hgiId: string }>;
  /** Read account balances for reconciliation (Bases, IVA, Retenciones, cartera) */
  readSaldos(fecha: string): Promise<Array<{ concepto: string; valor: number }>>;
  isConfigured(): boolean;
}

class HgiNotConfigured implements HgiAdapter {
  isConfigured() { return false; }
  async postDocumento(): Promise<{ hgiId: string }> {
    throw new Error('HGI adapter not configured — pending HGInet Web API license (see docs/HGI_REQUEST_EMAIL.md)');
  }
  async readSaldos(): Promise<Array<{ concepto: string; valor: number }>> {
    throw new Error('HGI adapter not configured');
  }
}

// TODO(sql-fallback): implement readSaldos via `mssql` package against HGI SQL Server
// (read-only, reconciliation only) once client grants DB access.
// TODO(api): implement full adapter against HGInet Web API when license + docs arrive.

export const hgi: HgiAdapter = new HgiNotConfigured();
