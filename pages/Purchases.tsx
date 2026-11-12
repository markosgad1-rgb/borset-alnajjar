
import React, { useState, useEffect } from 'react';
import { useERP } from '../context/ERPContext';
import { Plus, Search, Trash2, Check, X, ShoppingCart, PlusCircle, Save, Eye, Edit, FileText, Printer, Truck, MessageCircle, Building, AlertTriangle, Clock, Calculator, Wallet, Building2, Smartphone } from 'lucide-react';
import { InvoiceItem, Purchase, BranchId, BRANCHES, PaymentMethod } from '../types';
import { formatWithCommas, parseNumberFromCommas, handleNumericChangeWithCommas } from '../utils/formatters';
import { useDialog } from '../utils/useDialog';
import { sharePurchaseInvoicePdfViaWhatsApp } from '../utils/whatsapp';

export const Purchases: React.FC = () => {
  const { addPurchase, updatePurchase, finalizePurchasePrice, purchases, products, suppliers, deletePurchase, deletePurchaseInvoice, currentUser, printPurchaseInvoice, companyLogo, calculateSupplierBalance } = useERP();
  const { confirm: askConfirm, notify, dialog } = useDialog();
  
  // PDF sharing state
  const [sharingPdfId, setSharingPdfId] = useState<string | null>(null);

  // Header State
  const [purchaseId, setPurchaseId] = useState('R001'); // Auto-generated ID
  const [selectedBranch, setSelectedBranch] = useState<BranchId>('MARG');
  const [supplierCode, setSupplierCode] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [isPricePending, setIsPricePending] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Payment State for Purchases
  const [paidAmountInput, setPaidAmountInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');

  // Current Item State
  const [currentItem, setCurrentItem] = useState<{
    itemCode: string;
    itemName: string;
    quantity: number | '';
    price: number | '' | string;
  }>({
    itemCode: '',
    itemName: '',
    quantity: '',
    price: '',
  });

  // Cart State
  const [cartItems, setCartItems] = useState<InvoiceItem[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // History Filter State
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'PRICED' | 'PENDING_PRICE'>('ALL');

  const itemCodeRef = React.useRef<HTMLInputElement>(null);
  const itemNameRef = React.useRef<HTMLInputElement>(null);
  const quantityRef = React.useRef<HTMLInputElement>(null);
  const priceRef = React.useRef<HTMLInputElement>(null);

  // View/Edit Modal States
  const [viewPurchase, setViewPurchase] = useState<Purchase | null>(null);
  const [editPurchase, setEditPurchase] = useState<Purchase | null>(null);
  const [editItems, setEditItems] = useState<InvoiceItem[]>([]);
  const [editNewItem, setEditNewItem] = useState<{ code: string, quantity: number | '', price: number | '' }>({ code: '', quantity: '', price: '' });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editPaidAmountInput, setEditPaidAmountInput] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState<PaymentMethod>('CASH');

  // Edit Modal Calculated Values
  const editTotal = editItems.reduce((sum, item) => sum + item.total, 0);
  const editPaidVal = parseNumberFromCommas(editPaidAmountInput);
  const editRemaining = Math.max(0, editTotal - editPaidVal);

  // Pricing Modal State for Pending Invoices
  const [pricingPurchase, setPricingPurchase] = useState<Purchase | null>(null);
  const [pricingItems, setPricingItems] = useState<InvoiceItem[]>([]);
  const [isFinalizing, setIsFinalizing] = useState(false);

  const currentSupplier = suppliers.find(s => s.code === supplierCode);

  const canEditPurchases = !currentUser || currentUser?.role === 'ADMIN' || currentUser?.username === 'admin' || Boolean(currentUser?.permissions?.canEditPurchases);
  const canDeletePurchases = !currentUser || currentUser?.role === 'ADMIN' || currentUser?.username === 'admin' || Boolean(currentUser?.permissions?.canDeletePurchases || currentUser?.permissions?.canEditPurchases);

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
      setCurrentItem(prev => ({ 
        ...prev, 
        itemCode: code, 
        itemName: product.name,
        quantity: '',
        price: product.cost ? product.cost : ''
      }));
      setTimeout(() => {
        quantityRef.current?.focus();
        quantityRef.current?.select();
      }, 50);
    } else {
      setCurrentItem(prev => ({ ...prev, itemCode: code, quantity: '', price: '' }));
    }
  };

  const handleProductNameChange = (name: string) => {
    const product = products.find(p => p.name === name);
    if (product) {
      setCurrentItem(prev => ({ 
        ...prev, 
        itemCode: product.code, 
        itemName: name,
        quantity: '',
        price: product.cost ? product.cost : ''
      }));
      setTimeout(() => {
        quantityRef.current?.focus();
        quantityRef.current?.select();
      }, 50);
    } else {
      setCurrentItem(prev => ({ ...prev, itemName: name }));
    }
  };

  const addToCart = () => {
    const qty = typeof currentItem.quantity === 'number' ? currentItem.quantity : (currentItem.quantity ? Number(currentItem.quantity) : 0);
    const rawPrice = currentItem.price;
    const price = isPricePending 
      ? (typeof rawPrice === 'number' ? Math.max(0, rawPrice) : (rawPrice ? parseNumberFromCommas(rawPrice) : 0))
      : (typeof rawPrice === 'number' ? rawPrice : parseNumberFromCommas(rawPrice));

    if (!currentItem.itemCode || !currentItem.itemName) {
      notify("الرجاء اختيار صنف صحيح");
      itemCodeRef.current?.focus();
      return;
    }
    if (qty <= 0) {
      notify("الكمية يجب أن تكون أكبر من صفر");
      quantityRef.current?.focus();
      return;
    }
    if (!isPricePending && price <= 0) {
      notify("الرجاء إدخال سعر الشراء (أو قم بتفعيل خيار 'سعر معلّق' إذا لم يتم الاتفاق على السعر بعد)");
      priceRef.current?.focus();
      return;
    }

    const itemPrice = isPricePending ? Math.max(0, price || 0) : price;
    const itemTotal = qty * itemPrice;

    const existingItemIndex = cartItems.findIndex(i => i.itemCode === currentItem.itemCode);
    if (existingItemIndex >= 0) {
      const updatedCart = [...cartItems];
      updatedCart[existingItemIndex].quantity += qty;
      updatedCart[existingItemIndex].price = itemPrice;
      updatedCart[existingItemIndex].total = updatedCart[existingItemIndex].quantity * itemPrice;
      setCartItems(updatedCart);
    } else {
      setCartItems(prev => [...prev, {
        itemCode: currentItem.itemCode,
        itemName: currentItem.itemName,
        quantity: qty,
        price: itemPrice,
        total: itemTotal
      }]);
    }

    // Reset item with empty quantity and price immediately
    setCurrentItem({ itemCode: '', itemName: '', quantity: '', price: '' });
    setTimeout(() => {
      itemCodeRef.current?.focus();
      itemCodeRef.current?.select();
    }, 60);
  };

  const removeFromCart = (index: number) => {
    setCartItems(prev => prev.filter((_, i) => i !== index));
  };

  const cartTotal = cartItems.reduce((sum, item) => sum + item.total, 0);
  
  // Payment calculations
  const paidAmountVal = isPricePending ? 0 : parseNumberFromCommas(paidAmountInput);
  const remainingOnInvoice = Math.max(0, cartTotal - paidAmountVal);

  // Calculate expected new balance for display
  const currentBalance = currentSupplier ? calculateSupplierBalance(currentSupplier, purchases) : 0;
  const expectedBalance = isPricePending ? currentBalance : (currentBalance - cartTotal + paidAmountVal);

  const handleSaveInvoice = async () => {
    if (isSubmitting) return;

    if (cartItems.length === 0) {
      notify("الفاتورة فارغة! أضف أصناف أولاً.");
      return;
    }
    if (!supplierCode) {
      if (!await askConfirm("اسم المورد غير مسجل في قاعدة البيانات. هل تريد المتابعة بدون ربط الحساب؟ (لن يظهر في كشف حساب الموردين)")) {
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await addPurchase({
        id: purchaseId, // Use auto-generated ID
        branchId: selectedBranch,
        supplierCode: supplierCode || 'UNKNOWN',
        supplierName: supplierName,
        date: invoiceDate,
        total: isPricePending ? 0 : cartTotal,
        items: cartItems,
        pricingStatus: isPricePending ? 'PENDING_PRICE' : 'PRICED',
        paid: isPricePending ? 0 : paidAmountVal,
        paidAmount: isPricePending ? 0 : paidAmountVal,
        remaining: isPricePending ? 0 : remainingOnInvoice,
        remainingAmount: isPricePending ? 0 : remainingOnInvoice,
        paymentMethod: (!isPricePending && paidAmountVal > 0) ? paymentMethod : undefined
      });

      setCartItems([]);
      setSupplierName('');
      setSupplierCode('');
      setCurrentItem({ itemCode: '', itemName: '', quantity: '', price: '' });
      setIsPricePending(false);
      setPaidAmountInput('');
      setPaymentMethod('CASH');
      notify(isPricePending 
        ? "تم حفظ فاتورة المشتريات (سعر معلّق) وإدخال الكميات للمخزن بنجاح دون قيد مديونية للمورد لحين تحديد السعر." 
        : paidAmountVal > 0
        ? `تم حفظ فاتورة المشتريات وسداد دفعة قدرها ${paidAmountVal.toLocaleString()} ج.م وتحديث الخزينة وحساب المورد بنجاح.`
        : "تم حفظ فاتورة المشتريات وتحديث المخزن وحساب المورد بنجاح."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Pricing Modal for Pending Invoices ---
  const openPricingModal = (purchase: Purchase) => {
    setPricingPurchase(purchase);
    const items = (purchase.items || []).map(item => ({
      ...item,
      price: item.price || 0,
      total: item.total || 0
    }));
    setPricingItems(items);
  };

  const handlePricingPriceChange = (index: number, newPrice: number) => {
    setPricingItems(prev => {
      const copy = [...prev];
      const p = Math.max(0, newPrice);
      copy[index] = {
        ...copy[index],
        price: p,
        total: copy[index].quantity * p
      };
      return copy;
    });
  };

  const handleFinalizePricing = async () => {
    if (!pricingPurchase || isFinalizing) return;

    // Check that all items have price > 0
    const hasZero = pricingItems.some(item => !item.price || Number(item.price) <= 0);
    if (hasZero) {
      notify("يرجى إدخال سعر شراء صحيح (أكبر من صفر) لجميع الأصناف في الفاتورة");
      return;
    }

    const newTotal = pricingItems.reduce((sum, item) => sum + item.total, 0);

    setIsFinalizing(true);
    try {
      const success = await finalizePurchasePrice(pricingPurchase.id, pricingItems, newTotal);
      if (success) {
        notify(`تم اعتماد وتسعير فاتورة المشتريات #${pricingPurchase.id} بنجاح!\nالإجمالي الجديد: ${newTotal.toLocaleString()} ج.م، وتم ترحيل المديونية لحساب المورد وتحديث تكلفة الأصناف بالمخزن.`);
        setPricingPurchase(null);
      }
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleDelete = async (id: string) => {
    const p = purchases.find(x => x.id === id);
    const confirmMsg = `هل أنت متأكد من حذف فاتورة المشتريات #${id}${p?.supplierName ? ` للمورد (${p.supplierName})` : ''} نهائياً؟\n\nسيتم:\n1. خصم كميات الأصناف من المخزن لمنع تضخم الرصيد.\n2. حذف الفاتورة وبنودها من كشف حساب المورد وإعادة ضبط الرصيد.\n3. إلغاء أي دفعة مسددة من الخزينة إن وُجدت.`;
    if (!await askConfirm(confirmMsg)) return;

    try {
      await deletePurchase(id);
      notify(`تم حذف فاتورة المشتريات #${id} بنجاح وتحديث المخزن وحساب المورد والخزينة.`);
    } catch (err: any) {
      console.error(err);
      notify("حدث خطأ أثناء حذف الفاتورة: " + (err.message || ""));
    }
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
    const initialPaid = Number(purchase.paidAmount ?? purchase.paid ?? 0);
    setEditPaidAmountInput(initialPaid > 0 ? formatWithCommas(initialPaid) : '');
    setEditPaymentMethod(purchase.paymentMethod || 'CASH');
  };

  const handleEditAddItem = () => {
    const qty = Number(editNewItem.quantity) || 0;
    const prc = Number(editNewItem.price) || 0;
    if (!editNewItem.code || qty <= 0 || prc <= 0) return;
    const product = products.find(p => p.code === editNewItem.code);
    const itemName = product ? product.name : editNewItem.code;

    setEditItems(prev => {
      const existingIdx = prev.findIndex(i => i.itemCode === editNewItem.code);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx].quantity += qty;
        updated[existingIdx].total = updated[existingIdx].quantity * updated[existingIdx].price; 
        return updated;
      }
      return [...prev, {
        itemCode: editNewItem.code,
        itemName: itemName,
        quantity: qty,
        price: prc,
        total: qty * prc
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
    if (!editPurchase || isSavingEdit) return;
    if (editItems.length === 0) return notify("لا يمكن حفظ فاتورة فارغة");

    const newTotal = editItems.reduce((sum, i) => sum + i.total, 0);
    const newPaidAmount = parseNumberFromCommas(editPaidAmountInput);
    const newRemaining = Math.max(0, newTotal - newPaidAmount);

    const newPurchaseData: Purchase = {
      ...editPurchase,
      items: editItems,
      total: newTotal,
      paid: newPaidAmount,
      paidAmount: newPaidAmount,
      remaining: newRemaining,
      remainingAmount: newRemaining,
      paymentMethod: newPaidAmount > 0 ? editPaymentMethod : undefined
    };

    setIsSavingEdit(true);
    try {
      await updatePurchase(editPurchase, newPurchaseData);
      setEditPurchase(null);
      notify(newPaidAmount > 0 
        ? `تم تعديل فاتورة المشتريات وتحديث دفعة السداد (${newPaidAmount.toLocaleString()} ج.م) والمخزن وحساب المورد والخزينة بنجاح`
        : "تم تعديل فاتورة المشتريات وتحديث المخزن وحساب المورد بنجاح"
      );
    } finally {
      setIsSavingEdit(false);
    }
  };

  const activePurchases = purchases.filter(p => !p.isDeleted);
  const pendingPurchasesCount = activePurchases.filter(p => p.pricingStatus === 'PENDING_PRICE').length;
  const pricedPurchasesCount = activePurchases.filter(p => p.pricingStatus !== 'PENDING_PRICE').length;

  const filteredPurchases = activePurchases
    .filter(p => {
      if (historyFilter === 'PENDING_PRICE') return p.pricingStatus === 'PENDING_PRICE';
      if (historyFilter === 'PRICED') return p.pricingStatus !== 'PENDING_PRICE';
      return true;
    })
    .sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : (a.date ? new Date(a.date).getTime() : 0);
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : (b.date ? new Date(b.date).getTime() : 0);
      if (dateB !== dateA) return dateB - dateA;
      const numA = parseInt((a.id || '').replace(/\D/g, '')) || 0;
      const numB = parseInt((b.id || '').replace(/\D/g, '')) || 0;
      return numB - numA;
    });

  return (
    <div className="space-y-8">
      {/* Alert Banner for pending price purchases */}
      {pendingPurchasesCount > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-xs shrink-0">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h4 className="font-bold text-amber-900 text-sm md:text-base flex items-center gap-2">
                <span>تنبيه: فواتير مشتريات معلقة السعر</span>
                <span className="bg-amber-200 text-amber-900 text-xs px-2 py-0.5 rounded-full font-black">
                  {pendingPurchasesCount}
                </span>
              </h4>
              <p className="text-xs md:text-sm text-amber-800">
                يوجد لديك عدد ({pendingPurchasesCount}) فواتير مشتريات معلقة لم يتم تحديد سعر الشراء لها بعد! دخلت الكميات للمخزن ولكن لم تُسجل المديونية للموردين حتى الآن.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setHistoryFilter('PENDING_PRICE')}
            className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-xs md:text-sm font-bold shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Clock size={16} />
            <span>عرض الفواتير المعلقة</span>
          </button>
        </div>
      )}

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
        
        {/* Pending Price Option Checkbox Card */}
        <div className={`mb-6 p-4 rounded-xl border-2 transition-all ${
          isPricePending 
            ? 'bg-amber-50 border-amber-400 shadow-xs' 
            : 'bg-gray-50/70 border-dashed border-gray-300 hover:border-gray-400'
        }`}>
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input 
              type="checkbox"
              checked={isPricePending}
              onChange={e => setIsPricePending(e.target.checked)}
              className="mt-1 w-5 h-5 text-amber-600 rounded border-gray-300 focus:ring-amber-500 cursor-pointer"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={`font-black text-sm md:text-base ${isPricePending ? 'text-amber-950' : 'text-gray-800'}`}>
                  فاتورة مشتريات معلّقة السعر (استلام بضاعة قبل الاتفاق النهائي على سعر الشراء)
                </span>
                {isPricePending && (
                  <span className="bg-amber-200 text-amber-900 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <Clock size={12} /> قيد الانتظار
                  </span>
                )}
              </div>
              <p className={`text-xs mt-1 leading-relaxed ${isPricePending ? 'text-amber-800 font-medium' : 'text-gray-500'}`}>
                {isPricePending 
                  ? '⚠️ ميزة نشطة: سيتم إدخال الكميات للمخزن في الإدارة المحددة فوراً، ولن يتم قيد أي مديونية على حساب المورد، وستظهر الفاتورة بعلامة "معلقة السعر" مع إمكانية تسعيرها واعتمادها لاحقاً.' 
                  : 'حدد هذا الخيار إذا استلمت بضاعة من المورد دون معرفة السعر النهائي بعد، لتدخل الكميات المخزن فوراً دون تسجيل حساب المورد حتى الاتفاق.'}
              </p>
            </div>
          </label>
        </div>

        {/* Header Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 pb-6 border-b">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">المخزن المستقبل (الإدارة)</label>
            <div className="grid grid-cols-2 gap-2">
              {BRANCHES.map(b => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedBranch(b.id)}
                  className={`p-2.5 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                    selectedBranch === b.id
                      ? 'bg-brand-600 text-white border-brand-600 shadow-xs'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Building size={14} /> {b.name}
                </button>
              ))}
            </div>
          </div>

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
                {suppliers.map((s, idx) => <option key={`supp_${s.code || idx}_${idx}`} value={s.name} />)}
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
                <span className="text-gray-500 font-bold">رصيد سابق:</span>
                <span className={`font-bold font-mono ${currentBalance < 0 ? 'text-red-600' : currentBalance > 0 ? 'text-green-600' : 'text-gray-600'}`} dir="ltr">
                  {currentBalance.toLocaleString()} {currentBalance < 0 ? '(له / علينا)' : currentBalance > 0 ? '(لنا / عليه)' : '(متزن)'}
                </span>
             </div>
             <div className="flex justify-between items-center text-sm font-bold pt-2 border-t border-gray-200">
                <span className="text-brand-800">
                  {isPricePending ? 'الرصيد (لا يتغير الآن):' : 'رصيد متوقع:'}
                </span>
                <span className={`font-mono text-base font-bold ${expectedBalance < 0 ? 'text-red-600' : expectedBalance > 0 ? 'text-green-600' : 'text-gray-600'}`} dir="ltr">
                  {expectedBalance.toLocaleString()} {expectedBalance < 0 ? '(له / علينا)' : expectedBalance > 0 ? '(لنا / عليه)' : '(متزن)'}
                </span>
             </div>
          </div>
        </div>

        {/* Item Entry Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-gray-500 mb-1">كود الصنف</label>
            <input 
              ref={itemCodeRef}
              type="text" 
              list="productCodes"
              className="w-full p-2 border rounded font-mono text-sm"
              placeholder="كود"
              value={currentItem.itemCode}
              onFocus={e => e.target.select()}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  quantityRef.current?.focus();
                  quantityRef.current?.select();
                }
              }}
              onChange={e => handleProductCodeChange(e.target.value)}
            />
            <datalist id="productCodes">
              {products.map((p, idx) => <option key={`p_code_${p.code || idx}_${idx}`} value={p.code}>{p.name}</option>)}
            </datalist>
          </div>
          <div className="md:col-span-4">
            <label className="block text-xs font-bold text-gray-500 mb-1">اسم الصنف</label>
            <input 
              ref={itemNameRef}
              type="text" 
              list="purchaseProductNames"
              className="w-full p-2 border rounded text-sm bg-white"
              placeholder="اسم الصنف أو اختر من القائمة"
              value={currentItem.itemName}
              onFocus={e => e.target.select()}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  quantityRef.current?.focus();
                  quantityRef.current?.select();
                }
              }}
              onChange={e => handleProductNameChange(e.target.value)}
            />
            <datalist id="purchaseProductNames">
              {products.map((p, idx) => <option key={`p_name_${p.code || idx}_${idx}`} value={p.name}>{p.code}</option>)}
            </datalist>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-gray-500 mb-1">الكمية</label>
            <input 
              ref={quantityRef}
              type="number" min="1"
              placeholder="0"
              className="w-full p-2 border rounded text-sm text-center font-bold text-blue-600"
              value={currentItem.quantity}
              onFocus={e => e.target.select()}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  priceRef.current?.focus();
                  priceRef.current?.select();
                }
              }}
              onChange={e => setCurrentItem({...currentItem, quantity: e.target.value === '' ? '' : Number(e.target.value)})}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-gray-500 mb-1 flex items-center justify-between">
              <span>سعر الشراء</span>
              {isPricePending && <span className="text-[10px] text-amber-600 font-bold">(اختياري)</span>}
            </label>
            <input 
              ref={priceRef}
              type="text"
              dir="ltr"
              placeholder={isPricePending ? 'معلّق (0)' : '0'}
              className={`w-full p-2 border rounded text-sm text-center font-mono font-bold ${
                isPricePending ? 'bg-amber-50/50 border-amber-300' : ''
              }`}
              value={currentItem.price === '' || currentItem.price === 0 ? '' : formatWithCommas(currentItem.price)}
              onFocus={e => e.target.select()}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  addToCart();
                }
              }}
              onChange={e => handleNumericChangeWithCommas(e.target.value, val => setCurrentItem({...currentItem, price: val}))}
            />
          </div>
          <div className="md:col-span-2">
            <button 
              type="button"
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
                  <td className="p-3">
                    {item.price > 0 ? (
                      item.price.toLocaleString()
                    ) : (
                      <span className="text-xs text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        معلّق
                      </span>
                    )}
                  </td>
                  <td className="p-3 font-bold text-green-600">
                    {item.total > 0 ? (
                      item.total.toLocaleString()
                    ) : (
                      <span className="text-xs text-gray-400">0</span>
                    )}
                  </td>
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

        {/* Payment Section (سداد دفعة مسددة للمورد) */}
        {!isPricePending && (
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 mb-6 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-emerald-200/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-600 text-white rounded-lg">
                  <Wallet size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-emerald-950">سداد دفعة للمورد (دفعة مسددة)</h4>
                  <p className="text-xs text-emerald-700">اترك المبلغ 0 إذا كانت الفاتورة آجلة بالكامل دون سداد فوري</p>
                </div>
              </div>
              {cartTotal > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPaidAmountInput(formatWithCommas(cartTotal))}
                    className="text-xs px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg border border-emerald-300 transition-colors shadow-xs cursor-pointer"
                  >
                    سداد كامل الفاتورة ({cartTotal.toLocaleString()} ج.م)
                  </button>
                  {paidAmountVal > 0 && (
                    <button
                      type="button"
                      onClick={() => setPaidAmountInput('')}
                      className="text-xs px-2 py-1 bg-white hover:bg-red-50 text-red-600 font-bold rounded-lg border border-red-200 transition-colors cursor-pointer"
                    >
                      تصفير
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              {/* Paid Input */}
              <div className="md:col-span-5 space-y-1.5">
                <label className="block text-xs font-bold text-emerald-900">
                  المدفوع للمورد (دفعة مسددة)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    dir="ltr"
                    className="w-full p-2.5 pl-10 border-2 border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-lg text-center font-mono bg-white text-emerald-950 shadow-inner"
                    placeholder="0"
                    value={paidAmountInput}
                    onChange={e => handleNumericChangeWithCommas(e.target.value, val => setPaidAmountInput(val))}
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs pointer-events-none">
                    ج.م
                  </span>
                </div>
                {paidAmountVal > 0 && (
                  <p className="text-[11px] font-bold text-emerald-700 flex justify-between px-1">
                    <span>المبلغ المسدد:</span>
                    <span dir="ltr">{paidAmountVal.toLocaleString()} ج.م</span>
                  </p>
                )}
              </div>

              {/* Remaining On Invoice */}
              <div className="md:col-span-7 bg-white p-3 rounded-lg border border-emerald-200 flex items-center justify-between shadow-xs">
                <div>
                  <span className="block text-xs text-gray-500 font-bold">المتبقي من الفاتورة (آجل)</span>
                  <span className={`text-xl font-bold font-mono ${remainingOnInvoice > 0 ? 'text-amber-700' : 'text-emerald-600'}`} dir="ltr">
                    {remainingOnInvoice.toLocaleString()} ج.م
                  </span>
                </div>
                <div className="text-left text-xs">
                  <span className="text-gray-500 block">إجمالي الفاتورة</span>
                  <span className="font-bold font-mono text-gray-700" dir="ltr">{cartTotal.toLocaleString()} ج.م</span>
                </div>
              </div>
            </div>

            {/* Payment Method Selector (visible when paidAmountVal > 0) */}
            {paidAmountVal > 0 && (
              <div className="pt-2 border-t border-emerald-200/60 space-y-2 animate-fade-in">
                <label className="block text-xs font-bold text-emerald-900 mb-2">
                  طريقة الدفع (الخزنة / الحساب المنصرف منه)
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  <label className={`
                    flex flex-col items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all text-center
                    ${paymentMethod === 'CASH' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-1 ring-emerald-500 font-bold' : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'}
                  `}>
                    <input 
                      type="radio" 
                      name="purchasePaymentMethod" 
                      value="CASH" 
                      checked={paymentMethod === 'CASH'}
                      onChange={() => setPaymentMethod('CASH')} 
                      className="hidden"
                    />
                    <Wallet size={20} />
                    <span className="font-bold text-xs">خزنة (كاش)</span>
                  </label>

                  <label className={`
                    flex flex-col items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all text-center
                    ${paymentMethod === 'BANK_AHLY' ? 'bg-green-50 border-green-600 text-green-800 ring-1 ring-green-600 font-bold' : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'}
                  `}>
                    <input 
                      type="radio" 
                      name="purchasePaymentMethod" 
                      value="BANK_AHLY" 
                      checked={paymentMethod === 'BANK_AHLY'}
                      onChange={() => setPaymentMethod('BANK_AHLY')} 
                      className="hidden"
                    />
                    <Building2 size={20} />
                    <span className="font-bold text-xs">البنك الأهلي</span>
                  </label>

                  <label className={`
                    flex flex-col items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all text-center
                    ${paymentMethod === 'BANK_MISR' ? 'bg-red-50 border-red-600 text-red-800 ring-1 ring-red-600 font-bold' : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'}
                  `}>
                    <input 
                      type="radio" 
                      name="purchasePaymentMethod" 
                      value="BANK_MISR" 
                      checked={paymentMethod === 'BANK_MISR'}
                      onChange={() => setPaymentMethod('BANK_MISR')} 
                      className="hidden"
                    />
                    <Building2 size={20} />
                    <span className="font-bold text-xs">بنك مصر</span>
                  </label>

                  <label className={`
                    flex flex-col items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all text-center
                    ${paymentMethod === 'VF_CASH_AYMAN' ? 'bg-red-50 border-red-600 text-red-800 ring-1 ring-red-600 font-bold' : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'}
                  `}>
                    <input 
                      type="radio" 
                      name="purchasePaymentMethod" 
                      value="VF_CASH_AYMAN" 
                      checked={paymentMethod === 'VF_CASH_AYMAN'}
                      onChange={() => setPaymentMethod('VF_CASH_AYMAN')} 
                      className="hidden"
                    />
                    <Smartphone size={20} />
                    <span className="font-bold text-xs">فودافون كاش أيمن</span>
                  </label>

                  <label className={`
                    flex flex-col items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all text-center
                    ${paymentMethod === 'VF_CASH_KYRILLOS' ? 'bg-red-50 border-red-600 text-red-800 ring-1 ring-red-600 font-bold' : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'}
                  `}>
                    <input 
                      type="radio" 
                      name="purchasePaymentMethod" 
                      value="VF_CASH_KYRILLOS" 
                      checked={paymentMethod === 'VF_CASH_KYRILLOS'}
                      onChange={() => setPaymentMethod('VF_CASH_KYRILLOS')} 
                      className="hidden"
                    />
                    <Smartphone size={20} />
                    <span className="font-bold text-xs">فودافون كاش كيرلس</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer & Save */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-gray-50 p-4 rounded-lg border border-gray-200">
           <div className="text-base md:text-lg font-bold text-gray-700 flex flex-wrap items-center gap-3">
             <div className="flex items-center gap-2">
               <span>إجمالي الفاتورة:</span>
               {isPricePending ? (
                 <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 border border-amber-300 text-amber-900 rounded-lg text-sm font-black">
                   <Clock size={16} /> سعر معلّق (سيحدد لاحقاً)
                 </span>
               ) : (
                 <span className="text-2xl text-brand-700 mr-1">{cartTotal.toLocaleString()} ج.م</span>
               )}
             </div>

             {!isPricePending && paidAmountVal > 0 && (
               <div className="flex items-center gap-2 text-xs md:text-sm bg-white px-3 py-1.5 rounded-lg border border-emerald-200 shadow-2xs">
                 <span className="text-emerald-700 font-bold">مسدد: {paidAmountVal.toLocaleString()} ج.م</span>
                 <span className="text-gray-300">|</span>
                 <span className="text-amber-700 font-bold">متبقي: {remainingOnInvoice.toLocaleString()} ج.م</span>
               </div>
             )}
           </div>
           <button 
             type="button"
             disabled={isSubmitting}
             onClick={handleSaveInvoice}
             className={`${
               isPricePending 
                 ? 'bg-amber-600 hover:bg-amber-700' 
                 : 'bg-green-600 hover:bg-green-700'
             } text-white px-8 py-3 rounded-lg font-bold shadow-md flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer`}
           >
             <Save size={20} />
             <span>{isSubmitting ? 'جاري الحفظ...' : isPricePending ? 'حفظ الفاتورة (سعر معلّق)' : 'حفظ الفاتورة'}</span>
           </button>
        </div>
      </div>

      {/* Purchases History */}
      <div className="bg-white rounded-xl shadow-sm border border-brand-100 overflow-hidden">
        <div className="p-6 border-b border-brand-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="text-lg font-bold text-brand-800">سجل المشتريات</h3>
            <p className="text-xs text-gray-500">متابعة الفواتير المعتمدة والفواتير المعلقة وتحديد أسعارها</p>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setHistoryFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                historyFilter === 'ALL'
                  ? 'bg-white text-brand-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              الكل ({purchases.length})
            </button>
            <button
              type="button"
              onClick={() => setHistoryFilter('PRICED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                historyFilter === 'PRICED'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              مسعرة ومعتمدة ({pricedPurchasesCount})
            </button>
            <button
              type="button"
              onClick={() => setHistoryFilter('PENDING_PRICE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                historyFilter === 'PENDING_PRICE'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-amber-800 hover:bg-amber-50'
              }`}
            >
              <Clock size={13} />
              <span>معلقة السعر ({pendingPurchasesCount})</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-brand-50 text-brand-700">
              <tr>
                <th className="p-4">رقم الفاتورة</th>
                <th className="p-4">التاريخ</th>
                <th className="p-4">المورد</th>
                <th className="p-4">المخزن</th>
                <th className="p-4">الأصناف</th>
                <th className="p-4">الإجمالي</th>
                <th className="p-4">حالة الفاتورة</th>
                <th className="p-4 w-48">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredPurchases.map((purchase) => {
                const isPending = purchase.pricingStatus === 'PENDING_PRICE';
                const bId = purchase.branchId || 'MARG';

                return (
                  <tr key={purchase.id} className={`hover:bg-gray-50 ${isPending ? 'bg-amber-50/30' : ''}`}>
                    <td className="p-4 font-mono font-bold text-blue-600">{purchase.id}</td>
                    <td className="p-4 text-gray-600 font-mono text-xs">{purchase.date}</td>
                    <td className="p-4 font-medium text-gray-800">{purchase.supplierName}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                        bId === 'NOZHA' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {bId === 'NOZHA' ? 'النزهة' : 'المرج'}
                      </span>
                    </td>
                    <td className="p-4 text-gray-600 text-sm">
                      {purchase.items && purchase.items.length > 0 ? (
                        purchase.items.length > 1 
                          ? `${purchase.items[0].itemName} (+${purchase.items.length - 1} أصناف)`
                          : purchase.items[0].itemName
                      ) : (
                        `${purchase.itemName} (${purchase.itemCode})`
                      )}
                    </td>
                    <td className="p-4 font-bold">
                      {isPending ? (
                        <span className="text-amber-700 text-xs">معلّق السعر</span>
                      ) : (
                        <span className="text-emerald-600">{purchase.total.toLocaleString()} ج.م</span>
                      )}
                    </td>
                    <td className="p-4">
                      {isPending ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300">
                          <Clock size={12} className="text-amber-700 animate-spin" /> معلقة السعر
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <Check size={12} /> معتمدة
                        </span>
                      )}
                    </td>
                    <td className="p-4 flex gap-1.5 items-center flex-wrap">
                      {/* Price Setting Button for Pending Invoices */}
                      {isPending && (
                        <button
                          type="button"
                          onClick={() => openPricingModal(purchase)}
                          className="bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1.5 rounded-lg text-xs font-black shadow-xs transition-colors flex items-center gap-1"
                          title="تحديد سعر الشراء واعتماد الفاتورة"
                        >
                          <Calculator size={14} />
                          <span>تحديد السعر</span>
                        </button>
                      )}

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

                      <button 
                        onClick={async () => {
                          const supp = suppliers.find(s => s.code === purchase.supplierCode);
                          setSharingPdfId(purchase.id);
                          try {
                            await sharePurchaseInvoicePdfViaWhatsApp(purchase, companyLogo || undefined, supp?.phone);
                          } finally {
                            setSharingPdfId(null);
                          }
                        }}
                        disabled={sharingPdfId === purchase.id}
                        className="text-emerald-600 bg-emerald-50 hover:bg-emerald-100 p-2 rounded transition-colors disabled:opacity-50"
                        title="مشاركة الفاتورة عبر واتساب كملف PDF"
                      >
                        <MessageCircle size={18} />
                      </button>
                      
                      {canEditPurchases && (
                        <button 
                          onClick={() => openEditModal(purchase)}
                          className="text-blue-600 bg-blue-50 hover:bg-blue-100 p-2 rounded transition-colors"
                          title="تعديل"
                        >
                          <Edit size={18} />
                        </button>
                      )}

                      <button 
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          if (!await askConfirm("هل أنت متأكد من حذف الفاتورة؟")) return;
                          try {
                            const deleteFn = deletePurchaseInvoice || deletePurchase;
                            await deleteFn(purchase.id);
                            notify(`تم حذف الفاتورة #${purchase.id} بنجاح.`);
                          } catch (err: any) {
                            console.error(err);
                            notify("حدث خطأ أثناء حذف الفاتورة: " + (err?.message || ""));
                          }
                        }}
                        className="text-red-500 hover:bg-red-50 hover:text-red-700 p-2 rounded transition-colors cursor-pointer"
                        title="حذف فاتورة المشتريات"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredPurchases.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">
                    {historyFilter === 'PENDING_PRICE' 
                      ? 'لا توجد فواتير معلقة السعر، جميع فواتير المشتريات مسعرة ومعتمدة.' 
                      : 'لا توجد مشتريات مسجلة'}
                  </td>
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

               {viewPurchase.pricingStatus === 'PENDING_PRICE' ? (
                 <div className="mt-4 p-3 bg-amber-50 border border-amber-300 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-3">
                   <div className="flex items-center gap-2 text-xs font-black text-amber-900">
                     <Clock size={16} className="text-amber-600" />
                     <span>حالة الفاتورة: معلقة السعر (لم يتم تحديد سعر الشراء النهائي بعد)</span>
                   </div>
                   <button
                     type="button"
                     onClick={() => {
                       const target = viewPurchase;
                       setViewPurchase(null);
                       openPricingModal(target);
                     }}
                     className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs"
                   >
                     <Calculator size={14} />
                     <span>تحديد السعر الآن</span>
                   </button>
                 </div>
               ) : (
                 viewPurchase.currentBalance !== undefined && (
                   <div className="mt-4 p-3 bg-gray-50 border rounded-lg flex justify-between items-center text-sm font-bold text-gray-600">
                      <div>رصيد المورد السابق: {viewPurchase.previousBalance?.toLocaleString()}</div>
                      <div className="text-brand-800">رصيد المورد الحالي: {viewPurchase.currentBalance?.toLocaleString()}</div>
                   </div>
                 )
               )}

               <div className="mt-4 flex justify-between items-center">
                 <div className="flex items-center gap-2">
                   <button 
                      onClick={() => printPurchaseInvoice(viewPurchase)} 
                      className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold transition-colors"
                   >
                      <Printer size={18}/> طباعة
                   </button>
                   <button 
                       onClick={async () => {
                         const supp = suppliers.find(s => s.code === viewPurchase.supplierCode);
                         let safetyTimer: any = null;
                         try {
                           setSharingPdfId(viewPurchase.id);
                           safetyTimer = setTimeout(() => {
                             setSharingPdfId(null);
                           }, 3500);
                           await sharePurchaseInvoicePdfViaWhatsApp(viewPurchase, companyLogo || undefined, supp?.phone ? supp.phone : undefined);
                         } catch (err: any) {
                           if (
                             err?.name !== 'AbortError' &&
                             err?.name !== 'NotAllowedError' &&
                             !err?.message?.includes?.('AbortError') &&
                             !err?.message?.includes?.('canceled') &&
                             !err?.message?.includes?.('cancelled')
                           ) {
                             console.error(err);
                           }
                         } finally {
                           if (safetyTimer) clearTimeout(safetyTimer);
                           setSharingPdfId(null);
                         }
                       }} 
                       disabled={sharingPdfId === viewPurchase.id}
                       className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold transition-colors text-sm shadow-xs disabled:opacity-50"
                    >
                       <MessageCircle size={18}/> {sharingPdfId === viewPurchase.id ? 'جاري تجهيز PDF...' : 'مشاركة PDF واتساب'}
                    </button>
                 </div>
                 <div className="flex items-center gap-2">
                   {Boolean(viewPurchase.paid && viewPurchase.paid > 0) && (
                     <div className="text-xs sm:text-sm font-bold bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg text-emerald-800">
                       مسدد: {viewPurchase.paid?.toLocaleString()} ج.م
                       {viewPurchase.remaining !== undefined && (
                         <span className="mr-2 text-amber-700">| متبقي: {viewPurchase.remaining?.toLocaleString()} ج.م</span>
                       )}
                     </div>
                   )}
                   <div className="text-xl font-bold bg-gray-100 px-4 py-2 rounded text-brand-800">
                     الإجمالي: {viewPurchase.total.toLocaleString()} ج.م
                   </div>
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
                     {products.map((p, idx) => <option key={`prod_edit_${p.code || idx}_${idx}`} value={p.name}>{p.code}</option>)}
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

              {/* Payment Section (سداد دفعة مسددة للمورد) */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-emerald-200/60 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-600 text-white rounded-lg">
                      <Wallet size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-emerald-950">سداد دفعة للمورد (دفعة مسددة)</h4>
                      <p className="text-xs text-emerald-700">اترك المبلغ 0 إذا كانت الفاتورة آجلة بالكامل دون سداد فوري</p>
                    </div>
                  </div>
                  {editTotal > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditPaidAmountInput(formatWithCommas(editTotal))}
                        className="text-xs px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg border border-emerald-300 transition-colors shadow-xs cursor-pointer"
                      >
                        سداد كامل الفاتورة ({editTotal.toLocaleString()} ج.م)
                      </button>
                      {editPaidVal > 0 && (
                        <button
                          type="button"
                          onClick={() => setEditPaidAmountInput('')}
                          className="text-xs px-2 py-1 bg-white hover:bg-red-50 text-red-600 font-bold rounded-lg border border-red-200 transition-colors cursor-pointer"
                        >
                          تصفير
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  {/* Paid Input */}
                  <div className="md:col-span-5 space-y-1.5">
                    <label className="block text-xs font-bold text-emerald-900">
                      المدفوع للمورد (دفعة مسددة)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        dir="ltr"
                        className="w-full p-2.5 pl-10 border-2 border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-lg text-center font-mono bg-white text-emerald-950 shadow-inner"
                        placeholder="0"
                        value={editPaidAmountInput}
                        onChange={e => handleNumericChangeWithCommas(e.target.value, val => setEditPaidAmountInput(val))}
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs pointer-events-none">
                        ج.م
                      </span>
                    </div>
                    {editPaidVal > 0 && (
                      <p className="text-[11px] font-bold text-emerald-700 flex justify-between px-1">
                        <span>المبلغ المسدد:</span>
                        <span dir="ltr">{editPaidVal.toLocaleString()} ج.م</span>
                      </p>
                    )}
                  </div>

                  {/* Remaining On Invoice */}
                  <div className="md:col-span-7 bg-white p-3 rounded-lg border border-emerald-200 flex items-center justify-between shadow-xs">
                    <div>
                      <span className="block text-xs text-gray-500 font-bold">المتبقي من الفاتورة (آجل)</span>
                      <span className={`text-xl font-bold font-mono ${editRemaining > 0 ? 'text-amber-700' : 'text-emerald-600'}`} dir="ltr">
                        {editRemaining.toLocaleString()} ج.م
                      </span>
                    </div>
                    <div className="text-left text-xs">
                      <span className="text-gray-500 block">إجمالي الفاتورة الجديد</span>
                      <span className="font-bold font-mono text-gray-700" dir="ltr">{editTotal.toLocaleString()} ج.م</span>
                    </div>
                  </div>
                </div>

                {/* Payment Method Selector (visible when editPaidVal > 0) */}
                {editPaidVal > 0 && (
                  <div className="pt-2 border-t border-emerald-200/60 space-y-2 animate-fade-in">
                    <label className="block text-xs font-bold text-emerald-900 mb-2">
                      طريقة الدفع (الخزنة / الحساب المنصرف منه)
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                      <label className={`
                        flex flex-col items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all text-center
                        ${editPaymentMethod === 'CASH' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-1 ring-emerald-500 font-bold' : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'}
                      `}>
                        <input 
                          type="radio" 
                          name="editPurchasePaymentMethod" 
                          value="CASH" 
                          checked={editPaymentMethod === 'CASH'}
                          onChange={() => setEditPaymentMethod('CASH')} 
                          className="hidden"
                        />
                        <Wallet size={20} />
                        <span className="font-bold text-xs">خزنة (كاش)</span>
                      </label>

                      <label className={`
                        flex flex-col items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all text-center
                        ${editPaymentMethod === 'BANK_AHLY' ? 'bg-green-50 border-green-600 text-green-800 ring-1 ring-green-600 font-bold' : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'}
                      `}>
                        <input 
                          type="radio" 
                          name="editPurchasePaymentMethod" 
                          value="BANK_AHLY" 
                          checked={editPaymentMethod === 'BANK_AHLY'}
                          onChange={() => setEditPaymentMethod('BANK_AHLY')} 
                          className="hidden"
                        />
                        <Building2 size={20} />
                        <span className="font-bold text-xs">البنك الأهلي</span>
                      </label>

                      <label className={`
                        flex flex-col items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all text-center
                        ${editPaymentMethod === 'BANK_MISR' ? 'bg-red-50 border-red-600 text-red-800 ring-1 ring-red-600 font-bold' : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'}
                      `}>
                        <input 
                          type="radio" 
                          name="editPurchasePaymentMethod" 
                          value="BANK_MISR" 
                          checked={editPaymentMethod === 'BANK_MISR'}
                          onChange={() => setEditPaymentMethod('BANK_MISR')} 
                          className="hidden"
                        />
                        <Building2 size={20} />
                        <span className="font-bold text-xs">بنك مصر</span>
                      </label>

                      <label className={`
                        flex flex-col items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all text-center
                        ${editPaymentMethod === 'VF_CASH_AYMAN' ? 'bg-red-50 border-red-600 text-red-800 ring-1 ring-red-600 font-bold' : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'}
                      `}>
                        <input 
                          type="radio" 
                          name="editPurchasePaymentMethod" 
                          value="VF_CASH_AYMAN" 
                          checked={editPaymentMethod === 'VF_CASH_AYMAN'}
                          onChange={() => setEditPaymentMethod('VF_CASH_AYMAN')} 
                          className="hidden"
                        />
                        <Smartphone size={20} />
                        <span className="font-bold text-xs">فودافون كاش أيمن</span>
                      </label>

                      <label className={`
                        flex flex-col items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all text-center
                        ${editPaymentMethod === 'VF_CASH_KYRILLOS' ? 'bg-red-50 border-red-600 text-red-800 ring-1 ring-red-600 font-bold' : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'}
                      `}>
                        <input 
                          type="radio" 
                          name="editPurchasePaymentMethod" 
                          value="VF_CASH_KYRILLOS" 
                          checked={editPaymentMethod === 'VF_CASH_KYRILLOS'}
                          onChange={() => setEditPaymentMethod('VF_CASH_KYRILLOS')} 
                          className="hidden"
                        />
                        <Smartphone size={20} />
                        <span className="font-bold text-xs">فودافون كاش كيرلس</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-gray-100 border-t flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
               <div className="flex flex-wrap items-center gap-3 text-sm font-bold text-gray-800">
                 <div>
                   الإجمالي الجديد: <span className="text-blue-700 font-mono text-base">{editTotal.toLocaleString()} ج.م</span>
                 </div>
                 {editPaidVal > 0 && (
                   <>
                     <span className="text-gray-300">|</span>
                     <div>
                       المدفوع: <span className="text-emerald-700 font-mono text-base">{editPaidVal.toLocaleString()} ج.م</span>
                     </div>
                     <span className="text-gray-300">|</span>
                     <div>
                       المتبقي: <span className="text-amber-700 font-mono text-base">{editRemaining.toLocaleString()} ج.م</span>
                     </div>
                   </>
                 )}
               </div>
               <button 
                 onClick={handleSaveEdit} 
                 disabled={isSavingEdit}
                 className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
               >
                 <Save size={20}/> {isSavingEdit ? 'جاري الحفظ...' : 'حفظ التعديلات'}
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Pricing Modal for Pending Invoices */}
      {pricingPurchase && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in">
            <div className="bg-amber-600 p-4 flex justify-between items-center text-white shrink-0">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Calculator size={22}/> تحديد سعر الشراء واعتماد الفاتورة #{pricingPurchase.id}
              </h2>
              <button onClick={() => setPricingPurchase(null)} className="hover:bg-amber-700 p-1 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 leading-relaxed flex items-start gap-2.5">
                <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>تعليمات الاعتماد:</strong> تم استلام هذه الكميات مسبقاً في المخزن. يرجى إدخال سعر الشراء المتفق عليه لكل صنف.
                  عند الحفظ، سيتم تحديث إجمالي الفاتورة، وترحيل المديونية لحساب المورد ({pricingPurchase.supplierName}) وتحديث متوسط تكلفة الأصناف تلقائياً.
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-gray-50 p-3 rounded-xl border border-gray-200">
                <div>
                  <span className="text-gray-400 block">المورد:</span>
                  <span className="font-bold text-gray-800 text-sm">{pricingPurchase.supplierName}</span>
                </div>
                <div>
                  <span className="text-gray-400 block">المخزن المستلم:</span>
                  <span className="font-bold text-gray-800 text-sm">
                    {pricingPurchase.branchId === 'NOZHA' ? 'إدارة النزهة' : 'إدارة المرج'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block">تاريخ الاستلام:</span>
                  <span className="font-bold text-gray-800 text-sm font-mono">{pricingPurchase.date}</span>
                </div>
              </div>

              {/* Pricing Items Table */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-gray-100 font-bold text-gray-700 border-b">
                    <tr>
                      <th className="p-3 w-10 text-center">م</th>
                      <th className="p-3">اسم الصنف</th>
                      <th className="p-3 w-24 text-center">الكمية المستلمة</th>
                      <th className="p-3 w-36 text-center">سعر الشراء المتفق عليه</th>
                      <th className="p-3 w-28 text-center">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pricingItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-amber-50/20">
                        <td className="p-3 text-center text-gray-400 font-mono">{idx + 1}</td>
                        <td className="p-3 font-bold text-gray-800">
                          {item.itemName}
                          <span className="text-[10px] text-gray-400 block font-mono">({item.itemCode})</span>
                        </td>
                        <td className="p-3 text-center font-bold text-blue-600 font-mono text-sm">{item.quantity}</td>
                        <td className="p-3">
                          <input
                            type="text"
                            dir="ltr"
                            placeholder="أدخل السعر"
                            className="w-full p-2 border-2 border-amber-300 rounded-lg text-center font-bold font-mono text-sm focus:border-amber-500 outline-none bg-amber-50/40"
                            value={!item.price ? '' : formatWithCommas(item.price)}
                            onChange={e => handleNumericChangeWithCommas(e.target.value, val => handlePricingPriceChange(idx, parseNumberFromCommas(val)))}
                          />
                        </td>
                        <td className="p-3 text-center font-bold text-emerald-600 font-mono text-sm">
                          {item.total > 0 ? `${item.total.toLocaleString()} ج.م` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
              <div className="text-sm font-bold text-gray-700">
                إجمالي الفاتورة المعتمد:
                <span className="text-xl font-black text-emerald-700 mr-2 font-mono">
                  {pricingItems.reduce((s, i) => s + i.total, 0).toLocaleString()} ج.م
                </span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setPricingPurchase(null)}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-bold text-xs hover:bg-gray-100 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={isFinalizing}
                  onClick={handleFinalizePricing}
                  className="flex-1 sm:flex-initial bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg font-bold text-xs shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  <Check size={16} />
                  <span>{isFinalizing ? 'جاري الاعتماد...' : 'اعتماد وتسعير الفاتورة'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {dialog}
    </div>
  );
};

