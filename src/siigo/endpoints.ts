/**
 * Typed SIIGO endpoints used by Espacios Hub.
 * Only the fields our schema consumes are typed; passthrough otherwise.
 */

// ---- Payment receipts (egresos / Tesoreria) ----
export interface SiigoPaymentReceipt {
  id?: string;
  document?: { id: number };
  number?: number;
  name?: string;
  date: string;               // YYYY-MM-DD
  type?: string;
  customer?: { identification: string; branch_office?: number };
  payments?: Array<{ id: number; value: number; due?: { date?: string } }>;
  observations?: string;
  total?: number;
  items?: Array<{ type: string; code?: string; description?: string; value: number }>;
}

// ---- Vouchers (recibos de caja / Cartera) ----
export interface SiigoVoucher {
  id?: string;
  document?: { id: number };
  number?: number;
  date: string;
  type: 'advance_payment' | 'debt_payment' | 'other_income';
  customer: { identification: string };
  payments: Array<{ id: number; value: number }>;
  observations?: string;
}

// ---- Journals (causaciones / Contabilidad) ----
export interface SiigoJournal {
  id?: string;
  document?: { id: number };
  number?: number;
  date: string;
  observations?: string;
  items: Array<{
    account: { code: string; movement: 'Debit' | 'Credit' };
    value: number;
    customer?: { identification: string };
    description?: string;
    tax?: { id: number };
  }>;
}

// ---- Purchases (compras / Logistica) ----
export interface SiigoPurchase {
  id?: string;
  document?: { id: number };
  number?: number;
  date: string;
  supplier: { identification: string };
  items: Array<{ code: string; description?: string; quantity: number; price: number }>;
  payments?: Array<{ id: number; value: number; due?: { date?: string } }>;
  total?: number;
}

// ---- Customer (terceros) ----
export interface SiigoCustomer {
  id?: string;
  type: 'Customer' | 'Supplier';
  person_type: 'Person' | 'Company';
  id_type: string;
  identification: string;
  name: string[];
  commercial_name?: string;
  email?: string;
  phones?: Array<{ number: string }>;
  contacts?: Array<{ first_name: string; last_name: string; email?: string; phone?: { number?: string } }>;
}

export interface Paged<T> { results: T[]; pagination?: { page: number; page_size: number; total_results?: number } }

export const endpoints = {
  paymentReceipts: '/payment-receipts',
  paymentReceipt: (id: string) => `/payment-receipts/${id}`,
  vouchers: '/vouchers',
  voucher: (id: string) => `/vouchers/${id}`,
  journals: '/journals',
  purchases: '/purchases',
  customers: '/customers',
  trialBalanceByThird: '/trial-balance-by-third',
  accountsPayable: '/report/payables',
} as const;
