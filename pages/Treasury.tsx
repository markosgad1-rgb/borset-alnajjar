
import React, { useState } from 'react';
import { useERP } from '../context/ERPContext';
import { Wallet, Building2, Banknote, Trash2, AlertTriangle, PlusCircle, X, Save } from 'lucide-react';
import { PaymentMethod } from '../types';

export const Treasury: React.FC = () => {
  const { treasury, currentTreasuryBalance, balances, clearTreasury, currentUser, addOpeningBalance } = useERP();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  // Opening Balance Modal State
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [openingForm, setOpeningForm] = useState({
    amount: '',
    paymentMethod: 'CASH' as PaymentMethod,
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const handleClearTreasury = async () => {
    const success = await clearTreasury();
    if (success) {
      setShowClearConfirm(false);
      alert("تم تصفير الخزنة وحذف جميع المعاملات بنجاح.");
    }
  };

  const handleOpeningSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(openingForm.amount);
    if (amount <= 0) return alert("الرجاء إدخال مبلغ صحيح");

    await addOpeningBalance({
      amount: amount,
      date: openingForm.date,
      paymentMethod: openingForm.paymentMethod,
      notes: openingForm.notes
    });

    setShowOpeningModal(false);
    setOpeningForm({ amount: '', paymentMethod: 'CASH', date: new Date().toISOString().split('T')[0], notes: '' });
    alert("تم إضافة الرصيد الافتتاحي بنجاح");
  };

  const getMethodLabel = (method?: string) => {
    if (method === 'BANK_AHLY') return 'البنك الأهلي';
    if (method === 'BANK_MISR') return 'بنك مصر';
    return 'خزنة (كاش)';
  };

  const getMethodColor = (method?: string) => {
    if (method === 'BANK_AHLY') return 'text-green-700 bg-green-50';
    if (method === 'BANK_MISR') return 'text-red-700 bg-red-50';
    return 'text-emerald-700 bg-emerald-50';
  };

  return (
    <div className="space-y-8">
      
      {/* Header Row */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-brand-100">
        <h2 className="text-xl font-bold text-brand-800 flex items-center gap-2">
           <Wallet className="text-brand-600" /> إدارة الخزنة
        </h2>

        <div className="flex gap-3">
          {currentUser?.permissions.canManageTreasury && (
            <button 
              onClick={() => setShowOpeningModal(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm"
            >
              <PlusCircle size={16} /> إضافة رصيد افتتاحي
            </button>
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
                className="flex items-center gap-2 bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-red-200 transition-colors shadow-sm"
              >
                <Trash2 size={16} /> تصفير الخزنة (حذف السجل)
              </button>
            )
          )}
        </div>
      </div>

      {/* Balances Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Total */}
        <div className="bg-gray-900 rounded-xl p-6 text-white shadow-lg md:col-span-4 lg:col-span-1">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-full"><Wallet size={32}/></div>
            <div>
              <p className="text-gray-300 text-sm">إجمالي السيولة (الكل)</p>
              <h2 className="text-3xl font-bold">{currentTreasuryBalance.toLocaleString()}</h2>
            </div>
          </div>
        </div>

        {/* Cash */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-emerald-100 flex items-center gap-4">
          <div className="bg-emerald-100 text-emerald-600 p-3 rounded-full"><Banknote size={32}/></div>
          <div>
            <p className="text-gray-500 text-sm font-bold">الخزنة النقدية (الكاش)</p>
            <h2 className="text-2xl font-bold text-emerald-600">{balances.cash.toLocaleString()}</h2>
          </div>
        </div>

        {/* Bank Ahly */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-green-100 flex items-center gap-4">
          <div className="bg-green-100 text-green-700 p-3 rounded-full"><Building2 size={32}/></div>
          <div>
             <p className="text-gray-500 text-sm font-bold">البنك الأهلي</p>
             <h2 className="text-2xl font-bold text-green-700">{balances.bankAhly.toLocaleString()}</h2>
          </div>
        </div>

        {/* Bank Misr */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-red-100 flex items-center gap-4">
          <div className="bg-red-100 text-red-700 p-3 rounded-full"><Building2 size={32}/></div>
          <div>
             <p className="text-gray-500 text-sm font-bold">بنك مصر</p>
             <h2 className="text-2xl font-bold text-red-700">{balances.bankMisr.toLocaleString()}</h2>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-brand-100 overflow-hidden">
        <div className="p-6 border-b border-brand-50">
          <h3 className="text-lg font-bold text-brand-800">سجل المعاملات المالية</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-brand-50 text-brand-700">
              <tr>
                <th className="p-4">التاريخ</th>
                <th className="p-4">طريقة الدفع</th>
                <th className="p-4 w-1/3">البيان</th>
                <th className="p-4 text-green-700">دائن (وارد)</th>
                <th className="p-4 text-red-700">مدين (صادر)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[...treasury].reverse().map((t) => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 text-gray-600 whitespace-nowrap">{t.date}</td>
                  <td className="p-4">
                    <span className={`text-xs font-bold px-2 py-1 rounded border ${getMethodColor(t.paymentMethod)}`}>
                        {getMethodLabel(t.paymentMethod)}
                    </span>
                  </td>
                  <td className="p-4 text-gray-800 font-medium">{t.description}</td>
                  <td className="p-4 font-bold text-green-600">
                    {t.credit > 0 ? t.credit.toLocaleString() : '-'}
                  </td>
                  <td className="p-4 font-bold text-red-500">
                    {t.debit > 0 ? t.debit.toLocaleString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Opening Balance Modal */}
      {showOpeningModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in">
            <div className="bg-brand-600 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2"><PlusCircle/> إضافة رصيد افتتاحي</h3>
              <button onClick={() => setShowOpeningModal(false)}><X/></button>
            </div>
            <div className="p-6">
              <form onSubmit={handleOpeningSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">المبلغ</label>
                  <input 
                    type="number" min="1" step="0.01" required 
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-brand-500 outline-none"
                    value={openingForm.amount} onChange={e => setOpeningForm({...openingForm, amount: e.target.value})}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">الحساب (إلى أين؟)</label>
                  <select 
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-brand-500 outline-none bg-white"
                    value={openingForm.paymentMethod} 
                    onChange={e => setOpeningForm({...openingForm, paymentMethod: e.target.value as PaymentMethod})}
                  >
                    <option value="CASH">خزنة (كاش)</option>
                    <option value="BANK_AHLY">البنك الأهلي</option>
                    <option value="BANK_MISR">بنك مصر</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">التاريخ</label>
                  <input 
                    type="date" required 
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-brand-500 outline-none"
                    value={openingForm.date} onChange={e => setOpeningForm({...openingForm, date: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">ملاحظات</label>
                  <input 
                    type="text" 
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-brand-500 outline-none"
                    value={openingForm.notes} onChange={e => setOpeningForm({...openingForm, notes: e.target.value})}
                  />
                </div>

                <div className="pt-2">
                  <button type="submit" className="w-full bg-brand-600 text-white py-2 rounded-lg font-bold hover:bg-brand-700 flex justify-center gap-2">
                    <Save size={18}/> حفظ الرصيد
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
