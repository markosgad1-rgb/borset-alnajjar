
import React, { useState, useEffect } from 'react';
import { useERP } from '../context/ERPContext';
import { Plus, Search, Trash2, Check, X, ShoppingCart, PlusCircle, Save, Eye, Edit, FileText, Printer, Truck } from 'lucide-react';
import { InvoiceItem, Purchase } from '../types';

export const Purchases: React.FC = () => {
  const { addPurchase, updatePurchase, purchases, products, suppliers, deletePurchase, currentUser, printPurchaseInvoice } = useERP();
  
  // Header State
  const [purchaseId, setPurchaseId] = useState('R001'); // Auto-generated ID
  const [supplierCode, setSupplierCode] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);

  // Current Item State
  const [currentItem, setCurrentItem] = useState({
    itemCode: '',
    itemName: '',
    quantity: 0,
    price: 0,
  });

  // Cart State
  const [cartItems, setCartItems] = useState<InvoiceItem[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // View/Edit Modal States
  const [viewPurchase, setViewPurchase] = useState<Purchase | null>(null);
  const [editPurchase, setEditPurchase] = useState<Purchase | null>(null);
  const [editItems, setEditItems] = useState<InvoiceItem[]>([]);
  const [editNewItem, setEditNewItem] = useState<{ code: string, quantity: number, price: number }>({ code: '', quantity: 1, price: 0 });

  const currentSupplier = suppliers.find(s => s.code === supplierCode);

  // Auto-generate Purchase ID (R001 series)
  useEffect(() => {
    if (purchases.length === 0) {
      setPurchaseId('R001');
    } else {
      const rIds = purchases
        .filter(p => p.id && p.id.startsWith('R'))
        .map(p => parseInt(p.id.replace(/\D/g, '')))
        .filter(num => !isNaN(num));

      if (rIds.length > 0) {
        const maxId = Math.max(...rIds);
        setPurchaseId(`R${(maxId + 1).toString().padStart(3, '0')}`);
      } else {
        setPurchaseId('R001');
      }
    }
  }, [purchases]);

  const handleSupplierChange = (name: string) => {
    const supplier = suppliers.find(s => s.name === name);
    if (supplier) {
      setSupplierName(name);
      setSupplierCode(supplier.code);
    } else {
      setSupplierName(name);
      setSupplierCode('');
    }
  };

  const handleProductCodeChange = (code: string) => {
    const product = products.find(p => p.code === code);
    if (product) {
      setCurrentItem(prev => ({ ...prev, itemCode: code, itemName: product.name }));
    } else {
      setCurrentItem(prev => ({ ...prev, itemCode: code }));
    }
  };

  const addToCart = () => {
    if (!currentItem.itemCode || !currentItem.itemName) {
      alert("الرجاء اختيار صنف صحيح");
      return;
    }
    if (currentItem.quantity <= 0) {
      alert("الكمية يجب أن تكون أكبر من صفر");
      return;
    }
    if (currentItem.price <= 0) {
      alert("الرجاء إدخال سعر الشراء");
      return;
    }

    const existingItemIndex = cartItems.findIndex(i => i.itemCode === currentItem.itemCode);
    if (existingItemIndex >= 0) {
      const updatedCart = [...cartItems];
      updatedCart[existingItemIndex].quantity += currentItem.quantity;
      updatedCart[existingItemIndex].total = updatedCart[existingItemIndex].quantity * updatedCart[existingItemIndex].price;
      setCartItems(updatedCart);
    } else {
      setCartItems(prev => [...prev, {
        ...currentItem,
        total: currentItem.quantity * currentItem.price
      }]);
    }

    setCurrentItem(prev => ({ ...prev, itemCode: '', itemName: '', quantity: 0, price: 0 }));
  };

  const removeFromCart = (index: number) => {
    setCartItems(prev => prev.filter((_, i) => i !== index));
  };

  const cartTotal = cartItems.reduce((sum, item) => sum + item.total, 0);
  
  // Calculate expected new balance for display
  // Logic: Supplier Balance (Positive = We Owe Him). New Purchase = We owe more.
  // New Balance = Current Balance + Invoice Total
  const currentBalance = currentSupplier ? currentSupplier.balance : 0;
  const expectedBalance = currentBalance + cartTotal;

  const handleSaveInvoice = () => {
    if (cartItems.length === 0) {
      alert("الفاتورة فارغة! أضف أصناف أولاً.");
      return;
    }
    if (!supplierCode) {
      if(!confirm("اسم المورد غير مسجل في قاعدة البيانات. هل تريد المتابعة بدون ربط الحساب؟ (لن يظهر في كشف حساب الموردين)")) {
        return;
      }
    }

    addPurchase({
      id: purchaseId, // Use auto-generated ID
      supplierCode: supplierCode || 'UNKNOWN',
      supplierName: supplierName,
      date: invoiceDate,
      total: cartTotal,
      items: cartItems
    });

    setCartItems([]);
    setSupplierName('');
    setSupplierCode('');
    setCurrentItem({ itemCode: '', itemName: '', quantity: 0, price: 0 });
    alert("تم حفظ فاتورة المشتريات وتحديث المخزن وحساب المورد");
  };

  const handleDelete = async (id: string) => {
    await deletePurchase(id);
    setDeleteConfirmId(null);
  };

  // --- Edit Logic ---
  const openEditModal = (purchase: Purchase) => {
    setEditPurchase({ ...purchase });
    setEditItems(purchase.items ? [...purchase.items] : [{
      itemCode: purchase.itemCode || '',
      itemName: purchase.itemName || '',
      quantity: purchase.quantity || 0,
      price: purchase.price || 0,
      total: purchase.total
    }]);
    setEditNewItem({ code: '', quantity: 1, price: 0 });
  };

  const handleEditAddItem = () => {
    if (!editNewItem.code || editNewItem.quantity <= 0 || editNewItem.price <= 0) return;
    const product = products.find(p => p.code === editNewItem.code);
    const itemName = product ? product.name : editNewItem.code;

    setEditItems(prev => {
      const existingIdx = prev.findIndex(i => i.itemCode === editNewItem.code);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx].quantity += editNewItem.quantity;
        updated[existingIdx].total = updated[existingIdx].quantity * updated[existingIdx].price; 
        return updated;
      }
      return [...prev, {
        itemCode: editNewItem.code,
        itemName: itemName,
        quantity: editNewItem.quantity,
        price: editNewItem.price,
        total: editNewItem.quantity * editNewItem.price
      }];
    });
    setEditNewItem({ code: '', quantity: 1, price: 0 });
  };

  const handleEditRemoveItem = (idx: number) => {
    setEditItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleEditUpdateItem = (idx: number, field: 'quantity' | 'price', value: number) => {
    setEditItems(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      updated[idx].total = updated[idx].quantity * updated[idx].price;
      return updated;
    });
  };

  const handleSaveEdit = async () => {
    if (!editPurchase) return;
    if (editItems.length === 0) return alert("لا يمكن حفظ فاتورة فارغة");

    const newTotal = editItems.reduce((sum, i) => sum + i.total, 0);
    const newPurchaseData: Purchase = {
      ...editPurchase,
      items: editItems,
      total: newTotal
    };

    await updatePurchase(editPurchase, newPurchaseData);
    setEditPurchase(null);
    alert("تم تعديل فاتورة المشتريات وتحديث المخزن وحساب المورد بنجاح");
  };

  return (
    <div className="space-y-8">
      {/* Purchase Entry Form */}
      <div className="bg-white rounded-xl shadow-sm border border-brand-100 p-6">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h3 className="text-xl font-bold text-brand-800 flex items-center gap-2">
            <PlusCircle className="bg-brand-100 p-1 rounded-full text-brand-600" size={28} />
            تسجيل فاتورة مشتريات (وارد)
          </h3>
          <span className="bg-blue-100 text-blue-800 font-mono font-bold px-3 py-1 rounded-lg border border-blue-200">
            {purchaseId}
          </span>
        </div>
        
        {/* Header Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6 pb-6 border-b">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">اسم المورد</label>
            <div className="relative">
              <input 
                type="text" 
                list="suppliersList"
                className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                placeholder="اسم المورد"
                value={supplierName}
                onChange={e => handleSupplierChange(e.target.value)}
              />
              <datalist id="suppliersList">
                {suppliers.map(s => <option key={s.code} value={s.name} />)}
              </datalist>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">تاريخ الفاتورة</label>
            <input 
              type="date" 
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
              value={invoiceDate}
              onChange={e => setInvoiceDate(e.target.value)}
            />
          </div>

          {/* Supplier Balance Info */}
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
             <div className="flex justify-between items-center text-sm mb-2">
                <span className="text-gray-500">رصيد سابق:</span>
                <span className={`font-bold ${currentBalance > 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {currentBalance.toLocaleString()}
                </span>
             </div>
             <div className="flex justify-between items-center text-sm font-bold pt-2 border-t border-gray-200">
                <span className="text-brand-800">رصيد حالي:</span>
                <span className={`font-mono text-lg ${expectedBalance > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {expectedBalance.toLocaleString()}
                </span>
             </div>
          </div>
        </div>

        {/* Item Entry Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-gray-500 mb-1">كود الصنف</label>
            <input 
              type="text" 
              list="productCodes"
              className="w-full p-2 border rounded font-mono text-sm"
              value={currentItem.itemCode}
              onChange={e => handleProductCodeChange(e.target.value)}
            />
            <datalist id="productCodes">
              {products.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
            </datalist>
          </div>
          <div className="md:col-span-4">
            <label className="block text-xs font-bold text-gray-500 mb-1">اسم الصنف</label>
            <input 
              type="text" 
              className="w-full p-2 border rounded text-sm"
              value={currentItem.itemName}
              onChange={e => setCurrentItem({...currentItem, itemName: e.target.value})}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-gray-500 mb-1">الكمية</label>
            <input 
              type="number" min="1"
              className="w-full p-2 border rounded text-sm text-center font-bold text-blue-600"
              value={currentItem.quantity || ''}
              onChange={e => setCurrentItem({...currentItem, quantity: Number(e.target.value)})}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-gray-500 mb-1">سعر الشراء</label>
            <input 
              type="number" min="0" step="0.01"
              className="w-full p-2 border rounded text-sm text-center"
              value={currentItem.price || ''}
              onChange={e => setCurrentItem({...currentItem, price: Number(e.target.value)})}
            />
          </div>
          <div className="md:col-span-2">
            <button 
              onClick={addToCart}
              className="w-full bg-brand-600 text-white p-2 rounded hover:bg-brand-700 flex items-center justify-center gap-1 font-bold text-sm"
            >
              <Plus size={16} /> إضافة
            </button>
          </div>
        </div>

        {/* Cart Table */}
        <div className="border rounded-lg overflow-hidden mb-6">
          <table className="w-full text-right text-sm">
            <thead className="bg-gray-100 text-gray-700 font-bold">
              <tr>
                <th className="p-3">الصنف</th>
                <th className="p-3 w-24">الكمية</th>
                <th className="p-3 w-24">السعر</th>
                <th className="p-3 w-32">الإجمالي</th>
                <th className="p-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {cartItems.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="p-3">{item.itemName} <span className="text-xs text-gray-400">({item.itemCode})</span></td>
                  <td className="p-3 font-bold">{item.quantity}</td>
                  <td className="p-3">{item.price.toLocaleString()}</td>
                  <td className="p-3 font-bold text-green-600">{item.total.toLocaleString()}</td>
                  <td className="p-3">
                    <button onClick={() => removeFromCart(idx)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                      <Trash2 size={16}/>
                    </button>
                  </td>
                </tr>
              ))}
              {cartItems.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-gray-400">لا توجد أصناف في الفاتورة</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer & Save */}
        <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg border border-gray-200">
           <div className="text-lg font-bold text-gray-700">
             إجمالي الفاتورة: <span className="text-2xl text-brand-700 mr-2">{cartTotal.toLocaleString()} ج.م</span>
           </div>
           <button 
             onClick={handleSaveInvoice}
             className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-bold shadow-md flex items-center gap-2"
           >
             <Save size={20} /> حفظ الفاتورة
           </button>
        </div>
      </div>

      {/* Purchases History */}
      <div className="bg-white rounded-xl shadow-sm border border-brand-100 overflow-hidden">
        <div className="p-6 border-b border-brand-50">
          <h3 className="text-lg font-bold text-brand-800">سجل المشتريات</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-brand-50 text-brand-700">
              <tr>
                <th className="p-4">رقم الفاتورة</th>
                <th className="p-4">التاريخ</th>
                <th className="p-4">المورد</th>
                <th className="p-4">الأصناف</th>
                <th className="p-4">إجمالي الفاتورة</th>
                <th className="p-4 w-40">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {purchases.map((purchase) => (
                <tr key={purchase.id} className="hover:bg-gray-50">
                  <td className="p-4 font-mono font-bold text-blue-600">{purchase.id}</td>
                  <td className="p-4 text-gray-600">{purchase.date}</td>
                  <td className="p-4 font-medium text-gray-800">{purchase.supplierName}</td>
                  <td className="p-4 text-gray-600 text-sm">
                    {purchase.items && purchase.items.length > 0 ? (
                      purchase.items.length > 1 
                        ? `${purchase.items[0].itemName} (+${purchase.items.length - 1} أصناف)`
                        : purchase.items[0].itemName
                    ) : (
                      `${purchase.itemName} (${purchase.itemCode})`
                    )}
                  </td>
                  <td className="p-4 text-emerald-600 font-bold">{purchase.total.toLocaleString()}</td>
                  <td className="p-4 flex gap-2 items-center">
                    <button 
                      onClick={() => setViewPurchase(purchase)}
                      className="text-brand-600 bg-brand-50 hover:bg-brand-100 p-2 rounded transition-colors"
                      title="عرض التفاصيل"
                    >
                      <Eye size={18} />
                    </button>

                    <button 
                      onClick={() => printPurchaseInvoice(purchase)}
                      className="text-gray-600 bg-gray-50 hover:bg-gray-100 p-2 rounded transition-colors"
                      title="طباعة"
                    >
                      <Printer size={18} />
                    </button>
                    
                    {currentUser?.permissions.canEditPurchases && (
                      <>
                        <button 
                          onClick={() => openEditModal(purchase)}
                          className="text-blue-600 bg-blue-50 hover:bg-blue-100 p-2 rounded transition-colors"
                          title="تعديل"
                        >
                          <Edit size={18} />
                        </button>
                        {deleteConfirmId === purchase.id ? (
                          <div className="flex items-center gap-2 bg-red-50 p-1.5 rounded-lg border border-red-100 shadow-sm animate-fade-in">
                             <button 
                               onClick={() => handleDelete(purchase.id)} 
                               className="bg-red-500 text-white p-1.5 rounded hover:bg-red-600 transition-colors shadow-sm" 
                               title="تأكيد الحذف"
                             >
                               <Check size={16}/>
                             </button>
                             <button 
                               onClick={() => setDeleteConfirmId(null)} 
                               className="bg-white text-gray-500 p-1.5 rounded border border-gray-200 hover:bg-gray-100 transition-colors" 
                               title="إلغاء"
                             >
                               <X size={16}/>
                             </button>
                           </div>
                        ) : (
                          <button 
                            onClick={() => setDeleteConfirmId(purchase.id)}
                            className="text-red-400 hover:bg-red-50 hover:text-red-600 p-2 rounded transition-colors"
                            title="حذف السجل"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {purchases.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400">لا توجد مشتريات مسجلة</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Purchase Modal */}
      {viewPurchase && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in">
            <div className="bg-brand-600 p-4 flex justify-between items-center text-white">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <FileText size={20}/> تفاصيل مشتريات #{viewPurchase.id}
              </h2>
              <button onClick={() => setViewPurchase(null)} className="hover:bg-brand-700 p-1 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="p-6">
               <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                 <div className="bg-gray-50 p-2 rounded">
                   <span className="text-xs text-gray-500 block">المورد</span>
                   <span className="font-bold">{viewPurchase.supplierName}</span>
                 </div>
                 <div className="bg-gray-50 p-2 rounded">
                   <span className="text-xs text-gray-500 block">التاريخ</span>
                   <span className="font-bold">{viewPurchase.date}</span>
                 </div>
               </div>
               
               <table className="w-full text-right text-sm border rounded overflow-hidden">
                 <thead className="bg-gray-100 font-bold">
                   <tr>
                     <th className="p-3">الصنف</th>
                     <th className="p-3">الكمية</th>
                     <th className="p-3">السعر</th>
                     <th className="p-3">الإجمالي</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y">
                   {(viewPurchase.items || [{ itemName: viewPurchase.itemName, itemCode: viewPurchase.itemCode, quantity: viewPurchase.quantity, price: viewPurchase.price, total: viewPurchase.total } as InvoiceItem]).map((item, idx) => (
                     <tr key={idx}>
                       <td className="p-3">{item.itemName}</td>
                       <td className="p-3">{item.quantity}</td>
                       <td className="p-3">{item.price}</td>
                       <td className="p-3 font-bold">{item.total.toLocaleString()}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>

               {viewPurchase.currentBalance !== undefined && (
                 <div className="mt-4 p-3 bg-gray-50 border rounded-lg flex justify-between items-center text-sm font-bold text-gray-600">
                    <div>رصيد المورد السابق: {viewPurchase.previousBalance?.toLocaleString()}</div>
                    <div className="text-brand-800">رصيد المورد الحالي: {viewPurchase.currentBalance?.toLocaleString()}</div>
                 </div>
               )}

               <div className="mt-4 flex justify-between items-center">
                 <button 
                    onClick={() => printPurchaseInvoice(viewPurchase)} 
                    className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold transition-colors"
                 >
                    <Printer size={18}/> طباعة
                 </button>
                 <div className="text-xl font-bold bg-gray-100 px-4 py-2 rounded text-brand-800">
                   الإجمالي: {viewPurchase.total.toLocaleString()} ج.م
                 </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Purchase Modal */}
      {editPurchase && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in">
            <div className="bg-blue-600 p-4 flex justify-between items-center text-white shrink-0">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Edit size={20}/> تعديل فاتورة مشتريات #{editPurchase.id}
              </h2>
              <button onClick={() => setEditPurchase(null)} className="hover:bg-blue-700 p-1 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="flex gap-4">
                 <div className="flex-1">
                   <label className="text-xs font-bold text-gray-500">التاريخ</label>
                   <input type="date" value={editPurchase.date} onChange={e => setEditPurchase({...editPurchase, date: e.target.value})} className="w-full p-2 border rounded"/>
                 </div>
                 <div className="flex-1">
                   <label className="text-xs font-bold text-gray-500">المورد</label>
                   <div className="p-2 bg-gray-100 rounded font-bold text-gray-700">{editPurchase.supplierName}</div>
                 </div>
              </div>

              {/* Add Items to Edit */}
              <div className="flex gap-2 items-end bg-blue-50 p-3 rounded-lg border border-blue-100">
                 <div className="flex-1">
                   <label className="text-xs font-bold text-blue-700">إضافة صنف</label>
                   <input 
                     type="text" list="prodListEdit" placeholder="كود أو اسم الصنف" 
                     className="w-full p-2 rounded border text-sm"
                     value={editNewItem.code}
                     onChange={e => {
                        const val = e.target.value;
                        const p = products.find(p => p.name === val || p.code === val);
                        setEditNewItem(prev => ({ ...prev, code: p ? p.code : val }));
                     }}
                   />
                   <datalist id="prodListEdit">
                     {products.map(p => <option key={p.code} value={p.name}>{p.code}</option>)}
                   </datalist>
                 </div>
                 <div className="w-20">
                   <label className="text-xs font-bold text-blue-700">الكمية</label>
                   <input type="number" min="1" className="w-full p-2 rounded border text-sm text-center" value={editNewItem.quantity} onChange={e => setEditNewItem({...editNewItem, quantity: Number(e.target.value)})} />
                 </div>
                 <div className="w-24">
                   <label className="text-xs font-bold text-blue-700">السعر</label>
                   <input type="number" min="0" className="w-full p-2 rounded border text-sm text-center" value={editNewItem.price} onChange={e => setEditNewItem({...editNewItem, price: Number(e.target.value)})} />
                 </div>
                 <button onClick={handleEditAddItem} className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700"><Plus size={20}/></button>
              </div>

              {/* Items List */}
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
                        <input type="number" className="w-16 p-1 border rounded text-center" value={item.quantity} onChange={e => handleEditUpdateItem(idx, 'quantity', Number(e.target.value))} />
                      </td>
                      <td className="p-3">
                        <input type="number" className="w-20 p-1 border rounded text-center" value={item.price} onChange={e => handleEditUpdateItem(idx, 'price', Number(e.target.value))} />
                      </td>
                      <td className="p-3 font-bold">{item.total.toLocaleString()}</td>
                      <td className="p-3">
                        <button onClick={() => handleEditRemoveItem(idx)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={16}/></button>
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
               <button onClick={handleSaveEdit} className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 shadow-lg">
                 <Save size={20}/> حفظ التعديلات
               </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
