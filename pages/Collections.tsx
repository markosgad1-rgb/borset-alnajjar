
import React, { useState } from 'react';
import { useERP } from '../context/ERPContext';
import { Banknote, Save, Search, CheckCircle, AlertCircle, Building2, Wallet } from 'lucide-react';
import { PaymentMethod } from '../types';

export const Collections: React.FC = () => {
  const { customers, addCollection } = useERP();
  
  const [formData, setFormData] = useState({
    invoiceId: '',
    customerCode: '',
    customerName: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'CASH' as PaymentMethod
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(formData.amount);

    if (!formData.customerCode || !formData.customerName) {
      alert('الرجاء اختيار العميل');
      return;
    }
    if (amount <= 0) {
      alert('الرجاء إدخال مبلغ تحصيل صحيح');
      return;
    }

    addCollection({
      customerCode: formData.customerCode,
      invoiceId: formData.invoiceId || undefined,
      amount: amount,
      date: formData.date,
      paymentMethod: formData.paymentMethod
    });

    // Reset Form
    setFormData({
      invoiceId: '',
      customerCode: '',
      customerName: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      paymentMethod: 'CASH'
    });
    setCustomerBalance(null);
    alert('تم حفظ عملية التحصيل بنجاح، وتحديث رصيد العميل والخزنة.');
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
                  <div className="grid grid-cols-3 gap-4">
                    <label className={`
                      flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all
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
                      <span className="font-bold">خزنة (كاش)</span>
                    </label>

                    <label className={`
                      flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all
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
                      <span className="font-bold">البنك الأهلي</span>
                    </label>

                    <label className={`
                      flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all
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
                      <span className="font-bold">بنك مصر</span>
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
                <label className="block text-sm font-bold text-gray-700 text-emerald-700">المبلغ المحصل (تم دفع)</label>
                <div className="relative">
                  <input 
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    className="w-full p-3 border-2 border-emerald-100 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-xl"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={e => setFormData({...formData, amount: e.target.value})}
                  />
                  <span className="absolute left-3 top-4 text-gray-400 font-bold text-sm">ج.م</span>
                </div>
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

      {/* Hint Section */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-500 text-sm">
        <div className="flex items-start gap-2 bg-blue-50 p-4 rounded-lg border border-blue-100">
          <CheckCircle size={16} className="mt-1 text-blue-500"/>
          <p>عند الحفظ، سيتم إضافة المبلغ المدخل إلى <strong>الحساب المختار (خزنة/بنك)</strong> كإيراد.</p>
        </div>
        <div className="flex items-start gap-2 bg-blue-50 p-4 rounded-lg border border-blue-100">
          <CheckCircle size={16} className="mt-1 text-blue-500"/>
          <p>سيتم خصم المبلغ من مديونية العميل (أو إضافته لرصيده) وتحديث كشف الحساب تلقائياً.</p>
        </div>
      </div>
    </div>
  );
};
