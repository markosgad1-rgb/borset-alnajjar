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
