import React, { useState, useMemo } from 'react';
import { X, Printer, Search, Calendar, Filter, Users, Truck, Layers, ArrowUpDown, ChevronDown, CheckCircle2, AlertCircle, MessageCircle } from 'lucide-react';
import { useERP } from '../context/ERPContext';
import { shareConsolidatedStatementPdfViaWhatsApp } from '../utils/whatsapp';

interface ConsolidatedLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'CUSTOMERS' | 'SUPPLIERS' | 'ALL';
  onSelectEntity?: (type: 'CUSTOMER' | 'SUPPLIER', code: string) => void;
}

export const ConsolidatedLedgerModal: React.FC<ConsolidatedLedgerModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'CUSTOMERS',
  onSelectEntity
}) => {
  const { customers, suppliers, invoices, purchases, printConsolidatedLedger, companyLogo } = useERP();

  const [activeTab, setActiveTab] = useState<'CUSTOMERS' | 'SUPPLIERS' | 'ALL'>(initialTab);
  const [viewMode, setViewMode] = useState<'BALANCES' | 'MOVEMENTS'>('BALANCES');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DEBIT' | 'CREDIT' | 'ZERO'>('ALL');
  const [isSharingPdf, setIsSharingPdf] = useState(false);

  // Sync tab with initialTab when opened
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Helper to apply quick date presets
  const applyPreset = (preset: 'ALL' | 'TODAY' | 'THIS_MONTH' | 'LAST_MONTH' | 'LAST_30') => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    if (preset === 'ALL') {
      setFilterStartDate('');
      setFilterEndDate('');
    } else if (preset === 'TODAY') {
      setFilterStartDate(today);
      setFilterEndDate(today);
    } else if (preset === 'THIS_MONTH') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      setFilterStartDate(first);
      setFilterEndDate(today);
    } else if (preset === 'LAST_MONTH') {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const last = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      setFilterStartDate(first);
      setFilterEndDate(last);
    } else if (preset === 'LAST_30') {
      const prior = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setFilterStartDate(prior);
      setFilterEndDate(today);
    }
  };

  // Helper to format movement descriptions cleanly
  const formatMovementDesc = (desc: string) => {
    if (desc.includes('تحصيل من عميل')) {
      const notes = desc.replace(/^تحصيل من عميل:.*?(\s*-\s*|$)/, '').trim();
      return notes ? `دفعة (${notes})` : 'دفعة';
    }
    if (desc.includes('سداد لمورد')) {
      const notes = desc.replace(/^سداد لمورد:.*?(\s*-\s*|$)/, '').trim();
      return notes ? `دفعة (${notes})` : 'دفعة';
    }
    if (desc.includes('سداد / تحصيل نقدية')) return 'دفعة';
    return desc;
  };

  // 1. Calculate Consolidated Customer Balances & Movement Data
  const customerConsolidatedData = useMemo(() => {
    return customers.map(cust => {
      let prior = 0;
      let periodDebit = 0;
      let periodCredit = 0;
      const history = cust.history || [];

      // Calculate prior balance if startDate is active
      if (filterStartDate) {
        history.forEach(h => {
          if (h.description.includes('تعديل')) return;
          if (h.date < filterStartDate) {
            const isInv = h.description.includes('فاتورة بيع') && !h.description.includes('دفعة') && !h.description.includes('إلغاء');
            const invMatch = h.description.match(/#([A-Za-z0-9-]+)/);
            const invId = invMatch ? invMatch[1] : null;
            const invoice = invId ? invoices.find(inv => inv.id === invId) : null;
            if (isInv && invoice && invoice.items && invoice.items.length > 0) {
              const totalItems = invoice.items.reduce((s, it) => s + (it.quantity * it.price), 0);
              prior -= totalItems;
            } else {
              prior += h.amount;
            }
          }
        });
      }

      // Calculate period debits and credits
      history.forEach(h => {
        if (h.description.includes('تعديل')) return;
        if (filterStartDate && h.date < filterStartDate) return;
        if (filterEndDate && h.date > filterEndDate) return;

        const isInv = h.description.includes('فاتورة بيع') && !h.description.includes('دفعة') && !h.description.includes('إلغاء');
        const invMatch = h.description.match(/#([A-Za-z0-9-]+)/);
        const invId = invMatch ? invMatch[1] : null;
        const invoice = invId ? invoices.find(inv => inv.id === invId) : null;

        if (isInv && invoice && invoice.items && invoice.items.length > 0) {
          const totalItems = invoice.items.reduce((s, it) => s + (it.quantity * it.price), 0);
          periodDebit += totalItems;
        } else {
          if (h.amount < 0) {
            periodDebit += Math.abs(h.amount);
          } else {
            periodCredit += h.amount;
          }
        }
      });

      // Net final balance for customer:
      // If no start date filter, use real cust.balance. If date filter active, prior - periodDebit + periodCredit
      const finalBal = filterStartDate || filterEndDate
        ? (prior - periodDebit + periodCredit)
        : cust.balance;

      const status: 'مدين' | 'دائن' | 'متزن' = finalBal < 0 ? 'مدين' : finalBal > 0 ? 'دائن' : 'متزن';

      return {
        code: cust.code,
        name: cust.name,
        phone: cust.phone || '',
        entityType: 'CUSTOMER' as const,
        priorBalance: prior,
        debit: periodDebit,
        credit: periodCredit,
        finalBalance: finalBal,
        status,
        rawCustomer: cust
      };
    });
  }, [customers, invoices, filterStartDate, filterEndDate]);

  // 2. Calculate Consolidated Supplier Balances & Movement Data
  const supplierConsolidatedData = useMemo(() => {
    return suppliers.map(supp => {
      let prior = 0;
      let periodDebit = 0; // سداد للمورد
      let periodCredit = 0; // مشتريات من المورد (علينا)
      const history = [...(supp.history || [])];
      const hasOpening = history.some(h => h.description?.includes('رصيد افتتاحي'));
      const opVal = Number((supp as any).openingBalance !== undefined ? (supp as any).openingBalance : 0);
      if (!hasOpening && opVal !== 0) {
        const isDebtWeOwe = (supp as any).openingBalanceType === 'CREDIT' || ((supp as any).openingBalanceType !== 'DEBIT' && opVal < 0);
        const absVal = Math.abs(opVal);
        const historyAmount = isDebtWeOwe ? absVal : -absVal;
        history.unshift({
          date: history[0]?.date || new Date().toISOString().split('T')[0],
          description: 'رصيد افتتاحي',
          amount: historyAmount
        });
      }

      // Calculate prior balance if startDate is active
      if (filterStartDate) {
        history.forEach(h => {
          if (h.description.includes('تعديل')) return;
          if (h.date < filterStartDate) {
            const isPurch = h.description.includes('فاتورة مشتريات');
            const pMatch = h.description.match(/#([A-Za-z0-9-]+)/);
            const pId = pMatch ? pMatch[1] : null;
            const purch = pId ? purchases.find(p => p.id === pId) : null;
            if (isPurch && purch && purch.items && purch.items.length > 0) {
              const totalItems = purch.items.reduce((s, it) => s + (it.quantity * it.price), 0);
              prior += totalItems;
            } else {
              prior += h.amount;
            }
          }
        });
      }

      // Calculate period debits and credits
      history.forEach(h => {
        if (h.description.includes('تعديل')) return;
        if (filterStartDate && h.date < filterStartDate) return;
        if (filterEndDate && h.date > filterEndDate) return;

        const isPurch = h.description.includes('فاتورة مشتريات');
        const pMatch = h.description.match(/#([A-Za-z0-9-]+)/);
        const pId = pMatch ? pMatch[1] : null;
        const purch = pId ? purchases.find(p => p.id === pId) : null;

        if (isPurch && purch && purch.items && purch.items.length > 0) {
          const totalItems = purch.items.reduce((s, it) => s + (it.quantity * it.price), 0);
          periodCredit += totalItems; // supplier credit (we owe more)
        } else {
          if (h.amount < 0) {
            periodDebit += Math.abs(h.amount); // paying supplier reduces debt
          } else {
            periodCredit += h.amount;
          }
        }
      });

      // For supplier: positive balance means we owe supplier (دائن/له), negative means supplier owes us (مدين/لنا)
      const dynamicBal = prior + periodCredit - periodDebit;
      const finalBal = (supp.history && supp.history.length > 0)
        ? dynamicBal
        : ((supp as any).currentBalance !== undefined ? (supp as any).currentBalance : supp.balance);

      const status: 'مدين' | 'دائن' | 'متزن' = finalBal > 0 ? 'دائن' : finalBal < 0 ? 'مدين' : 'متزن';

      return {
        code: supp.code,
        name: supp.name,
        phone: supp.phone || '',
        entityType: 'SUPPLIER' as const,
        priorBalance: prior,
        debit: periodDebit,
        credit: periodCredit,
        finalBalance: finalBal,
        status,
        rawSupplier: supp
      };
    });
  }, [suppliers, purchases, filterStartDate, filterEndDate]);

  // Combined Active Balance Rows based on Tab
  const activeBalanceRows = useMemo(() => {
    let rows: typeof customerConsolidatedData = [];
    if (activeTab === 'CUSTOMERS') {
      rows = customerConsolidatedData;
    } else if (activeTab === 'SUPPLIERS') {
      rows = supplierConsolidatedData;
    } else {
      rows = [...customerConsolidatedData, ...supplierConsolidatedData];
    }

    // Apply Search
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      rows = rows.filter(r => 
        r.name.toLowerCase().includes(q) || 
        r.code.toLowerCase().includes(q) || 
        r.phone.includes(q)
      );
    }

    // Apply Status Filter
    if (statusFilter === 'DEBIT') {
      rows = rows.filter(r => r.status === 'مدين');
    } else if (statusFilter === 'CREDIT') {
      rows = rows.filter(r => r.status === 'دائن');
    } else if (statusFilter === 'ZERO') {
      rows = rows.filter(r => r.status === 'متزن');
    }

    return rows;
  }, [activeTab, customerConsolidatedData, supplierConsolidatedData, searchTerm, statusFilter]);

  // 3. Detailed Consolidated Movements Timeline across accounts
  const consolidatedMovementRows = useMemo(() => {
    const list: Array<{
      date: string;
      entityName: string;
      entityCode: string;
      entityType: 'CUSTOMER' | 'SUPPLIER';
      ref: string;
      itemName: string;
      quantity: number | string;
      price: number | string;
      lineTotal: number | string;
      debit: number;
      credit: number;
    }> = [];

    // Customer movements
    if (activeTab === 'CUSTOMERS' || activeTab === 'ALL') {
      customers.forEach(cust => {
        const history = cust.history || [];
        history.forEach(h => {
          if (h.description.includes('تعديل')) return;
          if (filterStartDate && h.date < filterStartDate) return;
          if (filterEndDate && h.date > filterEndDate) return;

          const isInv = h.description.includes('فاتورة بيع') && !h.description.includes('دفعة') && !h.description.includes('إلغاء');
          const invMatch = h.description.match(/#([A-Za-z0-9-]+)/);
          const invId = invMatch ? invMatch[1] : null;
          const invoice = invId ? invoices.find(inv => inv.id === invId) : null;

          if (isInv && invoice && invoice.items && invoice.items.length > 0) {
            invoice.items.forEach(it => {
              const lt = it.quantity * it.price;
              list.push({
                date: invoice.date || h.date,
                entityName: cust.name,
                entityCode: cust.code,
                entityType: 'CUSTOMER',
                ref: invoice.id,
                itemName: it.itemName,
                quantity: it.quantity,
                price: it.price,
                lineTotal: lt,
                debit: lt,
                credit: 0
              });
            });
          } else {
            const deb = h.amount < 0 ? Math.abs(h.amount) : 0;
            const cred = h.amount > 0 ? h.amount : 0;
            list.push({
              date: h.date,
              entityName: cust.name,
              entityCode: cust.code,
              entityType: 'CUSTOMER',
              ref: invId || '-',
              itemName: formatMovementDesc(h.description),
              quantity: '-',
              price: '-',
              lineTotal: '-',
              debit: deb,
              credit: cred
            });
          }
        });
      });
    }

    // Supplier movements
    if (activeTab === 'SUPPLIERS' || activeTab === 'ALL') {
      suppliers.forEach(supp => {
        const history = supp.history || [];
        history.forEach(h => {
          if (h.description.includes('تعديل')) return;
          if (filterStartDate && h.date < filterStartDate) return;
          if (filterEndDate && h.date > filterEndDate) return;

          const isPurch = h.description.includes('فاتورة مشتريات');
          const pMatch = h.description.match(/#([A-Za-z0-9-]+)/);
          const pId = pMatch ? pMatch[1] : null;
          const purch = pId ? purchases.find(p => p.id === pId) : null;

          if (isPurch && purch && purch.items && purch.items.length > 0) {
            purch.items.forEach(it => {
              const lt = it.quantity * it.price;
              list.push({
                date: purch.date || h.date,
                entityName: supp.name,
                entityCode: supp.code,
                entityType: 'SUPPLIER',
                ref: purch.id,
                itemName: it.itemName,
                quantity: it.quantity,
                price: it.price,
                lineTotal: lt,
                debit: 0,
                credit: lt
              });
            });
          } else {
            const deb = h.amount < 0 ? Math.abs(h.amount) : 0;
            const cred = h.amount > 0 ? h.amount : 0;
            list.push({
              date: h.date,
              entityName: supp.name,
              entityCode: supp.code,
              entityType: 'SUPPLIER',
              ref: pId || '-',
              itemName: formatMovementDesc(h.description),
              quantity: '-',
              price: '-',
              lineTotal: '-',
              debit: deb,
              credit: cred
            });
          }
        });
      });
    }

    // Sort chronologically ascending
    list.sort((a, b) => a.date.localeCompare(b.date));

    // Filter by search
    let filtered = list;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(item => 
        item.entityName.toLowerCase().includes(q) ||
        item.entityCode.toLowerCase().includes(q) ||
        item.itemName.toLowerCase().includes(q) ||
        item.ref.toLowerCase().includes(q)
      );
    }

    return filtered.map((row, idx) => ({
      num: idx + 1,
      ...row
    }));
  }, [activeTab, customers, suppliers, invoices, purchases, filterStartDate, filterEndDate, searchTerm]);

  // Overall Totals
  const totalDebit = useMemo(() => {
    if (viewMode === 'BALANCES') {
      return activeBalanceRows.reduce((sum, r) => sum + r.debit, 0);
    }
    return consolidatedMovementRows.reduce((sum, r) => sum + r.debit, 0);
  }, [viewMode, activeBalanceRows, consolidatedMovementRows]);

  const totalCredit = useMemo(() => {
    if (viewMode === 'BALANCES') {
      return activeBalanceRows.reduce((sum, r) => sum + r.credit, 0);
    }
    return consolidatedMovementRows.reduce((sum, r) => sum + r.credit, 0);
  }, [viewMode, activeBalanceRows, consolidatedMovementRows]);

  const totalNetBalance = useMemo(() => {
    return activeBalanceRows.reduce((sum, r) => sum + r.finalBalance, 0);
  }, [activeBalanceRows]);

  // Printed / shared statement only: biggest debt first. The on-screen view keeps the code order.
  // Customers: negative balance = the customer owes us -> most negative first.
  // Suppliers: positive balance = we owe the supplier -> most positive first.
  const getPrintBalanceRows = () => {
    const rows = [...activeBalanceRows];
    if (activeTab === 'CUSTOMERS') rows.sort((a, b) => a.finalBalance - b.finalBalance);
    else if (activeTab === 'SUPPLIERS') rows.sort((a, b) => b.finalBalance - a.finalBalance);
    return rows;
  };

  // Handle Print Action
  const handlePrint = () => {
    const reportTitle = activeTab === 'CUSTOMERS'
      ? 'كشف حساب مجمع للعملاء'
      : activeTab === 'SUPPLIERS'
      ? 'كشف حساب مجمع للموردين'
      : 'كشف حساب مجمع شامل (عملاء وموردين)';

    if (viewMode === 'BALANCES') {
      const balanceRowsForPrint = getPrintBalanceRows().map((r, i) => ({
        num: i + 1,
        code: r.code,
        name: r.name,
        phone: r.phone,
        entityType: r.entityType,
        priorBalance: r.priorBalance,
        debit: r.debit,
        credit: r.credit,
        finalBalance: r.finalBalance,
        status: r.status
      }));

      printConsolidatedLedger({
        title: reportTitle,
        reportType: activeTab,
        dateRange: (filterStartDate || filterEndDate) ? { from: filterStartDate, to: filterEndDate } : undefined,
        mode: 'BALANCES',
        balanceRows: balanceRowsForPrint,
        totalDebit,
        totalCredit,
        finalBalance: totalNetBalance
      });
    } else {
      const movementRowsForPrint = consolidatedMovementRows.map(r => ({
        num: r.num,
        date: r.date,
        entityName: r.entityName,
        entityCode: r.entityCode,
        ref: r.ref,
        itemName: r.itemName,
        quantity: r.quantity,
        price: r.price,
        lineTotal: r.lineTotal,
        debit: r.debit,
        credit: r.credit
      }));

      printConsolidatedLedger({
        title: `${reportTitle} - الحركات التفصيلية`,
        reportType: activeTab,
        dateRange: (filterStartDate || filterEndDate) ? { from: filterStartDate, to: filterEndDate } : undefined,
        mode: 'MOVEMENTS',
        movementRows: movementRowsForPrint,
        totalDebit,
        totalCredit,
        finalBalance: totalNetBalance
      });
    }
  };

  const handleShareWhatsApp = async () => {
    if (isSharingPdf) return;
    const reportTitle = activeTab === 'CUSTOMERS'
      ? 'كشف حساب مجمع للعملاء'
      : activeTab === 'SUPPLIERS'
      ? 'كشف حساب مجمع للموردين'
      : 'كشف حساب مجمع شامل (عملاء وموردين)';

    let safetyTimer: any = null;
    try {
      setIsSharingPdf(true);
      // Failsafe timer so the button NEVER remains stuck on 'جاري التحويل'
      safetyTimer = setTimeout(() => {
        setIsSharingPdf(false);
      }, 3500);

      if (viewMode === 'BALANCES') {
        const balanceRowsForPrint = getPrintBalanceRows().map((r, i) => ({
          num: i + 1,
          code: r.code,
          name: r.name,
          phone: r.phone,
          entityType: r.entityType,
          priorBalance: r.priorBalance,
          debit: r.debit,
          credit: r.credit,
          finalBalance: r.finalBalance,
          status: r.status
        }));

        await shareConsolidatedStatementPdfViaWhatsApp({
          title: reportTitle,
          reportType: activeTab,
          dateRange: (filterStartDate || filterEndDate) ? { from: filterStartDate, to: filterEndDate } : undefined,
          mode: 'BALANCES',
          balanceRows: balanceRowsForPrint,
          totalDebit,
          totalCredit,
          finalBalance: totalNetBalance
        }, companyLogo);
      } else {
        const movementRowsForPrint = consolidatedMovementRows.map(r => ({
          num: r.num,
          date: r.date,
          entityName: r.entityName,
          entityCode: r.entityCode,
          ref: r.ref,
          itemName: r.itemName,
          quantity: r.quantity,
          price: r.price,
          lineTotal: r.lineTotal,
          debit: r.debit,
          credit: r.credit
        }));

        await shareConsolidatedStatementPdfViaWhatsApp({
          title: `${reportTitle} - الحركات التفصيلية`,
          reportType: activeTab,
          dateRange: (filterStartDate || filterEndDate) ? { from: filterStartDate, to: filterEndDate } : undefined,
          mode: 'MOVEMENTS',
          movementRows: movementRowsForPrint,
          totalDebit,
          totalCredit,
          finalBalance: totalNetBalance
        }, companyLogo);
      }
    } catch (err: any) {
      if (
        err?.name !== 'AbortError' &&
        err?.name !== 'NotAllowedError' &&
        !err?.message?.includes?.('AbortError') &&
        !err?.message?.includes?.('canceled') &&
        !err?.message?.includes?.('cancelled')
      ) {
        console.error(err);
      }
    } finally {
      if (safetyTimer) clearTimeout(safetyTimer);
      setIsSharingPdf(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 md:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl border border-gray-200 flex flex-col max-h-[95vh] overflow-hidden animate-scale-up text-right">
        
        {/* Modal Top Header Bar */}
        <div className="bg-gradient-to-r from-slate-900 via-brand-900 to-slate-900 text-white p-3.5 md:p-4 flex flex-wrap justify-between items-center gap-3 shrink-0 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md">
              <Layers size={22} className="text-amber-400" />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-black tracking-wide flex items-center gap-2">
                كشف حساب مجمع
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  {activeTab === 'CUSTOMERS' ? 'العملاء' : activeTab === 'SUPPLIERS' ? 'الموردين' : 'شامل'}
                </span>
              </h2>
              <p className="text-xs text-gray-300">
                استعراض ومتابعة أرصدة وحركات الحسابات المجمعة مع إمكانية التصفية والطباعة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
            >
              <Printer size={15} />
              طباعة الكشف
            </button>
            <button
              onClick={handleShareWhatsApp}
              disabled={isSharingPdf}
              className="flex items-center gap-1.5 bg-[#25D366] hover:bg-[#1ebc59] active:bg-[#199d4b] text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              title="إرسال كشف الحساب المجمع كملف PDF عبر واتساب مباشرة بدون حفظ على الجهاز"
            >
              <MessageCircle size={15} className="fill-white/20" />
              {isSharingPdf ? 'جاري التحويل...' : 'إرسال PDF عبر واتساب'}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs & View Mode Switcher */}
        <div className="bg-slate-50 border-b border-gray-200 p-2.5 md:px-4 flex flex-wrap justify-between items-center gap-2 shrink-0">
          
          {/* Entity Tabs */}
          <div className="inline-flex bg-white p-1 rounded-xl border border-gray-200 shadow-2xs">
            <button
              onClick={() => setActiveTab('CUSTOMERS')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                activeTab === 'CUSTOMERS'
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-brand-900 hover:bg-gray-50'
              }`}
            >
              <Users size={14} />
              كشف العملاء ({customers.length})
            </button>

            <button
              onClick={() => setActiveTab('SUPPLIERS')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                activeTab === 'SUPPLIERS'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-orange-900 hover:bg-gray-50'
              }`}
            >
              <Truck size={14} />
              كشف الموردين ({suppliers.length})
            </button>

            <button
              onClick={() => setActiveTab('ALL')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                activeTab === 'ALL'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-gray-600 hover:text-slate-900 hover:bg-gray-50'
              }`}
            >
              <Layers size={14} />
              الكل معاً ({customers.length + suppliers.length})
            </button>
          </div>

          {/* Mode Switcher */}
          <div className="inline-flex bg-gray-200/80 p-0.5 rounded-xl border border-gray-300 text-xs font-bold">
            <button
              onClick={() => setViewMode('BALANCES')}
              className={`px-3 py-1 rounded-lg transition-all ${
                viewMode === 'BALANCES'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              ملخص الأرصدة والحسابات
            </button>
            <button
              onClick={() => setViewMode('MOVEMENTS')}
              className={`px-3 py-1 rounded-lg transition-all ${
                viewMode === 'MOVEMENTS'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              الحركات التفصيلية المجمعة
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="p-3 bg-white border-b border-gray-100 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          
          {/* Quick Date Presets & Date Inputs */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-[11px] font-bold">
              <button 
                onClick={() => applyPreset('ALL')}
                className={`px-2 py-0.5 rounded ${!filterStartDate && !filterEndDate ? 'bg-white text-brand-700 shadow-2xs font-black' : 'text-gray-600'}`}
              >
                الكل
              </button>
              <button 
                onClick={() => applyPreset('TODAY')}
                className="px-2 py-0.5 rounded text-gray-600 hover:text-brand-700"
              >
                اليوم
              </button>
              <button 
                onClick={() => applyPreset('THIS_MONTH')}
                className="px-2 py-0.5 rounded text-gray-600 hover:text-brand-700"
              >
                هذا الشهر
              </button>
              <button 
                onClick={() => applyPreset('LAST_MONTH')}
                className="px-2 py-0.5 rounded text-gray-600 hover:text-brand-700"
              >
                الشهر السابق
              </button>
              <button 
                onClick={() => applyPreset('LAST_30')}
                className="px-2 py-0.5 rounded text-gray-600 hover:text-brand-700"
              >
                آخر 30 يوم
              </button>
            </div>

            <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1">
              <span className="text-gray-500 text-[11px] font-bold">من:</span>
              <input
                type="date"
                value={filterStartDate}
                onChange={e => setFilterStartDate(e.target.value)}
                className="bg-transparent text-xs font-mono outline-hidden cursor-pointer"
              />
              <span className="text-gray-500 text-[11px] font-bold mr-1">إلى:</span>
              <input
                type="date"
                value={filterEndDate}
                onChange={e => setFilterEndDate(e.target.value)}
                className="bg-transparent text-xs font-mono outline-hidden cursor-pointer"
              />
              {(filterStartDate || filterEndDate) && (
                <button
                  onClick={() => { setFilterStartDate(''); setFilterEndDate(''); }}
                  className="text-red-500 hover:text-red-700 text-xs px-1 font-bold"
                  title="إلغاء تصفية التاريخ"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Search & Status Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="بحث بالاسم أو الكود..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-7 pr-3 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs w-44 md:w-56 focus:bg-white focus:border-brand-500 outline-hidden transition-all"
              />
              <Search size={13} className="absolute left-2.5 top-2 text-gray-400" />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute left-6 top-2 text-gray-400 hover:text-gray-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {viewMode === 'BALANCES' && (
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold text-gray-700 outline-hidden"
              >
                <option value="ALL">جميع الأرصدة</option>
                <option value="DEBIT">مدين فقط (عليهم مستحقات)</option>
                <option value="CREDIT">دائن فقط (لهم أرصدة)</option>
                <option value="ZERO">متزن (رصيد صفر)</option>
              </select>
            )}
          </div>
        </div>

        {/* Quick KPI Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 bg-gradient-to-b from-gray-50/80 to-white border-b border-gray-200 shrink-0 text-xs">
          
          <div className="bg-white border border-gray-200 rounded-xl p-2.5 shadow-2xs flex flex-col justify-between">
            <span className="text-gray-500 font-bold text-[11px]">إجمالي المدين (الفترة)</span>
            <div className="text-sm md:text-base font-black text-red-600 mt-1" dir="ltr">
              {totalDebit.toLocaleString()} ج.م
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-2.5 shadow-2xs flex flex-col justify-between">
            <span className="text-gray-500 font-bold text-[11px]">إجمالي الدائن (الفترة)</span>
            <div className="text-sm md:text-base font-black text-green-600 mt-1" dir="ltr">
              {totalCredit.toLocaleString()} ج.م
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-2.5 shadow-2xs flex flex-col justify-between">
            <span className="text-gray-500 font-bold text-[11px]">صافي الأرصدة الإجمالي</span>
            <div className={`text-sm md:text-base font-black mt-1 ${totalNetBalance < 0 ? 'text-red-700' : totalNetBalance > 0 ? 'text-blue-700' : 'text-gray-700'}`} dir="ltr">
              {totalNetBalance.toLocaleString()} ج.م
              <span className="text-[10px] font-bold mr-1">
                {totalNetBalance < 0 ? '(مستحق لنا)' : totalNetBalance > 0 ? '(مستحق للغير)' : '(متزن)'}
              </span>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-2.5 shadow-2xs flex flex-col justify-between">
            <span className="text-gray-500 font-bold text-[11px]">
              {viewMode === 'BALANCES' ? 'عدد الحسابات المعروضة' : 'عدد الحركات المسجلة'}
            </span>
            <div className="text-sm md:text-base font-black text-slate-800 mt-1">
              {viewMode === 'BALANCES' ? activeBalanceRows.length : consolidatedMovementRows.length}
            </div>
          </div>

        </div>

        {/* Scrollable Table Area */}
        <div className="flex-1 min-h-0 overflow-auto">
          {viewMode === 'BALANCES' ? (
            /* MODE A: BALANCES SUMMARY TABLE */
            <table className="w-full text-xs text-right border-collapse">
              <thead className="bg-slate-100 text-slate-800 font-bold sticky top-0 z-10 border-b border-slate-300 shadow-2xs">
                <tr>
                  <th className="p-2 text-center w-10 border-l border-slate-200">م</th>
                  <th className="p-2 text-center w-20 border-l border-slate-200">الكود</th>
                  <th className="p-2 border-l border-slate-200">الاسم والبيانات</th>
                  <th className="p-2 text-center w-28 border-l border-slate-200">الهاتف</th>
                  {activeTab === 'ALL' && (
                    <th className="p-2 text-center w-20 border-l border-slate-200">النوع</th>
                  )}
                  <th className="p-2 text-center w-24 border-l border-slate-200 bg-slate-50">رصيد سابق</th>
                  <th className="p-2 text-center w-24 border-l border-slate-200 text-red-700 bg-red-50/50">مدين (الفترة)</th>
                  <th className="p-2 text-center w-24 border-l border-slate-200 text-green-700 bg-green-50/50">دائن (الفترة)</th>
                  <th className="p-2 text-center w-28 border-l border-slate-200 bg-amber-50/60 font-black">الرصيد النهائي</th>
                  <th className="p-2 text-center w-20 border-l border-slate-200">الحالة</th>
                  <th className="p-2 text-center w-20">كشف منفرد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeBalanceRows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-10 text-center text-gray-400">
                      لا توجد حسابات مطابقة لمعايير البحث والتصفية المحددة
                    </td>
                  </tr>
                ) : (
                  activeBalanceRows.map((row, idx) => (
                    <tr key={`${row.entityType}-${row.code}`} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-2 text-center text-gray-400 font-mono border-l border-gray-100">{idx + 1}</td>
                      <td className="p-2 text-center font-mono font-bold text-gray-600 border-l border-gray-100">{row.code}</td>
                      <td className="p-2 font-bold text-slate-900 border-l border-gray-100">
                        {row.name}
                      </td>
                      <td className="p-2 text-center font-mono text-gray-500 border-l border-gray-100" dir="ltr">
                        {row.phone || '-'}
                      </td>
                      {activeTab === 'ALL' && (
                        <td className="p-2 text-center border-l border-gray-100">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            row.entityType === 'CUSTOMER' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                          }`}>
                            {row.entityType === 'CUSTOMER' ? 'عميل' : 'مورد'}
                          </span>
                        </td>
                      )}
                      <td className="p-2 text-center font-mono font-bold text-gray-600 border-l border-gray-100" dir="ltr">
                        {row.priorBalance.toLocaleString()}
                      </td>
                      <td className="p-2 text-center font-mono font-bold text-red-700 bg-red-50/20 border-l border-gray-100" dir="ltr">
                        {row.debit > 0 ? row.debit.toLocaleString() : '-'}
                      </td>
                      <td className="p-2 text-center font-mono font-bold text-green-700 bg-green-50/20 border-l border-gray-100" dir="ltr">
                        {row.credit > 0 ? row.credit.toLocaleString() : '-'}
                      </td>
                      <td className="p-2 text-center font-mono font-black text-slate-900 bg-amber-50/30 border-l border-gray-100 text-sm" dir="ltr">
                        {row.finalBalance.toLocaleString()}
                      </td>
                      <td className="p-2 text-center border-l border-gray-100">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block ${
                          row.status === 'مدين' ? 'bg-red-100 text-red-700' :
                          row.status === 'دائن' ? 'bg-green-100 text-green-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="p-2 text-center">
                        {onSelectEntity && (
                          <button
                            onClick={() => {
                              onSelectEntity(row.entityType, row.code);
                              onClose();
                            }}
                            className="text-brand-600 hover:text-brand-800 hover:underline font-bold text-[11px]"
                          >
                            فتح
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            /* MODE B: CONSOLIDATED MOVEMENTS TIMELINE */
            <table className="w-full text-xs text-right border-collapse">
              <thead className="bg-slate-100 text-slate-800 font-bold sticky top-0 z-10 border-b border-slate-300 shadow-2xs">
                <tr>
                  <th className="p-2 text-center w-8 border-l border-slate-200">م</th>
                  <th className="p-2 text-center w-24 border-l border-slate-200">التاريخ</th>
                  <th className="p-2 border-l border-slate-200 w-36">الطرف (الحساب)</th>
                  <th className="p-2 text-center w-20 border-l border-slate-200">الفاتورة</th>
                  <th className="p-2 border-l border-slate-200">الصنف / البيان</th>
                  <th className="p-2 text-center w-16 border-l border-slate-200">الكمية</th>
                  <th className="p-2 text-center w-16 border-l border-slate-200">السعر</th>
                  <th className="p-2 text-center w-20 border-l border-slate-200 bg-amber-50/60">الإجمالي</th>
                  <th className="p-2 text-center w-20 border-l border-slate-200 text-red-700 bg-red-50/50">مدين</th>
                  <th className="p-2 text-center w-20 border-l border-slate-200 text-green-700 bg-green-50/50">دائن</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {consolidatedMovementRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-10 text-center text-gray-400">
                      لا توجد حركات مسجلة مطابقة لمعايير البحث والتصفية المحددة
                    </td>
                  </tr>
                ) : (
                  consolidatedMovementRows.map(row => (
                    <tr key={`${row.num}-${row.date}-${row.ref}-${row.entityCode}`} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-2 text-center text-gray-400 font-mono border-l border-gray-100">{row.num}</td>
                      <td className="p-2 text-center font-mono text-gray-700 border-l border-gray-100 whitespace-nowrap">{row.date}</td>
                      <td className="p-2 font-bold text-slate-900 border-l border-gray-100">
                        {row.entityName}
                        <span className="text-[10px] text-gray-400 font-mono block">({row.entityCode})</span>
                      </td>
                      <td className="p-2 text-center font-mono font-bold text-brand-700 border-l border-gray-100">{row.ref}</td>
                      <td className="p-2 font-bold text-slate-800 border-l border-gray-100">{row.itemName}</td>
                      <td className="p-2 text-center font-mono font-bold border-l border-gray-100">
                        {typeof row.quantity === 'number' ? row.quantity.toLocaleString() : row.quantity}
                      </td>
                      <td className="p-2 text-center font-mono border-l border-gray-100">
                        {typeof row.price === 'number' ? row.price.toLocaleString() : row.price}
                      </td>
                      <td className="p-2 text-center font-mono font-bold text-amber-900 bg-amber-50/30 border-l border-gray-100">
                        {typeof row.lineTotal === 'number' ? row.lineTotal.toLocaleString() : row.lineTotal}
                      </td>
                      <td className="p-2 text-center font-mono font-bold text-red-700 bg-red-50/20 border-l border-gray-100" dir="ltr">
                        {row.debit > 0 ? row.debit.toLocaleString() : '-'}
                      </td>
                      <td className="p-2 text-center font-mono font-bold text-green-700 bg-green-50/20" dir="ltr">
                        {row.credit > 0 ? row.credit.toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Modal Bottom Fixed Summary Footer */}
        <div className="bg-slate-900 text-white p-3 px-4 flex flex-wrap justify-between items-center gap-3 shrink-0 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <span className="text-gray-400">إجمالي المدين: </span>
              <strong className="text-red-400 font-mono" dir="ltr">{totalDebit.toLocaleString()} ج.م</strong>
            </div>
            <div>
              <span className="text-gray-400">إجمالي الدائن: </span>
              <strong className="text-green-400 font-mono" dir="ltr">{totalCredit.toLocaleString()} ج.م</strong>
            </div>
            <div>
              <span className="text-gray-400">الصافي: </span>
              <strong className="text-amber-300 font-mono text-sm" dir="ltr">{totalNetBalance.toLocaleString()} ج.م</strong>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-1.5 rounded-xl font-bold transition-all shadow-md active:scale-95 text-xs"
            >
              <Printer size={15} />
              طباعة الكشف
            </button>
            <button
              onClick={handleShareWhatsApp}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-xl font-bold transition-all shadow-md active:scale-95 text-xs"
            >
              <MessageCircle size={15} />
              مشاركة واتساب
            </button>
            <button
              onClick={onClose}
              className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-xl font-bold transition-colors text-xs"
            >
              إغلاق
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
