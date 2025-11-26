
import React, { useState, useEffect } from 'react';
import { useERP } from '../context/ERPContext';
import { UserPlus, FileText, Edit, Truck, Download, Phone, RefreshCcw, Trash2, AlertTriangle } from 'lucide-react';

export const Suppliers: React.FC = () => {
  const { suppliers, addSupplier, updateSupplier, exportLedgerToExcel, exportAllSuppliersToExcel, clearLedger, currentUser } = useERP();
  
  const [formData, setFormData] = useState({ code: '', name: '', phone: '', balance: 0 });
  const [selectedSupplierCode, setSelectedSupplierCode] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingOldCode, setEditingOldCode] = useState<string | null>(null);

  // Clear Ledger confirmation state
  const [showClearLedgerConfirm, setShowClearLedgerConfirm] = useState(false);

  const generateNextCode = () => {
    if (suppliers.length === 0) return 'S001';
    const maxId = suppliers.reduce((max, s) => {
      const num = parseInt(s.code.replace(/\D/g, ''));
      return !isNaN(num) && num > max ? num : max;
    }, 0);
    return `S${(maxId + 1).toString().padStart(3, '0')}`;
  };

  useEffect(() => {
    if (!isEditing) {
      setFormData(prev => ({ ...prev, code: generateNextCode() }));
    }
  }, [suppliers, isEditing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.code && formData.name) {
      if (isEditing && editingOldCode) {
        updateSupplier(editingOldCode, { 
          code: formData.code, 
          name: formData.name, 
          phone: formData.phone,
          balance: Number(formData.balance) 
        });
        handleCancelEdit();
      } else {
        if (suppliers.some(s => s.code === formData.code)) {
          alert('هذا الكود مستخدم بالفعل لمورد آخر!');
          return;
        }
        addSupplier({ ...formData, history: [] });
        setFormData({ code: '', name: '', phone: '', balance: 0 });
      }
    }
  };

  const handleEditClick = (e: React.MouseEvent, supplier: any) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditingOldCode(supplier.code);
    setFormData({
      code: supplier.code,
      name: supplier.name,
      phone: supplier.phone || '',
      balance: supplier.balance
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingOldCode(null);
    setFormData({ code: generateNextCode(), name: '', phone: '', balance: 0 });
  };

  const handleClearLedger = async () => {
    if (!selectedSupplier) return;
    const success = await clearLedger('SUPPLIER', selectedSupplier.code);
    if (success) {
      setShowClearLedgerConfirm(false);
      alert("تم تصفير الحساب ومسح السجلات بنجاح.");
    }
  };

  const selectedSupplier = suppliers.find(s => s.code === selectedSupplierCode);

  return (
    <div className="space-y-8">

      {/* Header with Bulk Export */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-brand-100">
        <h2 className="text-xl font-bold text-brand-800">إدارة الموردين</h2>
        <button 
          onClick={exportAllSuppliersToExcel}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-700 transition-colors shadow-sm"
        >
          <Download size={18} /> تصدير قائمة الموردين (Excel)
        </button>
      </div>
      
      {/* Add/Edit Supplier Section */}
      <div className={`p-6 rounded-xl shadow-sm border transition-colors duration-300 ${isEditing ? 'bg-orange-50 border-orange-200' : 'bg-white border-brand-100'}`}>
        <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${isEditing ? 'text-orange-800' : 'text-brand-800'}`}>
          {isEditing ? <Edit size={20} /> : <Truck size={20} />} 
          {isEditing ? 'تعديل بيانات المورد' : 'إضافة مورد جديد'}
        </h3>
        <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-sm text-gray-600 mb-1">كود المورد</label>
            <input 
              type="text" 
              required
              className={`w-full p-2 border rounded-lg outline-none focus:border-brand-500 font-mono font-bold ${isEditing ? 'bg-white border-orange-300' : 'bg-gray-50'}`}
              value={formData.code}
              onChange={e => setFormData({...formData, code: e.target.value})}
              placeholder="تلقائي"
            />
          </div>
          <div className="flex-[2] w-full">
            <label className="block text-sm text-gray-600 mb-1">اسم المورد</label>
            <input 
              type="text" 
              required
              className="w-full p-2 border rounded-lg outline-none focus:border-brand-500"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              placeholder="اسم المورد"
            />
          </div>
          <div className="flex-[2] w-full">
            <label className="block text-sm text-gray-600 mb-1">رقم الهاتف</label>
            <input 
              type="text" 
              className="w-full p-2 border rounded-lg outline-none focus:border-brand-500"
              value={formData.phone}
              onChange={e => setFormData({...formData, phone: e.target.value})}
              placeholder="01xxxxxxxxx"
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
                (موجب = علينا)
              </span>
             </div>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button type="submit" className={`flex-1 md:flex-auto px-6 py-2.5 rounded-lg font-bold text-white transition-colors shadow-sm ${isEditing ? 'bg-orange-600 hover:bg-orange-700' : 'bg-brand-600 hover:bg-brand-700'}`}>
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
        {/* List */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-brand-100 overflow-hidden">
          <div className="p-4 bg-brand-50 border-b border-brand-100">
            <h3 className="font-bold text-brand-800">قائمة الموردين</h3>
          </div>
          <div className="overflow-y-auto max-h-[500px]">
            <ul className="divide-y divide-gray-100">
              {suppliers.map(s => (
                <li 
                  key={s.code} 
                  onClick={() => {
                    setSelectedSupplierCode(s.code);
                    setShowClearLedgerConfirm(false);
                  }}
                  className={`p-4 cursor-pointer hover:bg-brand-50 transition-colors flex justify-between items-center group
                    ${selectedSupplierCode === s.code ? 'bg-brand-50 border-r-4 border-brand-500' : ''}
                  `}
                >
                  <div className="flex-1">
                    <p className="font-bold text-gray-800">{s.name}</p>
                    <p className="text-xs text-gray-500">#{s.code} {s.phone ? `- ${s.phone}` : ''}</p>
                  </div>
                  <div className="text-left flex items-center gap-3">
                    <div>
                      {/* Positive = We Owe Him (Green - as requested), Negative = He Owes Us (Red - as requested) */}
                      <p className={`font-bold text-sm ${s.balance > 0 ? 'text-green-600' : s.balance < 0 ? 'text-red-600' : 'text-gray-600'}`} dir="ltr">
                        {s.balance.toLocaleString()}
                      </p>
                    </div>
                    <button 
                      onClick={(e) => handleEditClick(e, s)}
                      className="opacity-0 group-hover:opacity-100 p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-all"
                    >
                      <Edit size={16} />
                    </button>
                  </div>
                </li>
              ))}
              {suppliers.length === 0 && (
                <li className="p-4 text-center text-gray-400 text-sm">لا يوجد موردين</li>
              )}
            </ul>
          </div>
        </div>

        {/* Ledger Details */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-brand-100 p-6 min-h-[400px]">
           {selectedSupplier ? (
             <div className="space-y-6">
                <div className="flex justify-between items-start border-b pb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-brand-900 flex items-center gap-3">
                      {selectedSupplier.name}
                      <button 
                        onClick={(e) => handleEditClick(e, selectedSupplier)}
                        className="text-sm font-normal bg-gray-100 text-gray-600 hover:bg-gray-200 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                      >
                        <Edit size={14}/> تعديل
                      </button>
                    </h2>
                    <div className="flex flex-col gap-1 mt-1">
                      <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-mono w-fit">Code: {selectedSupplier.code}</span>
                      {selectedSupplier.phone && (
                        <span className="bg-orange-50 text-orange-600 px-2 py-1 rounded text-xs w-fit flex items-center gap-1">
                          <Phone size={10} /> {selectedSupplier.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-left bg-brand-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-500">الرصيد الحالي</p>
                    <p className={`text-2xl font-bold ${selectedSupplier.balance > 0 ? 'text-green-600' : selectedSupplier.balance < 0 ? 'text-red-600' : 'text-gray-800'}`} dir="ltr">
                      {selectedSupplier.balance.toLocaleString()} ج.م
                    </p>
                    <p className="text-xs text-gray-400">
                      {selectedSupplier.balance > 0 ? '(له - مديونية علينا)' : selectedSupplier.balance < 0 ? '(عليه - رصيد لنا)' : 'متزن'}
                    </p>
                  </div>
                </div>

                <div>
                  <div className="flex flex-col sm:flex-row justify-between items-center mb-3 gap-3">
                    <h4 className="font-bold text-gray-700 flex items-center gap-2">
                      <FileText size={18} /> كشف حساب
                    </h4>
                    <div className="flex gap-2 items-center">
                        {currentUser?.permissions.canDeleteLedgers && (
                          showClearLedgerConfirm ? (
                             <div className="flex items-center gap-2 bg-red-50 p-1.5 rounded-lg border border-red-200 animate-fade-in">
                               <AlertTriangle size={16} className="text-red-500" />
                               <span className="text-xs font-bold text-red-600">تأكيد الحذف؟</span>
                               <button 
                                 onClick={handleClearLedger}
                                 className="bg-red-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-red-700"
                               >
                                 نعم
                               </button>
                               <button 
                                 onClick={() => setShowClearLedgerConfirm(false)}
                                 className="bg-white text-gray-600 px-3 py-1 rounded border text-xs font-bold hover:bg-gray-100"
                               >
                                 إلغاء
                               </button>
                             </div>
                          ) : (
                            <button 
                              onClick={() => setShowClearLedgerConfirm(true)}
                              className="flex items-center gap-2 bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-red-200 transition-colors shadow-sm"
                            >
                              <Trash2 size={16} /> حذف كشف الحساب (تصفير)
                            </button>
                          )
                        )}

                        <button 
                          onClick={() => exportLedgerToExcel(selectedSupplier.name, selectedSupplier.code, selectedSupplier.history, selectedSupplier.balance, 'SUPPLIER')}
                          className="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-green-700 transition-colors shadow-sm"
                        >
                          <Download size={16} /> تصدير (Excel)
                        </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                      <thead className="bg-gray-50 text-gray-600 border-y">
                        <tr>
                          <th className="p-3">التاريخ</th>
                          <th className="p-3 w-1/3">البيان</th>
                          <th className="p-3 text-green-600">علينا (له)</th>
                          <th className="p-3 text-red-600">لنا (عليه)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedSupplier.history.length === 0 ? (
                          <tr><td colSpan={4} className="p-4 text-center text-gray-400">لا توجد حركات مسجلة</td></tr>
                        ) : (
                          selectedSupplier.history.map((h, idx) => {
                            // For Supplier:
                            // Positive Amount = Debt Increased (We buy/We owe more) -> Green Column (Aliena/Lahu)
                            // Negative Amount = Debt Decreased (We pay/Lana) -> Red Column (Lana/Alayh)
                            const isDebtIncrease = h.amount > 0;
                            const isDebtDecrease = h.amount < 0;

                            return (
                              <tr key={idx}>
                                <td className="p-3 text-gray-600 whitespace-nowrap">{h.date}</td>
                                <td className="p-3 font-medium text-gray-800">{h.description}</td>
                                <td className="p-3 font-bold text-green-600 bg-green-50/30">
                                  {isDebtIncrease ? h.amount.toLocaleString() : '-'}
                                </td>
                                <td className="p-3 font-bold text-red-600 bg-red-50/30">
                                  {isDebtDecrease ? Math.abs(h.amount).toLocaleString() : '-'}
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
               <Truck size={48} className="mb-4 opacity-50"/>
               <p>اختر مورد لعرض التفاصيل</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};
