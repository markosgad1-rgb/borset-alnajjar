import React, { useState, useMemo } from 'react';
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
    addOpeningBalance 
  } = useERP();

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<'ALL' | BranchId>('ALL');
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | PaymentMethod>('ALL');
  
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

  // Filter transactions by selected branch and payment method
  const sortedTransactions = useMemo(() => {
    return [...treasury]
      .filter(t => {
        const itemBranch = t.branchId || 'MARG';
        const branchMatch = selectedBranchFilter === 'ALL' || itemBranch === selectedBranchFilter;
        const normalizedMethod = t.paymentMethod || 'CASH';
        const methodMatch = selectedFilter === 'ALL' || normalizedMethod === selectedFilter;
        return branchMatch && methodMatch;
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
        const tA = getTimestamp(a);
        const tB = getTimestamp(b);
        if (tA && tB && tA !== tB) return tB - tA;
        const dateDiff = (b.date || '').localeCompare(a.date || '');
        if (dateDiff !== 0) return dateDiff;
        return (b.id || '').localeCompare(a.id || '');
      });
  }, [treasury, selectedBranchFilter, selectedFilter]);

  const handleClearTreasury = async () => {
    const success = await clearTreasury();
    if (success) {
      setShowClearConfirm(false);
      alert("تم تصفير الخزنة وحذف جميع المعاملات بنجاح.");
    }
  };

  const handleOpeningSubmit = async (e: React.FormEvent) => {
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

  const handleExecuteCashTransfer = async (e: React.FormEvent) => {
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
          {currentUser?.permissions.canManageTreasury && (
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

          {currentUser?.permissions.canDeleteLedgers && (
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
