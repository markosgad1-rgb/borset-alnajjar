
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useERP } from '../context/ERPContext';
import { FileText, Package, PlusCircle, Trash2, Save, ShoppingCart, CheckCircle, Printer, X, RefreshCcw, User, Calendar, Clock, CreditCard, Banknote, Coins, Wallet, MessageCircle, Phone, Send, MapPin, Building, Check, Search, Image as ImageIcon } from 'lucide-react';
import { InvoiceItem, SalesInvoice, PaymentMethod, BranchId, BRANCHES, BRANCH_AREAS, getBranchAreas, Customer } from '../types';
import { formatWithCommas, parseNumberFromCommas, handleNumericChangeWithCommas } from '../utils/formatters';
import { shareSalesInvoicePdfViaWhatsApp, shareSalesInvoiceImageViaWhatsApp, generatePdfFileFromHtml, getSalesInvoicePdfFileName } from '../utils/whatsapp';
import { getSalesInvoiceHtml } from '../utils/printTemplates';
import { useBackHandler } from '../utils/backNavigation';
import { useNetworkStatus } from '../utils/useNetworkStatus';

export const Sales: React.FC = () => {
  const { addInvoice, products, customers, invoices, printInvoice, companyLogo, currentUser } = useERP();
  const netUp = useNetworkStatus();
  
  const canEditPrices = currentUser?.role === 'ADMIN' || currentUser?.username === 'admin' || Boolean(currentUser?.permissions?.canEditPrices);

  // Cascading Branch & Area State
  const [selectedBranch, setSelectedBranch] = useState<BranchId>('MARG');
  const [selectedArea, setSelectedArea] = useState<string>('ALL');

  // Main Invoice State
  const [invoiceId, setInvoiceId] = useState('N001');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceTime, setInvoiceTime] = useState(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
  const [customerCode, setCustomerCode] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerBalance, setCustomerBalance] = useState(0);
  const [customerSearchText, setCustomerSearchText] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  // Close customer suggestions dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setIsCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Payment State
  const [paymentType, setPaymentType] = useState<'CREDIT' | 'CASH_FULL' | 'PARTIAL'>('CREDIT');
  const [paidAmountInput, setPaidAmountInput] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');

  // Cart Item State
  const [currentItem, setCurrentItem] = useState<{
    itemCode: string;
    itemName: string;
    quantity: number | '';
    price: number | '';
  }>({
    itemCode: '',
    itemName: '',
    quantity: '',
    price: ''
  });

  const itemCodeRef = React.useRef<HTMLInputElement>(null);
  const itemNameRef = React.useRef<HTMLInputElement>(null);
  const quantityRef = React.useRef<HTMLInputElement>(null);
  const priceRef = React.useRef<HTMLInputElement>(null);

  const [currentStock, setCurrentStock] = useState(0);
  const [cartItems, setCartItems] = useState<InvoiceItem[]>([]);

  // Post-Save State
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastSavedInvoice, setLastSavedInvoice] = useState<SalesInvoice | null>(null);
  const [modalCustomerPhone, setModalCustomerPhone] = useState<string>('');
  const [preloadedPdfFile, setPreloadedPdfFile] = useState<File | null>(null);

  // Hardware Back button closes the success modal
  useBackHandler(() => setShowSuccessModal(false), showSuccessModal, 'sales-success-modal');

  // Auto-generate Invoice ID
  // Online: same numbering as before (N001, N002, ...).
  // Offline: a short per-device letter tag is appended (e.g. N046-KQ) so two laptops working
  // offline can never create the same invoice number and overwrite each other on sync.
  const getDeviceTag = () => {
    try {
      let t = localStorage.getItem('erp_device_tag');
      if (!t) {
        const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        t = L[Math.floor(Math.random() * L.length)] + L[Math.floor(Math.random() * L.length)];
        localStorage.setItem('erp_device_tag', t);
      }
      return t;
    } catch { return 'XX'; }
  };

  useEffect(() => {
    const suffix = netUp ? '' : `-${getDeviceTag()}`;
    if (invoices.length === 0) {
      setInvoiceId(`N001${suffix}`);
    } else {
      const nIds = invoices
        .filter(inv => inv.id.startsWith('N'))
        .map(inv => parseInt(inv.id.replace(/\D/g, '')))
        .filter(num => !isNaN(num));

      if (nIds.length > 0) {
        const maxId = Math.max(...nIds);
        setInvoiceId(`N${(maxId + 1).toString().padStart(3, '0')}${suffix}`);
      } else {
        setInvoiceId(`N001${suffix}`);
      }
    }
  }, [invoices, netUp]);

  // Calculated Totals
  const cartTotal = cartItems.reduce((sum, item) => sum + item.total, 0);

  // Effective Paid Amount (Supports comma separators like 10,000 / 100,000)
  const parsedPaid = parseNumberFromCommas(paidAmountInput);

  const currentPaid = paymentType === 'CREDIT' 
    ? 0 
    : paymentType === 'CASH_FULL' 
      ? cartTotal 
      : Math.max(0, parsedPaid);

  const remainingAmount = Math.max(0, cartTotal - currentPaid);
  const excessPaid = Math.max(0, currentPaid - cartTotal);
  // Negative customer balance = owes us debt
  // Net balance after invoice: previousBalance - cartTotal + currentPaid
  // إذا كان المدفوع أكبر من الفاتورة يخصم الفائض من المديونية السابقة
  const newBalance = customerBalance - cartTotal + currentPaid;

  // Exclude deleted customers completely
  const activeCustomers = useMemo(() => {
    return customers.filter(c => !c.isDeleted);
  }, [customers]);

  // Dynamic list of areas for selected branch (default + any custom entered areas)
  const availableBranchAreas = useMemo(() => {
    return getBranchAreas(selectedBranch, activeCustomers);
  }, [selectedBranch, activeCustomers]);

  // Cascading Available Customers based on Step 1 (Branch) and Step 2 (Area) - Strictly active
  const availableCustomers = useMemo(() => {
    let list = activeCustomers.filter(c => (c.branchId || 'MARG') === selectedBranch);
    if (selectedArea && selectedArea !== 'ALL') {
      list = list.filter(c => (c.area || '') === selectedArea);
    }
    return list;
  }, [activeCustomers, selectedBranch, selectedArea]);

  // Format customer option label: [Code] Name - Area (example: [C079] مرقص - عين شمس)
  const formatCustomerLabel = (c: Customer): string => {
    return `[${c.code}] ${c.name}${c.area ? ` - ${c.area}` : ''}`;
  };

  const handleBranchChange = (newBranch: BranchId) => {
    setSelectedBranch(newBranch);
    setSelectedArea('ALL');
    setCustomerCode('');
    setCustomerName('');
    setCustomerSearchText('');
    setCustomerBalance(0);
    setIsCustomerDropdownOpen(false);
    if (currentItem.itemCode) {
      const prod = products.find(p => p.code === currentItem.itemCode);
      if (prod) {
        const stock = newBranch === 'NOZHA'
          ? (prod.quantityNozha !== undefined ? prod.quantityNozha : 0)
          : (prod.quantityMarg !== undefined ? prod.quantityMarg : prod.quantity);
        setCurrentStock(stock);
      }
    }
  };

  // Helper to apply customer selection strictly by Customer entity / code
  const selectCustomer = (customer: Customer | null) => {
    if (customer && !customer.isDeleted) {
      setCustomerCode(customer.code);
      setCustomerName(customer.name);
      setCustomerBalance(customer.balance);
      setCustomerSearchText(formatCustomerLabel(customer));
      if (customer.branchId && customer.branchId !== selectedBranch) {
        setSelectedBranch(customer.branchId);
      }
      if (customer.area && customer.area !== selectedArea) {
        setSelectedArea(customer.area);
      }
    } else {
      setCustomerCode('');
      setCustomerName('');
      setCustomerBalance(0);
      setCustomerSearchText('');
    }
    setIsCustomerDropdownOpen(false);
  };

  // Handle Customer Selection (By Code)
  const handleCustomerCode = (code: string) => {
    setCustomerCode(code);
    const trimmed = code.trim().toLowerCase();
    if (!trimmed) {
      setCustomerName('');
      setCustomerBalance(0);
      setCustomerSearchText('');
      return;
    }
    // Only search active (non-deleted) customers
    const customer = activeCustomers.find(c => c.code.toLowerCase() === trimmed);
    if (customer) {
      setCustomerName(customer.name);
      setCustomerBalance(customer.balance);
      setCustomerSearchText(formatCustomerLabel(customer));
      if (customer.branchId && customer.branchId !== selectedBranch) {
        setSelectedBranch(customer.branchId);
      }
      if (customer.area && customer.area !== selectedArea) {
        setSelectedArea(customer.area);
      }
    } else {
      setCustomerName('');
      setCustomerBalance(0);
    }
  };

  // Handle Customer Search / Dropdown Input (supports code, name, or formatted label)
  const handleCustomerSearchChange = (val: string) => {
    setCustomerSearchText(val);
    setIsCustomerDropdownOpen(true);
    const trimmed = val.trim();

    if (!trimmed) {
      setCustomerCode('');
      setCustomerName('');
      setCustomerBalance(0);
      return;
    }

    // 1. Check if string starts with [CODE] e.g. [C079] مرقص - عين شمس
    const bracketMatch = trimmed.match(/^\[([A-Za-z0-9_-]+)\]/);
    if (bracketMatch) {
      const extractedCode = bracketMatch[1].toLowerCase();
      const customer = activeCustomers.find(c => c.code.toLowerCase() === extractedCode);
      if (customer) {
        selectCustomer(customer);
        return;
      }
    }

    // 2. Check if string directly matches an active customer code
    const byCode = activeCustomers.find(c => c.code.toLowerCase() === trimmed.toLowerCase());
    if (byCode) {
      selectCustomer(byCode);
      return;
    }

    // 3. Check if exact unique match by name among active customers
    const matchesByName = availableCustomers.filter(c => c.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (matchesByName.length === 1) {
      selectCustomer(matchesByName[0]);
    } else if (matchesByName.length === 0) {
      const allActiveByName = activeCustomers.filter(c => c.name.trim().toLowerCase() === trimmed.toLowerCase());
      if (allActiveByName.length === 1) {
        selectCustomer(allActiveByName[0]);
      }
    }
  };

  // Filter suggestions for dropdown based on search query (code or name or area)
  const filteredCustomerSuggestions = useMemo(() => {
    const q = customerSearchText.trim().toLowerCase();
    const cleanQ = q.replace(/^\[[a-z0-9_-]+\]\s*/i, '');
    if (!cleanQ) return availableCustomers.slice(0, 30);

    return availableCustomers.filter(c => {
      const codeMatch = c.code.toLowerCase().includes(cleanQ);
      const nameMatch = c.name.toLowerCase().includes(cleanQ);
      const areaMatch = (c.area || '').toLowerCase().includes(cleanQ);
      const phoneMatch = (c.phone || '').includes(cleanQ);
      return codeMatch || nameMatch || areaMatch || phoneMatch;
    }).slice(0, 35);
  }, [availableCustomers, customerSearchText]);

  // Handle Item Selection (By Code)
  const handleItemCode = (code: string) => {
    const product = products.find(p => p.code === code);
    if (product) {
      const stock = selectedBranch === 'NOZHA'
        ? (product.quantityNozha !== undefined ? product.quantityNozha : 0)
        : (product.quantityMarg !== undefined ? product.quantityMarg : product.quantity);

      setCurrentItem(prev => ({
        ...prev,
        itemCode: code,
        itemName: product.name,
        quantity: '',
        price: product.price ? product.price : ''
      }));
      setCurrentStock(stock);
      setTimeout(() => {
        quantityRef.current?.focus();
        quantityRef.current?.select();
      }, 50);
    } else {
      setCurrentItem(prev => ({ ...prev, itemCode: code, itemName: '', quantity: '', price: '' }));
      setCurrentStock(0);
    }
  };

  // Handle Item Selection (By Name)
  const handleItemName = (name: string) => {
    const product = products.find(p => p.name === name);
    if (product) {
      const stock = selectedBranch === 'NOZHA'
        ? (product.quantityNozha !== undefined ? product.quantityNozha : 0)
        : (product.quantityMarg !== undefined ? product.quantityMarg : product.quantity);

      setCurrentItem(prev => ({
        ...prev,
        itemCode: product.code,
        itemName: name,
        quantity: '',
        price: product.price ? product.price : ''
      }));
      setCurrentStock(stock);
      setTimeout(() => {
        quantityRef.current?.focus();
        quantityRef.current?.select();
      }, 50);
    } else {
      setCurrentItem(prev => ({ ...prev, itemName: name }));
    }
  };

  // Add Item to Cart
  const addToCart = () => {
    if (!currentItem.itemCode || !currentItem.itemName) {
      alert("الرجاء اختيار صنف صحيح");
      itemCodeRef.current?.focus();
      return;
    }
    const qty = typeof currentItem.quantity === 'number' ? currentItem.quantity : (currentItem.quantity ? Number(currentItem.quantity) : 0);
    if (qty <= 0) {
      alert("الرجاء إدخال الكمية المطلوبة");
      quantityRef.current?.focus();
      return;
    }
    if (qty > currentStock) {
      alert("الكمية المطلوبة غير متوفرة بالمخزن");
      quantityRef.current?.focus();
      return;
    }

    const rawPrice = currentItem.price;
    const itemPrice = typeof rawPrice === 'number' ? rawPrice : (rawPrice ? Number(rawPrice) : 0);
    if (itemPrice <= 0) {
      alert("الرجاء إدخال سعر الصنف");
      priceRef.current?.focus();
      return;
    }

    const existingItemIndex = cartItems.findIndex(i => i.itemCode === currentItem.itemCode);
    if (existingItemIndex >= 0) {
      const updatedCart = [...cartItems];
      updatedCart[existingItemIndex].quantity += qty;
      updatedCart[existingItemIndex].price = itemPrice;
      updatedCart[existingItemIndex].total = updatedCart[existingItemIndex].quantity * itemPrice;
      
      if (updatedCart[existingItemIndex].quantity > currentStock) {
         alert("مجموع الكمية في الفاتورة يتعدى رصيد المخزن");
         return;
      }
      
      setCartItems(updatedCart);
    } else {
      setCartItems(prev => [...prev, {
        itemCode: currentItem.itemCode,
        itemName: currentItem.itemName,
        quantity: qty,
        price: itemPrice,
        total: qty * itemPrice
      }]);
    }

    // Reset item with empty quantity and price immediately
    setCurrentItem({ itemCode: '', itemName: '', quantity: '', price: '' });
    setCurrentStock(0);
    // Return focus automatically to the item selection input so the user can immediately type the next item
    setTimeout(() => {
      itemCodeRef.current?.focus();
      itemCodeRef.current?.select();
    }, 60);
  };

  const removeFromCart = (index: number) => {
    setCartItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleQuickPercent = (percent: number) => {
    const amt = Math.round((cartTotal * percent) / 100);
    setPaidAmountInput(formatWithCommas(amt.toString()));
  };

  const handleSaveInvoice = async () => {
    if (cartItems.length === 0) {
      alert("الفاتورة فارغة! أضف أصناف أولاً.");
      return;
    }
    if (!customerCode || !customerName) {
      alert("الرجاء اختيار عميل نشط عبر كود العميل أو البحث.");
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

    const cust = activeCustomers.find(c => c.code === customerCode) || customers.find(c => c.code === customerCode);
    const resolvedArea = selectedArea !== 'ALL' ? selectedArea : (cust?.area || '');
    const invoiceData: any = {
      id: invoiceId,
      date: invoiceDate,
      time: invoiceTime,
      branchId: selectedBranch,
      area: resolvedArea,
      customerCode,
      customerName,
      customerPhone: cust?.phone || '',
      items: cartItems,
      total: cartTotal,
      paidAmount: currentPaid,
      remainingAmount: remainingAmount,
      ...(currentPaid > 0 && paymentMethod ? { paymentMethod } : {})
    };

    await addInvoice(invoiceData);
    
    // Store for printing/modal
    setLastSavedInvoice({
      ...invoiceData,
      previousBalance: customerBalance,
      currentBalance: newBalance
    });
    setModalCustomerPhone(cust?.phone || '');
    setShowSuccessModal(true);

    // Clear Form
    setCartItems([]);
    setCustomerCode('');
    setCustomerName('');
    setCustomerSearchText('');
    setCustomerBalance(0);
    setIsCustomerDropdownOpen(false);
    setCurrentItem({ itemCode: '', itemName: '', quantity: '', price: 0 });
    setPaymentType('CREDIT');
    setPaidAmountInput('0');
  };

  // Pre-generate PDF in the background right after saving so that clicking WhatsApp shares immediately without waiting
  useEffect(() => {
    if (showSuccessModal && lastSavedInvoice) {
      let isMounted = true;
      const pregenerate = async () => {
        try {
          const html = getSalesInvoiceHtml(lastSavedInvoice, companyLogo);
          const fileName = getSalesInvoicePdfFileName(lastSavedInvoice);
          const file = await generatePdfFileFromHtml(html, fileName, 'portrait');
          if (isMounted) {
            setPreloadedPdfFile(file);
          }
        } catch (err) {
          console.warn('PDF pre-generate err:', err);
        }
      };
      pregenerate();
      return () => {
        isMounted = false;
      };
    } else {
      setPreloadedPdfFile(null);
    }
  }, [showSuccessModal, lastSavedInvoice, companyLogo]);

  const handleCloseModal = () => {
    setShowSuccessModal(false);
    setLastSavedInvoice(null);
    setPreloadedPdfFile(null);
    setModalCustomerPhone('');
  };

  const handlePrint = () => {
    if (lastSavedInvoice) {
      printInvoice(lastSavedInvoice);
    }
  };

  const [isSharingPdf, setIsSharingPdf] = useState(false);
  const [isSharingImage, setIsSharingImage] = useState(false);

  const handleShareWhatsAppImage = async () => {
    if (!lastSavedInvoice || isSharingImage) return;

    let syncTab: Window | null = null;
    const isNativeShareSupported = typeof navigator !== 'undefined' &&
      typeof navigator.canShare === 'function' &&
      typeof navigator.share === 'function';

    if (!isNativeShareSupported) {
      try {
        syncTab = window.open('about:blank', '_blank');
      } catch {
        // ignore popup error
      }
    }

    let safetyTimer: any = null;
    try {
      setIsSharingImage(true);
      safetyTimer = setTimeout(() => {
        setIsSharingImage(false);
      }, 4000);

      const targetPhone = modalCustomerPhone || lastSavedInvoice.customerPhone;
      await shareSalesInvoiceImageViaWhatsApp(
        { ...lastSavedInvoice, customerPhone: targetPhone },
        companyLogo,
        targetPhone,
        syncTab
      );
    } catch (e: any) {
      if (syncTab && !syncTab.closed) syncTab.close();
      if (
        e?.name !== 'AbortError' &&
        e?.name !== 'NotAllowedError' &&
        !e?.message?.includes?.('AbortError') &&
        !e?.message?.includes?.('canceled') &&
        !e?.message?.includes?.('cancelled')
      ) {
        console.error(e);
        alert('حدث خطأ أثناء مشاركة الصورة عبر واتساب');
      }
    } finally {
      if (safetyTimer) clearTimeout(safetyTimer);
      setIsSharingImage(false);
    }
  };

  const handleShareWhatsApp = async () => {
    if (!lastSavedInvoice || isSharingPdf) return;

    // For desktop browsers, open blank tab synchronously on click to avoid any browser popup block
    let syncTab: Window | null = null;
    const isNativeShareSupported = typeof navigator !== 'undefined' &&
      typeof navigator.canShare === 'function' &&
      typeof navigator.share === 'function';

    if (!preloadedPdfFile && !isNativeShareSupported) {
      try {
        syncTab = window.open('about:blank', '_blank');
      } catch {
        // ignore popup error
      }
    }

    let safetyTimer: any = null;
    try {
      setIsSharingPdf(true);
      // Failsafe timer so the button NEVER remains stuck on 'جاري التحويل'
      safetyTimer = setTimeout(() => {
        setIsSharingPdf(false);
      }, 3500);

      const targetPhone = modalCustomerPhone || lastSavedInvoice.customerPhone;
      await shareSalesInvoicePdfViaWhatsApp(
        { ...lastSavedInvoice, customerPhone: targetPhone },
        companyLogo,
        targetPhone,
        preloadedPdfFile,
        syncTab
      );
    } catch (e: any) {
      if (syncTab && !syncTab.closed) syncTab.close();
      if (
        e?.name !== 'AbortError' &&
        e?.name !== 'NotAllowedError' &&
        !e?.message?.includes?.('AbortError') &&
        !e?.message?.includes?.('canceled') &&
        !e?.message?.includes?.('cancelled')
      ) {
        console.error(e);
        alert('حدث خطأ أثناء التوجيه للواتساب');
      }
    } finally {
      if (safetyTimer) clearTimeout(safetyTimer);
      setIsSharingPdf(false);
    }
  };

  return (
    <div className="flex flex-col xl:grid xl:grid-cols-3 gap-6 h-auto xl:h-[calc(100vh-140px)] pb-28 xl:pb-0">
      
      {/* Invoice Entry Section (Left & Center on Desktop, Full on Mobile) */}
      <div className="xl:col-span-2 flex flex-col gap-4 xl:overflow-y-auto h-full">
        
        {/* 1. Customer & Invoice Info */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-brand-100">
          <div className="flex flex-wrap justify-between items-center mb-3 border-b pb-2 gap-2">
            <h3 className="font-bold text-brand-800 flex items-center gap-2 text-sm md:text-base">
              <FileText size={18} /> بيانات الفاتورة والعميل
            </h3>
            <div className="flex items-center gap-2">
               <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded text-xs font-bold">
                 {selectedBranch === 'NOZHA' ? 'فرع النزهة' : 'فرع المرج'}
               </span>
               <span className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">{invoiceId}</span>
               <span className="bg-gray-100 px-2 py-1 rounded text-xs">{invoiceDate}</span>
            </div>
          </div>

          {/* 3-Step Cascading Flow Header */}
          <div className="mb-3 p-3 bg-gradient-to-r from-blue-50/70 to-indigo-50/70 border border-blue-200/60 rounded-xl space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              
              {/* Step 1: Branch Selection */}
              <div className="md:col-span-5">
                <label className="text-xs font-bold text-blue-900 flex items-center gap-1.5 mb-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white inline-flex items-center justify-center text-[11px] font-bold">1</span>
                  اختيار الإدارة / الفرع
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {BRANCHES.map(b => {
                    const isSelected = selectedBranch === b.id;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => handleBranchChange(b.id)}
                        className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                          isSelected
                            ? 'bg-blue-600 text-white ring-2 ring-blue-300 shadow-blue-200'
                            : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <Building size={14} />
                        <span>{b.name}</span>
                        {isSelected && <Check size={14} className="mr-auto" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Dynamic Area Selection */}
              <div className="md:col-span-7">
                <label className="text-xs font-bold text-blue-900 flex items-center gap-1.5 mb-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white inline-flex items-center justify-center text-[11px] font-bold">2</span>
                  تحديد المنطقة ({selectedBranch === 'NOZHA' ? 'النزهة' : 'المرج'})
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <MapPin size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <select
                      className="w-full pr-8 pl-3 py-2 border border-blue-200 rounded-lg text-xs font-medium bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      value={selectedArea}
                      onChange={e => {
                        setSelectedArea(e.target.value);
                        setCustomerCode('');
                        setCustomerName('');
                        setCustomerSearchText('');
                        setCustomerBalance(0);
                        setIsCustomerDropdownOpen(false);
                      }}
                    >
                      <option value="ALL">جميع مناطق {selectedBranch === 'NOZHA' ? 'إدارة النزهة' : 'إدارة المرج'} ({availableCustomers.length} عميل)</option>
                      {availableBranchAreas.map(area => (
                        <option key={area} value={area}>{area}</option>
                      ))}
                    </select>
                  </div>
                  {selectedArea !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedArea('ALL');
                        setCustomerCode('');
                        setCustomerName('');
                        setCustomerSearchText('');
                        setCustomerBalance(0);
                        setIsCustomerDropdownOpen(false);
                      }}
                      className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-bold cursor-pointer"
                      title="عرض جميع مناطق الإدارة"
                    >
                      إلغاء الفلتر
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Step 3: Cascading Customer Selection */}
            <div className="pt-2 border-t border-blue-200/50">
              <label className="text-xs font-bold text-blue-900 flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white inline-flex items-center justify-center text-[11px] font-bold">3</span>
                  اختيار العميل (مفلتر حسب {selectedBranch === 'NOZHA' ? 'النزهة' : 'المرج'} {selectedArea !== 'ALL' ? `- ${selectedArea}` : ''})
                </span>
                <span className="text-[11px] text-blue-600 font-medium">
                  ({availableCustomers.length} عميل نشط)
                </span>
              </label>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start" ref={customerDropdownRef}>
                {/* Search Box / Dropdown */}
                <div className="md:col-span-7 relative">
                  <div className="relative">
                    <input
                      type="text"
                      list="customerNamesList"
                      className="w-full p-2 pr-8 pl-8 border border-blue-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      value={customerSearchText}
                      onChange={e => handleCustomerSearchChange(e.target.value)}
                      onFocus={() => setIsCustomerDropdownOpen(true)}
                      placeholder="ابحث بكود أو اسم العميل: [C079] مرقص - عين شمس..."
                    />
                    <Search size={15} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    {customerCode && (
                      <button
                        type="button"
                        onClick={() => selectCustomer(null)}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 p-0.5 rounded cursor-pointer transition-colors"
                        title="إلغاء اختيار العميل"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <datalist id="customerNamesList">
                    {availableCustomers.map(c => (
                      <option key={`cust_name_${c.code}`} value={formatCustomerLabel(c)}>
                        رصيد سابق: {c.balance.toLocaleString()} ج.م
                      </option>
                    ))}
                  </datalist>

                  {/* Interactive Suggestions Popup */}
                  {isCustomerDropdownOpen && filteredCustomerSuggestions.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-blue-200 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-gray-100">
                      {filteredCustomerSuggestions.map(c => {
                        const isSelected = customerCode === c.code;
                        return (
                          <button
                            key={`suggest_${c.code}`}
                            type="button"
                            onClick={() => selectCustomer(c)}
                            className={`w-full text-right p-2.5 hover:bg-blue-50 flex items-center justify-between text-xs transition-colors cursor-pointer ${
                              isSelected ? 'bg-blue-50 font-bold border-r-4 border-blue-600' : ''
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 font-mono font-bold rounded text-[11px]">
                                {c.code}
                              </span>
                              <span className="font-bold text-gray-800 text-sm">
                                {c.name}
                              </span>
                              {c.area && (
                                <span className="text-gray-500 text-[11px]">
                                  - {c.area}
                                </span>
                              )}
                            </div>
                            <div className="text-left shrink-0">
                              <span className={`font-mono text-xs font-bold ${
                                c.balance < 0 ? 'text-red-600' : c.balance > 0 ? 'text-emerald-700' : 'text-gray-500'
                              }`} dir="ltr">
                                {c.balance.toLocaleString()} ج.م
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Customer Code Input */}
                <div className="md:col-span-2 relative">
                  <input
                    type="text"
                    list="customers"
                    className="w-full p-2 border border-blue-200 rounded-lg text-sm font-mono font-bold bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={customerCode}
                    onChange={e => handleCustomerCode(e.target.value)}
                    placeholder="كود العميل"
                  />
                  <datalist id="customers">
                    {availableCustomers.map(c => (
                      <option key={`cust_code_${c.code}`} value={c.code}>
                        {formatCustomerLabel(c)}
                      </option>
                    ))}
                  </datalist>
                </div>

                {/* Customer Balance Card */}
                <div className="md:col-span-3 bg-white p-2 rounded-lg border border-blue-200 flex justify-between items-center text-xs h-[38px]">
                  <span className="text-gray-600 font-medium">الرصيد السابق:</span>
                  <span className={`font-bold font-mono text-sm ${customerBalance < 0 ? 'text-red-600' : 'text-emerald-700'}`} dir="ltr">
                    {customerBalance.toLocaleString()} ج.م
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Invoice Details (Invoice ID, Date, Time) */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] font-bold text-gray-500 block mb-1">رقم الفاتورة</label>
              <input
                type="text"
                className="w-full p-1.5 border rounded bg-gray-50 text-xs font-mono"
                value={invoiceId}
                onChange={e => setInvoiceId(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 block mb-1">تاريخ الفاتورة</label>
              <input
                type="date"
                className="w-full p-1.5 border rounded bg-gray-50 text-xs"
                value={invoiceDate}
                onChange={e => setInvoiceDate(e.target.value)}
              />
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className="text-[10px] font-bold text-gray-500 block mb-1">وقت الفاتورة</label>
              <input
                type="text"
                className="w-full p-1.5 border rounded bg-gray-50 text-xs font-mono"
                value={invoiceTime}
                onChange={e => setInvoiceTime(e.target.value)}
              />
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
                  ref={itemCodeRef}
                  type="text" 
                  list="products"
                  className="w-full p-2 border rounded text-sm font-mono"
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
                  onChange={e => handleItemCode(e.target.value)}
                />
                <datalist id="products">
                  {products.map((p, idx) => <option key={`prod_code_${p.code || idx}_${idx}`} value={p.code}>{p.name}</option>)}
                </datalist>
            </div>
            
            <div className="col-span-9 md:col-span-4">
              <label className="text-[10px] font-bold text-gray-500 block mb-1">اسم الصنف</label>
              <input 
                ref={itemNameRef}
                type="text" 
                list="productNames"
                className="w-full p-2 border rounded bg-white text-sm" 
                value={currentItem.itemName} 
                placeholder="اسم الصنف أو اختر من القائمة" 
                onFocus={e => e.target.select()}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    quantityRef.current?.focus();
                    quantityRef.current?.select();
                  }
                }}
                onChange={e => handleItemName(e.target.value)}
              />
              <datalist id="productNames">
                {products.map((p, idx) => <option key={`prod_name_${p.code || idx}_${idx}`} value={p.name}>{p.code}</option>)}
              </datalist>
            </div>

            <div className="col-span-4 md:col-span-2">
              <label className="text-[10px] font-bold text-gray-500 block mb-1">
                الكمية بمخزن {selectedBranch === 'NOZHA' ? 'النزهة' : 'المرج'} ({currentStock})
              </label>
              <input 
                ref={quantityRef}
                type="number" 
                className="w-full p-2 border rounded font-bold text-center text-sm" 
                min="1" 
                max={currentStock}
                placeholder="0"
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
                onChange={e => {
                  const val = e.target.value;
                  setCurrentItem({...currentItem, quantity: val === '' ? '' : Number(val)});
                }}
              />
            </div>
            
            <div className="col-span-4 md:col-span-2">
              <label className="text-[10px] font-bold text-gray-500 block mb-1">
                السعر {!canEditPrices && <span className="text-[9px] text-amber-600 font-normal">(ثابت)</span>}
              </label>
              <input 
                ref={priceRef}
                type="number" 
                readOnly={!canEditPrices}
                className={`w-full p-2 border rounded text-center text-sm font-bold font-mono ${
                  !canEditPrices ? 'bg-gray-100 text-gray-600 cursor-not-allowed border-gray-200' : 'bg-white border-gray-300'
                }`}
                placeholder="0"
                title={!canEditPrices ? "ليس لديك صلاحية تعديل السعر يدوياً" : undefined}
                value={currentItem.price === 0 || currentItem.price === '' ? '' : currentItem.price}
                onFocus={e => canEditPrices && e.target.select()}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    addToCart();
                  }
                }}
                onChange={e => {
                  if (!canEditPrices) return;
                  const val = e.target.value;
                  setCurrentItem({...currentItem, price: val === '' ? '' : Number(val)});
                }}
              />
            </div>

            <div className="col-span-4 md:col-span-2">
              <button 
                type="button"
                onClick={addToCart}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 px-1 rounded flex items-center justify-center gap-1 font-bold transition-colors text-sm"
              >
                <PlusCircle size={16} /> إضافة
              </button>
            </div>
          </div>
        </div>

        {/* 3. Cart Table */}
        <div className="bg-white rounded-xl shadow-sm border border-brand-100 flex flex-col min-h-[260px] max-h-[480px]">
          <div className="p-3 bg-brand-50 border-b border-brand-100 font-bold text-brand-800 flex justify-between items-center text-sm">
            <span className="flex items-center gap-2"><ShoppingCart size={18}/> الأصناف</span>
            <span className="bg-white px-2 py-0.5 rounded-full text-xs border">{cartItems.length}</span>
          </div>
          <div className="overflow-x-auto overflow-y-auto max-h-[420px] flex-1">
            <table className="w-full text-right text-sm">
              <thead className="bg-gray-50 text-gray-600 sticky top-0 z-10 shadow-sm">
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

        {/* 4. Payment & Settlement Section */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-brand-100 space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
            <h3 className="font-bold text-brand-800 flex items-center gap-2 text-sm md:text-base">
              <CreditCard size={18} className="text-brand-600" /> طريقة السداد والدفع
            </h3>
            <span className="text-xs text-gray-500">
              {paymentType === 'CREDIT' ? 'الفاتورة بالكامل على الحساب (آجل)' : paymentType === 'CASH_FULL' ? 'سداد كامل الفاتورة نقداً' : 'سداد دفعة نقدية والباقي آجل'}
            </span>
          </div>

          {/* Payment Type Selection */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setPaymentType('CREDIT');
                setPaidAmountInput('0');
              }}
              className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                paymentType === 'CREDIT'
                  ? 'border-red-500 bg-red-50 text-red-700 shadow-sm font-bold ring-2 ring-red-300'
                  : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <FileText size={18} />
              <span className="text-xs md:text-sm font-bold">آجل بالكامل</span>
              <span className="text-[10px] text-gray-500">0 ج.م مدفوع</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPaymentType('PARTIAL');
                if (parsedPaid === 0 || parsedPaid >= cartTotal) {
                  setPaidAmountInput(Math.round(cartTotal * 0.5).toString());
                }
              }}
              className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                paymentType === 'PARTIAL'
                  ? 'border-amber-500 bg-amber-50 text-amber-800 shadow-sm font-bold ring-2 ring-amber-300'
                  : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Coins size={18} />
              <span className="text-xs md:text-sm font-bold">دفع جزء (دفعة)</span>
              <span className="text-[10px] text-gray-500">جزء نقداً والباقي آجل</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPaymentType('CASH_FULL');
                setPaidAmountInput(cartTotal.toString());
              }}
              className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                paymentType === 'CASH_FULL'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-sm font-bold ring-2 ring-emerald-300'
                  : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Banknote size={18} />
              <span className="text-xs md:text-sm font-bold">نقداً بالكامل</span>
              <span className="text-[10px] text-gray-500">{cartTotal.toLocaleString()} ج.م</span>
            </button>
          </div>

          {/* If Partial Payment Selected: Show Amount Input and Quick Buttons */}
          {paymentType === 'PARTIAL' && (
            <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200 space-y-3 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-bold text-amber-900 flex items-center gap-1">
                  <Coins size={14} /> حدد المبلغ المدفوع نقداً:
                </label>
                <div className="flex items-center gap-1 text-xs">
                  {excessPaid > 0 ? (
                    <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                      فائض يخصم من المديونية: +{excessPaid.toLocaleString()} ج.م
                    </span>
                  ) : (
                    <>
                      <span className="text-gray-500">المتبقي على الحساب:</span>
                      <span className="font-bold font-mono text-red-600 text-sm">
                        {remainingAmount.toLocaleString()} ج.م
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    dir="ltr"
                    value={paidAmountInput}
                    onFocus={e => e.target.select()}
                    onChange={e => handleNumericChangeWithCommas(e.target.value, setPaidAmountInput)}
                    placeholder="0"
                    className="w-full p-2.5 pl-12 border border-amber-300 rounded-lg font-bold font-mono text-base md:text-lg text-gray-800 focus:ring-2 focus:ring-amber-500 outline-none bg-white text-center"
                  />
                  <span className="absolute left-3 top-3 text-xs text-gray-400 font-bold">ج.م</span>
                </div>

                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleQuickPercent(25)}
                    className="px-2.5 py-2 text-xs font-bold bg-white border border-amber-200 text-amber-800 rounded-lg hover:bg-amber-100 transition-colors"
                  >
                    25%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickPercent(50)}
                    className="px-2.5 py-2 text-xs font-bold bg-white border border-amber-200 text-amber-800 rounded-lg hover:bg-amber-100 transition-colors"
                  >
                    50%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickPercent(75)}
                    className="px-2.5 py-2 text-xs font-bold bg-white border border-amber-200 text-amber-800 rounded-lg hover:bg-amber-100 transition-colors"
                  >
                    75%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickPercent(100)}
                    className="px-2.5 py-2 text-xs font-bold bg-white border border-amber-200 text-amber-800 rounded-lg hover:bg-amber-100 transition-colors"
                  >
                    100%
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Treasury / Account Destination Selector (Shown when currentPaid > 0) */}
          {currentPaid > 0 && (
            <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 space-y-2 animate-fade-in">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-emerald-900 flex items-center gap-1">
                  <Wallet size={15} /> إيداع المبلغ المدفوع ({currentPaid.toLocaleString()} ج.م) في:
                </label>
                <span className="text-[11px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-full border border-emerald-200">
                  سيتم إضافة المبلغ للخزنة
                </span>
              </div>

              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full p-2.5 border border-emerald-300 rounded-lg text-sm font-bold text-gray-800 bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="CASH">خزنة رئيسية (كاش نقدية)</option>
                <option value="BANK_MISR">بنك مصر</option>
                <option value="BANK_AHLY">البنك الأهلي</option>
                <option value="VF_CASH_AYMAN">فودافون كاش - أيمن</option>
                <option value="VF_CASH_KYRILLOS">فودافون كاش - كيرلس</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 4. Desktop Sidebar (Summary & History) - Hidden on Mobile */}
      <div className="hidden xl:col-span-1 xl:flex flex-col gap-6">
        {/* Totals Card */}
        <div className="bg-gray-900 text-white p-6 rounded-xl shadow-lg space-y-3">
           <h3 className="text-lg font-bold border-b border-gray-700 pb-2 text-gray-300">ملخص الفاتورة والحساب</h3>
           
           <div className="flex justify-between items-center text-gray-300">
             <span>إجمالي الفاتورة</span>
             <span className="font-mono text-xl text-white">{cartTotal.toLocaleString()} ج.م</span>
           </div>

           <div className="flex justify-between items-center text-emerald-400 bg-gray-800/80 px-3 py-2 rounded-lg border border-emerald-900/50">
             <span className="text-sm font-bold flex items-center gap-1">
               <CheckCircle size={14}/> المدفوع الآن:
             </span>
             <span className="font-mono font-bold text-lg text-emerald-300">
               {currentPaid.toLocaleString()} ج.م
             </span>
           </div>

           <div className={`flex justify-between items-center px-3 py-2 rounded-lg border ${
             excessPaid > 0 
               ? 'text-emerald-400 bg-gray-800/80 border-emerald-900/50' 
               : 'text-amber-400 bg-gray-800/80 border-amber-900/50'
           }`}>
             <span className="text-sm font-bold">
               {excessPaid > 0 ? 'فائض لحساب العميل:' : 'المتبقي من الفاتورة:'}
             </span>
             <span className={`font-mono font-bold text-lg ${excessPaid > 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
               {excessPaid > 0 
                 ? `+${excessPaid.toLocaleString()} ج.م` 
                 : `${remainingAmount.toLocaleString()} ج.م`}
             </span>
           </div>

           <div className="pt-2 space-y-2 border-t border-gray-700 mt-2">
             <div className="flex justify-between items-center text-sm text-gray-400">
               <span>رصيد سابق للعميل</span>
               <span className="font-mono" dir="ltr">{customerBalance.toLocaleString()}</span>
             </div>
             <div className="flex justify-between items-center bg-gray-800 p-2.5 rounded-lg mt-2">
               <span className="font-bold text-yellow-400">الرصيد النهائي للعميل</span>
               <span className={`font-mono text-2xl font-bold ${newBalance < 0 ? 'text-red-400' : 'text-green-400'}`} dir="ltr">
                 {newBalance.toLocaleString()}
               </span>
             </div>
           </div>

           <button 
            type="button"
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
             <div className="flex items-center gap-2">
               <span className="text-xs text-gray-400">الإجمالي:</span>
               <span className="font-bold text-base font-mono text-yellow-400">{cartTotal.toLocaleString()}</span>
             </div>
             <div className="flex items-center gap-2 text-xs">
               <span className="text-emerald-400">مدفوع: {currentPaid.toLocaleString()}</span>
               {excessPaid > 0 ? (
                 <span className="text-emerald-300 font-bold">| فائض: +{excessPaid.toLocaleString()}</span>
               ) : (
                 <span className="text-red-400">| متبقي: {remainingAmount.toLocaleString()}</span>
               )}
             </div>
          </div>
          <button 
            type="button"
            onClick={handleSaveInvoice}
            className="flex-1 bg-brand-600 active:bg-brand-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg flex justify-center items-center gap-2"
          >
             <Save size={20} /> حفظ الفاتورة
          </button>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 text-center animate-fade-in border border-gray-100">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
              <CheckCircle size={34} />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-1">تم حفظ الفاتورة بنجاح!</h2>
            <p className="text-xs text-gray-500 mb-4">تم تحديث المخزن والخزينة وحساب العميل بنجاح</p>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 my-3 text-sm text-right space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">رقم الفاتورة:</span>
                <span className="font-bold font-mono text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">{lastSavedInvoice?.id}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">العميل:</span>
                <span className="font-bold text-gray-800">{lastSavedInvoice?.customerName}</span>
              </div>
              {/* السطر الأول: إجمالي الفاتورة */}
              <div className="flex justify-between items-center text-sm font-bold text-gray-900 border-b border-gray-200 pb-1.5">
                <span>إجمالي الفاتورة:</span>
                <span className="font-bold font-mono text-base">{lastSavedInvoice?.total.toLocaleString()} ج.م</span>
              </div>

              {/* السطر الثاني: المديونية السابقة */}
              <div className="flex justify-between items-center text-gray-600">
                <span>المديونية السابقة:</span>
                <span className="font-bold font-mono" dir="ltr">{(lastSavedInvoice?.previousBalance || 0).toLocaleString()} ج.م</span>
              </div>

              {/* السطر الثالث: دفعة مسددة */}
              <div className="flex justify-between items-center text-emerald-700 font-bold">
                <span>دفعة مسددة:</span>
                <span className="font-mono">{(lastSavedInvoice?.paidAmount || 0) > 0 ? `${(lastSavedInvoice?.paidAmount || 0).toLocaleString()} ج.م` : '0 ج.م'}</span>
              </div>

              {/* السطر الرابع: الإجمالي */}
              <div className="flex justify-between items-center border-t border-gray-200 pt-2 text-xs">
                <span className="text-gray-900 font-bold">الإجمالي:</span>
                <span className={`font-bold font-mono text-sm ${(lastSavedInvoice?.currentBalance || 0) < 0 ? 'text-red-600' : 'text-green-600'}`} dir="ltr">
                  {(lastSavedInvoice?.currentBalance || 0).toLocaleString()} ج.م
                </span>
              </div>

              {/* شريط سفلي مستقل: رصيد العميل الحالي في كشف الحساب */}
              {(() => {
                const liveCustBal = customers.find(c => c.code === lastSavedInvoice?.customerCode)?.balance ?? lastSavedInvoice?.currentBalance ?? 0;
                return (
                  <div className="mt-2 pt-2 border-t border-gray-200 bg-white p-2 rounded-lg text-[11px] flex justify-between items-center">
                    <span className="text-gray-600 font-bold">رصيد العميل الحالي في كشف الحساب:</span>
                    <span className={`font-mono font-bold ${liveCustBal < 0 ? 'text-red-600' : liveCustBal > 0 ? 'text-emerald-600' : 'text-gray-700'}`} dir="ltr">
                      {liveCustBal.toLocaleString()} ج.م {liveCustBal < 0 ? '(مدين)' : liveCustBal > 0 ? '(له رصيد)' : '(خالص)'}
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* WhatsApp Phone Destination Input */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 my-4 text-right">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="text-xs font-bold text-emerald-900 flex items-center gap-1.5 shrink-0">
                  <MessageCircle size={16} className="text-[#25D366]" />
                  رقم واتساب العميل للإرسال:
                </label>
                <input 
                  type="tel"
                  value={modalCustomerPhone}
                  onChange={(e) => setModalCustomerPhone(e.target.value)}
                  placeholder="مثال: 01012345678"
                  className="w-48 bg-white border border-emerald-300 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-gray-800 outline-none focus:ring-2 focus:ring-emerald-500"
                  dir="ltr"
                />
              </div>
              <div className="text-[11px] text-emerald-700">
                ⚡ يمكنك مشاركة الفاتورة كصورة عالية الدقة أو إرسالها بصيغة PDF الرسمية عبر واتساب مباشرة.
              </div>
            </div>
            
            {/* Action Buttons: WhatsApp PDF, WhatsApp Image, Print, New Invoice */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
              <button 
                onClick={handleShareWhatsApp}
                disabled={isSharingPdf}
                className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white py-2.5 sm:py-3.5 px-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all text-xs sm:text-sm shadow-md hover:shadow-lg disabled:opacity-60 cursor-pointer order-1 sm:order-2"
                title="إرسال الفاتورة PDF عبر واتساب مباشرة"
              >
                <MessageCircle size={16} /> 
                <span>{isSharingPdf ? 'جاري التحويل...' : 'مشاركة PDF'}</span>
              </button>

              <button 
                onClick={handleShareWhatsAppImage}
                disabled={isSharingImage}
                className="bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white py-2.5 sm:py-3.5 px-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all text-xs sm:text-sm shadow-md hover:shadow-lg disabled:opacity-60 cursor-pointer order-2 sm:order-3"
                title="مشاركة الفاتورة كصورة عبر واتساب"
              >
                <ImageIcon size={16} /> 
                <span>{isSharingImage ? 'جاري التحضير...' : 'مشاركة كصورة'}</span>
              </button>

              <button 
                onClick={handlePrint}
                className="bg-gray-800 hover:bg-gray-900 active:bg-black text-white py-2.5 sm:py-3.5 px-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all text-xs sm:text-sm shadow-md cursor-pointer order-3 sm:order-1"
              >
                <Printer size={16} /> <span>طباعة الفاتورة</span>
              </button>
              
              <button 
                onClick={handleCloseModal}
                className="bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white py-2.5 sm:py-3.5 px-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all text-xs sm:text-sm shadow-md cursor-pointer order-4 sm:order-4"
              >
                <RefreshCcw size={16} /> <span>فاتورة جديدة</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
