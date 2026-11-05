import { SalesInvoice, Purchase } from '../types';

export function getInvoicePrintStyle(): string {
  return `
    @page { 
      size: A4 portrait; 
      margin: 8mm; 
    }
    * { 
      box-sizing: border-box !important; 
      -webkit-print-color-adjust: exact !important; 
      print-color-adjust: exact !important; 
    }
    body { 
      font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; 
      direction: rtl; 
      margin: 0; 
      padding: 0; 
      color: #000; 
      background-color: #fff;
      font-size: 14px; 
      line-height: 1.3; 
    }
    .invoice-container { 
      width: 100%; 
      max-width: 860px;
      margin: 0 auto; 
      padding: 16px; 
      background: #fff; 
      display: flex;
      flex-direction: column;
      min-height: 1050px;
      justify-content: space-between;
      box-sizing: border-box;
    }
    .header { 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      border-bottom: 2.5px solid #000; 
      padding-bottom: 10px; 
      margin-bottom: 12px; 
    }
    .company-info h1 { 
      margin: 0; 
      font-size: 26px; 
      font-weight: 900; 
      line-height: 1.1; 
      color: #000;
    }
    .company-info p { 
      margin: 3px 0 0 0; 
      font-size: 15px; 
      font-weight: 800; 
      color: #1f2937; 
    }
    .logo-box { 
      display: flex; 
      justify-content: center; 
      align-items: center; 
    }
    .logo-box img { 
      max-height: 75px; 
      max-width: 220px; 
      object-fit: contain; 
    }
    .statement-title { 
      text-align: left; 
    }
    .invoice-title h2, .statement-title h2 {
      margin: 0 !important;
      font-size: 22px !important;
      border: 2.5px solid #000 !important;
      padding-top: 1px !important;
      padding-bottom: 15px !important;
      padding-left: 24px !important;
      padding-right: 24px !important;
      line-height: 1.1 !important;
      font-weight: 900 !important;
      border-radius: 8px !important;
      background-color: #f8fafc !important;
      color: #000 !important;
      display: inline-block !important;
    }
    .info-bar { 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      border: 2.5px solid #000; 
      padding-top: 4px !important;
      padding-bottom: 12px !important;
      padding-left: 16px;
      padding-right: 16px;
      border-radius: 8px; 
      background: #f8fafc; 
      margin-bottom: 12px; 
      flex-wrap: wrap; 
      gap: 10px; 
    }
    .info-item { 
      display: flex; 
      flex-direction: column; 
      align-items: center; 
    }
    .info-label { 
      font-weight: 800; 
      color: #475569; 
      font-size: 12px; 
      margin-bottom: 2px;
    }
    .info-value { 
      font-weight: 900; 
      font-size: 16px; 
      color: #000;
      line-height: 1.1 !important;
      margin-top: 2px !important;
    }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      table-layout: fixed;
      margin-top: 6px; 
      margin-bottom: 12px; 
      border: 2.5px solid #000;
      direction: rtl;
    }
    thead tr {
      height: 38px !important;
    }
    tbody tr {
      height: 36px !important;
    }
    table th, table td {
      padding: 0 !important;
      margin: 0 !important;
      text-align: center !important;
      vertical-align: middle !important;
      box-sizing: border-box !important;
      height: 38px !important;
    }
    th { 
      border: 2px solid #000; 
      background-color: #e2e8f0; 
      font-weight: 900; 
      font-size: 13.5px; 
      color: #000;
      white-space: nowrap;
      overflow: hidden;
    }
    td { 
      border: 1.5px solid #000; 
      font-weight: 800; 
      font-size: 13.5px; 
      color: #000; 
      white-space: nowrap;
      overflow: hidden;
    }
    tr:nth-child(even) td {
      background-color: #f8fafc;
    }
    .cell-content {
      display: block !important;
      width: 100% !important;
      text-align: center !important;
      margin: 0 auto !important;
      padding-top: 2px !important;
      padding-bottom: 7px !important;
      line-height: 1.2 !important;
      box-sizing: border-box !important;
    }
    th .cell-content {
      padding-top: 3px !important;
      padding-bottom: 7px !important;
    }
    .totals-summary { 
      display: flex; 
      justify-content: flex-end; 
      margin-top: 10px; 
      margin-bottom: 14px; 
    }
    .totals-section { 
      display: flex; 
      justify-content: flex-end; 
      align-items: flex-start; 
      margin-top: 10px; 
      width: 100%; 
    }
    .totals-box { 
      width: 390px; 
      border: 3px solid #000; 
      border-radius: 6px; 
      overflow: hidden; 
      background-color: #fff; 
    }
    .total-row {
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      padding-top: 2px !important;
      padding-bottom: 14px !important;
      padding-left: 12px !important;
      padding-right: 12px !important;
      border-bottom: 1.5px solid #cbd5e1 !important;
      font-size: 16px !important;
      font-weight: 800 !important;
      line-height: 1.1 !important;
    }
    .total-row.main {
      padding-top: 2px !important;
      padding-bottom: 14px !important;
      font-weight: 900 !important;
      font-size: 18px !important;
      border-bottom: 2.5px solid #000 !important;
      background-color: #f1f5f9 !important;
    }
    .total-row.final {
      padding-top: 3px !important;
      padding-bottom: 16px !important;
      background-color: #000 !important;
      color: #fff !important;
      border-bottom: none !important;
      font-size: 20px !important;
      font-weight: 900 !important;
    }
    .invoice-bottom-pinned { 
      width: 100%; 
      margin-top: auto; 
      padding-top: 16px;
    }
    .signatures { 
      margin-bottom: 14px; 
      display: flex; 
      justify-content: space-between; 
      padding: 0 45px; 
      font-size: 16px; 
      font-weight: 900; 
    }
    .sig-box { 
      text-align: center; 
      width: 170px; 
    }
    .sig-line { 
      border-top: 2.5px solid #000; 
      margin-top: 25px; 
      width: 100%; 
    }
    .footer-bar { 
      padding-top: 8px; 
      border-top: 2.5px solid #000; 
      width: 100%; 
      display: flex; 
      justify-content: center; 
      align-items: center; 
      font-size: 13.5px; 
      font-weight: 800; 
      color: #000; 
    }
  `;
}

export function getSalesInvoiceHtml(invoice: SalesInvoice, companyLogo?: string): string {
  const paymentMethodLabel = invoice.paymentMethod === 'BANK_AHLY'
    ? 'البنك الأهلي'
    : invoice.paymentMethod === 'BANK_MISR'
    ? 'بنك مصر'
    : invoice.paymentMethod === 'VF_CASH_AYMAN'
    ? 'فودافون كاش أيمن'
    : invoice.paymentMethod === 'VF_CASH_KYRILLOS'
    ? 'فودافون كاش كيرلس'
    : 'خزنة (كاش)';

  const paidAmount = invoice.paidAmount !== undefined ? invoice.paidAmount : (invoice.paid || 0);
  const remainingAmount = invoice.remainingAmount !== undefined 
    ? invoice.remainingAmount 
    : (invoice.total - paidAmount);

  return `
    <div style="font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; direction: rtl; width: 860px; padding: 20px; background: #fff; color: #000; box-sizing: border-box; margin: 0 auto;">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&display=swap" rel="stylesheet">
      <style>${getInvoicePrintStyle()}</style>
      <div class="invoice-container">
        <div>
          <div class="header">
            <div class="company-info">
              <h1>بورصة النجار</h1>
              <p>لتجارة البيض</p>
            </div>
            <div class="logo-box">
              <img src="${companyLogo || '/logo.png'}" alt="Logo" style="max-height: 75px; max-width: 200px; object-fit: contain;"/>
            </div>
            <div class="invoice-title">
              <h2>فاتورة مبيعات</h2>
            </div>
          </div>
          
          <div class="info-bar">
             <div class="info-item"><span class="info-label">العميل</span><span class="info-value">${invoice.customerName}</span></div>
             <div class="info-item"><span class="info-label">كود العميل</span><span class="info-value">${invoice.customerCode}</span></div>
             <div class="info-item"><span class="info-label">رقم الفاتورة</span><span class="info-value">${invoice.id}</span></div>
             <div class="info-item"><span class="info-label">التاريخ</span><span class="info-value">${invoice.date}</span></div>
             <div class="info-item"><span class="info-label">الوقت</span><span class="info-value">${invoice.time || '-'}</span></div>
          </div>

          <table>
            <colgroup>
              <col style="width: 7%;">
              <col style="width: 45%;">
              <col style="width: 16%;">
              <col style="width: 16%;">
              <col style="width: 16%;">
            </colgroup>
            <thead>
              <tr>
                <th><div class="cell-content">م</div></th>
                <th><div class="cell-content">الصنف</div></th>
                <th><div class="cell-content">الكمية</div></th>
                <th><div class="cell-content">السعر</div></th>
                <th><div class="cell-content">الإجمالي</div></th>
              </tr>
            </thead>
            <tbody>
              ${(invoice.items || []).map((item, index) => `
                <tr>
                  <td><div class="cell-content">${index + 1}</div></td>
                  <td style="font-weight: 900;"><div class="cell-content" style="font-weight: 900;">${item.itemName}</div></td>
                  <td><div class="cell-content">${item.quantity.toLocaleString()}</div></td>
                  <td><div class="cell-content">${item.price.toLocaleString()}</div></td>
                  <td style="font-weight: 900;"><div class="cell-content" style="font-weight: 900;">${(item.quantity * item.price).toLocaleString()}</div></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="totals-section">
            <div class="totals-box">
              <div class="total-row main"><span>إجمالي الفاتورة:</span><strong>${invoice.total.toLocaleString()} ج.م</strong></div>
              ${paidAmount > 0 ? `
                <div class="total-row" style="color: #047857;"><span>المدفوع (${paymentMethodLabel}):</span><strong>${paidAmount.toLocaleString()} ج.م</strong></div>
                <div class="total-row" style="color: #b91c1c;"><span>المتبقي من الفاتورة:</span><strong>${remainingAmount.toLocaleString()} ج.م</strong></div>
              ` : `
                <div class="total-row" style="color: #374151;"><span>حالة السداد:</span><span>آجل بالكامل على الحساب</span></div>
              `}
              ${invoice.previousBalance !== undefined ? `
                <div class="total-row" style="color: #1f2937;"><span>رصيد سابق:</span><span>${invoice.previousBalance.toLocaleString()} ج.م</span></div>
              ` : ''}
              ${invoice.currentBalance !== undefined ? `
                <div class="total-row final"><span>الرصيد الحالي:</span><span dir="ltr">${invoice.currentBalance.toLocaleString()} ج.م</span></div>
              ` : ''}
            </div>
          </div>
        </div>

        <div class="invoice-bottom-pinned">
          <div class="signatures">
            <div class="sig-box"><strong>المستلم / العميل</strong><div class="sig-line"></div></div>
            <div class="sig-box"><strong>توقيع إدارة البورصة</strong><div class="sig-line"></div></div>
          </div>

          <div class="footer-bar">
            للمبيعات والاستفسارات: 01280808532 - 01274688088 - 01000285428
          </div>
        </div>
      </div>
    </div>
  `;
}

export function getPurchaseInvoiceHtml(purchase: Purchase, companyLogo?: string): string {
  const paid = purchase.paid || 0;
  const remaining = purchase.remaining !== undefined ? purchase.remaining : (purchase.total - paid);

  return `
    <div style="font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; direction: rtl; width: 860px; padding: 20px; background: #fff; color: #000; box-sizing: border-box; margin: 0 auto;">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&display=swap" rel="stylesheet">
      <style>${getInvoicePrintStyle()}</style>
      <div class="invoice-container">
        <div>
          <div class="header">
            <div class="company-info">
              <h1>بورصة النجار</h1>
              <p>لتجارة البيض</p>
            </div>
            <div class="logo-box">
              <img src="${companyLogo || '/logo.png'}" alt="Logo" style="max-height: 75px; max-width: 200px; object-fit: contain;"/>
            </div>
            <div class="invoice-title">
              <h2>فاتورة مشتريات</h2>
            </div>
          </div>
          
          <div class="info-bar">
             <div class="info-item"><span class="info-label">المورد</span><span class="info-value">${purchase.supplierName}</span></div>
             <div class="info-item"><span class="info-label">كود المورد</span><span class="info-value">${purchase.supplierCode}</span></div>
             <div class="info-item"><span class="info-label">رقم الفاتورة</span><span class="info-value">${purchase.id}</span></div>
             <div class="info-item"><span class="info-label">التالتاريخ</span><span class="info-value">${purchase.date}</span></div>
          </div>

          <table>
            <colgroup>
              <col style="width: 7%;">
              <col style="width: 45%;">
              <col style="width: 16%;">
              <col style="width: 16%;">
              <col style="width: 16%;">
            </colgroup>
            <thead>
              <tr>
                <th><div class="cell-content">م</div></th>
                <th><div class="cell-content">الصنف</div></th>
                <th><div class="cell-content">الكمية</div></th>
                <th><div class="cell-content">السعر</div></th>
                <th><div class="cell-content">الإجمالي</div></th>
              </tr>
            </thead>
            <tbody>
              ${(purchase.items || []).map((item, index) => `
                <tr>
                  <td><div class="cell-content">${index + 1}</div></td>
                  <td style="font-weight: 900;"><div class="cell-content" style="font-weight: 900;">${item.itemName}</div></td>
                  <td><div class="cell-content">${item.quantity.toLocaleString()}</div></td>
                  <td><div class="cell-content">${item.price.toLocaleString()}</div></td>
                  <td style="font-weight: 900;"><div class="cell-content" style="font-weight: 900;">${(item.quantity * item.price).toLocaleString()}</div></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="totals-section">
            <div class="totals-box">
              <div class="total-row main"><span>إجمالي الفاتورة:</span><strong>${purchase.total.toLocaleString()} ج.م</strong></div>
              ${paid > 0 ? `
                <div class="total-row" style="color: #047857;"><span>المدفوع للمورد:</span><strong>${paid.toLocaleString()} ج.م</strong></div>
                <div class="total-row" style="color: #b91c1c;"><span>المتبقي:</span><strong>${remaining.toLocaleString()} ج.م</strong></div>
              ` : `
                <div class="total-row" style="color: #374151;"><span>حالة السداد:</span><span>آجل بالكامل على الحساب</span></div>
              `}
              ${purchase.previousBalance !== undefined ? `
                <div class="total-row" style="color: #1f2937;"><span>رصيد سابق:</span><span>${purchase.previousBalance.toLocaleString()} ج.م</span></div>
              ` : ''}
              ${purchase.currentBalance !== undefined ? `
                <div class="total-row final"><span>الرصيد الحالي:</span><span dir="ltr">${purchase.currentBalance.toLocaleString()} ج.م</span></div>
              ` : ''}
            </div>
          </div>
        </div>

        <div class="invoice-bottom-pinned">
          <div class="signatures">
            <div class="sig-box"><strong>المستلم / إدارة البورصة</strong><div class="sig-line"></div></div>
            <div class="sig-box"><strong>توقيع المورد</strong><div class="sig-line"></div></div>
          </div>

          <div class="footer-bar">
            للمبيعات والاستفسارات: 01280808532 - 01274688088 - 01000285428
          </div>
        </div>
      </div>
    </div>
  `;
}

export function getLedgerHtml(options: {
  title: string;
  entityName: string;
  entityCode: string;
  entityPhone?: string;
  type: 'CUSTOMER' | 'SUPPLIER';
  rows: Array<{
    num: number;
    date: string;
    ref?: string;
    itemName: string;
    quantity?: number | string;
    price?: number | string;
    lineTotal?: number | string;
    debit: number;
    credit: number;
    runningBalance: number;
  }>;
  totalDebit: number;
  totalCredit: number;
  finalBalance: number;
  dateRange?: { from?: string; to?: string };
}, companyLogo?: string): string {
  const { title, entityName, entityCode, entityPhone, type, rows, totalDebit, totalCredit, finalBalance, dateRange } = options;
  const isCustomer = type === 'CUSTOMER';
  const colDebitTitle = 'مدين';
  const colCreditTitle = 'دائن';

  return `
    <div style="font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; direction: rtl; width: 860px; padding: 20px; background: #fff; color: #000; box-sizing: border-box; margin: 0 auto;">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&display=swap" rel="stylesheet">
      <style>${getInvoicePrintStyle()}</style>

      <div class="header">
        <div class="company-info">
          <h1>بورصة النجار</h1>
          <p>لتجارة البيض</p>
        </div>
        <div class="logo-box">
          <img src="${companyLogo || '/logo.png'}" alt="Logo" style="max-height: 70px; max-width: 190px; object-fit: contain;"/>
        </div>
        <div class="statement-title">
          <h2>كشف حساب</h2>
        </div>
      </div>

      <div class="info-bar">
        <div class="info-item"><span class="info-label">${isCustomer ? 'العميل' : 'المورد'}</span><span class="info-value">${entityName}</span></div>
        <div class="info-item"><span class="info-label">الكود</span><span class="info-value">${entityCode}</span></div>
        ${entityPhone ? `<div class="info-item"><span class="info-label">الهاتف</span><span class="info-value" dir="ltr">${entityPhone}</span></div>` : ''}
        ${dateRange && (dateRange.from || dateRange.to) ? `
          <div class="info-item">
            <span class="info-label">الفترة المحددة</span>
            <span class="info-value" style="color: #0369a1;">
              ${dateRange.from ? `من: ${dateRange.from}` : ''} ${dateRange.to ? `إلى: ${dateRange.to}` : ''}
            </span>
          </div>
        ` : ''}
        <div class="info-item"><span class="info-label">تاريخ الطباعة</span><span class="info-value">${new Date().toISOString().split('T')[0]}</span></div>
      </div>

      <table>
        <colgroup>
          <col style="width: 4.5%;">   <!-- م -->
          <col style="width: 14%;">    <!-- التاريخ -->
          <col style="width: 9%;">     <!-- الفاتورة -->
          <col style="width: 24.5%;">  <!-- الصنف / البيان -->
          <col style="width: 7%;">     <!-- الكمية -->
          <col style="width: 7%;">     <!-- السعر -->
          <col style="width: 10%;">    <!-- الإجمالي -->
          <col style="width: 8%;">     <!-- مدين -->
          <col style="width: 8%;">     <!-- دائن -->
          <col style="width: 8%;">     <!-- الرصيد -->
        </colgroup>
        <thead>
          <tr>
            <th><div class="cell-content">م</div></th>
            <th><div class="cell-content">التاريخ</div></th>
            <th><div class="cell-content">الفاتورة</div></th>
            <th><div class="cell-content">الصنف / البيان</div></th>
            <th><div class="cell-content">الكمية</div></th>
            <th><div class="cell-content">السعر</div></th>
            <th><div class="cell-content">الإجمالي</div></th>
            <th><div class="cell-content">${colDebitTitle}</div></th>
            <th><div class="cell-content">${colCreditTitle}</div></th>
            <th><div class="cell-content">الرصيد</div></th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td><div class="cell-content">${r.num}</div></td>
              <td dir="ltr"><div class="cell-content" dir="ltr">${r.date}</div></td>
              <td><div class="cell-content">${r.ref || '-'}</div></td>
              <td style="font-weight: 900;"><div class="cell-content" style="font-weight: 900;">${r.itemName}</div></td>
              <td><div class="cell-content">${typeof r.quantity === 'number' ? r.quantity.toLocaleString() : r.quantity}</div></td>
              <td><div class="cell-content">${typeof r.price === 'number' ? r.price.toLocaleString() : r.price}</div></td>
              <td style="font-weight: 900;"><div class="cell-content" style="font-weight: 900;">${r.lineTotal !== undefined && r.lineTotal !== '-' ? (typeof r.lineTotal === 'number' ? r.lineTotal.toLocaleString() : r.lineTotal) : '-'}</div></td>
              <td style="color: #b91c1c; font-weight: 900;"><div class="cell-content" style="color: #b91c1c; font-weight: 900;">${r.debit > 0 ? r.debit.toLocaleString() : '-'}</div></td>
              <td style="color: #15803d; font-weight: 900;"><div class="cell-content" style="color: #15803d; font-weight: 900;">${r.credit > 0 ? r.credit.toLocaleString() : '-'}</div></td>
              <td style="font-weight: 900;" dir="ltr"><div class="cell-content" style="font-weight: 900;" dir="ltr">${r.runningBalance.toLocaleString()}</div></td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="totals-summary">
        <div class="totals-box">
          <div class="total-row"><span>إجمالي ${colDebitTitle}:</span><span>${totalDebit.toLocaleString()} ج.م</span></div>
          <div class="total-row"><span>إجمالي ${colCreditTitle}:</span><span>${totalCredit.toLocaleString()} ج.م</span></div>
          <div class="total-row final"><span>الرصيد النهائي:</span><span dir="ltr">${finalBalance.toLocaleString()} ج.م</span></div>
        </div>
      </div>

      <div class="signatures">
        <div class="sig-box"><strong>المستلم / الطرف الآخر</strong><div class="sig-line"></div></div>
        <div class="sig-box"><strong>توقيع إدارة البورصة</strong><div class="sig-line"></div></div>
      </div>

      <div class="footer-bar">
        للمبيعات والاستفسارات: 01280808532 - 01274688088 - 01000285428
      </div>
    </div>
  `;
}

export function getConsolidatedLedgerHtml(options: {
  title: string;
  reportType: 'CUSTOMERS' | 'SUPPLIERS' | 'ALL';
  dateRange?: { from?: string; to?: string };
  mode: 'BALANCES' | 'MOVEMENTS';
  balanceRows?: Array<{
    num: number;
    code: string;
    name: string;
    phone?: string;
    entityType?: 'CUSTOMER' | 'SUPPLIER';
    priorBalance: number;
    debit: number;
    credit: number;
    finalBalance: number;
    status: 'مدين' | 'دائن' | 'متزن';
  }>;
  movementRows?: Array<{
    num: number;
    date: string;
    entityName: string;
    entityCode: string;
    ref?: string;
    itemName: string;
    quantity?: number | string;
    price?: number | string;
    lineTotal?: number | string;
    debit: number;
    credit: number;
  }>;
  totalDebit: number;
  totalCredit: number;
  finalBalance: number;
}, companyLogo?: string): string {
  const { title, reportType, dateRange, mode, balanceRows = [], movementRows = [], totalDebit, totalCredit, finalBalance } = options;
  const isCustomerReport = reportType === 'CUSTOMERS';
  const isSupplierReport = reportType === 'SUPPLIERS';
  const typeLabel = isCustomerReport ? 'كشف حساب مجمع للعملاء' : isSupplierReport ? 'كشف حساب مجمع للموردين' : 'كشف حساب مجمع شامل (عملاء وموردين)';

  return `
    <div style="font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; direction: rtl; width: ${mode === 'MOVEMENTS' ? '1060px' : '880px'}; padding: 20px; background: #fff; color: #000; box-sizing: border-box; margin: 0 auto;">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&display=swap" rel="stylesheet">
      <style>${getInvoicePrintStyle()}</style>

      <div class="header">
        <div class="company-info">
          <h1>بورصة النجار</h1>
          <p>لتجارة البيض</p>
        </div>
        <div class="logo-box">
          <img src="${companyLogo || '/logo.png'}" alt="Logo" style="max-height: 70px; max-width: 190px; object-fit: contain;"/>
        </div>
        <div class="statement-title">
          <h2>${title}</h2>
        </div>
      </div>

      <div class="info-bar">
        <div class="info-item"><span class="info-label">التقرير</span><span class="info-value">${typeLabel}</span></div>
        <div class="info-item"><span class="info-label">نوع العرض</span><span class="info-value">${mode === 'BALANCES' ? 'ملخص الأرصدة' : 'سجل الحركات التفصيلية'}</span></div>
        ${dateRange && (dateRange.from || dateRange.to) ? `
          <div class="info-item">
            <span class="info-label">الفترة المحددة</span>
            <span class="info-value" style="color: #0369a1;">
              ${dateRange.from ? `من: ${dateRange.from}` : ''} ${dateRange.to ? `إلى: ${dateRange.to}` : ''}
            </span>
          </div>
        ` : '<div class="info-item"><span class="info-label">الفترة</span><span class="info-value">جميع الحركات حتى تاريخه</span></div>'}
        <div class="info-item"><span class="info-label">العدد</span><span class="info-value">${mode === 'BALANCES' ? `${balanceRows.length} حساب` : `${movementRows.length} حركة`}</span></div>
        <div class="info-item"><span class="info-label">تاريخ الطباعة</span><span class="info-value">${new Date().toISOString().split('T')[0]}</span></div>
      </div>

      ${mode === 'BALANCES' ? `
        <table>
          <colgroup>
            <col style="width: 5%;">
            <col style="width: 10%;">
            <col style="width: 25%;">
            <col style="width: 13%;">
            ${reportType === 'ALL' ? '<col style="width: 7%;">' : ''}
            <col style="width: 10%;">
            <col style="width: 10%;">
            <col style="width: 10%;">
            <col style="width: 10%;">
          </colgroup>
          <thead>
            <tr>
              <th><div class="cell-content">م</div></th>
              <th><div class="cell-content">الكود</div></th>
              <th><div class="cell-content">الاسم</div></th>
              <th><div class="cell-content">الهاتف</div></th>
              ${reportType === 'ALL' ? '<th><div class="cell-content">النوع</div></th>' : ''}
              <th><div class="cell-content">رصيد سابق</div></th>
              <th><div class="cell-content">إجمالي مدين</div></th>
              <th><div class="cell-content">إجمالي دائن</div></th>
              <th><div class="cell-content">الرصيد النهائي</div></th>
            </tr>
          </thead>
          <tbody>
            ${balanceRows.map(r => `
              <tr>
                <td><div class="cell-content">${r.num}</div></td>
                <td style="font-weight: 800;"><div class="cell-content" style="font-weight: 800;">${r.code}</div></td>
                <td style="font-weight: 800;"><div class="cell-content" style="font-weight: 800;">${r.name}</div></td>
                <td dir="ltr"><div class="cell-content" dir="ltr">${r.phone || '-'}</div></td>
                ${reportType === 'ALL' ? `<td><div class="cell-content">${r.entityType === 'CUSTOMER' ? 'عميل' : 'مورد'}</div></td>` : ''}
                <td dir="ltr"><div class="cell-content" dir="ltr">${r.priorBalance.toLocaleString()}</div></td>
                <td dir="ltr" style="color: #b91c1c; font-weight: 900;"><div class="cell-content" dir="ltr" style="color: #b91c1c; font-weight: 900;">${r.debit > 0 ? r.debit.toLocaleString() : '-'}</div></td>
                <td dir="ltr" style="color: #15803d; font-weight: 900;"><div class="cell-content" dir="ltr" style="color: #15803d; font-weight: 900;">${r.credit > 0 ? r.credit.toLocaleString() : '-'}</div></td>
                <td dir="ltr" style="font-weight: 900;"><div class="cell-content" dir="ltr" style="font-weight: 900;">${r.finalBalance.toLocaleString()}</div></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : `
        <table>
          <colgroup>
            <col style="width: 4%;">
            <col style="width: 12%;">
            <col style="width: 16%;">
            <col style="width: 8%;">
            <col style="width: 20%;">
            <col style="width: 7%;">
            <col style="width: 7%;">
            <col style="width: 9%;">
            <col style="width: 8.5%;">
            <col style="width: 8.5%;">
          </colgroup>
          <thead>
            <tr>
              <th><div class="cell-content">م</div></th>
              <th><div class="cell-content">التاريخ</div></th>
              <th><div class="cell-content">الطرف</div></th>
              <th><div class="cell-content">الفاتورة</div></th>
              <th><div class="cell-content">الصنف / البيان</div></th>
              <th><div class="cell-content">الكمية</div></th>
              <th><div class="cell-content">السعر</div></th>
              <th><div class="cell-content">الإجمالي</div></th>
              <th><div class="cell-content">مدين</div></th>
              <th><div class="cell-content">دائن</div></th>
            </tr>
          </thead>
          <tbody>
            ${movementRows.map(r => `
              <tr>
                <td><div class="cell-content">${r.num}</div></td>
                <td dir="ltr"><div class="cell-content" dir="ltr">${r.date}</div></td>
                <td style="font-weight: 800;"><div class="cell-content" style="font-weight: 800;">${r.entityName} <span style="font-size: 11px; color: #64748b;">(${r.entityCode})</span></div></td>
                <td><div class="cell-content">${r.ref || '-'}</div></td>
                <td style="font-weight: 900;"><div class="cell-content" style="font-weight: 900;">${r.itemName}</div></td>
                <td><div class="cell-content">${typeof r.quantity === 'number' ? r.quantity.toLocaleString() : r.quantity}</div></td>
                <td><div class="cell-content">${typeof r.price === 'number' ? r.price.toLocaleString() : r.price}</div></td>
                <td style="font-weight: 900;"><div class="cell-content" style="font-weight: 900;">${r.lineTotal !== undefined && r.lineTotal !== '-' ? (typeof r.lineTotal === 'number' ? r.lineTotal.toLocaleString() : r.lineTotal) : '-'}</div></td>
                <td style="color: #b91c1c; font-weight: 900;"><div class="cell-content" dir="ltr" style="color: #b91c1c; font-weight: 900;">${r.debit > 0 ? r.debit.toLocaleString() : '-'}</div></td>
                <td style="color: #15803d; font-weight: 900;"><div class="cell-content" dir="ltr" style="color: #15803d; font-weight: 900;">${r.credit > 0 ? r.credit.toLocaleString() : '-'}</div></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}

      <div class="totals-summary">
        <div class="totals-box">
          <div class="total-row"><span>إجمالي مدين:</span><span dir="ltr">${totalDebit.toLocaleString()} ج.م</span></div>
          <div class="total-row"><span>إجمالي دائن:</span><span dir="ltr">${totalCredit.toLocaleString()} ج.م</span></div>
          <div class="total-row final"><span>صافي الرصيد:</span><span dir="ltr">${finalBalance.toLocaleString()} ج.م</span></div>
        </div>
      </div>

      <div class="signatures">
        <div class="sig-box"><strong>المستلم / الطرف الآخر</strong><div class="sig-line"></div></div>
        <div class="sig-box"><strong>توقيع إدارة البورصة</strong><div class="sig-line"></div></div>
      </div>

      <div class="footer-bar">
        للمبيعات والاستفسارات: 01280808532 - 01274688088 - 01000285428
      </div>
    </div>
  `;
}
