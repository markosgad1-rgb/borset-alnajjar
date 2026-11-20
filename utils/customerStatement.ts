// حساب رقم كشف حساب العميل (نسخة واحدة مشتركة بين صفحة العملاء وباقي البرنامج)
// الرقم اللي بيظهر جنب اسم العميل وفي التحصيل والتحويلات والمبيعات = نفس رقم آخر سطر في كشف الحساب.
import { SalesInvoice } from '../types';

export const formatCustomerMovementDesc = (desc: string): string => {
  if (!desc) return '';
  if (
    desc.includes('سداد/تحصيل نقدية') || 
    desc.includes('تحصيل من عميل') || 
    desc.includes('دفعة نقدية مسددة') || 
    desc.includes('سداد نقدي كامل') || 
    desc.includes('استلام من عميل') ||
    desc.startsWith('تحصيل') ||
    desc.startsWith('سداد')
  ) {
    const parts = desc.split(' - ');
    if (parts.length > 1) {
      const last = parts[parts.length - 1].trim();
      if (!last.includes('تحصيل من عميل') && !last.startsWith('فاتورة #') && last !== '') {
        return `دفعة (${last})`;
      }
    }
    return 'دفعة';
  }
  return desc;
};

export const getConsumedPaymentIndices = (history: Array<{ date: string; description: string; amount: number }>, invoices: SalesInvoice[]) => {
  const consumedIndices = new Set<number>();
  // تحصيلات صفحة التحصيل دفعات مستقلة، عمرها ما تتحسب كأنها دفعة الفاتورة نفسها (وإلا بتختفي من الكشف)
  // (تحصيل من صفحة التحصيل cust_pay_ ، أو تحويل من صفحة التحويلات trans_)
  const isCollectionEntry = (x: any) =>
    /^(cust_pay_|trans_)/.test(String(x?.id || '')) || /^(T_COL_|TR\d)/.test(String(x?.paymentId || ''));

  for (let i = 0; i < history.length; i++) {
    const h = history[i];
    if (h.description.includes('تعديل فاتورة') || h.description.includes('إلغاء فاتورة')) continue;

    const isInvoiceSale = h.description.includes('فاتورة بيع') && !h.description.includes('دفعة') && !h.description.includes('إلغاء');
    if (!isInvoiceSale) continue;

    const invMatch = h.description.match(/#([A-Za-z0-9-]+)/);
    const invId = invMatch ? invMatch[1] : null;
    if (!invId) continue;

    const invoice = invoices.find(inv => inv.id === invId && !inv.isDeleted);
    if (!invoice) continue;
    const rawPaid = Number(invoice?.paidAmount || 0);
    const invoicePaid = Math.max(0, isNaN(rawPaid) ? 0 : rawPaid);

    if (invoicePaid <= 0) continue;

    // 1. Direct match by invoice number in description with matching positive amount
    let matchedIdx = -1;
    for (let j = 0; j < history.length; j++) {
      if (j === i || consumedIndices.has(j) || isCollectionEntry(history[j])) continue;
      const candidate = history[j];
      if (candidate.amount > 0 && Math.abs(candidate.amount - invoicePaid) < 0.01) {
        if (candidate.description.includes(`#${invId}`) || candidate.description.includes(invId)) {
          matchedIdx = j;
          break;
        }
      }
    }

    // 2. Direct sequence match: immediate entry following invoice (standard ERPContext.addInvoice order)
    if (matchedIdx === -1 && i + 1 < history.length && !consumedIndices.has(i + 1) && !isCollectionEntry(history[i + 1])) {
      const next = history[i + 1];
      if (next.amount > 0 && Math.abs(next.amount - invoicePaid) < 0.01 && !next.description.includes('فاتورة بيع') && (next.description.includes('دفعة') || next.description.includes(invId))) {
        matchedIdx = i + 1;
      }
    }

    // 3. Same-date payment entry with matching amount
    if (matchedIdx === -1) {
      for (let j = 0; j < history.length; j++) {
        if (j === i || consumedIndices.has(j) || isCollectionEntry(history[j])) continue;
        const candidate = history[j];
        if (candidate.amount > 0 && Math.abs(candidate.amount - invoicePaid) < 0.01) {
          if (candidate.date === (invoice?.date || h.date) && !candidate.description.includes('فاتورة بيع') && (candidate.description.includes('دفعة') || candidate.description.includes(invId))) {
            matchedIdx = j;
            break;
          }
        }
      }
    }

    if (matchedIdx !== -1) {
      consumedIndices.add(matchedIdx);
    }
  }

  return consumedIndices;
};

const amountPositive = (h: any) => Number(h?.amount) > 0;

export const getItemizedRowsForRange = (cust: any, invoices: SalesInvoice[], startDate?: string, endDate?: string) => {
  if (!cust || !cust.history) return [];

  const consumedPaymentIndices = getConsumedPaymentIndices(cust.history, invoices);
  let priorBalance = 0;

  // 1. Calculate prior balance if startDate is specified
  if (startDate) {
    for (let i = 0; i < cust.history.length; i++) {
      if (consumedPaymentIndices.has(i)) continue; // Prevent double-counting in prior balance
      const h = cust.history[i];
      if (h.description.includes('تعديل فاتورة') || h.description.includes('إلغاء فاتورة')) continue;
      if (h.date < startDate) {
        const isInvoiceSale = h.description.includes('فاتورة بيع') && !h.description.includes('دفعة') && !h.description.includes('إلغاء');
        const invMatch = h.description.match(/#([A-Za-z0-9-]+)/);
        const invId = invMatch ? invMatch[1] : null;
        const invoice = invId ? invoices.find(inv => inv.id === invId && !inv.isDeleted) : null;

        if (isInvoiceSale && invId && !invoice) continue; // Skip deleted invoice
        if (isInvoiceSale && invoice && invoice.items && invoice.items.length > 0) {
          const invoiceTotal = invoice.items.reduce((sum, item) => sum + (item.quantity * item.price), 0) - Math.max(0, Number((invoice as any).discount || 0));
          const invoicePaid = Math.max(0, Number(invoice.paidAmount || 0));
          // Net debt increase from invoice = total - paid
          priorBalance -= (invoiceTotal - invoicePaid);
        } else {
          priorBalance += h.amount;
        }
      }
    }
  }

  const rows: Array<{
    id?: string;
    num: number;
    date: string;
    ref: string;
    itemName: string;
    quantity: number | string;
    price: number | string;
    lineTotal: number | string; // الإجمالي
    debit: number; // مدين (عليه)
    credit: number; // دائن (له/سداد)
    runningBalance: number;
    status: 'مدين' | 'دائن' | 'متزن';
    isInvoiceItem: boolean;
    invoiceId?: string;
    invoiceNo?: string;
    paymentId?: string;
    type?: string;
    description?: string;
    amount?: number;
    historyIndex?: number;
  }> = [];

  let running = startDate ? priorBalance : 0;
  let counter = 1;

  // Insert opening balance row if there is a prior balance before the start date
  if (startDate && priorBalance !== 0) {
    rows.push({
      id: `prior_bal_${startDate}`,
      num: counter++,
      date: startDate,
      ref: '-',
      itemName: 'رصيد سابق ما قبل الفترة',
      quantity: '-',
      price: '-',
      lineTotal: '-',
      debit: priorBalance < 0 ? Math.abs(priorBalance) : 0,
      credit: priorBalance > 0 ? priorBalance : 0,
      runningBalance: running,
      status: running < 0 ? 'مدين' : running > 0 ? 'دائن' : 'متزن',
      isInvoiceItem: false,
      type: 'prior'
    });
  }

  for (let i = 0; i < cust.history.length; i++) {
    // If this history entry is the payment entry belonging to an invoice, skip it because
    // it is displayed directly under the invoice items as a single dedicated line with the invoice ref!
    if (consumedPaymentIndices.has(i)) continue;

    const h = cust.history[i];
    if (h.description.includes('تعديل فاتورة') || h.description.includes('إلغاء فاتورة')) continue;
    if (startDate && h.date < startDate) continue;
    if (endDate && h.date > endDate) continue;

    const isInvoiceSale = h.description.includes('فاتورة بيع') && !h.description.includes('دفعة') && !h.description.includes('إلغاء');
    const invMatch = h.description.match(/#([A-Za-z0-9-]+)/);
    const invId = invMatch ? invMatch[1] : null;
    const invoice = invId ? invoices.find(inv => inv.id === invId && !inv.isDeleted) : null;

    if (isInvoiceSale && invId && !invoice) continue; // Skip deleted invoice

    if (isInvoiceSale && invoice && invoice.items && invoice.items.length > 0) {
      const rawPaid = Number(invoice.paidAmount || 0);
      const invoicePaid = Math.max(0, isNaN(rawPaid) ? 0 : rawPaid);

      // 1. Expand invoice items (all invoice item lines have debit = lineTotal and credit = 0)
      invoice.items.forEach((item) => {
        const lineTotal = item.quantity * item.price;
        const debit = lineTotal;

        // Debit increases customer debt (-)
        running -= debit;

        rows.push({
          id: `inv_item_${invoice.id}_${item.itemCode || item.itemName}`,
          num: counter++,
          date: invoice.date || h.date,
          ref: invoice.id,
          itemName: item.itemName,
          quantity: item.quantity,
          price: item.price,
          lineTotal: lineTotal,
          debit: debit,
          credit: 0,
          runningBalance: running,
          status: running < 0 ? 'مدين' : running > 0 ? 'دائن' : 'متزن',
          isInvoiceItem: true,
          invoiceId: invoice.id,
          invoiceNo: invoice.id,
          type: 'invoice',
          description: `فاتورة بيع #${invoice.id} - ${item.itemName}`,
          amount: -debit
        });
      });

      // 1.b سطر الخصم (لو الفاتورة عليها خصم): دائن بقيمة الخصم تحت أصناف الفاتورة مباشرة
      const invDiscount = Math.max(0, Number((invoice as any).discount || 0));
      if (invDiscount > 0) {
        running += invDiscount;
        const pct = Number((invoice as any).discountPct || 0);
        rows.push({
          id: `inv_disc_${invoice.id}`,
          num: counter++,
          date: invoice.date || h.date,
          ref: invoice.id,
          itemName: pct > 0 ? `خصم (${pct}%)` : 'خصم',
          quantity: '-',
          price: '-',
          lineTotal: '-',
          debit: 0,
          credit: invDiscount,
          runningBalance: running,
          status: running < 0 ? 'مدين' : running > 0 ? 'دائن' : 'متزن',
          isInvoiceItem: false,
          invoiceId: invoice.id,
          invoiceNo: invoice.id,
          type: 'discount',
          description: `خصم فاتورة بيع #${invoice.id}`,
          amount: invDiscount
        });
      }

      // 2. Add the single dedicated payment row right below the last item of the invoice
      if (invoicePaid > 0) {
        // Payment credit reduces customer debt (+)
        running += invoicePaid;

        rows.push({
          id: `inv_pay_${invoice.id}`,
          paymentId: `pay_${invoice.id}`,
          num: counter++,
          date: invoice.date || h.date,
          ref: invoice.id,
          itemName: 'دفعة',
          quantity: '-',
          price: '-',
          lineTotal: '-',
          debit: 0,
          credit: invoicePaid,
          runningBalance: running,
          status: running < 0 ? 'مدين' : running > 0 ? 'دائن' : 'متزن',
          isInvoiceItem: false,
          invoiceId: invoice.id,
          invoiceNo: invoice.id,
          type: 'payment',
          description: `سداد فاتورة بيع #${invoice.id}`,
          amount: invoicePaid
        });
      }
    } else {
      const isDebit = h.amount < 0;
      const debit = isDebit ? Math.abs(h.amount) : 0;
      const credit = !isDebit ? h.amount : 0;
      running += h.amount;

      const displayName = formatCustomerMovementDesc(h.description);
      let refCol = invId || '-';
      if (h.description.includes('افتتاحي')) refCol = 'افتتاحي';
      else if (
        h.description.includes('تسوية') || 
        h.description.includes('خصم') || 
        h.description.includes('تعديل') || 
        h.description.includes('يدوي') || 
        h.description.includes('حركة') ||
        h.description.includes('سداد خارجي') ||
        h.description.includes('بدون فاتورة') ||
        !invId
      ) {
        refCol = 'تسوية';
      }

      // تحصيل من صفحة التحصيل مربوط برقم فاتورة: يظهر برقم الفاتورة في الكشف (من غير ما يتحسب جزء من الفاتورة)
      const linkedInvNo = (/^cust_pay_T_COL_/.test(String((h as any).id || '')) || /^T_COL_/.test(String((h as any).paymentId || ''))) && amountPositive(h)
        ? String((h as any).invoiceId || (h as any).invoiceNo || '').trim().replace(/^#/, '') : '';
      if (linkedInvNo) refCol = linkedInvNo;

      const isPay = h.description.includes('سداد') || h.description.includes('دفعة') || h.description.includes('تحصيل');

      rows.push({
        id: (h as any).id || `cust_mvt_${cust.code}_${i}_${h.date}`,
        paymentId: isPay ? ((h as any).id || `pay_${cust.code}_${i}`) : undefined,
        num: counter++,
        date: h.date,
        ref: refCol,
        itemName: displayName,
        quantity: '-',
        price: '-',
        lineTotal: '-',
        debit,
        credit,
        runningBalance: running,
        status: running < 0 ? 'مدين' : running > 0 ? 'دائن' : 'متزن',
        isInvoiceItem: false,
        invoiceId: linkedInvNo || invId || undefined,
        invoiceNo: linkedInvNo ? undefined : (invId || undefined),
        ...(linkedInvNo ? { linkedPayment: true, linkedPaymentId: (h as any).paymentId } : {}),
        type: isPay ? 'payment' : 'adjustment',
        description: h.description,
        amount: h.amount,
        historyIndex: i
      });
    }
  }

  return rows;
};

/** رقم كشف الحساب النهائي للعميل (لو مفيش حركات: الرصيد المخزّن) */
export const statementBalanceOf = (cust: any, invoices: SalesInvoice[]): number => {
  const stored = Number(cust?.balance) || 0;
  try {
    const rows = getItemizedRowsForRange(cust, invoices);
    if (rows.length === 0) return stored;
    let v = Math.round(rows.reduce((a: number, r: any) => a + r.credit - r.debit, 0) * 100) / 100;
    if (Object.is(v, -0)) v = 0;
    return v;
  } catch { return stored; }
};

/** عدد حركات "فاتورة بيع" في كشف العميل اللي فاتورتها مش موجودة (الكشف بيتجاهلها) */
export const countOrphanSales = (cust: any, invoices: SalesInvoice[]): number => {
  const activeIds = new Set(invoices.filter(i => !i.isDeleted).map(i => String(i.id)));
  return (cust?.history || []).filter((h: any) => {
    const d = String(h.description || '');
    if (!d.includes('فاتورة بيع') || d.includes('دفعة') || d.includes('إلغاء') || d.includes('تعديل فاتورة')) return false;
    const m = d.match(/#([A-Za-z0-9-]+)/);
    return !!m && !activeIds.has(m[1]);
  }).length;
};

/** هل العميل ده آمن يتضبط رصيده المخزّن تلقائياً على رقم الكشف؟ */
export const safeToAutoAlign = (cust: any, invoices: SalesInvoice[], stmt: number): boolean => {
  const stored = Math.round((Number(cust?.balance) || 0) * 100) / 100;
  if (!cust?.history || cust.history.length === 0) return false;
  if (countOrphanSales(cust, invoices) > 0) return false;
  if (stored === 0 && stmt !== 0) return false;
  return true;
};
