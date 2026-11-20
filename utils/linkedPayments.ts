import { Customer, SalesInvoice } from '../types';

const clean = (v: any) => String(v ?? '').trim().replace(/^#/, '').toLowerCase();

/** تحصيلات (من صفحة التحصيل) اتسجلت على رقم الفاتورة دي — بتتقرا من كشف العميل نفسه، فلو التحصيل اتحذف بتختفي لوحدها */
export const getLinkedPayments = (invoice: Pick<SalesInvoice, 'id'> | undefined, customer: Customer | undefined) => {
  if (!invoice || !customer || !Array.isArray(customer.history)) return [];
  const id = clean(invoice.id);
  if (!id) return [];
  return customer.history.filter((h: any) =>
    (/^cust_pay_T_COL_/.test(String(h?.id || '')) || /^T_COL_/.test(String(h?.paymentId || ''))) &&
    clean(h.invoiceId || h.invoiceNo) === id &&
    Number(h.amount) > 0
  );
};

export const getLinkedPaidTotal = (invoice: Pick<SalesInvoice, 'id'> | undefined, customer: Customer | undefined) =>
  Math.round(getLinkedPayments(invoice, customer).reduce((s, h) => s + Number(h.amount || 0), 0) * 100) / 100;

/** دفعات المورد (من صفحة التحويلات) اللي اتسجلت على رقم فاتورة مشتريات — بتتقرا من كشف المورد نفسه */
export const getLinkedSupplierPayments = (purchase: { id: string } | undefined, supplier: any) => {
  if (!purchase || !supplier || !Array.isArray(supplier.history)) return [];
  const id = clean(purchase.id);
  if (!id) return [];
  return supplier.history.filter((h: any) =>
    h && clean(h.linkedPurchaseId) === id && Number(h.amount) > 0
  );
};

export const getLinkedSupplierPaidTotal = (purchase: { id: string } | undefined, supplier: any) =>
  Math.round(getLinkedSupplierPayments(purchase, supplier).reduce((s: number, h: any) => s + Number(h.amount || 0), 0) * 100) / 100;

/** نسخة للعرض/الطباعة/المشاركة فقط (ماتتبعتش للتعديل): المدفوع والمتبقي والرصيد بعد الفاتورة شاملين الدفعات المربوطة */
export const withLinkedSupplierPaid = <T extends { id: string; paid?: number; remaining?: number; total: number; currentBalance?: number }>(purchase: T, supplier: any): T => {
  const L = getLinkedSupplierPaidTotal(purchase, supplier);
  if (!(L > 0)) return purchase;
  const basePaid = Number((purchase as any).paidAmount ?? purchase.paid ?? 0);
  const baseRem = purchase.remaining !== undefined ? Number(purchase.remaining) : (purchase.total - basePaid);
  return {
    ...purchase,
    paid: basePaid + L,
    remaining: Math.max(0, baseRem - L),
    ...(purchase.currentBalance !== undefined ? { currentBalance: purchase.currentBalance + L } : {}),
    linkedPaid: L
  } as T;
};
