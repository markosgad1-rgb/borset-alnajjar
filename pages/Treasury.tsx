import React, { useState, useMemo, useRef } from 'react';
import { useERP } from '../context/ERPContext';
import { 
  Wallet, 
  Building2, 
  Banknote, 
  Trash2, 
  AlertTriangle, 
  PlusCircle, 
  X, 
  Save, 
  Smartphone,
  ArrowLeftRight,
  Building,
  RotateCcw,
  Check
} from 'lucide-react';
import { PaymentMethod, BranchId, BRANCHES } from '../types';
import { formatWithCommas, parseNumberFromCommas, handleNumericChangeWithCommas } from '../utils/formatters';
import { useBackHandler } from '../utils/backNavigation';
import { canDo } from '../utils/permissions';

export const Treasury: React.FC = () => {
  const { 
    treasury, 
    currentTreasuryBalance, 
    currentTreasuryBalanceMarg,
    currentTreasuryBalanceNozha,
    transferCashBetweenBranches,
    balances, 
    clearTreasury, 
    currentUser, 
    addOpeningBalance,
    findDuplicateTreasury,
    removeTreasuryTransactions,
    closeTreasuryDay,
    undoTreasuryClose
  } = useERP();

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<'ALL' | BranchId>('ALL');
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | PaymentMethod>('ALL');
  const [searchText, setSearchText] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [opFilter, setOpFilter] = useState('ALL');
  const [dupGroups, setDupGroups] = useState<ReturnType<typeof findDuplicateTreasury> | null>(null);
  const [dupBusy, setDupBusy] = useState(false);
  
  // إقفال اليوم
  const PM_LIST: { id: PaymentMethod; label: string }[] = [
    { id: 'CASH', label: 'خزنة كاش' }, { id: 'BANK_AHLY', label: 'البنك الأهلي' }, { id: 'BANK_MISR', label: 'بنك مصر' },
    { id: 'VF_CASH_AYMAN', label: 'فودافون أيمن' }, { id: 'VF_CASH_KYRILLOS', label: 'فودافون كيرلس' }
  ];
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeScope, setCloseScope] = useState<'ALL' | 'CASH' | 'OTHERS' | PaymentMethod>('ALL');
  const [closeBranch, setCloseBranch] = useState<'ALL' | BranchId>('ALL');
  const [closeOpenBranch, setCloseOpenBranch] = useState<BranchId>('MARG');
  const [closeOpenings, setCloseOpenings] = useState<Record<string, string>>({});
  const [closeDate, setCloseDate] = useState(new Date().toISOString().split('T')[0]);
  const [closeNotes, setCloseNotes] = useState('');
  const [closeBusy, setCloseBusy] = useState(false);
  useBackHandler(() => setShowCloseModal(false), showCloseModal, 'treasury-close-modal');
  const closeAccounts: PaymentMethod[] = closeScope === 'ALL' ? PM_LIST.map(x => x.id)
    : closeScope === 'CASH' ? ['CASH'] : closeScope === 'OTHERS' ? PM_LIST.filter(x => x.id !== 'CASH').map(x => x.id) : [closeScope as PaymentMethod];
  const lastClose = useMemo(() => {
    const rows = treasury.filter((t: any) => t.source === 'DAY_CLOSE' || t.source === 'DAY_OPEN');
    if (rows.length === 0) return null;
    const latest = rows.reduce((a: any, b: any) => ((b.timestamp || 0) > (a.timestamp || 0) ? b : a));
    const g = rows.filter((t: any) => t.groupId === latest.groupId);
    return { groupId: latest.groupId as string, date: String(latest.date || '').slice(0, 16), count: g.length };
  }, [treasury]);
  const handleCloseDay = async () => {
    if (closeBusy) return;
    const openings: any = {};
    closeAccounts.forEach(a => { const v = parseNumberFromCommas(closeOpenings[a] || ''); if (v > 0) openings[a] = v; });
    setCloseBusy(true);
    try {
      const r = await closeTreasuryDay({ scopeBranch: closeBranch, accounts: closeAccounts, openings, openingBranch: closeBranch === 'ALL' ? closeOpenBranch : closeBranch, date: closeDate, notes: closeNotes.trim() || undefined });
      if (r && r.groupId && (r.closed + r.opened) > 0) {
        alert(`تم الإقفال: ${r.closed} حساب اتصفّر${r.opened ? `، و${r.opened} رصيد افتتاحي اتسجل` : ''}. السجلات والكشوفات زي ما هي.`);
        setShowCloseModal(false); setCloseOpenings({}); setCloseNotes('');
      } else if (r && r.groupId) {
        alert('كل الحسابات المختارة رصيدها صفر بالفعل ومفيش رصيد افتتاحي مكتوب، فمفيش حاجة اتسجلت.');
      }
    } finally { setCloseBusy(false); }
  };

  // Opening Balance Modal State
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [openingForm, setOpeningForm] = useState<{
    amount: string;
    branchId: BranchId;
    paymentMethod: PaymentMethod;
    date: string;
    notes: string;
  }>({
    amount: '',
    branchId: 'MARG',
    paymentMethod: 'CASH',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // Inter-branch Cash Transfer Modal State
  const [showCashTransferModal, setShowCashTransferModal] = useState(false);
  const [cashTransferFrom, setCashTransferFrom] = useState<BranchId>('MARG');
  const [cashTransferTo, setCashTransferTo] = useState<BranchId>('NOZHA');
  const [cashTransferAmount, setCashTransferAmount] = useState('');
  const [cashTransferMethod, setCashTransferMethod] = useState<PaymentMethod>('CASH');
  const [cashTransferNotes, setCashTransferNotes] = useState('');
  const [isTransferringCash, setIsTransferringCash] = useState(false);

  // Hardware Back button handlers
  useBackHandler(() => setShowOpeningModal(false), showOpeningModal, 'treasury-opening-modal');
  useBackHandler(() => setShowCashTransferModal(false), showCashTransferModal, 'treasury-cash-transfer-modal');
  useBackHandler(() => setShowClearConfirm(false), showClearConfirm, 'treasury-clear-confirm');

  const classifyTx = (t: any): string => {
    const d = String(t.description || '');
    if (t.source === 'DAY_CLOSE') return 'CLOSING';
    if (t.source === 'DAY_OPEN') return 'OPENING';
    if (t.source === 'COLLECTION' || d.includes('تحصيل')) return 'COLLECTION';
    if (t.source === 'TRANSFER' || d.includes('تحويل')) return 'TRANSFER';
    if (t.source === 'DAY_CLOSE') return 'CLOSING';
    if (t.source === 'DAY_OPEN' || d.includes('رصيد افتتاحي')) return 'OPENING';
    if (t.source === 'PURCHASE' || d.includes('للمورد') || d.includes('مشتريات')) return 'SUPPLIER';
    if (d.includes('مصروف')) return 'EXPENSE';
    if (d.includes('فاتورة')) return 'SALE';
    return 'OTHER';
  };
  const isIncomeTx = (t: any) => (t.credit > 0 || t.type === 'INCOME' || (t.amount && t.amount > 0 && t.type !== 'EXPENSE'));

  // Filter transactions by selected branch and payment method
  const sortedTransactions = useMemo(() => {
    return [...treasury]
      .filter(t => {
        const itemBranch = t.branchId || 'MARG';
        const branchMatch = selectedBranchFilter === 'ALL' || itemBranch === selectedBranchFilter;
        const normalizedMethod = t.paymentMethod || 'CASH';
        const methodMatch = selectedFilter === 'ALL' || normalizedMethod === selectedFilter;
        if (!(branchMatch && methodMatch)) return false;
        if (dateFrom && String(t.date || '').slice(0, 10) < dateFrom) return false;
        if (dateTo && String(t.date || '').slice(0, 10) > dateTo) return false;
        if (opFilter === 'IN' && !isIncomeTx(t)) return false;
        if (opFilter === 'OUT' && isIncomeTx(t)) return false;
        if (!['ALL', 'IN', 'OUT'].includes(opFilter) && classifyTx(t) !== opFilter) return false;
        const q = searchText.trim().toLowerCase();
        if (q) {
          const hay = `${t.description || ''} ${t.invoiceNumber || ''} ${t.entityName || ''} ${t.entityCode || ''} ${t.id || ''} ${t.date || ''} ${t.credit || t.debit || t.amount || ''}`.toLowerCase();
          if (!q.split(/\s+/).every(w => hay.includes(w))) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const getTimestamp = (item: any) => {
          if (item.timestamp && typeof item.timestamp === 'number') return item.timestamp;
          if (item.createdAt) {
            const parsed = Date.parse(item.createdAt);
            if (!isNaN(parsed)) return parsed;
          }
          if (item.date) {
            const parsed = Date.parse(item.date);
            if (!isNaN(parsed)) return parsed;
          }
          const match = (item.id || '').match(/\d{10,}/);
          return match ? Number(match[0]) : 0;
        };
        // الترتيب الأساسي بتاريخ العملية نفسه (الأحدث فوق)، وجوه اليوم الواحد بوقت التسجيل
        const dayOf = (item: any) => (String(item.date || '').match(/\d{4}-\d{2}-\d{2}/) || [''])[0];
        const dA = dayOf(a), dB = dayOf(b);
        if (dA !== dB) return dB.localeCompare(dA);
        const tA = getTimestamp(a);
        const tB = getTimestamp(b);
        if (tA && tB && tA !== tB) return tB - tA;
        const dateDiff = (b.date || '').localeCompare(a.date || '');
        if (dateDiff !== 0) return dateDiff;
        return (b.id || '').localeCompare(a.id || '');
      });
  }, [treasury, selectedBranchFilter, selectedFilter, searchText, dateFrom, dateTo, opFilter]);

  const shownTotals = useMemo(() => {
    let inc = 0, out = 0;
    sortedTransactions.forEach((t: any) => {
      if (t.source === 'DAY_CLOSE' || t.source === 'DAY_OPEN') return; // الإقفال والافتتاحي مش إيراد ولا مصروف
      if (isIncomeTx(t)) inc += Number(t.credit || t.amount || 0);
      else out += Number(t.debit || t.amount || 0);
    });
    return { inc, out };
  }, [sortedTransactions]);

  const runDupCheck = () => setDupGroups(findDuplicateTreasury());
  const removeDups = async () => {
    if (!dupGroups || dupBusy) return;
    const ids = dupGroups.flatMap(g => g.extras.map(e => e.id));
    if (!ids.length) return;
    setDupBusy(true);
    const n = await removeTreasuryTransactions(ids);
    setDupBusy(false);
    setDupGroups(null);
    alert(`تم حذف ${n} حركة مكررة وإبقاء الحركة الأصلية لكل فاتورة.`);
  };

  const handleClearTreasury = async () => {
    const success = await clearTreasury();
    if (success) {
      setShowClearConfirm(false);
      alert("تم تصفير الخزنة وحذف جميع المعاملات بنجاح.");
    }
  };

  const handleOpeningSubmitLock = useRef(false);
  const handleOpeningSubmit = async (e: React.FormEvent) => {
    if (handleOpeningSubmitLock.current) { e?.preventDefault?.(); return; }
    handleOpeningSubmitLock.current = true;
    try { await _handleOpeningSubmit(e); } finally { setTimeout(() => { handleOpeningSubmitLock.current = false; }, 1000); }
  };
  const _handleOpeningSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseNumberFromCommas(openingForm.amount);
    if (amount <= 0) return alert("الرجاء إدخال مبلغ صحيح");

    await addOpeningBalance({
      amount: amount,
      branchId: openingForm.branchId,
      date: openingForm.date,
      paymentMethod: openingForm.paymentMethod,
      notes: openingForm.notes
    });

    setShowOpeningModal(false);
    setOpeningForm({ amount: '', branchId: 'MARG', paymentMethod: 'CASH', date: new Date().toISOString().split('T')[0], notes: '' });
    alert(`تم إضافة الرصيد الافتتاحي لخزينة ${openingForm.branchId === 'NOZHA' ? 'النزهة' : 'المرج'} بنجاح`);
  };

  const handleExecuteCashTransferLock = useRef(false);
  const handleExecuteCashTransfer = async (e: React.FormEvent) => {
    if (handleExecuteCashTransferLock.current) { e?.preventDefault?.(); return; }
    handleExecuteCashTransferLock.current = true;
    try { await _handleExecuteCashTransfer(e); } finally { setTimeout(() => { handleExecuteCashTransferLock.current = false; }, 1000); }
  };
  const _handleExecuteCashTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isTransferringCash) return;

    if (cashTransferFrom === cashTransferTo) {
      alert("لا يمكن التحويل لنفس الإدارة");
      return;
    }

    const amt = parseNumberFromCommas(cashTransferAmount);
    if (amt <= 0) {
      alert("يرجى إدخال مبلغ صحيح للتحويل");
      return;
    }

    setIsTransferringCash(true);
    try {
      const success = await transferCashBetweenBranches({
        fromBranch: cashTransferFrom,
        toBranch: cashTransferTo,
        amount: amt,
        paymentMethod: cashTransferMethod,
        notes: cashTransferNotes
      });

      if (success) {
        alert("تم تحويل النقدية بين الخزائن وتسجيل حركتي الصرف والإيداع بنجاح");
        setShowCashTransferModal(false);
        setCashTransferAmount('');
        setCashTransferNotes('');
      }
    } catch (err: any) {
      alert(err?.message || "حدث خطأ أثناء تحويل النقدية");
    } finally {
      setIsTransferringCash(false);
    }
  };

  const getMethodLabel = (method?: string) => {
    if (method === 'BANK_AHLY') return 'البنك الأهلي';
    if (method === 'BANK_MISR') return 'بنك مصر';
    if (method === 'VF_CASH_AYMAN') return 'فودافون كاش أيمن';
    if (method === 'VF_CASH_KYRILLOS') return 'فودافون كاش كيرلس';
    return 'خزنة (كاش)';
  };

  const getMethodColor = (method?: string) => {
    if (method === 'BANK_AHLY') return 'text-green-700 bg-green-50';
    if (method === 'BANK_MISR') return 'text-red-700 bg-red-50';
    if (method === 'VF_CASH_AYMAN' || method === 'VF_CASH_KYRILLOS') return 'text-red-800 bg-red-100';
    return 'text-emerald-700 bg-emerald-50';
  };

  return (
    <div className="space-y-6">
      
      {/* Header Row */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-5 rounded-xl shadow-sm border border-brand-100">
        <div>
          <h2 className="text-xl font-bold text-brand-800 flex items-center gap-2">
            <Wallet className="text-brand-600" /> إدارة الخزينة وفصل الإدارات
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">فصل التدفقات النقدية والأرصدة بين خزينة المرج وخزينة النزهة مع إمكانية التحويل بينهما</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {canDo(currentUser, 'treasury.manage') && (
            <>
              <button 
                onClick={() => setShowCashTransferModal(true)}
                className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold hover:bg-indigo-100 transition-colors shadow-xs"
              >
                <ArrowLeftRight size={16} /> تحويل نقدية بين الإدارات
              </button>

              <button 
                onClick={() => setShowOpeningModal(true)}
                className="flex items-center gap-1.5 bg-blue-600 text-white px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold hover:bg-blue-700 transition-colors shadow-xs"
              >
                <PlusCircle size={16} /> رصيد افتتاحي
              </button>
            </>
          )}

          {canDo(currentUser, 'treasury.close') && (
            <button
              onClick={() => setShowCloseModal(true)}
              className="flex items-center gap-1.5 bg-amber-500 text-white px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold hover:bg-amber-600 transition-colors shadow-xs"
            >
              <Wallet size={16} /> إقفال اليوم / تصفير الرصيد
            </button>
          )}

          {canDo(currentUser, 'treasury.clear') && (
            showClearConfirm ? (
               <div className="flex items-center gap-2 bg-red-50 p-1.5 rounded-lg border border-red-200 animate-fade-in">
                 <AlertTriangle size={16} className="text-red-500" />
                 <span className="text-xs font-bold text-red-600">تأكيد تصفير الخزنة؟</span>
                 <button 
                   onClick={handleClearTreasury}
                   className="bg-red-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-red-700"
                 >
                   نعم
                 </button>
                 <button 
                   onClick={() => setShowClearConfirm(false)}
                   className="bg-white text-gray-600 px-3 py-1 rounded border text-xs font-bold hover:bg-gray-100"
                 >
                   إلغاء
                 </button>
               </div>
            ) : (
              <button 
                onClick={() => setShowClearConfirm(true)}
                className="flex items-center gap-1.5 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 px-3 py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors shadow-xs"
              >
                <Trash2 size={16} className="text-red-600" /> تصفير الخزنة
              </button>
            )
          )}
        </div>
      </div>

      {/* Primary Branch Treasury Balances */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Marg Treasury Card */}
        <div 
          onClick={() => setSelectedBranchFilter('MARG')}
          className={`p-5 rounded-xl border transition-all cursor-pointer ${
            selectedBranchFilter === 'MARG'
              ? 'bg-blue-50/90 border-blue-400 ring-2 ring-blue-300 shadow-sm'
              : 'bg-white border-gray-200 hover:border-blue-200 hover:bg-blue-50/30'
          }`}
        >
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
              <Building size={16} className="text-blue-600" /> خزينة إدارة المرج
            </span>
            <span className="text-[11px] font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">
              MARG
            </span>
          </div>
          <div className="mt-3">
            <span className="text-xs text-gray-500 block mb-1">الرصيد الفعلي للخزينة:</span>
            <h3 className={`text-2xl font-black font-mono ${currentTreasuryBalanceMarg < 0 ? 'text-red-600' : 'text-blue-800'}`} dir="ltr">
              {currentTreasuryBalanceMarg.toLocaleString()} <span className="text-xs text-gray-500 font-sans">ج.م</span>
            </h3>
          </div>
        </div>

        {/* Nozha Treasury Card */}
        <div 
          onClick={() => setSelectedBranchFilter('NOZHA')}
          className={`p-5 rounded-xl border transition-all cursor-pointer ${
            selectedBranchFilter === 'NOZHA'
              ? 'bg-purple-50/90 border-purple-400 ring-2 ring-purple-300 shadow-sm'
              : 'bg-white border-gray-200 hover:border-purple-200 hover:bg-purple-50/30'
          }`}
        >
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
              <Building size={16} className="text-purple-600" /> خزينة إدارة النزهة
            </span>
            <span className="text-[11px] font-mono bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-bold">
              NOZHA
            </span>
          </div>
          <div className="mt-3">
            <span className="text-xs text-gray-500 block mb-1">الرصيد الفعلي للخزينة:</span>
            <h3 className={`text-2xl font-black font-mono ${currentTreasuryBalanceNozha < 0 ? 'text-red-600' : 'text-purple-800'}`} dir="ltr">
              {currentTreasuryBalanceNozha.toLocaleString()} <span className="text-xs text-gray-500 font-sans">ج.م</span>
            </h3>
          </div>
        </div>

        {/* Total Liquidity */}
        <div 
          onClick={() => setSelectedBranchFilter('ALL')}
          className={`p-5 rounded-xl border transition-all cursor-pointer ${
            selectedBranchFilter === 'ALL'
              ? 'bg-gray-900 text-white ring-2 ring-gray-400 shadow-md'
              : 'bg-gray-900 text-white hover:bg-gray-800'
          }`}
        >
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
              <Wallet size={16} className="text-emerald-400" /> إجمالي السيولة النقدية (الفرعين)
            </span>
            <span className="text-[11px] font-mono bg-white/20 text-white px-2 py-0.5 rounded-full font-bold">
              إجمالي
            </span>
          </div>
          <div className="mt-3">
            <span className="text-xs text-gray-400 block mb-1">مجموع السيولة المتاحة:</span>
            <h3 className={`text-2xl font-black font-mono ${currentTreasuryBalance < 0 ? 'text-red-400' : 'text-emerald-400'}`} dir="ltr">
              {currentTreasuryBalance.toLocaleString()} <span className="text-xs text-gray-400 font-sans">ج.م</span>
            </h3>
          </div>
        </div>
      </div>

      {/* Account Sub-Balances */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl p-3.5 shadow-xs border border-emerald-100 flex items-center gap-3">
          <div className="bg-emerald-50 text-emerald-600 p-2 rounded-lg"><Banknote size={20}/></div>
          <div>
            <p className="text-gray-500 text-[11px] font-bold">خزنة كاش</p>
            <h4 className="text-sm font-bold text-emerald-700 font-mono">{balances.cash.toLocaleString()}</h4>
          </div>
        </div>

        <div className="bg-white rounded-xl p-3.5 shadow-xs border border-green-100 flex items-center gap-3">
          <div className="bg-green-50 text-green-700 p-2 rounded-lg"><Building2 size={20}/></div>
          <div>
             <p className="text-gray-500 text-[11px] font-bold">البنك الأهلي</p>
             <h4 className="text-sm font-bold text-green-800 font-mono">{balances.bankAhly.toLocaleString()}</h4>
          </div>
        </div>

        <div className="bg-white rounded-xl p-3.5 shadow-xs border border-red-100 flex items-center gap-3">
          <div className="bg-red-50 text-red-700 p-2 rounded-lg"><Building2 size={20}/></div>
          <div>
             <p className="text-gray-500 text-[11px] font-bold">بنك مصر</p>
             <h4 className="text-sm font-bold text-red-800 font-mono">{balances.bankMisr.toLocaleString()}</h4>
          </div>
        </div>

        <div className="bg-white rounded-xl p-3.5 shadow-xs border border-red-100 flex items-center gap-3">
          <div className="bg-red-50 text-red-700 p-2 rounded-lg"><Smartphone size={20}/></div>
          <div>
             <p className="text-gray-500 text-[11px] font-bold">فودافون أيمن</p>
             <h4 className="text-sm font-bold text-red-800 font-mono">{balances.vfCashAyman.toLocaleString()}</h4>
          </div>
        </div>

        <div className="bg-white rounded-xl p-3.5 shadow-xs border border-red-100 flex items-center gap-3 col-span-2 sm:col-span-1">
          <div className="bg-red-50 text-red-700 p-2 rounded-lg"><Smartphone size={20}/></div>
          <div>
             <p className="text-gray-500 text-[11px] font-bold">فودافون كيرلس</p>
             <h4 className="text-sm font-bold text-red-800 font-mono">{balances.vfCashKyrillos.toLocaleString()}</h4>
          </div>
        </div>
      </div>

      {/* Transactions Table Section */}
      <div className="bg-white rounded-xl shadow-sm border border-brand-100 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-brand-800">سجل المعاملات والتدفقات المالية</h3>
              <p className="text-xs text-gray-500 mt-0.5">تتبع الإيرادات والمصروفات والتحويلات لكل إدارة</p>
            </div>

            {/* Branch Filter Switcher Tabs */}
            <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-lg self-start sm:self-auto">
              <button 
                type="button"
                onClick={() => setSelectedBranchFilter('ALL')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  selectedBranchFilter === 'ALL' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                كل الخزائن
              </button>
              <button 
                type="button"
                onClick={() => setSelectedBranchFilter('MARG')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                  selectedBranchFilter === 'MARG' ? 'bg-blue-600 text-white shadow-xs' : 'text-blue-700 hover:text-blue-900'
                }`}
              >
                <Building size={12} /> خزينة المرج
              </button>
              <button 
                type="button"
                onClick={() => setSelectedBranchFilter('NOZHA')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                  selectedBranchFilter === 'NOZHA' ? 'bg-purple-600 text-white shadow-xs' : 'text-purple-700 hover:text-purple-900'
                }`}
              >
                <Building size={12} /> خزينة النزهة
              </button>
            </div>
          </div>

          {/* Search / date / operation filters */}
          <div className="flex flex-wrap gap-2 items-end pt-1 border-t border-gray-100">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[11px] text-gray-500 mb-1">بحث (اسم / بيان / رقم فاتورة / مبلغ)</label>
              <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="مثال: R054 أو عبد العليم أو 500000" className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-300" />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">من تاريخ</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">إلى تاريخ</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">نوع العملية</label>
              <select value={opFilter} onChange={e => setOpFilter(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white">
                <option value="ALL">كل العمليات</option>
                <option value="IN">وارد فقط</option>
                <option value="OUT">صادر فقط</option>
                <option value="COLLECTION">تحصيل</option>
                <option value="SUPPLIER">سداد موردين / مشتريات</option>
                <option value="SALE">فواتير بيع</option>
                <option value="TRANSFER">تحويلات</option>
                <option value="EXPENSE">مصروفات</option>
                <option value="OPENING">رصيد افتتاحي</option>
                <option value="CLOSING">إقفال يوم</option>
              </select>
            </div>
            {(searchText || dateFrom || dateTo || opFilter !== 'ALL') && (
              <button onClick={() => { setSearchText(''); setDateFrom(''); setDateTo(''); setOpFilter('ALL'); }} className="px-3 py-1.5 rounded-lg border text-xs font-bold text-gray-600 bg-gray-50 hover:bg-gray-100">مسح الفلاتر</button>
            )}
          </div>
          <div className="flex flex-wrap gap-3 text-xs font-bold">
            <span className="text-gray-500">المعروض: {sortedTransactions.length} حركة</span>
            <span className="text-green-700">إجمالي الوارد: {shownTotals.inc.toLocaleString()} ج.م</span>
            <span className="text-red-600">إجمالي الصادر: {shownTotals.out.toLocaleString()} ج.م</span>
          </div>

          {canDo(currentUser, 'treasury.clear') && (
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100">
              <button onClick={runDupCheck} className="px-3 py-1.5 rounded-lg border text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100">🔍 فحص الحركات المكررة</button>
              {dupGroups && dupGroups.length === 0 && <span className="text-xs font-bold text-green-700">لا توجد حركات مكررة ✓</span>}
              {dupGroups && dupGroups.length > 0 && (
                <div className="w-full bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs space-y-2">
                  <div className="font-bold text-amber-900">
                    تم العثور على {dupGroups.length} فاتورة فيها تكرار ({dupGroups.reduce((a, g) => a + g.extras.length, 0)} حركة زائدة، بقيمة {dupGroups.reduce((a, g) => a + g.extras.reduce((x, e) => x + Number(e.debit || e.credit || 0), 0), 0).toLocaleString()} ج.م). هيتم إبقاء الأقدم وحذف الباقي.
                  </div>
                  <div className="max-h-48 overflow-auto divide-y divide-amber-100">
                    {dupGroups.map(g => (
                      <div key={g.key} className="py-1 flex flex-wrap gap-x-3">
                        <span className="font-mono font-bold">{g.keep.invoiceNumber}</span>
                        <span>{Number(g.keep.debit || g.keep.credit || 0).toLocaleString()} ج.م</span>
                        <span className="text-gray-600">{g.keep.description}</span>
                        <span className="text-red-600 font-bold">زيادة: {g.extras.length}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button disabled={dupBusy} onClick={removeDups} className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-50">{dupBusy ? 'جارٍ الحذف...' : 'حذف الحركات الزائدة'}</button>
                    <button onClick={() => setDupGroups(null)} className="px-3 py-1.5 rounded-lg border bg-white font-bold">إلغاء</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Account Filter Pills */}
          <div className="flex flex-wrap gap-1.5 text-xs font-bold pt-1 border-t border-gray-100">
            <span className="text-xs text-gray-500 self-center ml-2">طريقة الدفع:</span>
            <button 
              onClick={() => setSelectedFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg border transition-all text-xs ${selectedFilter === 'ALL' ? 'bg-brand-600 text-white border-brand-600 shadow-xs' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
            >
              الكل ({sortedTransactions.length})
            </button>
            <button 
              onClick={() => setSelectedFilter('CASH')}
              className={`px-2.5 py-1 rounded-lg border transition-all text-xs ${selectedFilter === 'CASH' ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'}`}
            >
              كاش
            </button>
            <button 
              onClick={() => setSelectedFilter('BANK_AHLY')}
              className={`px-2.5 py-1 rounded-lg border transition-all text-xs ${selectedFilter === 'BANK_AHLY' ? 'bg-green-700 text-white border-green-700 shadow-xs' : 'bg-green-50 text-green-800 hover:bg-green-100'}`}
            >
              الأهلي
            </button>
            <button 
              onClick={() => setSelectedFilter('BANK_MISR')}
              className={`px-2.5 py-1 rounded-lg border transition-all text-xs ${selectedFilter === 'BANK_MISR' ? 'bg-red-700 text-white border-red-700 shadow-xs' : 'bg-red-50 text-red-800 hover:bg-red-100'}`}
            >
              بنك مصر
            </button>
            <button 
              onClick={() => setSelectedFilter('VF_CASH_AYMAN')}
              className={`px-2.5 py-1 rounded-lg border transition-all text-xs ${selectedFilter === 'VF_CASH_AYMAN' ? 'bg-red-700 text-white border-red-700 shadow-xs' : 'bg-red-50 text-red-800 hover:bg-red-100'}`}
            >
              فودافون أيمن
            </button>
            <button 
              onClick={() => setSelectedFilter('VF_CASH_KYRILLOS')}
              className={`px-2.5 py-1 rounded-lg border transition-all text-xs ${selectedFilter === 'VF_CASH_KYRILLOS' ? 'bg-red-700 text-white border-red-700 shadow-xs' : 'bg-red-50 text-red-800 hover:bg-red-100'}`}
            >
              فودافون كيرلس
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {sortedTransactions.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <p>لا توجد معاملات مسجلة تطابق الفلاتر المحددة</p>
            </div>
          ) : (
            <table className="w-full text-right text-xs sm:text-sm">
              <thead className="bg-brand-50 text-brand-700">
                <tr>
                  <th className="p-3.5">التاريخ</th>
                  <th className="p-3.5">الإدارة / الفرع</th>
                  <th className="p-3.5">طريقة الدفع / الحساب</th>
                  <th className="p-3.5 w-1/3">البيان</th>
                  <th className="p-3.5 text-green-700">دائن (وارد)</th>
                  <th className="p-3.5 text-red-700">مدين (صادر)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedTransactions.map((t) => {
                  const bId = t.branchId || 'MARG';
                  return (
                    <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-3.5 text-gray-600 whitespace-nowrap font-mono">{t.date}</td>
                      <td className="p-3.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                          bId === 'NOZHA'
                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}>
                          <Building size={11} /> {bId === 'NOZHA' ? 'النزهة' : 'المرج'}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${getMethodColor(t.paymentMethod)}`}>
                            {getMethodLabel(t.paymentMethod)}
                        </span>
                      </td>
                      <td className="p-3.5 text-gray-800 font-medium">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {t.source === 'COLLECTION' || t.description?.includes('تحصيل') ? (
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
                              تحصيل
                            </span>
                          ) : null}
                          <span>{t.description}</span>
                        </div>
                      </td>
                      <td className="p-3.5 font-bold text-green-600 font-mono">
                        {(t.credit > 0 || t.type === 'INCOME' || (t.amount && t.amount > 0 && t.type !== 'EXPENSE')) 
                          ? `${(t.credit || t.amount || 0).toLocaleString()} ج.م` 
                          : '-'}
                      </td>
                      <td className="p-3.5 font-bold text-red-500 font-mono">
                        {(t.debit > 0 || t.type === 'EXPENSE') 
                          ? `${(t.debit || (t.type === 'EXPENSE' ? t.amount : 0) || 0).toLocaleString()} ج.م` 
                          : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Close Day Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden border border-amber-200 max-h-[92vh] flex flex-col">
            <div className="bg-amber-500 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2"><Wallet size={18}/> إقفال اليوم وبدء رصيد جديد</h3>
              <button onClick={() => setShowCloseModal(false)}><X size={18}/></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2.5 leading-relaxed">
                الإقفال بيسجّل حركة تصفّر رصيد الحساب من غير ما يمسح أي سجل. العملاء والموردين والفواتير والكشوفات والتحصيلات والتحويلات كلها زي ما هي. وتقدر تتراجع عنه.
              </p>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">إيه اللي يتصفّر؟</label>
                <div className="grid grid-cols-2 gap-2">
                  {([['ALL','كل الحسابات'],['CASH','الكاش بس'],['OTHERS','البنوك والفودافون بس']] as const).map(([k,l]) => (
                    <button key={k} type="button" onClick={() => setCloseScope(k)} className={`p-2 rounded-lg text-xs font-bold border ${closeScope === k ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>{l}</button>
                  ))}
                  <select value={['ALL','CASH','OTHERS'].includes(closeScope) ? '' : closeScope} onChange={e => e.target.value && setCloseScope(e.target.value as PaymentMethod)} className="p-2 rounded-lg text-xs font-bold border border-gray-200 bg-white">
                    <option value="">حساب واحد...</option>
                    {PM_LIST.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">الإدارة</label>
                <div className="grid grid-cols-3 gap-2">
                  {([['ALL','الاتنين'],['MARG','المرج'],['NOZHA','النزهة']] as const).map(([k,l]) => (
                    <button key={k} type="button" onClick={() => setCloseBranch(k as any)} className={`p-2 rounded-lg text-xs font-bold border ${closeBranch === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>{l}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">الرصيد الحالي ورصيد بداية اليوم (اختياري - سيبه فاضي يبدأ من صفر)</label>
                <div className="space-y-1.5">
                  {PM_LIST.filter(x => closeAccounts.includes(x.id)).map(x => {
                    const cur = treasury.filter((t: any) => (closeBranch === 'ALL' || (t.branchId || 'MARG') === closeBranch) && (t.paymentMethod || 'CASH') === x.id).reduce((a: number, t: any) => a + (Number(t.credit) || 0) - (Number(t.debit) || 0), 0);
                    return (
                      <div key={x.id} className="flex items-center gap-2 text-xs">
                        <span className="w-28 font-bold text-gray-700">{x.label}</span>
                        <span className="w-24 font-mono text-gray-500" dir="ltr">{Math.round(cur * 100) / 100 === 0 ? '0' : (Math.round(cur * 100) / 100).toLocaleString()}</span>
                        <span className="text-gray-400">←</span>
                        <input type="text" dir="ltr" inputMode="decimal" placeholder="0" value={closeOpenings[x.id] || ''}
                          onFocus={e => e.target.select()}
                          onChange={e => handleNumericChangeWithCommas(e.target.value, val => setCloseOpenings(o => ({ ...o, [x.id]: val })))}
                          className="flex-1 min-w-0 border rounded-lg p-1.5 text-center font-mono font-bold outline-none focus:ring-2 focus:ring-amber-400" />
                      </div>
                    );
                  })}
                </div>
                {closeBranch === 'ALL' && (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span className="text-gray-600">الرصيد الافتتاحي يتسجل على:</span>
                    {(['MARG','NOZHA'] as BranchId[]).map(b => (
                      <button key={b} type="button" onClick={() => setCloseOpenBranch(b)} className={`px-2.5 py-1 rounded-md font-bold border ${closeOpenBranch === b ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200'}`}>{b === 'MARG' ? 'المرج' : 'النزهة'}</button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">التاريخ</label>
                  <input type="date" value={closeDate} onChange={e => setCloseDate(e.target.value)} className="w-full p-2 border rounded-lg text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">ملاحظة</label>
                  <input type="text" value={closeNotes} onChange={e => setCloseNotes(e.target.value)} placeholder="اختياري" className="w-full p-2 border rounded-lg text-xs" />
                </div>
              </div>
              <button type="button" disabled={closeBusy} onClick={handleCloseDay} className="w-full bg-amber-500 text-white py-2.5 rounded-lg font-bold hover:bg-amber-600 disabled:opacity-60 text-sm">
                {closeBusy ? 'جاري الحفظ...' : 'تنفيذ الإقفال'}
              </button>
              {lastClose && (
                <div className="flex items-center justify-between gap-2 text-xs bg-gray-50 border rounded-lg p-2">
                  <span className="text-gray-600">آخر إقفال: {lastClose.date} ({lastClose.count} حركة)</span>
                  <button type="button" onClick={async () => { if (!window.confirm('التراجع عن آخر إقفال؟ الأرصدة هترجع زي ما كانت.')) return; const n = await undoTreasuryClose(lastClose.groupId); if (n) alert('تم التراجع عن آخر إقفال.'); }} className="px-2.5 py-1 rounded-md bg-red-50 text-red-700 border border-red-200 font-bold">تراجع</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Opening Balance Modal */}
      {showOpeningModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in border border-blue-100">
            <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2"><PlusCircle size={18}/> إضافة رصيد افتتاحي للخزينة</h3>
              <button onClick={() => setShowOpeningModal(false)}><X size={18}/></button>
            </div>
            <div className="p-6">
              <form onSubmit={handleOpeningSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">الإدارة / الفرع</label>
                  <div className="grid grid-cols-2 gap-2">
                    {BRANCHES.map(b => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setOpeningForm({...openingForm, branchId: b.id})}
                        className={`p-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1 ${
                          openingForm.branchId === b.id
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <Building size={14} /> {b.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">المبلغ</label>
                  <input 
                    type="text" 
                    dir="ltr" 
                    required 
                    placeholder="0"
                    className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-base text-center font-mono"
                    value={openingForm.amount} 
                    onFocus={e => e.target.select()}
                    onChange={e => handleNumericChangeWithCommas(e.target.value, val => setOpeningForm({...openingForm, amount: val}))}
                  />
                  {parseNumberFromCommas(openingForm.amount) > 0 && (
                    <p className="text-xs font-bold text-blue-700 bg-blue-50 p-1.5 rounded mt-1 flex justify-between">
                      <span>المبلغ:</span>
                      <span dir="ltr">{parseNumberFromCommas(openingForm.amount).toLocaleString()} ج.م</span>
                    </p>
                  )}
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">الحساب (إلى أين؟)</label>
                  <select 
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-xs font-bold"
                    value={openingForm.paymentMethod} 
                    onChange={e => setOpeningForm({...openingForm, paymentMethod: e.target.value as PaymentMethod})}
                  >
                    <option value="CASH">خزنة كاش</option>
                    <option value="BANK_AHLY">البنك الأهلي</option>
                    <option value="BANK_MISR">بنك مصر</option>
                    <option value="VF_CASH_AYMAN">فودافون كاش أيمن</option>
                    <option value="VF_CASH_KYRILLOS">فودافون كاش كيرلس</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">التاريخ</label>
                  <input 
                    type="date" required 
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                    value={openingForm.date} onChange={e => setOpeningForm({...openingForm, date: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">ملاحظات</label>
                  <input 
                    type="text" 
                    placeholder="مثال: رصيد افتتاحي لبداية العام"
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                    value={openingForm.notes} onChange={e => setOpeningForm({...openingForm, notes: e.target.value})}
                  />
                </div>

                <div className="pt-2">
                  <button type="submit" className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-bold hover:bg-blue-700 flex justify-center items-center gap-2 shadow-sm text-sm cursor-pointer">
                    <Save size={16}/> حفظ الرصيد الافتتاحي
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Inter-branch Cash Transfer Modal */}
      {showCashTransferModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in border border-indigo-100">
            <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2 text-sm sm:text-base">
                <ArrowLeftRight size={18}/> تحويل نقدية بين الإدارات
              </h3>
              <button onClick={() => setShowCashTransferModal(false)}><X size={18}/></button>
            </div>
            <div className="p-6">
              <form onSubmit={handleExecuteCashTransfer} className="space-y-4">
                {/* From / To Branch */}
                <div className="grid grid-cols-2 gap-3 bg-indigo-50/60 p-3 rounded-xl border border-indigo-100">
                  <div>
                    <label className="block text-xs font-bold text-indigo-900 mb-1">من إدارة (صرف)</label>
                    <select
                      className="w-full p-2 border border-indigo-200 rounded-lg text-xs font-bold bg-white"
                      value={cashTransferFrom}
                      onChange={e => {
                        const from = e.target.value as BranchId;
                        setCashTransferFrom(from);
                        setCashTransferTo(from === 'MARG' ? 'NOZHA' : 'MARG');
                      }}
                    >
                      <option value="MARG">إدارة المرج</option>
                      <option value="NOZHA">إدارة النزهة</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-indigo-900 mb-1">إلى إدارة (إيداع)</label>
                    <select
                      className="w-full p-2 border border-indigo-200 rounded-lg text-xs font-bold bg-white"
                      value={cashTransferTo}
                      onChange={e => {
                        const to = e.target.value as BranchId;
                        setCashTransferTo(to);
                        setCashTransferFrom(to === 'MARG' ? 'NOZHA' : 'MARG');
                      }}
                    >
                      <option value="NOZHA">إدارة النزهة</option>
                      <option value="MARG">إدارة المرج</option>
                    </select>
                  </div>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">المبلغ المراد تحويله</label>
                  <input 
                    type="text" 
                    dir="ltr" 
                    required 
                    placeholder="0"
                    className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-base text-center font-mono"
                    value={cashTransferAmount} 
                    onFocus={e => e.target.select()}
                    onChange={e => handleNumericChangeWithCommas(e.target.value, val => setCashTransferAmount(val))}
                  />
                  {parseNumberFromCommas(cashTransferAmount) > 0 && (
                    <p className="text-xs font-bold text-indigo-700 bg-indigo-50 p-1.5 rounded mt-1 flex justify-between">
                      <span>المبلغ بالأرقام:</span>
                      <span dir="ltr">{parseNumberFromCommas(cashTransferAmount).toLocaleString()} ج.م</span>
                    </p>
                  )}
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">طريقة النقل / الحساب</label>
                  <select 
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-xs font-bold"
                    value={cashTransferMethod} 
                    onChange={e => setCashTransferMethod(e.target.value as PaymentMethod)}
                  >
                    <option value="CASH">خزنة كاش</option>
                    <option value="BANK_AHLY">البنك الأهلي</option>
                    <option value="BANK_MISR">بنك مصر</option>
                    <option value="VF_CASH_AYMAN">فودافون كاش أيمن</option>
                    <option value="VF_CASH_KYRILLOS">فودافون كاش كيرلس</option>
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">ملاحظات / سبب التحويل (اختياري)</label>
                  <input 
                    type="text" 
                    placeholder="مثال: تمويل سيولة بناء على طلب الإدارة"
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
                    value={cashTransferNotes} 
                    onChange={e => setCashTransferNotes(e.target.value)}
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button 
                    type="submit" 
                    disabled={isTransferringCash || parseNumberFromCommas(cashTransferAmount) <= 0}
                    className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg font-bold hover:bg-indigo-700 disabled:bg-gray-400 flex justify-center items-center gap-2 shadow-sm text-xs sm:text-sm cursor-pointer"
                  >
                    {isTransferringCash ? (
                      <>
                        <RotateCcw size={16} className="animate-spin" />
                        <span>جاري التحويل...</span>
                      </>
                    ) : (
                      <>
                        <Check size={16}/>
                        <span>تأكيد تحويل النقدية</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowCashTransferModal(false)}
                    disabled={isTransferringCash}
                    className="py-2.5 px-4 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-bold cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
