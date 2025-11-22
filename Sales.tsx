
import React, { useState, useEffect } from 'react';
import { useERP } from '../context/ERPContext';
import { FileText, Package, PlusCircle, Trash2, Save, ShoppingCart, CheckCircle, Printer, X, RefreshCcw } from 'lucide-react';
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
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 h-[calc(100vh-140px)]">
      
      {/* Invoice Entry Section (Left) */}
      <div className="xl:col-span-2 flex flex-col gap-6 h-full overflow-y-auto">
        
        {/* Top: Customer & Meta */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-brand-100">
          <div className="flex items-center gap-2 mb-4 text-brand-800 font-bold text-lg border-b pb-2">
            <FileText /> بيانات الفاتورة والعميل
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="text-xs font-bold text-brand-600 block mb-1">رقم الفاتورة</label>
              <input 
                type="text" 
                className="w-full p-2 border-2 border-brand-200 rounded bg-brand-50 font-mono font-bold text-brand-800 focus:border-brand-500 outline-none" 
                value={invoiceId} 
                onChange={e => setInvoiceId(e.target.value)} 
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 block mb-1">التاريخ</label>
              <input type="date" className="w-full p-2 border rounded bg-gray-50" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 block mb-1">الوقت</label>
              <input type="time" className="w-full p-2 border rounded bg-gray-50" value={invoiceTime} onChange={e => setInvoiceTime(e.target.value)} />
            </div>
            <div className="md:col-span-2 grid grid-cols-2 gap-2 bg-blue-50 p-2 rounded border border-blue-100">
               <div>
                 <label className="text-xs font-bold text-blue-700 block mb-1">اسم العميل</label>
                 <input 
                    type="text"
                    list="customerNamesList" 
                    className="w-full p-2 border rounded text-sm" 
                    value={customerName} 
                    onChange={e => handleCustomerNameChange(e.target.value)} 
                    placeholder="بحث بالاسم..."
                 />
                 <datalist id="customerNamesList">
                   {customers.map(c => <option key={c.code} value={c.name}>{c.code}</option>)}
                 </datalist>
               </div>
               <div>
                 <label className="text-xs font-bold text-blue-700 block mb-1">كود العميل</label>
                 <input 
                    type="text" 
                    list="customers"
                    className="w-full p-2 border rounded text-sm font-mono"
                    value={customerCode}
                    onChange={e => handleCustomerCode(e.target.value)}
                    placeholder="الكود..."
                  />
                  <datalist id="customers">
                    {customers.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                  </datalist>
               </div>
               <div className="col-span-2 flex justify-between items-center px-2 mt-1">
                 <span className="text-xs text-blue-600">الرصيد الحالي:</span>
                 <span className={`font-bold ${customerBalance < 0 ? 'text-red-600' : 'text-green-600'}`} dir="ltr">
                   {customerBalance.toLocaleString()}
                 </span>
               </div>
            </div>
          </div>
        </div>

        {/* Middle: Item Entry */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-brand-100">
           <div className="flex items-center gap-2 mb-4 text-orange-700 font-bold text-lg border-b pb-2">
            <Package /> إضافة أصناف
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-2">
               <label className="text-xs font-bold text-gray-500 block mb-1">كود الصنف</label>
               <input 
                  type="text" 
                  list="products"
                  className="w-full p-2 border rounded focus:ring-2 ring-brand-400"
                  value={currentItem.itemCode}
                  onChange={e => handleItemCode(e.target.value)}
                  placeholder="كود"
                />
                <datalist id="products">
                  {products.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
                </datalist>
            </div>
            <div className="md:col-span-4">
              <label className="text-xs font-bold text-gray-500 block mb-1">اسم الصنف</label>
              <input type="text" className="w-full p-2 border rounded bg-gray-50" value={currentItem.itemName} readOnly />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-bold text-gray-500 block mb-1">الكمية (المتاح: {currentStock})</label>
              <input 
                type="number" 
                className="w-full p-2 border rounded font-bold text-center" 
                min="1" 
                max={currentStock}
                value={currentItem.quantity}
                onChange={e => setCurrentItem({...currentItem, quantity: Number(e.target.value)})}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-bold text-gray-500 block mb-1">السعر</label>
              <input 
                type="number" 
                className="w-full p-2 border rounded text-center" 
                value={currentItem.price}
                onChange={e => setCurrentItem({...currentItem, price: Number(e.target.value)})}
              />
            </div>
            <div className="md:col-span-2">
              <button 
                onClick={addToCart}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 px-4 rounded flex items-center justify-center gap-2 font-bold transition-colors"
              >
                <PlusCircle size={18} /> إضافة
              </button>
            </div>
          </div>
        </div>

        {/* Bottom: Cart Table */}
        <div className="bg-white rounded-xl shadow-sm border border-brand-100 flex-1 flex flex-col">
          <div className="p-4 bg-brand-50 border-b border-brand-100 font-bold text-brand-800 flex justify-between items-center">
            <span className="flex items-center gap-2"><ShoppingCart size={20}/> محتويات الفاتورة</span>
            <span className="bg-white px-3 py-1 rounded-full text-sm border">عدد الأصناف: {cartItems.length}</span>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-right">
              <thead className="bg-gray-50 text-gray-600 text-sm sticky top-0">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">الصنف</th>
                  <th className="p-3">الكمية</th>
                  <th className="p-3">السعر</th>
                  <th className="p-3">الإجمالي</th>
                  <th className="p-3">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cartItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="p-3 text-gray-400 text-sm">{idx + 1}</td>
                    <td className="p-3 font-medium">{item.itemName}</td>
                    <td className="p-3 font-bold">{item.quantity}</td>
                    <td className="p-3">{item.price.toLocaleString()}</td>
                    <td className="p-3 font-bold text-brand-600">{item.total.toLocaleString()}</td>
                    <td className="p-3">
                      <button onClick={() => removeFromCart(idx)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {cartItems.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-gray-400">
                      لم يتم إضافة أصناف للفاتورة بعد
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Summary & Actions Section (Right Side) */}
      <div className="xl:col-span-1 flex flex-col gap-6">
        {/* Totals Card */}
        <div className="bg-gray-900 text-white p-6 rounded-xl shadow-lg space-y-4">
           <h3 className="text-lg font-bold border-b border-gray-700 pb-2 text-gray-300">ملخص الحساب (آجل)</h3>
           
           {/* Invoice Total */}
           <div className="flex justify-between items-center text-gray-300">
             <span>إجمالي الفاتورة</span>
             <span className="font-mono text-xl text-white">{cartTotal.toLocaleString()}</span>
           </div>

           <div className="pt-2 space-y-2 border-t border-gray-700 mt-2">
             <div className="flex justify-between items-center text-sm text-gray-400">
               <span>رصيد العميل السابق</span>
               <span className="font-mono" dir="ltr">{customerBalance.toLocaleString()}</span>
             </div>
             
             <div className="flex justify-between items-center text-sm text-red-400">
                <span>إضافة للدين (سحب آجل)</span>
                <span className="font-mono font-bold">{cartTotal.toLocaleString()} -</span>
             </div>

             <div className="flex justify-between items-center bg-gray-800 p-2 rounded mt-2">
               <span className="font-bold text-yellow-400">الرصيد النهائي المتوقع</span>
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
                 {invoices.map(inv => (
                   <tr key={inv.id} className="hover:bg-gray-50">
                     <td className="p-2 text-xs font-mono text-gray-500">{inv.id}</td>
                     <td className="p-2">{inv.customerName}</td>
                     <td className="p-2 font-bold text-gray-800">{inv.total.toLocaleString()}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
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
