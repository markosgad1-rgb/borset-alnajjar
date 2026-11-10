import { Supplier, Purchase, SupplierStatementRow } from '../types';

export interface SupplierStatementOptions {
  startDate?: string;
  endDate?: string;
  viewMode?: 'ITEMS' | 'INVOICES';
}

export interface SupplierStatementResult {
  rows: SupplierStatementRow[];
  totalCredit: number;
  totalDebit: number;
  totalQuantity: number;
  totalLineTotal: number;
  finalBalance: number;
  openingBalance: number;
  openingBalanceRow?: SupplierStatementRow;
}

/**
 * Helper to clean and format supplier movement descriptions (e.g., payment notes)
 */
export const formatSupplierMovementDesc = (desc: string): string => {
  if (!desc) return '';
  if (
    desc.includes('دفع لـ مورد') || 
    desc.includes('سداد مورد') || 
    desc.includes('سداد دفعة') ||
    desc.includes('سداد/تحصيل نقدية') ||
    desc.startsWith('دفع لـ') ||
    desc.startsWith('سداد')
  ) {
    const parts = desc.split(' - ');
    if (parts.length > 1) {
      const last = parts[parts.length - 1].trim();
      if (!last.includes('دفع لـ مورد') && !last.startsWith('فاتورة #') && last !== '') {
        return `دفعة (${last})`;
      }
    }
    return 'دفعة';
  }
  return desc;
};

/**
 * Extracts and calculates all supplier statement rows, automatically inserting
 * the official opening balance ("رصيد افتتاحي") row as the first transaction,
 * and seamlessly integrating running balances with purchase invoices and payments.
 *
 * Accounting Rules:
 * 1. إذا كان الرصيد الافتتاحي سالباً (مديونية علينا للمورد):
 *    - يدرج المبلغ بالموجب في خانة دائن (علينا / توريدات)
 *    - تبدأ خانة الرصيد بالسالب
 *    - تكون الحالة "له (علينا)"
 * 2. إذا كان الرصيد الافتتاحي موجباً (مبلغ لنا عنده / دفعة مقدمة):
 *    - يدرج في خانة مدين (لنا / سدادات)
 *    - تبدأ خانة الرصيد بالموجب
 *    - تكون الحالة "لنا (عليه)"
 * 3. الرصيد بعد الفاتورة = الرصيد الافتتاحي + التوريدات الجديدة - السدادات (بالمعنى المحاسبي الدقيق)
 */
export function getSupplierStatementTransactions(
  supplier: Supplier | null | undefined,
  purchases: Purchase[] = [],
  options?: SupplierStatementOptions
): SupplierStatementResult {
  if (!supplier) {
    return {
      rows: [],
      totalCredit: 0,
      totalDebit: 0,
      totalQuantity: 0,
      totalLineTotal: 0,
      finalBalance: 0,
      openingBalance: 0
    };
  }

  const startDate = options?.startDate;
  const endDate = options?.endDate;
  const viewMode = options?.viewMode || 'ITEMS';

  // 1. Determine opening balance safely without any state mutation
  let openingBal = 0;
  const isS005 = (supplier.code || '').trim().toUpperCase() === 'S005' || 
                 (supplier.name && supplier.name.includes('أحمد تعيلب'));

  if (!isS005) {
    if (typeof supplier.openingBalance === 'number' && !isNaN(supplier.openingBalance)) {
      // Guard against corrupted timestamp values or runaway numbers > 100M
      openingBal = Math.abs(supplier.openingBalance) > 100000000 ? 0 : supplier.openingBalance;
    } else {
      const opEntry = (supplier.history || []).find(h => h.description?.includes('رصيد افتتاحي'));
      if (opEntry && typeof opEntry.amount === 'number' && !isNaN(opEntry.amount)) {
        openingBal = Math.abs(opEntry.amount) > 100000000 ? 0 : opEntry.amount;
      }
    }
  }

  const creationDate = supplier.createdAt 
    || (supplier.history && supplier.history.length > 0 ? supplier.history[0].date : '') 
    || new Date().toISOString().split('T')[0];

  // 2. Prepare normalized history list (filtering out corruptions and fake opening entries)
  const rawHistory = Array.isArray(supplier.history) ? [...supplier.history] : [];
  const filteredHistory = rawHistory.filter(h => {
    if (!h) return false;
    if (h.description?.includes('تعديل فاتورة مشتريات')) return false;
    // Discard corrupted or fake opening balance movements for S005 or runaway numbers
    if (h.description?.includes('رصيد افتتاحي')) {
      if (isS005) return false;
      const amt = Math.abs(parseFloat(String(h.amount || 0)) || 0);
      if (amt > 100000000) return false;
    }
    return true;
  });
  const hasOpeningInHistory = filteredHistory.some(h => h.description?.includes('رصيد افتتاحي'));

  type UnifiedMovement = {
    date: string;
    description: string;
    amount: number;
    isOpening?: boolean;
    historyIndex?: number;
    id?: string;
  };

  const allMovements: UnifiedMovement[] = [];

  // If opening balance !== 0 and no opening entry exists in history, prepend it at the very top
  if (openingBal !== 0 && !hasOpeningInHistory && !isS005) {
    allMovements.push({
      date: creationDate,
      description: 'رصيد افتتاحي',
      amount: openingBal,
      isOpening: true
    });
  }

  // Add the rest of movements, ensuring any existing 'رصيد افتتاحي' is marked
  rawHistory.forEach((h, originalIndex) => {
    if (!h) return;
    if (h.description?.includes('تعديل فاتورة مشتريات')) return;
    if (h.description?.includes('رصيد افتتاحي')) {
      if (isS005) return;
      const amt = Math.abs(parseFloat(String(h.amount || 0)) || 0);
      if (amt > 100000000) return;
    }

    const amt = parseFloat(String(h.amount || 0)) || 0;
    if (Math.abs(amt) > 100000000) return; // Skip corrupted entries
    if (h.description?.includes('رصيد افتتاحي')) {
      if (isS005) return;
      allMovements.push({
        ...h,
        amount: amt,
        description: 'رصيد افتتاحي',
        isOpening: true,
        historyIndex: h.historyIndex !== undefined ? h.historyIndex : originalIndex
      });
    } else {
      allMovements.push({
        ...h,
        amount: amt,
        historyIndex: h.historyIndex !== undefined ? h.historyIndex : originalIndex
      });
    }
  });

  // Make sure opening balance movement is strictly at index 0 (قمة مصفوفة العمليات قبل الفواتير)
  allMovements.sort((a, b) => {
    if (a.isOpening && !b.isOpening) return -1;
    if (!a.isOpening && b.isOpening) return 1;
    return (a.date || '').localeCompare(b.date || '');
  });

  // 3. Compute prior balance if filtering by startDate
  let priorBalance = 0;
  const priorSeenPurchaseIds = new Set<string>();

  if (startDate) {
    for (const m of allMovements) {
      if (m.date < startDate) {
        if (m.isOpening) {
          priorBalance += parseFloat(String(m.amount || 0)) || 0;
        } else {
          const isPurch = m.description.includes('فاتورة مشتريات') || m.description.includes('استلام بضاعة');
          const pMatch = m.description.match(/#([A-Za-z0-9-]+)/);
          const pId = pMatch ? pMatch[1].trim() : null;

          if (isPurch) {
            if (pId && priorSeenPurchaseIds.has(pId)) continue;
            if (pId) priorSeenPurchaseIds.add(pId);

            const purchase = pId ? purchases.find(p => p.id === pId) : null;
            if (purchase) {
              const pTot = purchase.pricingStatus === 'PENDING_PRICE' 
                ? 0 
                : (parseFloat(String(purchase.total || 0)) || 0);
              priorBalance -= pTot;
            } else {
              const pTot = Math.abs(parseFloat(String(m.amount || 0)) || 0);
              priorBalance -= pTot;
            }
          } else {
            // Payment, settlement, or adjustment
            const parsedAmt = parseFloat(String(m.amount || 0)) || 0;
            const amt = Math.abs(parsedAmt);
            const isDebit = parsedAmt > 0 || (parsedAmt === 0 && (m.description.includes('دفع') || m.description.includes('سداد') || m.description.includes('صرف')));
            if (isDebit) {
              priorBalance += amt;
            } else {
              priorBalance -= amt;
            }
          }
        }
      }
    }
    priorBalance = Math.round(priorBalance * 100) / 100;
  }

  // 4. Generate statement rows
  const rows: SupplierStatementRow[] = [];
  let counter = 1;
  let running = startDate ? priorBalance : 0;
  let openingRow: SupplierStatementRow | undefined;
  const seenPurchaseIds = new Set<string>();

  // Insert prior period summary row if filtering by startDate
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
      credit: priorBalance < 0 ? Math.abs(priorBalance) : 0,
      debit: priorBalance > 0 ? priorBalance : 0,
      runningBalance: running,
      status: running < 0 ? 'له (علينا)' : running > 0 ? 'لنا (عليه)' : 'متزن',
      isInvoiceItem: false,
      type: 'prior'
    });
  }

  for (const m of allMovements) {
    if (startDate && m.date < startDate) continue;
    if (endDate && m.date > endDate) continue;

    if (m.isOpening) {
      // إذا كان سالباً (مديونية علينا للمورد): يدرج المبلغ بالموجب في خانة دائن (علينا / توريدات)، وتبدأ خانة الرصيد بالسالب وتكون الحالة "له (علينا)".
      // إذا كان موجباً (مبلغ لنا عنده / دفعة مقدمة): يدرج في خانة مدين (لنا / سدادات)، وتكون الحالة "لنا (عليه)".
      const parsedAmount = parseFloat(String(m.amount || 0)) || 0;
      const isDebtToSupplier = parsedAmount < 0;
      const credit = isDebtToSupplier ? Math.abs(parsedAmount) : 0;
      const debit = !isDebtToSupplier ? Math.abs(parsedAmount) : 0;

      running = parsedAmount; // starts exactly at opening balance

      const row: SupplierStatementRow = {
        id: `supp_op_${supplier.code}`,
        num: counter++,
        date: m.date,
        ref: '-',
        itemName: 'رصيد افتتاحي',
        quantity: '-',
        price: '-',
        lineTotal: '-',
        credit,
        debit,
        runningBalance: running,
        status: running < 0 ? 'له (علينا)' : running > 0 ? 'لنا (عليه)' : 'متزن',
        isInvoiceItem: false,
        isOpeningBalance: true,
        type: 'opening',
        description: 'رصيد افتتاحي',
        amount: parsedAmount
      };
      rows.push(row);
      openingRow = row;
      continue;
    }

    const isPurchaseInvoice = m.description.includes('فاتورة مشتريات') || m.description.includes('استلام بضاعة');
    const pMatch = m.description.match(/#([A-Za-z0-9-]+)/);
    const pId = pMatch ? pMatch[1].trim() : null;

    if (isPurchaseInvoice) {
      // Prevent double counting if invoice appears multiple times in history (e.g., pricing update vs original creation)
      if (pId && seenPurchaseIds.has(pId)) continue;
      if (pId) seenPurchaseIds.add(pId);

      const purchase = pId ? purchases.find(p => p.id === pId) : null;

      if (purchase) {
        if (viewMode === 'ITEMS' && purchase.items && purchase.items.length > 0) {
          // Expand invoice items
          purchase.items.forEach((item, itemIdx) => {
            const itemQty = parseFloat(String(item.quantity || 0)) || 0;
            const itemPrice = parseFloat(String(item.price || 0)) || 0;
            const lineTotal = Math.round(itemQty * itemPrice * 100) / 100;

            // Supply increases debt to supplier (makes running balance more negative)
            running = Math.round((running - lineTotal) * 100) / 100;

            rows.push({
              id: `p_item_${purchase.id}_${item.itemCode || itemIdx}`,
              num: counter++,
              date: purchase.date || m.date,
              ref: purchase.id,
              itemName: item.itemName,
              quantity: itemQty,
              price: itemPrice,
              lineTotal,
              credit: lineTotal,
              debit: 0,
              runningBalance: running,
              status: running < 0 ? 'له (علينا)' : running > 0 ? 'لنا (عليه)' : 'متزن',
              isInvoiceItem: true,
              purchaseId: purchase.id,
              invoiceId: purchase.id,
              invoiceNo: purchase.id,
              type: 'invoice',
              description: `فاتورة مشتريات #${purchase.id} - ${item.itemName}`,
              amount: -lineTotal,
              historyIndex: m.historyIndex
            });
          });
        } else {
          // Invoices summary mode
          const pTotal = purchase.pricingStatus === 'PENDING_PRICE' 
            ? 0 
            : (parseFloat(String(purchase.total || 0)) || 0);

          running = Math.round((running - pTotal) * 100) / 100;

          rows.push({
            id: `p_sum_${purchase.id}`,
            num: counter++,
            date: purchase.date || m.date,
            ref: purchase.id,
            itemName: purchase.pricingStatus === 'PENDING_PRICE' 
              ? `استلام بضاعة (سعر معلّق) #${purchase.id}` 
              : `فاتورة مشتريات #${purchase.id}`,
            quantity: '-',
            price: '-',
            lineTotal: pTotal,
            credit: pTotal,
            debit: 0,
            runningBalance: running,
            status: running < 0 ? 'له (علينا)' : running > 0 ? 'لنا (عليه)' : 'متزن',
            isInvoiceItem: false,
            purchaseId: purchase.id,
            invoiceId: purchase.id,
            invoiceNo: purchase.id,
            type: 'invoice',
            description: `فاتورة مشتريات #${purchase.id}`,
            amount: -pTotal,
            historyIndex: m.historyIndex
          });
        }
      } else {
        // Fallback for purchase not indexed in purchases list
        const pTotal = Math.abs(parseFloat(String(m.amount || 0)) || 0);
        running = Math.round((running - pTotal) * 100) / 100;

        rows.push({
          id: `p_fb_${pId || m.date}_${counter}`,
          num: counter++,
          date: m.date,
          ref: pId || '-',
          itemName: m.description,
          quantity: '-',
          price: '-',
          lineTotal: pTotal,
          credit: pTotal,
          debit: 0,
          runningBalance: running,
          status: running < 0 ? 'له (علينا)' : running > 0 ? 'لنا (عليه)' : 'متزن',
          isInvoiceItem: false,
          purchaseId: pId || undefined,
          invoiceId: pId || undefined,
          invoiceNo: pId || undefined,
          type: 'invoice',
          description: m.description,
          amount: -pTotal,
          historyIndex: m.historyIndex
        });
      }
    } else {
      // Payment, Settlement or Treasury movement (سدادات أو تسويات)
      const parsedAmt = parseFloat(String(m.amount || 0)) || 0;
      const isDebit = parsedAmt > 0 || (parsedAmt === 0 && (m.description.includes('دفع') || m.description.includes('سداد') || m.description.includes('صرف')));
      const amt = Math.abs(parsedAmt);
      const debit = isDebit ? amt : 0;
      const credit = !isDebit ? amt : 0;

      // Paying supplier / debit decreases debt -> running += debit
      // Credit increases debt -> running -= credit
      running = Math.round((running + debit - credit) * 100) / 100;

      const isManualAdj = m.description.includes('تسوية') || 
                          m.description.includes('يدوي') || 
                          m.description.includes('سداد خارجي') || 
                          m.description.includes('بدون فاتورة') || 
                          m.description.includes('خصم') ||
                          m.description.includes('مرتجع') ||
                          m.description.includes('فرق سعر') ||
                          m.description.includes('مصاريف نقل');
      const refCol = pId || (isManualAdj ? 'تسوية' : '-');

      const displayName = formatSupplierMovementDesc(m.description);
      const isPay = m.description.includes('دفع') || m.description.includes('سداد') || m.description.includes('صرف');

      rows.push({
        id: `supp_mvt_${supplier.code}_${m.date}_${counter}`,
        paymentId: isPay ? `pay_supp_${m.date}_${counter}` : undefined,
        num: counter++,
        date: m.date,
        ref: refCol,
        itemName: displayName,
        quantity: '-',
        price: '-',
        lineTotal: '-',
        credit,
        debit,
        runningBalance: running,
        status: running < 0 ? 'له (علينا)' : running > 0 ? 'لنا (عليه)' : 'متزن',
        isInvoiceItem: false,
        purchaseId: pId || undefined,
        invoiceId: pId || undefined,
        invoiceNo: pId || undefined,
        type: isPay ? 'payment' : 'adjustment',
        description: m.description,
        amount: m.amount,
        historyIndex: m.historyIndex
      });
    }
  }

  // Account for any active purchases for this supplier not yet registered in history
  const cleanSupplierCode = (supplier.code || '').trim().toLowerCase();
  const unlinkedPurchases = (purchases || []).filter(p => 
    !p.isDeleted &&
    (p.supplierCode || '').trim().toLowerCase() === cleanSupplierCode &&
    !seenPurchaseIds.has(p.id)
  );

  for (const unlinked of unlinkedPurchases) {
    if (startDate && unlinked.date && unlinked.date < startDate) continue;
    if (endDate && unlinked.date && unlinked.date > endDate) continue;

    const pTotal = unlinked.pricingStatus === 'PENDING_PRICE' 
      ? 0 
      : (parseFloat(String(unlinked.total || 0)) || 0);

    running = Math.round((running - pTotal) * 100) / 100;
    seenPurchaseIds.add(unlinked.id);

    rows.push({
      id: `p_unlinked_${unlinked.id}`,
      num: counter++,
      date: unlinked.date || new Date().toISOString().split('T')[0],
      ref: unlinked.id,
      itemName: `فاتورة مشتريات #${unlinked.id}`,
      quantity: '-',
      price: '-',
      lineTotal: pTotal,
      credit: pTotal,
      debit: 0,
      runningBalance: running,
      status: running < 0 ? 'له (علينا)' : running > 0 ? 'لنا (عليه)' : 'متزن',
      isInvoiceItem: false,
      purchaseId: unlinked.id,
      invoiceId: unlinked.id,
      invoiceNo: unlinked.id,
      type: 'invoice',
      description: `فاتورة مشتريات #${unlinked.id}`,
      amount: -pTotal
    });
  }

  const totalCredit = Math.round(rows.reduce((sum, r) => sum + r.credit, 0) * 100) / 100;
  const totalDebit = Math.round(rows.reduce((sum, r) => sum + r.debit, 0) * 100) / 100;
  const totalQuantity = rows.reduce((sum, r) => typeof r.quantity === 'number' ? sum + r.quantity : sum, 0);
  const totalLineTotal = Math.round(rows.reduce((sum, r) => typeof r.lineTotal === 'number' ? sum + r.lineTotal : sum, 0) * 100) / 100;
  const finalBalance = rows.length > 0 
    ? rows[rows.length - 1].runningBalance 
    : (startDate ? priorBalance : openingBal);

  return {
    rows,
    totalCredit,
    totalDebit,
    totalQuantity,
    totalLineTotal,
    finalBalance: Math.round(finalBalance * 100) / 100,
    openingBalance: openingBal,
    openingBalanceRow: openingRow
  };
}

/**
 * Single Source of Truth for calculating a supplier's live, accurate balance.
 *
 * Mathematical Accounting Equation:
 *   الرصيد = الرصيد الافتتاحي (إن وجد) - إجمالي التوريدات (دائن / علينا) + إجمالي السدادات (مدين / لنا)
 *
 * Guarantees:
 * 1. Zero initial cumulative balance: starts strictly from clean slate.
 * 2. Strict floating-point numeric parsing (Number(val) || 0) to prevent any String Concatenation.
 * 3. Scope strictly to the specified supplierId / supplierCode (case-insensitive & trimmed).
 * 4. Deduplication of purchase entries via a seenPurchaseIds Set to prevent double-counting.
 * 5. Returns float rounded to 2 decimal places.
 */
export function calculateSupplierBalance(
  supplier: Supplier | null | undefined,
  purchases: Purchase[] = []
): number {
  if (!supplier || !supplier.code) return 0;
  const result = getSupplierStatementTransactions(supplier, purchases);
  return Math.round((Number(result.finalBalance) || 0) * 100) / 100;
}

export const getSupplierBalance = calculateSupplierBalance;
