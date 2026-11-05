
import React, { useState } from 'react';
import { useERP } from '../context/ERPContext';
import { Banknote, Save, Search, CheckCircle, AlertCircle, Building2, Wallet, Smartphone, History, ArrowDownLeft } from 'lucide-react';
import { PaymentMethod } from '../types';
import { formatWithCommas, parseNumberFromCommas, handleNumericChangeWithCommas } from '../utils/formatters';

export const Collections: React.FC = () => {
  const { customers, addCollection, treasury } = useERP();
  
  const [formData, setFormData] = useState({
    invoiceId: '',
    customerCode: '',
    customerName: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'CASH' as PaymentMethod,
    notes: ''
  });

  const [customerBalance, setCustomerBalance] = useState<number | null>(null);

  // Handle Customer Selection (By Name)
  const handleCustomerNameChange = (name: string) => {
    const customer = customers.find(c => c.name === name);
    if (customer) {
      setFormData(prev => ({ 
        ...prev, 
        customerName: name, 
        customerCode: customer.code 
      }));
      setCustomerBalance(customer.balance);
    } else {
      setFormData(prev => ({ ...prev, customerName: name }));
      setCustomerBalance(null);
    }
  };

  // Handle Customer Selection (By Code)
  const handleCustomerCodeChange = (code: string) => {
    const customer = customers.find(c => c.code === code);
    if (customer) {
      setFormData(prev => ({ 
        ...prev, 
        customerCode: code, 
        customerName: customer.name 
      }));
      setCustomerBalance(customer.balance);
    } else {
      setFormData(prev => ({ ...prev, customerCode: code }));
      setCustomerBalance(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseNumberFromCommas(formData.amount);

    if (!formData.customerCode || !formData.customerName) {
      alert('الرجاء اختيار العميل');
      return;
    }
    if (amount <= 0) {
      alert('الرجاء إدخال مبلغ تحصيل صحيح');
      return;
    }

    try {
      await addCollection({
        customerCode: formData.customerCode,
        customerName: formData.customerName,
        invoiceId: formData.invoiceId?.trim() || undefined,
        amount: amount,
        date: formData.date,
        paymentMethod: formData.paymentMethod,
        notes: formData.notes?.trim() || undefined
      });

      // Reset Form
      setFormData({
        invoiceId: '',
        customerCode: '',
        customerName: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        paymentMethod: 'CASH',
        notes: ''
      });
      setCustomerBalance(null);
      alert('تم حفظ عملية التحصيل بنجاح وتحديث رصيد العميل والخزنة فوراً.');
    } catch (err: any) {
      alert('حدث خطأ أثناء حفظ التحصيل: ' + (err?.message || err));
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-brand-100 overflow-hidden">
        <div className="p-6 bg-brand-600 text-white flex items-center gap-3">
          <Banknote size={28} />
          <h2 className="text-xl font-bold">تسجيل تحصيل نقدية (دفعات عملاء)</h2>
        </div>
        
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Customer Selection Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">اسم العميل</label>
                <div className="relative">
                  <input 
                    type="text"
                    list="customerNames"
                    required
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none pr-10"
                    placeholder="ابحث باسم العميل..."
                    value={formData.customerName}
                    onChange={e => handleCustomerNameChange(e.target.value)}
                  />
                  <Search className="absolute left-3 top-3.5 text-gray-400" size={18}/>
                  <datalist id="customerNames">
                    {customers.map(c => <option key={c.code} value={c.name} />)}
                  </datalist>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">كود العميل</label>
                <input 
                  type="text"
                  list="customerCodes"
                  required
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none font-mono bg-gray-50"
                  placeholder="كود العميل"
                  value={formData.customerCode}
                  onChange={e => handleCustomerCodeChange(e.target.value)}
                />
                <datalist id="customerCodes">
                   {customers.map(c => <option key={c.code} value={c.code} />)}
                </datalist>
              </div>
            </div>

            {/* Customer Balance Display */}
            {formData.customerName && customerBalance !== null && (
              <div className={`p-4 rounded-lg border flex items-center gap-3 animate-fade-in
                ${customerBalance < 0 ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}
              `}>
                <AlertCircle size={24} />
                <div>
                  <p className="text-sm font-bold opacity-80">رصيد العميل الحالي (قبل التحصيل)</p>
                  <p className="text-2xl font-bold" dir="ltr">
                    {customerBalance.toLocaleString()} ج.م 
                    <span className="text-xs mr-2">
                      {customerBalance < 0 ? '(عليه - مدين)' : '(له - دائن)'}
                    </span>
                  </p>
                </div>
              </div>
            )}

            {/* Payment Details Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
               {/* Payment Method */}
               <div className="md:col-span-2 space-y-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">طريقة التحصيل (إلى أين ستذهب الأموال؟)</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <label className={`
                      flex flex-col items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all text-center
                      ${formData.paymentMethod === 'CASH' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-1 ring-emerald-500' : 'bg-white border-gray-200 hover:bg-gray-50'}
                    `}>
                      <input 
                        type="radio" 
                        name="method" 
                        value="CASH" 
                        checked={formData.paymentMethod === 'CASH'}
                        onChange={() => setFormData({...formData, paymentMethod: 'CASH'})} 
                        className="hidden"
                      />
                      <Wallet size={20} />
                      <span className="font-bold text-xs">خزنة (كاش)</span>
                    </label>

                    <label className={`
                      flex flex-col items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all text-center
                      ${formData.paymentMethod === 'BANK_AHLY' ? 'bg-green-50 border-green-600 text-green-800 ring-1 ring-green-600' : 'bg-white border-gray-200 hover:bg-gray-50'}
                    `}>
                      <input 
                        type="radio" 
                        name="method" 
                        value="BANK_AHLY" 
                        checked={formData.paymentMethod === 'BANK_AHLY'}
                        onChange={() => setFormData({...formData, paymentMethod: 'BANK_AHLY'})} 
                        className="hidden"
                      />
                      <Building2 size={20} />
                      <span className="font-bold text-xs">البنك الأهلي</span>
                    </label>

                    <label className={`
                      flex flex-col items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all text-center
                      ${formData.paymentMethod === 'BANK_MISR' ? 'bg-red-50 border-red-600 text-red-800 ring-1 ring-red-600' : 'bg-white border-gray-200 hover:bg-gray-50'}
                    `}>
                      <input 
                        type="radio" 
                        name="method" 
                        value="BANK_MISR" 
                        checked={formData.paymentMethod === 'BANK_MISR'}
                        onChange={() => setFormData({...formData, paymentMethod: 'BANK_MISR'})} 
                        className="hidden"
                      />
                      <Building2 size={20} />
                      <span className="font-bold text-xs">بنك مصر</span>
                    </label>

                    <label className={`
                      flex flex-col items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all text-center
                      ${formData.paymentMethod === 'VF_CASH_AYMAN' ? 'bg-red-50 border-red-600 text-red-800 ring-1 ring-red-600' : 'bg-white border-gray-200 hover:bg-gray-50'}
                    `}>
                      <input 
                        type="radio" 
                        name="method" 
                        value="VF_CASH_AYMAN" 
                        checked={formData.paymentMethod === 'VF_CASH_AYMAN'}
                        onChange={() => setFormData({...formData, paymentMethod: 'VF_CASH_AYMAN'})} 
                        className="hidden"
                      />
                      <Smartphone size={20} />
                      <span className="font-bold text-xs">فودافون كاش أيمن</span>
                    </label>

                    <label className={`
                      flex flex-col items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all text-center
                      ${formData.paymentMethod === 'VF_CASH_KYRILLOS' ? 'bg-red-50 border-red-600 text-red-800 ring-1 ring-red-600' : 'bg-white border-gray-200 hover:bg-gray-50'}
                    `}>
                      <input 
                        type="radio" 
                        name="method" 
                        value="VF_CASH_KYRILLOS" 
                        checked={formData.paymentMethod === 'VF_CASH_KYRILLOS'}
                        onChange={() => setFormData({...formData, paymentMethod: 'VF_CASH_KYRILLOS'})} 
                        className="hidden"
                      />
                      <Smartphone size={20} />
                      <span className="font-bold text-xs">فودافون كاش كيرلس</span>
                    </label>
                  </div>
               </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">رقم الفاتورة (مرجع)</label>
                <input 
                  type="text"
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="اختياري (مثال: N005)"
                  value={formData.invoiceId}
                  onChange={e => setFormData({...formData, invoiceId: e.target.value})}
                />
                <p className="text-xs text-gray-500">اتركه فارغاً إذا كانت دفعة عامة</p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">تاريخ التحصيل</label>
                <input 
                  type="date"
                  required
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                  value={formData.date}
                  onChange={e => setFormData({...formData, date: e.target.value})}
                />
              </div>

              <div className="md:col-span-2 space-y-2">
                <label className="block text-sm font-bold text-gray-700">ملاحظات / بيان إضافي</label>
                <input 
                  type="text"
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="أضف أي ملاحظات أو تفاصيل حول التحصيل..."
                  value={formData.notes}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                />
              </div>

              <div className="md:col-span-2 space-y-2">
                <label className="block text-sm font-bold text-gray-700 text-emerald-700">المبلغ المحصل (تم دفع)</label>
                <div className="relative">
                  <input 
                    type="text"
                    dir="ltr"
                    required
                    className="w-full p-3 border-2 border-emerald-100 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-xl text-center font-mono"
                    placeholder="0"
                    value={formData.amount}
                    onFocus={e => e.target.select()}
                    onChange={e => handleNumericChangeWithCommas(e.target.value, val => setFormData({...formData, amount: val}))}
                  />
                  <span className="absolute left-3 top-4 text-gray-400 font-bold text-sm">ج.م</span>
                </div>
                {parseNumberFromCommas(formData.amount) > 0 && (
                  <p className="text-xs font-bold text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-100 flex justify-between">
                    <span>المبلغ المحدد:</span>
                    <span dir="ltr">{parseNumberFromCommas(formData.amount).toLocaleString()} ج.م</span>
                  </p>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-6">
              <button 
                type="submit"
                className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg transition-all flex justify-center items-center gap-3"
              >
                <Save size={24} />
                حفظ التحصيل
              </button>
            </div>

          </form>
        </div>
      </div>

      {/* Recent Collections Table */}
      <div className="bg-white rounded-xl shadow-sm border border-brand-100 overflow-hidden">
        <div className="p-4 bg-brand-50 border-b border-brand-100 flex items-center justify-between">
          <h3 className="font-bold text-brand-900 flex items-center gap-2">
            <History size={20} className="text-brand-600" />
            سجل عمليات التحصيل الأخيرة المسجلة بالخزنة
          </h3>
          <span className="text-xs text-brand-700 font-bold">
            محدثة تلقائياً مع الخزنة
          </span>
        </div>
        
        {treasury.filter(t => t.id.startsWith('T_COL_') || t.description.includes('تحصيل من عميل')).length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p>لا توجد عمليات تحصيل مسجلة بعد</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-gray-50 text-gray-600 font-bold">
                <tr>
                  <th className="p-3">التاريخ</th>
                  <th className="p-3">الحساب / الخزنة</th>
                  <th className="p-3">البيان</th>
                  <th className="p-3 text-emerald-700 font-bold">المبلغ المسدد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {treasury
                  .filter(t => t.id.startsWith('T_COL_') || t.description.includes('تحصيل من عميل'))
                  .slice(-8)
                  .reverse()
                  .map((t) => (
                    <tr key={t.id} className="hover:bg-brand-50/40 transition-colors">
                      <td className="p-3 text-gray-600 whitespace-nowrap">{t.date}</td>
                      <td className="p-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                          t.paymentMethod === 'BANK_AHLY' ? 'bg-green-50 text-green-700 border-green-200' :
                          t.paymentMethod === 'BANK_MISR' ? 'bg-red-50 text-red-700 border-red-200' :
                          t.paymentMethod === 'VF_CASH_AYMAN' || t.paymentMethod === 'VF_CASH_KYRILLOS' ? 'bg-red-100 text-red-800 border-red-200' :
                          'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {t.paymentMethod === 'BANK_AHLY' ? 'البنك الأهلي' :
                           t.paymentMethod === 'BANK_MISR' ? 'بنك مصر' :
                           t.paymentMethod === 'VF_CASH_AYMAN' ? 'فودافون أيمن' :
                           t.paymentMethod === 'VF_CASH_KYRILLOS' ? 'فودافون كيرلس' : 'خزنة كاش'}
                        </span>
                      </td>
                      <td className="p-3 text-gray-800 font-medium">{t.description}</td>
                      <td className="p-3 font-bold text-emerald-600">
                        {t.credit > 0 ? `${t.credit.toLocaleString()} ج.م` : '-'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Hint Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-500 text-sm">
        <div className="flex items-start gap-2 bg-blue-50 p-4 rounded-lg border border-blue-100">
          <CheckCircle size={16} className="mt-1 text-blue-500"/>
          <p>عند الحفظ، سيتم إضافة المبلغ المدخل إلى <strong>الحساب المختار (خزنة/بنك)</strong> كإيراد ويسمع فوراً في الخزنة.</p>
        </div>
        <div className="flex items-start gap-2 bg-blue-50 p-4 rounded-lg border border-blue-100">
          <CheckCircle size={16} className="mt-1 text-blue-500"/>
          <p>سيتم خصم المبلغ من مديونية العميل وتحديث كشف الحساب تلقائياً.</p>
        </div>
      </div>
    </div>
  );
};
