
import React, { useState, useEffect } from 'react';
import { useERP } from '../context/ERPContext';
import { Calendar, Search, FileText, X, Printer, Trash2, Check, AlertTriangle, Edit, Plus, Save, Coins, CreditCard, Wallet, Banknote } from 'lucide-react';
import { SalesInvoice, InvoiceItem, PaymentMethod } from '../types';
import { formatWithCommas, parseNumberFromCommas, handleNumericChangeWithCommas } from '../utils/formatters';

export const SalesHistory: React.FC = () => {
  const { invoices, products, printInvoice, deleteInvoice, clearAllInvoices, updateInvoice, currentUser } = useERP();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [editInvoiceId, setEditInvoiceId] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editItems, setEditItems] = useState<InvoiceItem[]>([]);
  const [editCustomer, setEditCustomer] = useState({ code: '', name: '' });
  const [editPaidAmount, setEditPaidAmount] = useState<string>('0');
  const [editPaymentMethod, setEditPaymentMethod] = useState<PaymentMethod>('CASH');
  
  // New Item for Edit Modal
  const [newItem, setNewItem] = useState<{ code: string, quantity: number | '', price: number | '' }>({
    code: '', quantity: '', price: ''
  });

  const getPaymentMethodLabel = (method?: PaymentMethod): string => {
    if (method === 'BANK_AHLY') return 'البنك الأهلي';
    if (method === 'BANK_MISR') return 'بنك مصر';
    if (method === 'VF_CASH_AYMAN') return 'فودافون كاش أيمن';
    if (method === 'VF_CASH_KYRILLOS') return 'فودافون كاش كيرلس';
    return 'خزنة (كاش)';
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesDate = inv.date === selectedDate;
    const matchesSearch = 
      inv.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
      inv.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesDate && matchesSearch;
  });

  const dayTotal = filteredInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const dayPaidTotal = filteredInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
  const dayRemainingTotal = filteredInvoices.reduce((sum, inv) => sum + (inv.remainingAmount !== undefined ? inv.remainingAmount : (inv.total - (inv.paidAmount || 0))), 0);

  const handleDelete = async (id: string) => {
    await deleteInvoice(id);
    setDeleteConfirmId(null);
  };

  const handleClearAll = async () => {
    const success = await clearAllInvoices();
    if (success) {
      setShowClearConfirm(false);
      alert("تم حذف جميع الفواتير بنجاح. سيبدأ الترقيم من N001.");
    }
  };

  // --- Edit Handlers ---
  
  const openEditModal = (invoice: SalesInvoice) => {
    setEditInvoiceId(invoice.id);
    setEditDate(invoice.date);
    setEditTime(invoice.time);
    setEditItems([...invoice.items]); // Deep copy items
    setEditCustomer({ code: invoice.customerCode, name: invoice.customerName });
    setEditPaidAmount(formatWithCommas(invoice.paidAmount || 0));
    setEditPaymentMethod(invoice.paymentMethod || 'CASH');
    setIsEditing(true);
  };

  const handleAddItem = () => {
    const qty = typeof newItem.quantity === 'number' ? newItem.quantity : 0;
    if (!newItem.code || qty <= 0) return alert("الرجاء اختيار صنف وتحديد الكمية");
    const product = products.find(p => p.code === newItem.code);
    if (!product) return;
    const itemPrice = typeof newItem.price === 'number' && newItem.price > 0 ? newItem.price : product.price;

    const existingIdx = editItems.findIndex(i => i.itemCode === newItem.code);
    if (existingIdx >= 0) {
      const updated = [...editItems];
      updated[existingIdx].quantity += qty;
      updated[existingIdx].total = updated[existingIdx].quantity * updated[existingIdx].price;
      setEditItems(updated);
    } else {
      setEditItems(prev => [...prev, {
        itemCode: product.code,
        itemName: product.name,
        quantity: qty,
        price: itemPrice,
        total: qty * itemPrice
      }]);
    }
    setNewItem({ code: '', quantity: '', price: '' });
  };

  const handleRemoveItem = (idx: number) => {
    setEditItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateItem = (idx: number, field: 'quantity' | 'price', value: number) => {
    setEditItems(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      updated[idx].total = updated[idx].quantity * updated[idx].price;
      return updated;
    });
  };

  const saveChanges = async () => {
    if (editItems.length === 0) return alert("لا يمكن حفظ فاتورة فارغة");
    
    const oldInvoice = invoices.find(inv => inv.id === editInvoiceId);
    if (!oldInvoice) return;

    const newTotal = editItems.reduce((sum, i) => sum + i.total, 0);
    const parsedPaid = parseNumberFromCommas(editPaidAmount);
    const finalPaid = Math.min(Math.max(0, parsedPaid), newTotal);
    const finalRemaining = Math.max(0, newTotal - finalPaid);
    
    const newInvoiceData: SalesInvoice = {
      ...oldInvoice,
      date: editDate,
      time: editTime,
      items: editItems,
      total: newTotal,
      paidAmount: finalPaid,
      remainingAmount: finalRemaining,
      paymentMethod: finalPaid > 0 ? editPaymentMethod : undefined,
      currentBalance: oldInvoice.previousBalance - finalRemaining
    };

    await updateInvoice(oldInvoice, newInvoiceData);
    setIsEditing(false);
    alert("تم تعديل الفاتورة وتصحيح الخزنة والمخزن والرصيد بنجاح");
  };

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-brand-100 flex flex-col gap-6">
        <div className="flex justify-between items-center border-b pb-4 mb-2">
           <h2 className="text-xl font-bold text-brand-800">سجل فواتير المبيعات</h2>
           
           {currentUser?.permissions.canDeleteLedgers && (
              showClearConfirm ? (
                 <div className="flex items-center gap-2 bg-red-50 p-1.5 rounded-lg border border-red-200 animate-fade-in">
                   <AlertTriangle size={16} className="text-red-500" />
                   <span className="text-xs font-bold text-red-600">هل أنت متأكد من حذف جميع الفواتير؟</span>
                   <button 
                     onClick={handleClearAll}
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
                  className="flex items-center gap-2 bg-red-100 text-red-600 px-3 py-2 rounded-lg text-sm font-bold hover:bg-red-200 transition-colors shadow-sm"
                >
                  <Trash2 size={16} /> تصفير سجل الفواتير (حذف الكل)
                </button>
              )
            )}
        </div>

        <div className="flex flex-col md:flex-row gap-4 justify-between items-end">
          <div className="flex-1 w-full">
            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
              <Calendar size={16}/> اختر تاريخ الفواتير
            </label>
            <input 
              type="date"
              className="w-full p-3 border border-brand-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
            />
          </div>

          <div className="flex-1 w-full">
            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
              <Search size={16}/> بحث برقم الفاتورة أو العميل
            </label>
            <input 
              type="text"
              className="w-full p-3 border border-brand-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
              placeholder="بحث..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full md:w-auto">
            <div className="bg-brand-50 p-3 rounded-lg border border-brand-200 text-center min-w-[130px]">
               <span className="block text-[11px] text-brand-600 mb-1">إجمالي المبيعات</span>
               <span className="block text-lg font-bold text-brand-900">{dayTotal.toLocaleString()} ج.م</span>
            </div>
            <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200 text-center min-w-[130px]">
               <span className="block text-[11px] text-emerald-700 mb-1">المحصل بالخزنة</span>
               <span className="block text-lg font-bold text-emerald-800">{dayPaidTotal.toLocaleString()} ج.م</span>
            </div>
            <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-center min-w-[130px]">
               <span className="block text-[11px] text-amber-700 mb-1">المتبقي (آجل)</span>
               <span className="block text-lg font-bold text-amber-900">{dayRemainingTotal.toLocaleString()} ج.م</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-brand-100 overflow-hidden">
        <div className="p-4 border-b border-brand-50 bg-brand-50 flex justify-between items-center">
           <h3 className="font-bold text-brand-800">سجل فواتير يوم {selectedDate}</h3>
           <span className="text-xs bg-white px-2 py-1 rounded border text-gray-500">عدد الفواتير: {filteredInvoices.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50 text-gray-600 text-sm">
              <tr>
                <th className="p-4"># الرقم</th>
                <th className="p-4">الوقت</th>
                <th className="p-4">العميل</th>
                <th className="p-4">الأصناف</th>
                <th className="p-4">الإجمالي</th>
                <th className="p-4">المدفوع</th>
                <th className="p-4">المتبقي</th>
                <th className="p-4">الحالة</th>
                <th className="p-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredInvoices.map((inv) => {
                const paid = inv.paidAmount || 0;
                const remaining = inv.remainingAmount !== undefined ? inv.remainingAmount : (inv.total - paid);
                const isFullyPaid = paid >= inv.total;
                const isPartial = paid > 0 && paid < inv.total;

                return (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-mono font-bold text-brand-700">{inv.id}</td>
                    <td className="p-4 text-gray-500 text-sm">{inv.time}</td>
                    <td className="p-4 font-bold text-gray-800">{inv.customerName}</td>
                    <td className="p-4 text-sm text-gray-600">{inv.items.length} صنف</td>
                    <td className="p-4 font-bold text-gray-900">{inv.total.toLocaleString()}</td>
                    <td className="p-4 font-bold text-emerald-600">
                      {paid > 0 ? (
                        <div className="flex flex-col">
                          <span>{paid.toLocaleString()}</span>
                          <span className="text-[10px] text-gray-400 font-normal">{getPaymentMethodLabel(inv.paymentMethod)}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 font-normal">0</span>
                      )}
                    </td>
                    <td className="p-4 font-bold text-amber-700">
                      {remaining > 0 ? remaining.toLocaleString() : <span className="text-gray-400 font-normal">0</span>}
                    </td>
                    <td className="p-4">
                      {isFullyPaid ? (
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">
                          مسدد بالكامل
                        </span>
                      ) : isPartial ? (
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                          مسدد جزئياً
                        </span>
                      ) : (
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800">
                          آجل
                        </span>
                      )}
                    </td>
                    <td className="p-4 flex gap-2 items-center justify-center">
                      <button 
                        onClick={() => setSelectedInvoice(inv)}
                        className="bg-brand-100 text-brand-700 hover:bg-brand-200 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-1"
                        title="عرض التفاصيل"
                      >
                        <FileText size={16} />
                      </button>

                      <button 
                        onClick={() => openEditModal(inv)}
                        className="bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-1"
                        title="تعديل الفاتورة والسداد"
                      >
                        <Edit size={16} />
                      </button>

                      {deleteConfirmId === inv.id ? (
                        <div className="flex items-center gap-1 bg-red-50 p-1 rounded border border-red-100 animate-fade-in">
                           <button 
                             onClick={() => handleDelete(inv.id)} 
                             className="bg-red-500 text-white p-1 rounded hover:bg-red-600 transition-colors" 
                             title="تأكيد الحذف"
                           >
                             <Check size={16}/>
                           </button>
                           <button 
                             onClick={() => setDeleteConfirmId(null)} 
                             className="bg-white text-gray-500 p-1 rounded border border-gray-200 hover:bg-gray-100 transition-colors" 
                             title="إلغاء"
                           >
                             <X size={16}/>
                           </button>
                         </div>
                      ) : (
                        <button 
                          onClick={() => setDeleteConfirmId(inv.id)}
                          className="text-red-400 hover:bg-red-50 hover:text-red-600 p-2 rounded-lg transition-colors"
                          title="حذف السجل"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-gray-400 flex flex-col items-center gap-2">
                    <FileText size={40} className="opacity-20"/>
                    لا توجد فواتير مسجلة في هذا التاريخ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in">
            <div className="bg-blue-600 p-4 flex justify-between items-center text-white shrink-0">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Edit size={20}/> تعديل الفاتورة {editInvoiceId}
              </h2>
              <button onClick={() => setIsEditing(false)} className="hover:bg-blue-700 p-1 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Invoice Info */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg border">
                 <div>
                   <label className="text-xs font-bold text-gray-500">العميل</label>
                   <div className="font-bold text-gray-800">{editCustomer.name}</div>
                 </div>
                 <div>
                   <label className="text-xs font-bold text-gray-500">التاريخ</label>
                   <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="w-full p-1 border rounded bg-white text-sm"/>
                 </div>
                 <div>
                   <label className="text-xs font-bold text-gray-500">الوقت</label>
                   <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)} className="w-full p-1 border rounded bg-white text-sm"/>
                 </div>
              </div>

              {/* Add Items */}
              <div className="flex gap-2 items-end bg-blue-50 p-3 rounded-lg border border-blue-100">
                 <div className="flex-1">
                   <label className="text-xs font-bold text-blue-700">إضافة صنف</label>
                   <input 
                     type="text" list="prodList" placeholder="اكتب اسم الصنف" 
                     className="w-full p-2 rounded border text-sm"
                     value={newItem.code}
                     onChange={e => {
                       const val = e.target.value;
                       const p = products.find(p => p.name === val || p.code === val);
                       setNewItem(prev => ({ ...prev, code: p ? p.code : val, price: p ? p.price : 0 }));
                     }}
                   />
                   <datalist id="prodList">
                     {products.map(p => <option key={p.code} value={p.name}>{p.code}</option>)}
                   </datalist>
                 </div>
                 <div className="w-20">
                   <label className="text-xs font-bold text-blue-700">الكمية</label>
                   <input 
                     type="number" min="1" className="w-full p-2 rounded border text-sm text-center"
                     placeholder="الكمية"
                     value={newItem.quantity}
                     onChange={e => setNewItem(prev => ({ ...prev, quantity: e.target.value === '' ? '' : Number(e.target.value) }))}
                   />
                 </div>
                 <div className="w-24">
                   <label className="text-xs font-bold text-blue-700">السعر</label>
                   <input 
                     type="number" min="0" className="w-full p-2 rounded border text-sm text-center"
                     placeholder="السعر"
                     value={newItem.price}
                     onChange={e => setNewItem(prev => ({ ...prev, price: e.target.value === '' ? '' : Number(e.target.value) }))}
                   />
                 </div>
                 <button onClick={handleAddItem} className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700">
                   <Plus size={20}/>
                 </button>
              </div>

              {/* Items Table */}
              <table className="w-full text-right text-sm border rounded overflow-hidden">
                <thead className="bg-gray-100 font-bold text-gray-700">
                  <tr>
                    <th className="p-3">الصنف</th>
                    <th className="p-3 w-24">الكمية</th>
                    <th className="p-3 w-24">السعر</th>
                    <th className="p-3 w-24">الإجمالي</th>
                    <th className="p-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {editItems.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-3">{item.itemName}</td>
                      <td className="p-3">
                        <input 
                          type="number" className="w-16 p-1 border rounded text-center"
                          value={item.quantity}
                          onChange={e => handleUpdateItem(idx, 'quantity', Number(e.target.value))}
                        />
                      </td>
                      <td className="p-3">
                        <input 
                          type="number" className="w-20 p-1 border rounded text-center"
                          value={item.price}
                          onChange={e => handleUpdateItem(idx, 'price', Number(e.target.value))}
                        />
                      </td>
                      <td className="p-3 font-bold">{item.total.toLocaleString()}</td>
                      <td className="p-3">
                        <button onClick={() => handleRemoveItem(idx)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                          <Trash2 size={16}/>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Edit Payment Settings */}
              <div className="bg-emerald-50/80 p-4 rounded-xl border border-emerald-200 space-y-3">
                <h4 className="font-bold text-emerald-900 text-sm flex items-center gap-2">
                  <Coins size={16} /> تعديل بيانات السداد والخزنة
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-gray-700">المبلغ المدفوع نقداً (ج.م):</label>
                      {editPaidAmount && (
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                          {parseNumberFromCommas(editPaidAmount).toLocaleString()} ج.م
                        </span>
                      )}
                    </div>
                    <input 
                      type="text" 
                      dir="ltr"
                      inputMode="numeric"
                      value={editPaidAmount}
                      onChange={e => handleNumericChangeWithCommas(e.target.value, setEditPaidAmount)}
                      placeholder="0"
                      className="w-full p-2 border border-emerald-300 rounded font-bold text-emerald-800 bg-white font-mono text-center"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">طريقة السداد / الخزنة:</label>
                    <select
                      value={editPaymentMethod}
                      onChange={e => setEditPaymentMethod(e.target.value as PaymentMethod)}
                      className="w-full p-2 border border-emerald-300 rounded text-sm font-bold bg-white"
                    >
                      <option value="CASH">خزنة رئيسية (كاش نقدية)</option>
                      <option value="BANK_MISR">بنك مصر</option>
                      <option value="BANK_AHLY">البنك الأهلي</option>
                      <option value="VF_CASH_AYMAN">فودافون كاش - أيمن</option>
                      <option value="VF_CASH_KYRILLOS">فودافون كاش - كيرلس</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs font-bold pt-2 border-t border-emerald-200">
                  <span className="text-gray-600">المتبقي على الحساب (آجل):</span>
                  <span className="text-amber-800 text-sm font-mono">
                    {Math.max(0, editItems.reduce((s, i) => s + i.total, 0) - editPaidAmount).toLocaleString()} ج.م
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-100 border-t flex justify-between items-center shrink-0">
               <div className="text-lg font-bold text-gray-800">
                 الإجمالي الجديد: <span className="text-blue-700">{editItems.reduce((s, i) => s + i.total, 0).toLocaleString()} ج.م</span>
               </div>
               <button 
                 onClick={saveChanges}
                 className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 shadow-lg"
               >
                 <Save size={20}/> حفظ التعديلات
               </button>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in">
            <div className="bg-brand-600 p-4 flex justify-between items-center text-white">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <FileText size={20}/> تفاصيل الفاتورة {selectedInvoice.id}
              </h2>
              <button onClick={() => setSelectedInvoice(null)} className="hover:bg-brand-700 p-1 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-50 p-3 rounded-lg">
                   <span className="block text-gray-500 text-xs">العميل</span>
                   <span className="font-bold text-gray-800 text-lg">{selectedInvoice.customerName}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                   <span className="block text-gray-500 text-xs">التاريخ والوقت</span>
                   <span className="font-bold text-gray-800">{selectedInvoice.date} - {selectedInvoice.time}</span>
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
                    {selectedInvoice.items.map((item, idx) => (
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
                <div className="bg-gray-900 text-white p-5 rounded-xl w-full md:w-3/5 space-y-2">
                  <div className="flex justify-between items-center text-lg font-bold">
                     <span>إجمالي الفاتورة:</span>
                     <span className="font-mono text-xl">{selectedInvoice.total.toLocaleString()} ج.م</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-sm text-emerald-400 bg-gray-800 px-3 py-1.5 rounded">
                     <span>المدفوع نقداً ({getPaymentMethodLabel(selectedInvoice.paymentMethod)}):</span>
                     <span className="font-bold font-mono">{(selectedInvoice.paidAmount || 0).toLocaleString()} ج.م</span>
                  </div>

                  <div className="flex justify-between items-center text-sm text-amber-400 bg-gray-800 px-3 py-1.5 rounded">
                     <span>المتبقي (آجل):</span>
                     <span className="font-bold font-mono">
                       {((selectedInvoice.remainingAmount !== undefined ? selectedInvoice.remainingAmount : (selectedInvoice.total - (selectedInvoice.paidAmount || 0)))).toLocaleString()} ج.م
                     </span>
                  </div>

                  <div className="mt-2 pt-2 border-t border-gray-700 text-xs text-gray-400 flex justify-between">
                     <span>رصيد سابق: {selectedInvoice.previousBalance.toLocaleString()}</span>
                     <span className="font-bold text-gray-200">رصيد بعد الفاتورة: {selectedInvoice.currentBalance.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 border-t flex justify-end gap-3">
              <button 
                onClick={() => printInvoice(selectedInvoice)} 
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 flex items-center gap-2"
              >
                <Printer size={16}/> طباعة
              </button>
              <button 
                onClick={() => setSelectedInvoice(null)} 
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
