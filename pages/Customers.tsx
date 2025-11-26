
import React, { useState, useEffect } from 'react';
import { useERP } from '../context/ERPContext';
import { UserPlus, FileText, Edit, X, Check, Download, Phone, Trash2, RefreshCcw, AlertTriangle, Eye, Printer } from 'lucide-react';
import { SalesInvoice } from '../types';

export const Customers: React.FC = () => {
  const { customers, addCustomer, updateCustomer, deleteCustomer, exportLedgerToExcel, exportAllCustomersToExcel, clearLedger, currentUser, invoices, printInvoice } = useERP();
  
  // State for form data
  const [formData, setFormData] = useState({ code: '', name: '', phone: '', balance: 0 });
  
  // State to track selection and editing mode
  const [selectedCustomerCode, setSelectedCustomerCode] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingOldCode, setEditingOldCode] = useState<string | null>(null); // To track the original code before edit

  // Delete confirmation state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // Clear Ledger confirmation state
  const [showClearLedgerConfirm, setShowClearLedgerConfirm] = useState(false);

  // View Invoice Modal State
  const [viewInvoice, setViewInvoice] = useState<SalesInvoice | null>(null);

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
          phone: formData.phone,
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
        setFormData({ code: '', name: '', phone: '', balance: 0 });
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
      phone: customer.phone || '',
      balance: customer.balance
    });
    // Scroll to top to see the form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingOldCode(null);
    setFormData({ code: generateNextCode(), name: '', phone: '', balance: 0 });
  };

  const handleDelete = async (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    await deleteCustomer(code);
    setDeleteConfirmId(null);
    if (selectedCustomerCode === code) {
      setSelectedCustomerCode(null);
    }
  };

  const handleClearLedger = async () => {
    if (!selectedCustomer) return;
    const success = await clearLedger('CUSTOMER', selectedCustomer.code);
    if (success) {
       setShowClearLedgerConfirm(false);
       alert("تم تصفير الحساب ومسح السجلات بنجاح.");
    }
  };

  const handleViewInvoiceDetails = (description: string) => {
    // Extract invoice ID from description (e.g., "فاتورة بيع #N005")
    const match = description.match(/#([A-Za-z0-9-]+)/);
    if (match) {
      const invoiceId = match[1];
      const invoice = invoices.find(inv => inv.id === invoiceId);
      if (invoice) {
        setViewInvoice(invoice);
      } else {
        alert("عذراً، تفاصيل هذه الفاتورة غير متوفرة في السجل العام (ربما تم حذفها).");
      }
    }
  };

  const selectedCustomer = customers.find(c => c.code === selectedCustomerCode);

  return (
    <div className="space-y-8">
      
      {/* Header with Bulk Export */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-brand-100">
        <h2 className="text-xl font-bold text-brand-800">إدارة العملاء</h2>
        <button 
          onClick={exportAllCustomersToExcel}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-700 transition-colors shadow-sm"
        >
          <Download size={18} /> تصدير قائمة العملاء (Excel)
        </button>
      </div>

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
                  onClick={() => {
                    setSelectedCustomerCode(c.code);
                    setShowClearLedgerConfirm(false);
                  }}
                  className={`p-4 cursor-pointer hover:bg-brand-50 transition-colors flex justify-between items-center group
                    ${selectedCustomerCode === c.code ? 'bg-brand-50 border-r-4 border-brand-500' : ''}
                  `}
                >
                  <div className="flex-1">
                    <p className="font-bold text-gray-800">{c.name}</p>
                    <p className="text-xs text-gray-500">#{c.code} {c.phone ? `- ${c.phone}` : ''}</p>
                  </div>
                  <div className="text-left flex items-center gap-2">
                    <div>
                      {/* Red for Negative (Debt), Green for Positive (Credit) */}
                      <p className={`font-bold text-sm ${c.balance < 0 ? 'text-red-600' : c.balance > 0 ? 'text-green-600' : 'text-gray-600'}`} dir="ltr">
                        {c.balance.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-gray-400">الرصيد الحالي</p>
                    </div>
                    
                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => handleEditClick(e, c)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="تعديل بيانات العميل"
                      >
                        <Edit size={16} />
                      </button>

                      {deleteConfirmId === c.code ? (
                         <div className="flex items-center gap-1 bg-red-50 p-1 rounded border border-red-100" onClick={e => e.stopPropagation()}>
                           <button 
                             onClick={(e) => handleDelete(e, c.code)} 
                             className="bg-red-500 text-white p-1 rounded hover:bg-red-600 transition-colors" 
                             title="تأكيد الحذف"
                           >
                             <Check size={14}/>
                           </button>
                           <button 
                             onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }} 
                             className="bg-white text-gray-500 p-1 rounded border border-gray-200 hover:bg-gray-100 transition-colors" 
                             title="إلغاء"
                           >
                             <X size={14}/>
                           </button>
                         </div>
                      ) : (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(c.code); }}
                          className="p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 rounded transition-colors"
                          title="حذف العميل"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>

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
                    <div className="flex flex-col gap-1 mt-1">
                      <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-mono w-fit">Code: {selectedCustomer.code}</span>
                      {selectedCustomer.phone && (
                        <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded text-xs w-fit flex items-center gap-1">
                          <Phone size={10} /> {selectedCustomer.phone}
                        </span>
                      )}
                    </div>
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
                  <div className="flex flex-col sm:flex-row justify-between items-center mb-3 gap-3">
                    <h4 className="font-bold text-gray-700 flex items-center gap-2">
                      <FileText size={18} /> كشف حساب تفصيلي
                    </h4>
                    <div className="flex gap-2 items-center">
                        {currentUser?.permissions.canDeleteLedgers && (
                          showClearLedgerConfirm ? (
                             <div className="flex items-center gap-2 bg-red-50 p-1.5 rounded-lg border border-red-200 animate-fade-in">
                               <AlertTriangle size={16} className="text-red-500" />
                               <span className="text-xs font-bold text-red-600">تأكيد التصفير؟</span>
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
                          onClick={() => exportLedgerToExcel(selectedCustomer.name, selectedCustomer.code, selectedCustomer.history, selectedCustomer.balance, 'CUSTOMER')}
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
                          <th className="p-3 text-red-600">مدين (عليه)</th>
                          <th className="p-3 text-green-600">دائن (له)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedCustomer.history.length === 0 ? (
                          <tr><td colSpan={4} className="p-4 text-center text-gray-400">لا توجد حركات مسجلة</td></tr>
                        ) : (
                          selectedCustomer.history.map((h, idx) => {
                            const isDebit = h.amount < 0;
                            const isCredit = h.amount > 0;
                            // Check if description contains an invoice ID
                            const invoiceIdMatch = h.description.match(/#([A-Za-z0-9-]+)/);
                            const hasInvoiceId = !!invoiceIdMatch;

                            return (
                              <tr key={idx}>
                                <td className="p-3 text-gray-600 whitespace-nowrap">{h.date}</td>
                                <td className="p-3 font-medium text-gray-800">
                                  <div className="flex justify-between items-center">
                                    <span>{h.description}</span>
                                    {hasInvoiceId && (
                                      <button 
                                        onClick={() => handleViewInvoiceDetails(h.description)}
                                        className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 p-1 rounded transition-colors"
                                        title="عرض تفاصيل الفاتورة"
                                      >
                                        <Eye size={16} />
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3 font-bold text-red-600 bg-red-50/30">
                                  {isDebit ? Math.abs(h.amount).toLocaleString() : '-'}
                                </td>
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

      {/* View Invoice Details Modal */}
      {viewInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in">
            <div className="bg-brand-600 p-4 flex justify-between items-center text-white">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <FileText size={20}/> تفاصيل الفاتورة {viewInvoice.id}
              </h2>
              <button onClick={() => setViewInvoice(null)} className="hover:bg-brand-700 p-1 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-50 p-3 rounded-lg">
                   <span className="block text-gray-500 text-xs">العميل</span>
                   <span className="font-bold text-gray-800 text-lg">{viewInvoice.customerName}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                   <span className="block text-gray-500 text-xs">التاريخ والوقت</span>
                   <span className="font-bold text-gray-800">{viewInvoice.date} - {viewInvoice.time}</span>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-right text-sm">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="p-3">الصنف</th>
                      <th className="p-3">الكمية</th>
                      <th className="p-3">السعر</th>
                      <th className="p-3">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {viewInvoice.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-3 font-medium">{item.itemName} <span className="text-xs text-gray-400">({item.itemCode})</span></td>
                        <td className="p-3">{item.quantity}</td>
                        <td className="p-3">{item.price.toLocaleString()}</td>
                        <td className="p-3 font-bold">{item.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end">
                <div className="bg-gray-900 text-white p-4 rounded-xl w-full md:w-1/2">
                  <div className="flex justify-between items-center text-lg font-bold">
                     <span>إجمالي الفاتورة</span>
                     <span>{viewInvoice.total.toLocaleString()} ج.م</span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-700 text-xs text-gray-400 flex justify-between">
                     <span>رصيد سابق: {viewInvoice.previousBalance.toLocaleString()}</span>
                     <span>رصيد بعد الفاتورة: {viewInvoice.currentBalance.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 border-t flex justify-end gap-3">
              <button 
                onClick={() => printInvoice(viewInvoice)} 
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 flex items-center gap-2"
              >
                <Printer size={16}/> طباعة
              </button>
              <button 
                onClick={() => setViewInvoice(null)} 
                className="px-6 py-2 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
