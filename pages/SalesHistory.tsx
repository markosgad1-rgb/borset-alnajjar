
import React, { useState, useEffect } from 'react';
import { useERP } from '../context/ERPContext';
import { Calendar, Search, FileText, X, Printer, Trash2, Check, AlertTriangle, Edit, Plus, Save } from 'lucide-react';
import { SalesInvoice, InvoiceItem } from '../types';

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
  
  // New Item for Edit Modal
  const [newItem, setNewItem] = useState<{ code: string, quantity: number, price: number }>({
    code: '', quantity: 1, price: 0
  });

  const filteredInvoices = invoices.filter(inv => {
    const matchesDate = inv.date === selectedDate;
    const matchesSearch = 
      inv.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
      inv.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesDate && matchesSearch;
  });

  const dayTotal = filteredInvoices.reduce((sum, inv) => sum + inv.total, 0);

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
    setIsEditing(true);
  };

  const handleAddItem = () => {
    if (!newItem.code || newItem.quantity <= 0) return;
    const product = products.find(p => p.code === newItem.code);
    if (!product) return;

    const existingIdx = editItems.findIndex(i => i.itemCode === newItem.code);
    if (existingIdx >= 0) {
      const updated = [...editItems];
      updated[existingIdx].quantity += newItem.quantity;
      updated[existingIdx].total = updated[existingIdx].quantity * updated[existingIdx].price;
      setEditItems(updated);
    } else {
      setEditItems(prev => [...prev, {
        itemCode: product.code,
        itemName: product.name,
        quantity: newItem.quantity,
        price: newItem.price || product.price,
        total: newItem.quantity * (newItem.price || product.price)
      }]);
    }
    setNewItem({ code: '', quantity: 1, price: 0 });
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
    
    const newInvoiceData: SalesInvoice = {
      ...oldInvoice,
      date: editDate,
      time: editTime,
      items: editItems,
      total: newTotal,
      // Recalculate balance impact: 
      // Previous balance remains what it was BEFORE the original invoice.
      // Current Balance = Previous Balance - New Total
      currentBalance: oldInvoice.previousBalance - newTotal
    };

    await updateInvoice(oldInvoice, newInvoiceData);
    setIsEditing(false);
    alert("تم تعديل الفاتورة وتصحيح المخزن والرصيد بنجاح");
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

          <div className="bg-brand-50 p-3 rounded-lg border border-brand-200 text-center min-w-[200px]">
             <span className="block text-xs text-brand-600 mb-1">إجمالي مبيعات اليوم</span>
             <span className="block text-xl font-bold text-brand-900">{dayTotal.toLocaleString()} ج.م</span>
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
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-4"># الرقم</th>
                <th className="p-4">الوقت</th>
                <th className="p-4">العميل</th>
                <th className="p-4">عدد الأصناف</th>
                <th className="p-4">الإجمالي</th>
                <th className="p-4">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-mono font-bold text-brand-700">{inv.id}</td>
                  <td className="p-4 text-gray-500 text-sm">{inv.time}</td>
                  <td className="p-4 font-bold text-gray-800">{inv.customerName}</td>
                  <td className="p-4 text-sm text-gray-600">{inv.items.length} صنف</td>
                  <td className="p-4 font-bold text-emerald-600">{inv.total.toLocaleString()}</td>
                  <td className="p-4 flex gap-2 items-center">
                    <button 
                      onClick={() => setSelectedInvoice(inv)}
                      className="bg-brand-100 text-brand-700 hover:bg-brand-200 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                      title="عرض التفاصيل"
                    >
                      <FileText size={16} />
                    </button>

                    <button 
                      onClick={() => openEditModal(inv)}
                      className="bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                      title="تعديل الفاتورة"
                    >
                      <Edit size={16} />
                    </button>

                    {deleteConfirmId === inv.id ? (
                      <div className="flex items-center gap-2 bg-red-50 p-1 rounded border border-red-100 animate-fade-in">
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
              ))}
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-gray-400 flex flex-col items-center gap-2">
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
                       // Try to find product code by name or code
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
                     value={newItem.quantity}
                     onChange={e => setNewItem(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                   />
                 </div>
                 <div className="w-24">
                   <label className="text-xs font-bold text-blue-700">السعر</label>
                   <input 
                     type="number" min="0" className="w-full p-2 rounded border text-sm text-center"
                     value={newItem.price}
                     onChange={e => setNewItem(prev => ({ ...prev, price: Number(e.target.value) }))}
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
                <div className="bg-gray-900 text-white p-4 rounded-xl w-full md:w-1/2">
                  <div className="flex justify-between items-center text-lg font-bold">
                     <span>إجمالي الفاتورة</span>
                     <span>{selectedInvoice.total.toLocaleString()} ج.م</span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-700 text-xs text-gray-400 flex justify-between">
                     <span>رصيد سابق: {selectedInvoice.previousBalance.toLocaleString()}</span>
                     <span>رصيد بعد الفاتورة: {selectedInvoice.currentBalance.toLocaleString()}</span>
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
