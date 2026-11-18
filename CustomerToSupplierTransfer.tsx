import React, { useMemo, useState } from 'react';
import { useERP } from '../context/ERPContext';
import { ArrowLeftRight, Save } from 'lucide-react';
import { PaymentMethod, Supplier } from '../types';
import { parseNumberFromCommas, handleNumericChangeWithCommas } from '../utils/formatters';
import { calculateSupplierBalance } from '../utils/supplierStatement';

const PM: { id: PaymentMethod; label: string }[] = [
  { id: 'CASH', label: 'خزنة (كاش)' },
  { id: 'BANK_MISR', label: 'بنك مصر' },
  { id: 'BANK_AHLY', label: 'البنك الأهلي' },
  { id: 'VF_CASH_AYMAN', label: 'فودافون كاش أيمن' },
  { id: 'VF_CASH_KYRILLOS', label: 'فودافون كاش كيرلس' },
];

/** تحويل عميل -> مورد: العميل سدد للمورد من بره. بيتسجل وارد من العميل وصادر للمورد على نفس حساب الخزنة المختار. */
export const CustomerToSupplierTransfer: React.FC<{ notify: (m: string) => void }> = ({ notify }) => {
  const { customers, suppliers, rawPurchases: purchases, addCustomerToSupplierTransfer, customerBalanceOf } = useERP();
  const [custCode, setCustCode] = useState('');
  const [supCode, setSupCode] = useState('');
  const [custSearch, setCustSearch] = useState('');
  const [supSearch, setSupSearch] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [pm, setPm] = useState<PaymentMethod | ''>('');
  const [busy, setBusy] = useState(false);
  const [warnAck, setWarnAck] = useState(false);

  const activeC = useMemo(() => customers.filter(c => !c.isDeleted), [customers]);
  const activeS = useMemo(() => suppliers.filter(s => !(s as any).isDeleted), [suppliers]);
  const cust = activeC.find(c => c.code === custCode);
  const sup = activeS.find(s => s.code === supCode);
  const supBal = sup ? calculateSupplierBalance(sup as Supplier, purchases) : 0;
  const amt = parseNumberFromCommas(amount);
  const custDebt = cust ? Math.max(0, -(customerBalanceOf(cust) || 0)) : 0;
  const supDebt = sup ? Math.max(0, -supBal) : 0;

  const cList = custSearch.trim() && !cust
    ? activeC.filter(c => (c.name || '').includes(custSearch.trim()) || (c.code || '').toLowerCase().includes(custSearch.trim().toLowerCase())).slice(0, 8) : [];
  const sList = supSearch.trim() && !sup
    ? activeS.filter(s => (s.name || '').includes(supSearch.trim()) || (s.code || '').toLowerCase().includes(supSearch.trim().toLowerCase())).slice(0, 8) : [];

  const needsWarn = !!cust && !!sup && amt > 0 && (amt > custDebt || amt > supDebt);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!cust) return notify('اختار العميل');
    if (!sup) return notify('اختار المورد');
    if (!(amt > 0)) return notify('الرجاء إدخال قيمة صحيحة أكبر من الصفر');
    if (!pm) return notify('اختار حساب الخزنة اللي هتتسجل عليه الحركة');
    if (needsWarn && !warnAck) { setWarnAck(true); return; }
    setBusy(true);
    try {
      const r = await addCustomerToSupplierTransfer({ customerCode: cust.code, supplierCode: sup.code, amount: amt, date, notes, paymentMethod: pm });
      if (r.success) {
        notify(`تم تسجيل تحويل ${amt.toLocaleString()} ج.م من العميل ${cust.name} إلى المورد ${sup.name}`);
        setCustCode(''); setSupCode(''); setCustSearch(''); setSupSearch(''); setAmount(''); setNotes(''); setPm(''); setWarnAck(false);
      } else {
        notify('لم يتم التسجيل: ' + (r.message || 'خطأ غير متوقع'));
      }
    } catch (err: any) {
      notify('حدث خطأ: ' + (err?.message || err));
    } finally { setBusy(false); }
  };

  const box = 'w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white';
  return (
    <form onSubmit={submit} className="bg-white rounded-xl shadow-sm border border-purple-200 p-6 space-y-5" dir="rtl">
      <div className="flex items-center gap-2 text-purple-700 font-bold text-lg"><ArrowLeftRight size={22} /> تحويل من عميل إلى مورد</div>
      <p className="text-xs text-gray-500">العميل سدّد للمورد من بره: بينزل من حساب العميل، ويتسدد لحساب المورد، ويتسجل في الخزنة دخول وخروج بنفس المبلغ على الحساب المختار.</p>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="relative">
          <label className="block text-sm font-bold mb-1">العميل</label>
          <input className={box} placeholder="ابحث بالاسم أو الكود" value={cust ? `${cust.name} (${cust.code})` : custSearch}
            onChange={e => { setCustCode(''); setCustSearch(e.target.value); setWarnAck(false); }} />
          {cList.length > 0 && (
            <div className="absolute z-20 w-full bg-white border rounded-lg shadow-lg max-h-56 overflow-auto">
              {cList.map(c => (
                <button type="button" key={c.code} className="block w-full text-right px-3 py-2 hover:bg-purple-50 text-sm"
                  onClick={() => { setCustCode(c.code); setCustSearch(''); }}>{c.name} <span className="text-gray-400">({c.code})</span></button>
              ))}
            </div>
          )}
          {cust && <div className="text-xs mt-1 text-gray-600">{custDebt > 0 ? `عليه مديونية: ${custDebt.toLocaleString()} ج.م` : `الرصيد: ${(customerBalanceOf(cust) || 0).toLocaleString()} ج.م`}</div>}
        </div>
        <div className="relative">
          <label className="block text-sm font-bold mb-1">المورد</label>
          <input className={box} placeholder="ابحث بالاسم أو الكود" value={sup ? `${sup.name} (${sup.code})` : supSearch}
            onChange={e => { setSupCode(''); setSupSearch(e.target.value); setWarnAck(false); }} />
          {sList.length > 0 && (
            <div className="absolute z-20 w-full bg-white border rounded-lg shadow-lg max-h-56 overflow-auto">
              {sList.map(s => (
                <button type="button" key={s.code} className="block w-full text-right px-3 py-2 hover:bg-purple-50 text-sm"
                  onClick={() => { setSupCode(s.code); setSupSearch(''); }}>{s.name} <span className="text-gray-400">({s.code})</span></button>
              ))}
            </div>
          )}
          {sup && <div className="text-xs mt-1 text-gray-600">{supDebt > 0 ? `مستحق للمورد: ${supDebt.toLocaleString()} ج.م` : `الرصيد: ${(-supBal).toLocaleString()} ج.م`}</div>}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold mb-1">المبلغ</label>
          <input className={box} inputMode="decimal" value={amount} onChange={e => { handleNumericChangeWithCommas(e, setAmount); setWarnAck(false); }} placeholder="0" />
        </div>
        <div>
          <label className="block text-sm font-bold mb-1">التاريخ</label>
          <input type="date" className={box} value={date} onChange={e => setDate(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold mb-1">حساب الخزنة (اختار كل مرة)</label>
        <div className="flex flex-wrap gap-2">
          {PM.map(o => (
            <button type="button" key={o.id} onClick={() => setPm(o.id)}
              className={`px-3 py-2 rounded-lg border text-sm font-bold ${pm === o.id ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>{o.label}</button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold mb-1">ملاحظات (اختياري)</label>
        <input className={box} value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      {needsWarn && warnAck && (
        <div className="bg-amber-50 border border-amber-300 text-amber-800 text-sm rounded-lg p-3">
          المبلغ أكبر من {amt > custDebt ? 'مديونية العميل' : 'المستحق للمورد'} الحالية. لو متأكد اضغط "تسجيل التحويل" مرة تانية للتأكيد.
        </div>
      )}

      <button type="submit" disabled={busy} className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white font-bold px-6 py-3 rounded-lg">
        <Save size={18} /> {busy ? 'جاري التسجيل...' : 'تسجيل التحويل'}
      </button>
    </form>
  );
};
