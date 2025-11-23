
import React, { useState } from 'react';
import { useERP } from '../context/ERPContext';
import { Receipt, Save } from 'lucide-react';

export const Expenses: React.FC = () => {
  const { addExpense, treasury } = useERP();
  
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(formData.amount);

    if (!formData.name) {
      alert('الرجاء إدخال اسم الشخص/الجهة');
      return;
    }
    if (amount <= 0) {
      alert('الرجاء إدخال قيمة مصروفات صحيحة');
      return;
    }

    addExpense({
      name: formData.name,
      amount: amount,
      date: formData.date,
      notes: formData.notes
    });

    setFormData({
      name: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    alert('تم تسجيل المصروفات وخصمها من الخزنة النقدية بنجاح');
  };

  // Filter only expenses from treasury records (Outgoing + Description contains 'مصروفات')
  const recentExpenses = treasury
    .filter(t => t.debit > 0 && t.description.includes('مصروفات'))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      
      {/* Expense Entry Form */}
      <div className="bg-white rounded-xl shadow-sm border border-brand-100 overflow-hidden">
        <div className="p-6 bg-red-600 text-white flex items-center gap-3">
          <Receipt size={28} />
          <h2 className="text-xl font-bold">تسجيل مصروفات جديدة</h2>
        </div>
        
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">اسم المستلم (الشخص/الجهة)</label>
                <input 
                  type="text" 
                  required
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                  placeholder="مثال: شركة الكهرباء، أحمد محمد..."
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700 text-red-700">قيمة المصروف</label>
                <div className="relative">
                  <input 
                    type="number" 
                    required
                    min="1"
                    step="0.01"
                    className="w-full p-3 border-2 border-red-100 rounded-lg focus:ring-2 focus:ring-red-500 outline-none font-bold text-xl"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={e => setFormData({...formData, amount: e.target.value})}
                  />
                  <span className="absolute left-3 top-4 text-gray-400 font-bold text-sm">ج.م</span>
                </div>
                <p className="text-xs text-gray-500">سيتم خصم المبلغ مباشرة من الخزنة النقدية (الكاش)</p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">التاريخ</label>
                <input 
                  type="date" 
                  required
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                  value={formData.date}
                  onChange={e => setFormData({...formData, date: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">ملاحظات</label>
                <input 
                  type="text" 
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                  placeholder="بيان تفصيلي للمصروف..."
                  value={formData.notes}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                />
              </div>
            </div>

            <div className="pt-4">
              <button 
                type="submit"
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg transition-all flex justify-center items-center gap-3"
              >
                <Save size={24} />
                تسجيل المصروف
              </button>
            </div>

          </form>
        </div>
      </div>

      {/* Recent Expenses List */}
      <div className="bg-white rounded-xl shadow-sm border border-brand-100 overflow-hidden">
        <div className="p-6 border-b border-brand-50 flex justify-between items-center">
          <h3 className="text-lg font-bold text-brand-800">سجل أحدث المصروفات</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-4">التاريخ</th>
                <th className="p-4">البيان</th>
                <th className="p-4 text-red-600">القيمة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentExpenses.length > 0 ? (
                recentExpenses.slice(0, 10).map((exp) => (
                  <tr key={exp.id} className="hover:bg-gray-50">
                    <td className="p-4 text-gray-600">{exp.date}</td>
                    <td className="p-4 font-medium text-gray-800">{exp.description}</td>
                    <td className="p-4 font-bold text-red-600">{exp.debit.toLocaleString()} ج.م</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-gray-400">لا توجد مصروفات مسجلة</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
