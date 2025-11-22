
import React, { useState, useEffect } from 'react';
import { useERP } from '../context/ERPContext';
import { UserPlus, FileText, Edit, X, Check } from 'lucide-react';

export const Customers: React.FC = () => {
  const { customers, addCustomer, updateCustomer } = useERP();
  
  // State for form data
  const [formData, setFormData] = useState({ code: '', name: '', balance: 0 });
  
  // State to track selection and editing mode
  const [selectedCustomerCode, setSelectedCustomerCode] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingOldCode, setEditingOldCode] = useState<string | null>(null); // To track the original code before edit

  // Helper to generate next code
  const generateNextCode = () => {
    if (customers.length === 0) return 'C001';
    
    // Extract numbers from codes (assuming format like C001, 101, etc)
    const maxId = customers.reduce((max, c) => {
      // Remove non-numeric characters to find the number
      const num = parseInt(c.code.replace(/\D/g, ''));
      return !isNaN(num) && num > max ? num : max;
    }, 0);

    return `C${(maxId + 1).toString().padStart(3, '0')}`;
  };

  // Effect to auto-fill code when NOT editing
  useEffect(() => {
    if (!isEditing) {
      setFormData(prev => ({ ...prev, code: generateNextCode() }));
    }
  }, [customers, isEditing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.code && formData.name) {
      if (isEditing && editingOldCode) {
        // Update existing customer (pass old code to find, and full new data including potential new code)
        updateCustomer(editingOldCode, { 
          code: formData.code, 
          name: formData.name, 
          balance: Number(formData.balance) 
        });
        handleCancelEdit();
      } else {
        // Check if code exists before adding
        if (customers.some(c => c.code === formData.code)) {
          alert('هذا الكود مستخدم بالفعل لعميل آخر!');
          return;
        }
        addCustomer({ ...formData, history: [] });
        // Reset form (code will auto-regenerate via useEffect)
        setFormData({ code: '', name: '', balance: 0 });
      }
    }
  };

  const handleEditClick = (e: React.MouseEvent, customer: any) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditingOldCode(customer.code); // Save the original code
    setFormData({
      code: customer.code,
      name: customer.name,
      balance: customer.balance
    });
    // Scroll to top to see the form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingOldCode(null);
    setFormData({ code: generateNextCode(), name: '', balance: 0 });
  };

  const selectedCustomer = customers.find(c => c.code === selectedCustomerCode);

  return (
    <div className="space-y-8">
      
      {/* Add/Edit Customer Section */}
      <div className={`p-6 rounded-xl shadow-sm border transition-colors duration-300 ${isEditing ? 'bg-blue-50 border-blue-200' : 'bg-white border-brand-100'}`}>
        <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${isEditing ? 'text-blue-800' : 'text-brand-800'}`}>
          {isEditing ? <Edit size={20} /> : <UserPlus size={20} />} 
          {isEditing ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}
        </h3>
        <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-sm text-gray-600 mb-1">كود العميل</label>
            <input 
              type="text" 
              required
              // Removed 'disabled' to allow editing
              className={`w-full p-2 border rounded-lg outline-none focus:border-brand-500 font-mono font-bold ${isEditing ? 'bg-white border-blue-300' : 'bg-gray-50'}`}
              value={formData.code}
              onChange={e => setFormData({...formData, code: e.target.value})}
              placeholder="تلقائي"
            />
          </div>
          <div className="flex-[2] w-full">
            <label className="block text-sm text-gray-600 mb-1">اسم العميل</label>
            <input 
              type="text" 
              required
              className="w-full p-2 border rounded-lg outline-none focus:border-brand-500"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              placeholder="اسم العميل"
            />
          </div>
          <div className="flex-1 w-full">
             <label className="block text-sm text-gray-600 mb-1">{isEditing ? 'تعديل الرصيد الحالي' : 'رصيد افتتاحي'}</label>
             <div className="relative">
               <input 
                type="number" 
                className="w-full p-2 border rounded-lg outline-none focus:border-brand-500"
                value={formData.balance}
                onChange={e => setFormData({...formData, balance: Number(e.target.value)})}
              />
              <span className="absolute left-2 top-2 text-xs text-gray-400 pointer-events-none">
                (سالب = عليه)
              </span>
             </div>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button type="submit" className={`flex-1 md:flex-auto px-6 py-2.5 rounded-lg font-bold text-white transition-colors shadow-sm ${isEditing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-brand-600 hover:bg-brand-700'}`}>
              {isEditing ? 'حفظ التعديلات' : 'إضافة'}
            </button>
            {isEditing && (
              <button type="button" onClick={handleCancelEdit} className="bg-white text-gray-600 border border-gray-300 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                إلغاء
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customers List */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-brand-100 overflow-hidden">
          <div className="p-4 bg-brand-50 border-b border-brand-100">
            <h3 className="font-bold text-brand-800">قائمة العملاء</h3>
          </div>
          <div className="overflow-y-auto max-h-[500px]">
            <ul className="divide-y divide-gray-100">
              {customers.map(c => (
                <li 
                  key={c.code} 
                  onClick={() => setSelectedCustomerCode(c.code)}
                  className={`p-4 cursor-pointer hover:bg-brand-50 transition-colors flex justify-between items-center group
                    ${selectedCustomerCode === c.code ? 'bg-brand-50 border-r-4 border-brand-500' : ''}
                  `}
                >
                  <div className="flex-1">
                    <p className="font-bold text-gray-800">{c.name}</p>
                    <p className="text-xs text-gray-500">#{c.code}</p>
                  </div>
                  <div className="text-left flex items-center gap-3">
                    <div>
                      {/* Red for Negative (Debt), Green for Positive (Credit) */}
                      <p className={`font-bold text-sm ${c.balance < 0 ? 'text-red-600' : c.balance > 0 ? 'text-green-600' : 'text-gray-600'}`} dir="ltr">
                        {c.balance.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-gray-400">الرصيد الحالي</p>
                    </div>
                    <button 
                      onClick={(e) => handleEditClick(e, c)}
                      className="opacity-0 group-hover:opacity-100 p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-all"
                      title="تعديل بيانات العميل"
                    >
                      <Edit size={16} />
                    </button>
                  </div>
                </li>
              ))}
              {customers.length === 0 && (
                <li className="p-4 text-center text-gray-400 text-sm">لا يوجد عملاء</li>
              )}
            </ul>
          </div>
        </div>

        {/* Customer Ledger Details */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-brand-100 p-6 min-h-[400px]">
           {selectedCustomer ? (
             <div className="space-y-6">
                <div className="flex justify-between items-start border-b pb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-brand-900 flex items-center gap-3">
                      {selectedCustomer.name}
                      <button 
                        onClick={(e) => handleEditClick(e, selectedCustomer)}
                        className="text-sm font-normal bg-gray-100 text-gray-600 hover:bg-gray-200 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                      >
                        <Edit size={14}/> تعديل
                      </button>
                    </h2>
                    <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-mono">Code: {selectedCustomer.code}</span>
                  </div>
                  <div className="text-left bg-brand-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-500">الرصيد الحالي</p>
                    {/* Red if negative (Owes us), Green if positive (We owe him) */}
                    <p className={`text-2xl font-bold ${selectedCustomer.balance < 0 ? 'text-red-600' : selectedCustomer.balance > 0 ? 'text-green-600' : 'text-gray-800'}`} dir="ltr">
                      {selectedCustomer.balance.toLocaleString()} ج.م
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <FileText size={18} /> كشف حساب تفصيلي
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                      <thead className="bg-gray-50 text-gray-600 border-y">
                        <tr>
                          <th className="p-3">التاريخ</th>
                          <th className="p-3 w-1/3">البيان</th>
                          <th className="p-3 text-red-600">مدين (عليه)</th>
                          <th className="p-3 text-green-600">دائن (له)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedCustomer.history.length === 0 ? (
                          <tr><td colSpan={4} className="p-4 text-center text-gray-400">لا توجد حركات مسجلة</td></tr>
                        ) : (
                          selectedCustomer.history.map((h, idx) => {
                            // Logic: 
                            // If amount is negative, it means debt increased (Invoice) -> Debit (عليه)
                            // If amount is positive, it means debt decreased (Payment) -> Credit (له)
                            const isDebit = h.amount < 0;
                            const isCredit = h.amount > 0;

                            return (
                              <tr key={idx}>
                                <td className="p-3 text-gray-600 whitespace-nowrap">{h.date}</td>
                                <td className="p-3 font-medium text-gray-800">{h.description}</td>
                                
                                {/* Debit Column (عليه) - Show positive number if amount was negative */}
                                <td className="p-3 font-bold text-red-600 bg-red-50/30">
                                  {isDebit ? Math.abs(h.amount).toLocaleString() : '-'}
                                </td>

                                {/* Credit Column (له) - Show positive number if amount was positive */}
                                <td className="p-3 font-bold text-green-600 bg-green-50/30">
                                  {isCredit ? h.amount.toLocaleString() : '-'}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
             </div>
           ) : (
             <div className="h-full flex flex-col items-center justify-center text-gray-400">
               <UserPlus size={48} className="mb-4 opacity-50"/>
               <p>اختر عميل لعرض التفاصيل</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};
