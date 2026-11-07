import React, { useState, useEffect, useMemo } from 'react';
import { useERP } from '../context/ERPContext';
import { 
  Calendar, 
  Search, 
  FileText, 
  X, 
  Printer, 
  Trash2, 
  Check, 
  AlertTriangle, 
  Edit, 
  Plus, 
  Save, 
  Coins, 
  CreditCard, 
  Wallet, 
  Banknote, 
  MessageCircle,
  Building,
  MapPin
} from 'lucide-react';
import { SalesInvoice, InvoiceItem, PaymentMethod, BranchId, BRANCHES, BRANCH_AREAS, getBranchAreas } from '../types';
import { formatWithCommas, parseNumberFromCommas, handleNumericChangeWithCommas } from '../utils/formatters';
import { shareSalesInvoicePdfViaWhatsApp } from '../utils/whatsapp';
import { useBackHandler } from '../utils/backNavigation';

export const SalesHistory: React.FC = () => {
  const { invoices, products, customers, printInvoice, deleteInvoice, clearAllInvoices, updateInvoice, currentUser, companyLogo } = useERP();
  
  const canDeleteInvoices = currentUser?.role === 'ADMIN' || currentUser?.username === 'admin' || Boolean(currentUser?.permissions?.canDeleteInvoices);
  const canEditInvoices = currentUser?.role === 'ADMIN' || currentUser?.username === 'admin' || Boolean(currentUser?.permissions?.canEditInvoices);
  const canEditPrices = currentUser?.role === 'ADMIN' || currentUser?.username === 'admin' || Boolean(currentUser?.permissions?.canEditPrices);

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<'ALL' | BranchId>('ALL');
  const [selectedAreaFilter, setSelectedAreaFilter] = useState<string>('ALL');
  
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [editInvoiceId, setEditInvoiceId] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editBranchId, setEditBranchId] = useState<BranchId>('MARG');
  const [editArea, setEditArea] = useState<string>('');
  const [editItems, setEditItems] = useState<InvoiceItem[]>([]);
  const [editCustomer, setEditCustomer] = useState({ code: '', name: '' });
  const [editPaidAmount, setEditPaidAmount] = useState<string>('0');
  const [editPaymentMethod, setEditPaymentMethod] = useState<PaymentMethod>('CASH');
  
  // New Item for Edit Modal
  const [newItem, setNewItem] = useState<{ code: string, quantity: number | '', price: number | '' }>({
    code: '', quantity: '', price: ''
  });

  // Hardware Back button handlers
  useBackHandler(() => setIsEditing(false), isEditing, 'sales-history-edit-modal');
  useBackHandler(() => setSelectedInvoice(null), !!selectedInvoice, 'sales-history-view-modal');
  useBackHandler(() => setDeleteConfirmId(null), !!deleteConfirmId, 'sales-history-delete-confirm');
  useBackHandler(() => setShowClearConfirm(false), showClearConfirm, 'sales-history-clear-confirm');

  const [sharingPdfId, setSharingPdfId] = useState<string | null>(null);

  // Reset area filter when branch filter changes
  const handleBranchFilterChange = (branch: 'ALL' | BranchId) => {
    setSelectedBranchFilter(branch);
    setSelectedAreaFilter('ALL');
  };

  const handleShareInvoicePdf = async (inv: SalesInvoice) => {
    if (sharingPdfId) return;
    let syncTab: Window | null = null;
    const isNative = typeof navigator !== 'undefined' &&
      typeof navigator.canShare === 'function' &&
      typeof navigator.share === 'function';

    if (!isNative) {
      try {
        syncTab = window.open('about:blank', '_blank');
      } catch {}
    }

    let safetyTimer: any = null;
    try {
      setSharingPdfId(inv.id);
      safetyTimer = setTimeout(() => {
        setSharingPdfId(null);
      }, 3500);

      const cust = customers.find(c => c.code === inv.customerCode);
      const invoiceWithLiveBal = {
        ...inv,
        currentBalance: cust ? cust.balance : inv.currentBalance,
        liveCustomerBalance: cust ? cust.balance : inv.currentBalance
      };
      await shareSalesInvoicePdfViaWhatsApp(invoiceWithLiveBal, companyLogo, cust?.phone, null, syncTab);
    } catch (err: any) {
      if (syncTab && !syncTab.closed) syncTab.close();
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
  };

  const getPaymentMethodLabel = (method?: PaymentMethod): string => {
    if (method === 'BANK_AHLY') return 'البنك الأهلي';
    if (method === 'BANK_MISR') return 'بنك مصر';
    if (method === 'VF_CASH_AYMAN') return 'فودافون كاش أيمن';
    if (method === 'VF_CASH_KYRILLOS') return 'فودافون كاش كيرلس';
    return 'خزنة (كاش)';
  };

  // Filtered invoices according to Date, Search, Branch, and Area
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (inv.isDeleted) return false;
      const matchesDate = inv.date === selectedDate;
      const matchesSearch = 
        inv.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
        inv.customerName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const invBranch = inv.branchId || 'MARG';
      const matchesBranch = selectedBranchFilter === 'ALL' || invBranch === selectedBranchFilter;

      const cust = customers.find(c => c.code === inv.customerCode);
      const invArea = inv.area || cust?.area || '';
      const matchesArea = selectedAreaFilter === 'ALL' || invArea === selectedAreaFilter;

      return matchesDate && matchesSearch && matchesBranch && matchesArea;
    });
  }, [invoices, selectedDate, searchTerm, selectedBranchFilter, selectedAreaFilter, customers]);

  const dayTotal = filteredInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const dayPaidTotal = filteredInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
  const dayRemainingTotal = filteredInvoices.reduce((sum, inv) => sum + (inv.remainingAmount !== undefined ? inv.remainingAmount : (inv.total - (inv.paidAmount || 0))), 0);

  const handleDelete = async (id: string) => {
    if (!canDeleteInvoices) {
      alert('ليس لديك صلاحية حذف فواتير البيع');
      return;
    }
    await deleteInvoice(id);
    setDeleteConfirmId(null);
  };

  const handleClearAll = async () => {
    if (!canDeleteInvoices) {
      alert('ليس لديك صلاحية حذف فواتير البيع');
      return;
    }
    const success = await clearAllInvoices();
    if (success) {
      setShowClearConfirm(false);
      alert("تم حذف جميع الفواتير بنجاح. سيبدأ الترقيم من N001.");
    }
  };

  // --- Edit Handlers ---
  const openEditModal = (invoice: SalesInvoice) => {
    if (!canEditInvoices) {
      alert('ليس لديك صلاحية تعديل الفواتير');
      return;
    }
    setEditInvoiceId(invoice.id);
    setEditDate(invoice.date);
    setEditTime(invoice.time);
    setEditBranchId(invoice.branchId || 'MARG');
    setEditArea(invoice.area || '');
    setEditItems([...invoice.items]);
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
    const finalPaid = Math.max(0, parsedPaid);
    const finalRemaining = Math.max(0, newTotal - finalPaid);
    
    const newInvoiceData: SalesInvoice = {
      ...oldInvoice,
      date: editDate,
      time: editTime,
      branchId: editBranchId,
      area: editArea,
      items: editItems,
      total: newTotal,
      paidAmount: finalPaid,
      remainingAmount: finalRemaining,
      paymentMethod: finalPaid > 0 ? editPaymentMethod : undefined,
      currentBalance: oldInvoice.previousBalance - newTotal + finalPaid
    };

    await updateInvoice(oldInvoice, newInvoiceData);
    setIsEditing(false);
    alert("تم تعديل الفاتورة وتصحيح الخزنة والمخزن والرصيد بنجاح");
  };

  // Available areas based on selected branch filter (default + custom areas)
  const availableAreas = useMemo(() => {
    if (selectedBranchFilter === 'ALL') {
      const combined = new Set<string>();
      getBranchAreas('MARG', customers).forEach(a => combined.add(a));
      getBranchAreas('NOZHA', customers).forEach(a => combined.add(a));
      return Array.from(combined);
    }
    return getBranchAreas(selectedBranchFilter, customers);
  }, [selectedBranchFilter, customers]);

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-brand-100 flex flex-col gap-4">
        <div className="flex justify-between items-center border-b pb-3">
          <div>
            <h2 className="text-xl font-bold text-brand-800 flex items-center gap-2">
              <FileText className="text-brand-600" /> سجل فواتير المبيعات
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">استعراض وتدقيق الفواتير حسب التاريخ، الإدارة والمنطقة</p>
          </div>
           
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
                className="flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors shadow-xs"
              >
                <Trash2 size={15} className="text-red-600" /> تصفير سجل الفواتير
              </button>
            )
          )}
        </div>

        {/* Branch & Area Cascading Filter Toolbar */}
        <div className="p-3 bg-gradient-to-r from-blue-50/60 to-indigo-50/60 rounded-xl border border-blue-200/60 flex flex-wrap items-center justify-between gap-3">
          {/* Branch filter tabs */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-blue-900 ml-1">الإدارة / الفرع:</span>
            <button
              type="button"
              onClick={() => handleBranchFilterChange('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedBranchFilter === 'ALL'
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              كل الإدارات
            </button>
            <button
              type="button"
              onClick={() => handleBranchFilterChange('MARG')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                selectedBranchFilter === 'MARG'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-blue-700 border border-blue-200 hover:bg-blue-50'
              }`}
            >
              <Building size={13} /> إدارة المرج
            </button>
            <button
              type="button"
              onClick={() => handleBranchFilterChange('NOZHA')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                selectedBranchFilter === 'NOZHA'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-white text-purple-700 border border-purple-200 hover:bg-purple-50'
              }`}
            >
              <Building size={13} /> إدارة النزهة
            </button>
          </div>

          {/* Dynamic Area filter */}
          <div className="flex items-center gap-2 flex-1 sm:flex-initial min-w-[220px]">
            <span className="text-xs font-bold text-blue-900 flex items-center gap-1">
              <MapPin size={13} /> المنطقة:
            </span>
            <select
              className="w-full sm:w-auto flex-1 px-3 py-1.5 border border-blue-200 rounded-lg text-xs font-bold bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
              value={selectedAreaFilter}
              onChange={e => setSelectedAreaFilter(e.target.value)}
            >
              <option value="ALL">جميع المناطق</option>
              {availableAreas.map(area => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Date & Search Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
              <Calendar size={14}/> تاريخ الفواتير
            </label>
            <input 
              type="date"
              className="w-full p-2.5 border border-gray-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-brand-500 outline-none"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
              <Search size={14}/> بحث برقم الفاتورة أو العميل
            </label>
            <input 
              type="text"
              className="w-full p-2.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 outline-none"
              placeholder="ابحث بالرقم أو اسم العميل..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Totals Summary Cards for Selected Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-gray-100">
          <div className="bg-blue-50/70 p-3.5 rounded-xl border border-blue-100">
            <span className="text-[11px] font-bold text-blue-800 block">إجمالي مبيعات اليوم (المفلترة)</span>
            <span className="text-xl font-black text-blue-900 font-mono" dir="ltr">
              {dayTotal.toLocaleString()} <span className="text-xs font-normal">ج.م</span>
            </span>
          </div>

          <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-100">
            <span className="text-[11px] font-bold text-emerald-800 block">المحصل نقداً</span>
            <span className="text-xl font-black text-emerald-700 font-mono" dir="ltr">
              {dayPaidTotal.toLocaleString()} <span className="text-xs font-normal">ج.م</span>
            </span>
          </div>

          <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-100">
            <span className="text-[11px] font-bold text-amber-800 block">المتبقي على الحساب (آجل)</span>
            <span className="text-xl font-black text-amber-700 font-mono" dir="ltr">
              {dayRemainingTotal.toLocaleString()} <span className="text-xs font-normal">ج.م</span>
            </span>
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl shadow-sm border border-brand-100 overflow-hidden">
        <div className="p-4 border-b border-brand-50 bg-brand-50/50 flex flex-wrap justify-between items-center gap-2">
           <h3 className="font-bold text-brand-800 text-sm">
             سجل فواتير يوم {selectedDate} 
             {selectedBranchFilter !== 'ALL' && ` - ${selectedBranchFilter === 'NOZHA' ? 'فرع النزهة' : 'فرع المرج'}`}
             {selectedAreaFilter !== 'ALL' && ` (${selectedAreaFilter})`}
           </h3>
           <span className="text-xs bg-white px-2.5 py-1 rounded-md border text-gray-600 font-bold">
             عدد الفواتير: {filteredInvoices.length}
           </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs sm:text-sm">
            <thead className="bg-gray-50 text-gray-700 font-bold border-b">
              <tr>
                <th className="p-3 w-20"># الرقم</th>
                <th className="p-3 w-20">الوقت</th>
                <th className="p-3">العميل والمنطقة</th>
                <th className="p-3 w-24">الإدارة</th>
                <th className="p-3 w-20 text-center">الأصناف</th>
                <th className="p-3 w-28 text-center">الإجمالي</th>
                <th className="p-3 w-28 text-center">المدفوع</th>
                <th className="p-3 w-28 text-center">المتبقي</th>
                <th className="p-3 w-24 text-center">الحالة</th>
                <th className="p-3 text-center w-36">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredInvoices.map((inv) => {
                const paid = inv.paidAmount || 0;
                const remaining = inv.remainingAmount !== undefined ? inv.remainingAmount : (inv.total - paid);
                const isFullyPaid = paid >= inv.total;
                const isPartial = paid > 0 && paid < inv.total;
                const bId = inv.branchId || 'MARG';
                const cust = customers.find(c => c.code === inv.customerCode);
                const areaName = inv.area || cust?.area;

                return (
                  <tr key={inv.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="p-3 font-mono font-bold text-brand-700">{inv.id}</td>
                    <td className="p-3 text-gray-500 font-mono">{inv.time}</td>
                    <td className="p-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-900 block">{inv.customerName}</span>
                          <span 
                            className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border inline-flex items-center gap-1 ${
                              (cust ? cust.balance : (inv.currentBalance || 0)) < 0 
                                ? 'bg-red-50 text-red-700 border-red-200' 
                                : (cust ? cust.balance : (inv.currentBalance || 0)) > 0
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-gray-50 text-gray-600 border-gray-200'
                            }`}
                            title="إجمالي مديونية / رصيد العميل الحالي في النظام"
                          >
                            <span>الرصيد الحالي:</span>
                            <span dir="ltr">{(cust ? cust.balance : (inv.currentBalance || 0)).toLocaleString()} ج.م</span>
                          </span>
                        </div>
                        {areaName && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                            <MapPin size={10} className="text-gray-400" /> {areaName}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                        bId === 'NOZHA'
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : 'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}>
                        <Building size={11} /> {bId === 'NOZHA' ? 'النزهة' : 'المرج'}
                      </span>
                    </td>
                    <td className="p-3 text-center text-gray-600 font-mono">{inv.items.length}</td>
                    <td className="p-3 text-center font-bold text-gray-900 font-mono">{inv.total.toLocaleString()}</td>
                    <td className="p-3 text-center font-bold text-emerald-600 font-mono">
                      {paid > 0 ? (
                        <div className="flex flex-col">
                          <span>{paid.toLocaleString()}</span>
                          <span className="text-[10px] text-gray-400 font-normal">{getPaymentMethodLabel(inv.paymentMethod)}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 font-normal">0</span>
                      )}
                    </td>
                    <td className="p-3 text-center font-bold text-amber-700 font-mono">
                      {remaining > 0 ? remaining.toLocaleString() : <span className="text-gray-400 font-normal">0</span>}
                    </td>
                    <td className="p-3 text-center">
                      {isFullyPaid ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-100 text-green-800">
                          خالص
                        </span>
                      ) : isPartial ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                          جزئي
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800">
                          آجل
                        </span>
                      )}
                    </td>
                    <td className="p-3 flex gap-1.5 items-center justify-center">
                      <button 
                        onClick={() => setSelectedInvoice(inv)}
                        className="bg-brand-50 text-brand-700 hover:bg-brand-100 p-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        title="عرض تفاصيل الفاتورة"
                      >
                        <FileText size={15} />
                      </button>

                      <button 
                        onClick={() => {
                          const liveBal = cust ? cust.balance : inv.currentBalance;
                          printInvoice({ ...inv, currentBalance: liveBal, liveCustomerBalance: liveBal });
                        }}
                        className="bg-gray-100 text-gray-700 hover:bg-gray-200 p-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        title="طباعة الفاتورة"
                      >
                        <Printer size={15} />
                      </button>

                      {canEditInvoices && (
                        <button 
                          onClick={() => openEditModal(inv)}
                          className="bg-blue-50 text-blue-700 hover:bg-blue-100 p-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          title="تعديل الفاتورة والسداد"
                        >
                          <Edit size={15} />
                        </button>
                      )}

                      <button 
                        onClick={() => handleShareInvoicePdf(inv)}
                        disabled={sharingPdfId === inv.id}
                        className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 p-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        title="إرسال عبر واتساب"
                      >
                        <MessageCircle size={15} />
                      </button>

                      {canDeleteInvoices && (
                        deleteConfirmId === inv.id ? (
                          <div className="flex items-center gap-1 bg-red-50 p-1 rounded border border-red-200 animate-fade-in">
                             <button 
                               onClick={() => handleDelete(inv.id)} 
                               className="bg-red-600 text-white p-1 rounded hover:bg-red-700 transition-colors shadow-xs" 
                               title="تأكيد الحذف"
                             >
                               <Check size={14}/>
                             </button>
                             <button 
                               onClick={() => setDeleteConfirmId(null)} 
                               className="bg-white text-gray-600 p-1 rounded border border-gray-200 hover:bg-gray-100 transition-colors" 
                               title="إلغاء"
                             >
                               <X size={14}/>
                             </button>
                           </div>
                        ) : (
                          <button 
                            onClick={() => setDeleteConfirmId(inv.id)}
                            className="text-red-500 hover:bg-red-50 hover:text-red-700 p-1.5 rounded-lg transition-colors cursor-pointer"
                            title="حذف الفاتورة"
                          >
                            <Trash2 size={15} />
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-gray-400">
                    <p className="font-bold">لا توجد فواتير مطابقة للبحث أو التاريخ المحدد</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Invoice Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in border border-blue-100">
            <div className="bg-brand-600 p-4 text-white flex justify-between items-center shrink-0">
               <h3 className="font-bold flex items-center gap-2">
                 <Edit size={18}/> تعديل الفاتورة {editInvoiceId}
               </h3>
               <button onClick={() => setIsEditing(false)}><X size={18}/></button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
               {/* Meta info */}
               <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-3 rounded-lg text-xs">
                 <div>
                   <span className="text-gray-500 block mb-1">العميل:</span>
                   <span className="font-bold text-gray-800">{editCustomer.name}</span>
                 </div>
                 <div>
                   <span className="text-gray-500 block mb-1">التاريخ:</span>
                   <input 
                     type="date" className="p-1 border rounded w-full bg-white font-bold"
                     value={editDate} onChange={e => setEditDate(e.target.value)}
                   />
                 </div>
                 <div>
                   <span className="text-gray-500 block mb-1">الإدارة / الفرع:</span>
                   <select
                     className="p-1 border rounded w-full bg-white font-bold"
                     value={editBranchId}
                     onChange={e => {
                       const b = e.target.value as BranchId;
                       setEditBranchId(b);
                       setEditArea(BRANCH_AREAS[b]?.[0] || '');
                     }}
                   >
                     <option value="MARG">إدارة المرج</option>
                     <option value="NOZHA">إدارة النزهة</option>
                   </select>
                 </div>
                 <div>
                   <span className="text-gray-500 block mb-1">المنطقة:</span>
                   <select
                     className="p-1 border rounded w-full bg-white font-bold"
                     value={editArea}
                     onChange={e => setEditArea(e.target.value)}
                   >
                     {(BRANCH_AREAS[editBranchId] || []).map(a => (
                       <option key={a} value={a}>{a}</option>
                     ))}
                   </select>
                 </div>
               </div>

               {/* Add Item Row */}
               <div className="flex flex-wrap gap-2 items-end bg-blue-50/70 p-3 rounded-xl border border-blue-200">
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-xs font-bold text-blue-900 block mb-1">إضافة صنف</label>
                    <select 
                      className="w-full p-2 rounded-lg border bg-white text-xs font-bold"
                      value={newItem.code}
                      onChange={e => {
                        const p = products.find(prod => prod.code === e.target.value);
                        setNewItem({ code: e.target.value, quantity: 1, price: p?.price || '' });
                      }}
                    >
                      <option value="">-- اختر صنف للإضافة --</option>
                      {products.map(p => (
                        <option key={p.code} value={p.code}>{p.name} ({p.code})</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-24">
                    <label className="text-xs font-bold text-blue-900 block mb-1">الكمية</label>
                    <input 
                      type="number" min="1" className="w-full p-2 rounded-lg border text-xs text-center font-bold"
                      placeholder="الكمية"
                      value={newItem.quantity}
                      onChange={e => setNewItem(prev => ({ ...prev, quantity: e.target.value === '' ? '' : Number(e.target.value) }))}
                    />
                  </div>
                  <div className="w-28">
                    <label className="text-xs font-bold text-blue-900 block mb-1">
                      السعر {!canEditPrices && <span className="text-[10px] text-amber-600">(ثابت)</span>}
                    </label>
                    <input 
                      type="number" min="0" 
                      readOnly={!canEditPrices}
                      className={`w-full p-2 rounded-lg border text-xs text-center font-bold font-mono ${
                        !canEditPrices ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white'
                      }`}
                      placeholder="السعر"
                      value={newItem.price}
                      onChange={e => {
                        if (!canEditPrices) return;
                        setNewItem(prev => ({ ...prev, price: e.target.value === '' ? '' : Number(e.target.value) }));
                      }}
                    />
                  </div>
                  <button onClick={handleAddItem} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 cursor-pointer">
                    <Plus size={18}/>
                  </button>
               </div>

               {/* Items Table */}
               <table className="w-full text-right text-xs border rounded-lg overflow-hidden">
                 <thead className="bg-gray-100 font-bold text-gray-700">
                   <tr>
                     <th className="p-2.5">الصنف</th>
                     <th className="p-2.5 w-24 text-center">الكمية</th>
                     <th className="p-2.5 w-28 text-center">السعر</th>
                     <th className="p-2.5 w-28 text-center">الإجمالي</th>
                     <th className="p-2.5 w-10"></th>
                   </tr>
                 </thead>
                 <tbody className="divide-y">
                   {editItems.map((item, idx) => (
                     <tr key={idx}>
                       <td className="p-2.5 font-bold">{item.itemName}</td>
                       <td className="p-2.5 text-center">
                         <input 
                           type="number" className="w-16 p-1 border rounded text-center font-bold font-mono"
                           value={item.quantity}
                           onChange={e => handleUpdateItem(idx, 'quantity', Number(e.target.value))}
                         />
                       </td>
                       <td className="p-2.5 text-center">
                         <input 
                           type="number" 
                           readOnly={!canEditPrices}
                           className={`w-20 p-1 border rounded text-center font-bold font-mono ${
                             !canEditPrices ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white'
                           }`}
                           value={item.price}
                           onChange={e => {
                             if (!canEditPrices) return;
                             handleUpdateItem(idx, 'price', Number(e.target.value));
                           }}
                         />
                       </td>
                       <td className="p-2.5 font-bold text-center font-mono">{item.total.toLocaleString()}</td>
                       <td className="p-2.5 text-center">
                         <button onClick={() => handleRemoveItem(idx)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                           <Trash2 size={15}/>
                         </button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>

               {/* Edit Payment Settings */}
               <div className="bg-emerald-50/80 p-4 rounded-xl border border-emerald-200 space-y-3">
                 <h4 className="font-bold text-emerald-900 text-xs flex items-center gap-2">
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
                       className="w-full p-2 border border-emerald-300 rounded-lg font-bold text-emerald-800 bg-white font-mono text-center text-sm"
                     />
                   </div>
                   <div>
                     <label className="text-xs font-bold text-gray-700 block mb-1">طريقة السداد / الخزنة:</label>
                     <select
                       value={editPaymentMethod}
                       onChange={e => setEditPaymentMethod(e.target.value as PaymentMethod)}
                       className="w-full p-2 border border-emerald-300 rounded-lg text-xs font-bold bg-white"
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
                     {Math.max(0, editItems.reduce((s, i) => s + i.total, 0) - parseNumberFromCommas(editPaidAmount)).toLocaleString()} ج.م
                   </span>
                 </div>
               </div>
            </div>

            <div className="p-4 bg-gray-100 border-t flex justify-between items-center shrink-0">
               <div className="text-base font-bold text-gray-800">
                 الإجمالي الجديد: <span className="text-blue-700 font-mono">{editItems.reduce((s, i) => s + i.total, 0).toLocaleString()} ج.م</span>
               </div>
               <button 
                 onClick={saveChanges}
                 className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-bold flex items-center gap-1.5 shadow-md text-xs sm:text-sm cursor-pointer"
               >
                 <Save size={16}/> حفظ التعديلات
               </button>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in border border-brand-100">
            <div className="bg-brand-600 p-4 flex justify-between items-center text-white">
              <h2 className="text-base font-bold flex items-center gap-2">
                <FileText size={18}/> تفاصيل الفاتورة {selectedInvoice.id}
              </h2>
              <button onClick={() => setSelectedInvoice(null)} className="hover:bg-brand-700 p-1 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                <div className="bg-gray-50 p-3 rounded-lg">
                   <span className="block text-gray-500 text-[11px] mb-0.5">العميل</span>
                   <span className="font-bold text-gray-800 text-sm">{selectedInvoice.customerName}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                   <span className="block text-gray-500 text-[11px] mb-0.5">الإدارة / الفرع</span>
                   <span className="font-bold text-blue-700 text-sm">
                     {(selectedInvoice.branchId || 'MARG') === 'NOZHA' ? 'إدارة النزهة' : 'إدارة المرج'}
                   </span>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                   <span className="block text-gray-500 text-[11px] mb-0.5">المنطقة</span>
                   <span className="font-bold text-gray-800 text-sm">
                     {selectedInvoice.area || customers.find(c => c.code === selectedInvoice.customerCode)?.area || 'غير محدد'}
                   </span>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                   <span className="block text-gray-500 text-[11px] mb-0.5">التاريخ والوقت</span>
                   <span className="font-bold text-gray-800 font-mono">{selectedInvoice.date} {selectedInvoice.time}</span>
                </div>
                <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 col-span-2 sm:col-span-1">
                   <span className="block text-amber-800 text-[11px] font-bold mb-0.5">مديونية العميل الحالية</span>
                   <span className={`font-black text-sm font-mono ${
                     (customers.find(c => c.code === selectedInvoice.customerCode)?.balance ?? selectedInvoice.currentBalance ?? 0) < 0
                       ? 'text-red-700'
                       : 'text-emerald-700'
                   }`} dir="ltr">
                     {(customers.find(c => c.code === selectedInvoice.customerCode)?.balance ?? selectedInvoice.currentBalance ?? 0).toLocaleString()} ج.م
                   </span>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-gray-100 text-gray-700 font-bold">
                    <tr>
                      <th className="p-2.5">الصنف</th>
                      <th className="p-2.5 text-center">الكمية</th>
                      <th className="p-2.5 text-center">السعر</th>
                      <th className="p-2.5 text-center">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedInvoice.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-2.5 font-medium">{item.itemName} <span className="text-[10px] text-gray-400 font-mono">({item.itemCode})</span></td>
                        <td className="p-2.5 text-center font-mono">{item.quantity}</td>
                        <td className="p-2.5 text-center font-mono">{item.price.toLocaleString()}</td>
                        <td className="p-2.5 font-bold text-center font-mono">{item.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end">
                {(() => {
                  const paid = selectedInvoice.paidAmount || 0;
                  const remaining = selectedInvoice.remainingAmount !== undefined 
                    ? selectedInvoice.remainingAmount 
                    : (selectedInvoice.total - paid);
                  
                  // حساب قديم / مديونية سابقة: الاعتماد على القيمة المسجلة وقت إصدار الفاتورة
                  let oldDebt = selectedInvoice.previousBalance !== undefined 
                    ? selectedInvoice.previousBalance 
                    : 0;
                  if (Object.is(oldDebt, -0) || Math.abs(oldDebt) < 0.0001) oldDebt = 0;

                  // إجمالي الحساب بعد الفاتورة = الحساب القديم + المتبقي من الفاتورة
                  let totalAfterInvoice = selectedInvoice.currentBalance !== undefined
                    ? selectedInvoice.currentBalance
                    : (oldDebt - remaining);
                  if (Object.is(totalAfterInvoice, -0) || Math.abs(totalAfterInvoice) < 0.0001) totalAfterInvoice = 0;

                  // مديونية العميل الحالية الآن (تشمل جميع الحركات والتحصيلات اللاحقة)
                  const liveCustomerDebt = customers.find(c => c.code === selectedInvoice.customerCode)?.balance ?? selectedInvoice.currentBalance ?? 0;

                  return (
                    <div className="bg-gray-900 text-white p-4 rounded-xl w-full sm:w-2/3 space-y-2">
                      {/* السطر الأول: إجمالي الفاتورة */}
                      <div className="flex justify-between items-center text-base font-bold border-b border-gray-700 pb-2">
                         <span>إجمالي الفاتورة:</span>
                         <span className="font-mono text-lg text-amber-400">{selectedInvoice.total.toLocaleString()} ج.م</span>
                      </div>
                      
                      {/* السطر الثاني: المديونية السابقة */}
                      <div className="flex justify-between items-center text-xs text-gray-300 bg-gray-800 px-3 py-1.5 rounded">
                         <span>المديونية السابقة:</span>
                         <span className="font-bold font-mono" dir="ltr">{oldDebt.toLocaleString()} ج.م</span>
                      </div>

                      {/* السطر الثالث: دفعة مسددة */}
                      <div className="flex justify-between items-center text-xs text-emerald-400 bg-gray-800 px-3 py-1.5 rounded">
                         <span>دفعة مسددة:</span>
                         <span className="font-bold font-mono">{paid > 0 ? `${paid.toLocaleString()} ج.م` : '0 ج.م'}</span>
                      </div>

                      {/* السطر الرابع: الإجمالي */}
                      <div className="flex justify-between items-center text-sm font-bold text-amber-300 bg-gray-800/90 px-3 py-2 rounded-lg border border-amber-500/30">
                         <span>الإجمالي:</span>
                         <span className="font-black font-mono text-base" dir="ltr">{totalAfterInvoice.toLocaleString()} ج.م</span>
                      </div>

                      {/* شريط سفلي مستقل: رصيد العميل الحالي في كشف الحساب */}
                      <div className="mt-3 pt-2.5 border-t border-gray-700 bg-gray-800/60 p-2.5 rounded-lg text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1.5">
                         <span className="text-gray-400">رصيد العميل الحالي في كشف الحساب:</span>
                         <span className={`font-mono font-bold text-sm ${liveCustomerDebt < 0 ? 'text-red-400' : liveCustomerDebt > 0 ? 'text-emerald-400' : 'text-gray-300'}`} dir="ltr">
                           {liveCustomerDebt.toLocaleString()} ج.م {liveCustomerDebt < 0 ? '(مدين)' : liveCustomerDebt > 0 ? '(له رصيد)' : '(خالص)'}
                         </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="bg-gray-50 p-3 border-t border-gray-200 flex justify-end gap-2 shrink-0">
              <button 
                onClick={() => {
                  const custBal = customers.find(c => c.code === selectedInvoice.customerCode)?.balance ?? selectedInvoice.currentBalance;
                  printInvoice({ 
                    ...selectedInvoice, 
                    currentBalance: custBal,
                    liveCustomerBalance: custBal
                  });
                }}
                className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer size={15} /> طباعة الفاتورة
              </button>
              <button 
                onClick={() => handleShareInvoicePdf(selectedInvoice)}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <MessageCircle size={15} /> مشاركة واتساب
              </button>
              <button 
                onClick={() => setSelectedInvoice(null)}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
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
