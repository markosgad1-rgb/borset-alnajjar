
import React, { useState, useEffect } from 'react';
import { useERP } from '../context/ERPContext';
import { FileText, Package, PlusCircle, Trash2, Save, ShoppingCart, CheckCircle, Printer, X, RefreshCcw, User, Calendar, Clock } from 'lucide-react';
import { InvoiceItem, SalesInvoice } from '../types';

export const Sales: React.FC = () => {
  const { addInvoice, products, customers, invoices, printInvoice } = useERP();
  
  // Main Invoice State
  const [invoiceId, setInvoiceId] = useState('N001');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceTime, setInvoiceTime] = useState(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
  const [customerCode, setCustomerCode] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerBalance, setCustomerBalance] = useState(0);
  
  // Cart Item State
  const [currentItem, setCurrentItem] = useState<{
    itemCode: string;
    itemName: string;
    quantity: number;
    price: number;
  }>({
    itemCode: '',
    itemName: '',
    quantity: 1,
    price: 0
  });

  const [currentStock, setCurrentStock] = useState(0);
  const [cartItems, setCartItems] = useState<InvoiceItem[]>([]);

  // Post-Save State
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastSavedInvoice, setLastSavedInvoice] = useState<SalesInvoice | null>(null);

  // Auto-generate Invoice ID
  useEffect(() => {
    if (invoices.length === 0) {
      setInvoiceId('N001');
    } else {
      const nIds = invoices
        .filter(inv => inv.id.startsWith('N'))
        .map(inv => parseInt(inv.id.replace(/\D/g, '')))
        .filter(num => !isNaN(num));

      if (nIds.length > 0) {
        const maxId = Math.max(...nIds);
        setInvoiceId(`N${(maxId + 1).toString().padStart(3, '0')}`);
      } else {
        setInvoiceId('N001');
      }
    }
  }, [invoices]);

  // Calculated Totals
  const cartTotal = cartItems.reduce((sum, item) => sum + item.total, 0);
  const newBalance = customerBalance - cartTotal;

  // Handle Customer Selection (By Code)
  const handleCustomerCode = (code: string) => {
    setCustomerCode(code);
    const customer = customers.find(c => c.code === code);
    if (customer) {
      setCustomerName(customer.name);
      setCustomerBalance(customer.balance);
    } else {
      setCustomerName('');
      setCustomerBalance(0);
    }
  };

  // Handle Customer Selection (By Name)
  const handleCustomerNameChange = (name: string) => {
    setCustomerName(name);
    const customer = customers.find(c => c.name === name);
    if (customer) {
      setCustomerCode(customer.code);
      setCustomerBalance(customer.balance);
    }
  };

  // Handle Item Selection
  const handleItemCode = (code: string) => {
    const product = products.find(p => p.code === code);
    if (product) {
      setCurrentItem(prev => ({
        ...prev,
        itemCode: code,
        itemName: product.name,
        price: product.price
      }));
      setCurrentStock(product.quantity);
    } else {
      setCurrentItem(prev => ({ ...prev, itemCode: code, itemName: '', price: 0 }));
      setCurrentStock(0);
    }
  };

  // Add Item to Cart
  const addToCart = () => {
    if (!currentItem.itemCode || !currentItem.itemName) {
      alert("الرجاء اختيار صنف صحيح");
      return;
    }
    if (currentItem.quantity <= 0) {
      alert("الكمية يجب أن تكون أكبر من صفر");
      return;
    }
    if (currentItem.quantity > currentStock) {
      alert("الكمية المطلوبة غير متوفرة بالمخزن");
      return;
    }

    const existingItemIndex = cartItems.findIndex(i => i.itemCode === currentItem.itemCode);
    if (existingItemIndex >= 0) {
      const updatedCart = [...cartItems];
      updatedCart[existingItemIndex].quantity += currentItem.quantity;
      updatedCart[existingItemIndex].total = updatedCart[existingItemIndex].quantity * updatedCart[existingItemIndex].price;
      
      if (updatedCart[existingItemIndex].quantity > currentStock) {
         alert("مجموع الكمية في الفاتورة يتعدى رصيد المخزن");
         return;
      }
      
      setCartItems(updatedCart);
    } else {
      setCartItems(prev => [...prev, {
        ...currentItem,
        total: currentItem.quantity * currentItem.price
      }]);
    }

    setCurrentItem({ itemCode: '', itemName: '', quantity: 1, price: 0 });
    setCurrentStock(0);
  };

  const removeFromCart = (index: number) => {
    setCartItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveInvoice = () => {
    if (cartItems.length === 0) {
      alert("الفاتورة فارغة! أضف أصناف أولاً.");
      return;
    }
    if (!customerName) {
      alert("الرجاء اختيار عميل.");
      return;
    }
    if (!invoiceId) {
      alert("يجب تحديد رقم الفاتورة");
      return;
    }
    if (invoices.some(inv => inv.id === invoiceId)) {
      alert("رقم الفاتورة موجود بالفعل، الرجاء تغييره.");
      return;
    }

    const invoiceData = {
      id: invoiceId,
      date: invoiceDate,
      time: invoiceTime,
      customerCode,
      customerName,
      items: cartItems,
      total: cartTotal,
    };

    addInvoice(invoiceData);
    
    // Store for printing/modal
    setLastSavedInvoice({
      ...invoiceData,
      previousBalance: customerBalance,
      currentBalance: newBalance
    });
    setShowSuccessModal(true);

    // Clear Form
    setCartItems([]);
    setCustomerCode('');
    setCustomerName('');
    setCustomerBalance(0);
    setCurrentItem({ itemCode: '', itemName: '', quantity: 1, price: 0 });
  };

  const handleCloseModal = () => {
    setShowSuccessModal(false);
    setLastSavedInvoice(null);
  };

  const handlePrint = () => {
    if (lastSavedInvoice) {
      printInvoice(lastSavedInvoice);
    }
  };

  return (
    <div className="flex flex-col xl:grid xl:grid-cols-3 gap-6 h-auto xl:h-[calc(100vh-140px)] pb-28 xl:pb-0">
      
      {/* Invoice Entry Section (Left & Center on Desktop, Full on Mobile) */}
      <div className="xl:col-span-2 flex flex-col gap-4 xl:overflow-y-auto h-full">
        
        {/* 1. Customer & Invoice Info */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-brand-100">
          <div className="flex justify-between items-center mb-4 border-b pb-2">
            <h3 className="font-bold text-brand-800 flex items-center gap-2 text-sm md:text-base">
              <FileText size={18} /> بيانات الفاتورة
            </h3>
            <div className="flex gap-2">
               <span className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">{invoiceId}</span>
               <span className="bg-gray-100 px-2 py-1 rounded text-xs">{invoiceDate}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
             {/* Mobile: Compact ID/Date inputs */}
             <div className="grid grid-cols-2 gap-2 lg:hidden">
               <div>
                  <label className="text-[10px] font-bold text-gray-500 block mb-1">رقم الفاتورة</label>
                  <input type="text" className="w-full p-2 border rounded bg-gray-50 text-sm font-mono" value={invoiceId} onChange={e => setInvoiceId(e.target.value)} />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-gray-500 block mb-1">التاريخ</label>
                  <input type="date" className="w-full p-2 border rounded bg-gray-50 text-sm" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
               </div>
             </div>

             {/* Desktop: ID/Date/Time */}
             <div className="hidden lg:block">
                <label className="text-[10px] font-bold text-gray-500 block mb-1">رقم الفاتورة</label>
                <input type="text" className="w-full p-2 border rounded bg-gray-50 text-sm font-mono" value={invoiceId} onChange={e => setInvoiceId(e.target.value)} />
             </div>
             <div className="hidden lg:block">
                <label className="text-[10px] font-bold text-gray-500 block mb-1">التاريخ</label>
                <input type="date" className="w-full p-2 border rounded bg-gray-50 text-sm" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
             </div>
             
             {/* Customer Selection */}
             <div className="col-span-1 md:col-span-2 lg:col-span-2 bg-blue-50 p-2 rounded border border-blue-100">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-blue-700 block mb-1 flex items-center gap-1"><User size={12}/> العميل</label>
                    <input 
                        type="text"
                        list="customerNamesList" 
                        className="w-full p-2 border rounded text-sm" 
                        value={customerName} 
                        onChange={e => handleCustomerNameChange(e.target.value)} 
                        placeholder="ابحث بالاسم"
                    />
                    <datalist id="customerNamesList">
                      {customers.map(c => <option key={c.code} value={c.name}>{c.code}</option>)}
                    </datalist>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-blue-700 block mb-1">كود</label>
                    <input 
                        type="text" 
                        list="customers"
                        className="w-full p-2 border rounded text-sm font-mono"
                        value={customerCode}
                        onChange={e => handleCustomerCode(e.target.value)}
                        placeholder="كود"
                      />
                      <datalist id="customers">
                        {customers.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                      </datalist>
                  </div>
                </div>
                <div className="mt-2 flex justify-between items-center text-xs">
                  <span className="text-blue-600">الرصيد:</span>
                  <span className={`font-bold ${customerBalance < 0 ? 'text-red-600' : 'text-green-600'}`} dir="ltr">
                    {customerBalance.toLocaleString()}
                  </span>
                </div>
             </div>
          </div>
        </div>

        {/* 2. Item Entry */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-brand-100">
           <div className="flex items-center gap-2 mb-3 text-orange-700 font-bold text-sm md:text-base border-b pb-2">
            <Package size={18} /> إضافة أصناف
          </div>
          <div className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-3 md:col-span-2">
               <label className="text-[10px] font-bold text-gray-500 block mb-1">كود</label>
               <input 
                  type="text" 
                  list="products"
                  className="w-full p-2 border rounded text-sm font-mono"
                  value={currentItem.itemCode}
                  onChange={e => handleItemCode(e.target.value)}
                />
                <datalist id="products">
                  {products.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
                </datalist>
            </div>
            
            <div className="col-span-9 md:col-span-4">
              <label className="text-[10px] font-bold text-gray-500 block mb-1">اسم الصنف</label>
              <input type="text" className="w-full p-2 border rounded bg-gray-50 text-sm" value={currentItem.itemName} readOnly />
            </div>

            <div className="col-span-4 md:col-span-2">
              <label className="text-[10px] font-bold text-gray-500 block mb-1">الكمية ({currentStock})</label>
              <input 
                type="number" 
                className="w-full p-2 border rounded font-bold text-center text-sm" 
                min="1" 
                max={currentStock}
                value={currentItem.quantity}
                onChange={e => setCurrentItem({...currentItem, quantity: Number(e.target.value)})}
              />
            </div>
            
            <div className="col-span-4 md:col-span-2">
              <label className="text-[10px] font-bold text-gray-500 block mb-1">السعر</label>
              <input 
                type="number" 
                className="w-full p-2 border rounded text-center text-sm" 
                value={currentItem.price}
                onChange={e => setCurrentItem({...currentItem, price: Number(e.target.value)})}
              />
            </div>

            <div className="col-span-4 md:col-span-2">
              <button 
                onClick={addToCart}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 px-1 rounded flex items-center justify-center gap-1 font-bold transition-colors text-sm"
              >
                <PlusCircle size={16} /> إضافة
              </button>
            </div>
          </div>
        </div>

        {/* 3. Cart Table */}
        <div className="bg-white rounded-xl shadow-sm border border-brand-100 flex-1 flex flex-col min-h-[200px]">
          <div className="p-3 bg-brand-50 border-b border-brand-100 font-bold text-brand-800 flex justify-between items-center text-sm">
            <span className="flex items-center gap-2"><ShoppingCart size={18}/> الأصناف</span>
            <span className="bg-white px-2 py-0.5 rounded-full text-xs border">{cartItems.length}</span>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-right text-sm">
              <thead className="bg-gray-50 text-gray-600 sticky top-0">
                <tr>
                  <th className="p-2 whitespace-nowrap">الصنف</th>
                  <th className="p-2 w-16 text-center">الكمية</th>
                  <th className="p-2 w-20">السعر</th>
                  <th className="p-2 w-24">الإجمالي</th>
                  <th className="p-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cartItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="p-2 font-medium">
                      <div className="flex flex-col">
                        <span>{item.itemName}</span>
                        <span className="text-[10px] text-gray-400 font-mono">{item.itemCode}</span>
                      </div>
                    </td>
                    <td className="p-2 font-bold text-center">{item.quantity}</td>
                    <td className="p-2">{item.price.toLocaleString()}</td>
                    <td className="p-2 font-bold text-brand-600">{item.total.toLocaleString()}</td>
                    <td className="p-2">
                      <button onClick={() => removeFromCart(idx)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {cartItems.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-400 text-sm">
                      الفاتورة فارغة
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 4. Desktop Sidebar (Summary & History) - Hidden on Mobile */}
      <div className="hidden xl:col-span-1 xl:flex flex-col gap-6">
        {/* Totals Card */}
        <div className="bg-gray-900 text-white p-6 rounded-xl shadow-lg space-y-4">
           <h3 className="text-lg font-bold border-b border-gray-700 pb-2 text-gray-300">ملخص الحساب</h3>
           <div className="flex justify-between items-center text-gray-300">
             <span>إجمالي الفاتورة</span>
             <span className="font-mono text-xl text-white">{cartTotal.toLocaleString()}</span>
           </div>
           <div className="pt-2 space-y-2 border-t border-gray-700 mt-2">
             <div className="flex justify-between items-center text-sm text-gray-400">
               <span>رصيد سابق</span>
               <span className="font-mono" dir="ltr">{customerBalance.toLocaleString()}</span>
             </div>
             <div className="flex justify-between items-center bg-gray-800 p-2 rounded mt-2">
               <span className="font-bold text-yellow-400">الرصيد المتوقع</span>
               <span className={`font-mono text-2xl font-bold ${newBalance < 0 ? 'text-red-400' : 'text-green-400'}`} dir="ltr">
                 {newBalance.toLocaleString()}
               </span>
             </div>
           </div>
           <button 
            onClick={handleSaveInvoice}
            className="w-full bg-brand-600 hover:bg-brand-500 text-white font-bold py-4 rounded-lg shadow-lg transition-all transform hover:scale-[1.02] flex justify-center items-center gap-2 mt-4"
           >
             <Save size={20} /> حفظ الفاتورة
           </button>
        </div>

        {/* Recent Invoices Mini List */}
        <div className="bg-white rounded-xl shadow-sm border border-brand-100 flex-1 overflow-hidden flex flex-col">
           <div className="p-4 border-b bg-gray-50 font-bold text-gray-700">أحدث الفواتير</div>
           <div className="overflow-y-auto flex-1">
             <table className="w-full text-right text-sm">
               <thead className="bg-gray-50 text-gray-500">
                 <tr>
                   <th className="p-2">رقم</th>
                   <th className="p-2">العميل</th>
                   <th className="p-2">الإجمالي</th>
                 </tr>
               </thead>
               <tbody className="divide-y">
                 {invoices.slice(0, 10).map(inv => (
                   <tr key={inv.id} className="hover:bg-gray-50">
                     <td className="p-2 text-xs font-mono text-gray-500">{inv.id}</td>
                     <td className="p-2 text-xs">{inv.customerName}</td>
                     <td className="p-2 font-bold text-gray-800 text-xs">{inv.total.toLocaleString()}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>
      </div>

      {/* 5. Mobile Sticky Footer (Totals & Save) - Only Visible on Mobile/Tablet */}
      <div className="xl:hidden fixed bottom-0 left-0 right-0 bg-gray-900 text-white p-3 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <div className="flex justify-between items-center gap-3">
          <div className="flex flex-col">
             <span className="text-xs text-gray-400">الإجمالي النهائي</span>
             <span className="font-bold text-xl font-mono text-yellow-400">{cartTotal.toLocaleString()} ج.م</span>
          </div>
          <button 
            onClick={handleSaveInvoice}
            className="flex-1 bg-brand-600 active:bg-brand-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg flex justify-center items-center gap-2"
          >
             <Save size={20} /> حفظ
          </button>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-8 text-center animate-fade-in">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">تم حفظ الفاتورة بنجاح!</h2>
            <p className="text-gray-500 mb-6">تم تسجيل الفاتورة كأجل وتحديث رصيد العميل والمخزن.</p>
            
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={handlePrint}
                className="bg-gray-800 hover:bg-gray-900 text-white py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <Printer size={20} /> طباعة
              </button>
              <button 
                onClick={handleCloseModal}
                className="bg-brand-600 hover:bg-brand-700 text-white py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <RefreshCcw size={20} /> فاتورة جديدة
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
