import React, { useState, useEffect, useMemo } from 'react';
import { useERP } from '../context/ERPContext';
import { 
  UserPlus, FileText, Edit, Truck, Download, Phone, Trash2, 
  AlertTriangle, Eye, Printer, Package, Layers, X, Search, PlusCircle, Check 
} from 'lucide-react';
import { Purchase } from '../types';
import { formatWithCommas, parseNumberFromCommas, handleNumericChangeWithCommas } from '../utils/formatters';

export const Suppliers: React.FC = () => {
  const { 
    suppliers, addSupplier, updateSupplier, deleteSupplier,
    exportLedgerToExcel, exportAllSuppliersToExcel, clearLedger, 
    currentUser, purchases, printLedger, printPurchaseInvoice 
  } = useERP();
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');

  // Supplier Add/Edit Modal state
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [formData, setFormData] = useState({ code: '', name: '', phone: '', balance: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [editingOldCode, setEditingOldCode] = useState<string | null>(null);

  // Selected supplier
  const [selectedSupplierCode, setSelectedSupplierCode] = useState<string | null>(null);

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Clear Ledger confirmation state
  const [showClearLedgerConfirm, setShowClearLedgerConfirm] = useState(false);

  // View Purchase Modal State
  const [viewPurchase, setViewPurchase] = useState<Purchase | null>(null);

  // View Mode for Ledger: 'ITEMS' (default, itemized breakdown) or 'INVOICES' (summary)
  const [viewMode, setViewMode] = useState<'ITEMS' | 'INVOICES'>('ITEMS');

  const generateNextCode = () => {
    if (suppliers.length === 0) return 'S001';
    const maxId = suppliers.reduce((max, s) => {
      const num = parseInt(s.code.replace(/\D/g, ''));
      return !isNaN(num) && num > max ? num : max;
    }, 0);
    return `S${(maxId + 1).toString().padStart(3, '0')}`;
  };

  // Auto-select first supplier if none selected
  useEffect(() => {
    if (!selectedSupplierCode && suppliers.length > 0) {
      setSelectedSupplierCode(suppliers[0].code);
    }
  }, [suppliers, selectedSupplierCode]);

  // Filtered supplier list
  const filteredSuppliers = useMemo(() => {
    if (!searchTerm.trim()) return suppliers;
    const q = searchTerm.toLowerCase().trim();
    return suppliers.filter(s => 
      s.name.toLowerCase().includes(q) || 
      s.code.toLowerCase().includes(q) || 
      (s.phone && s.phone.includes(q))
    );
  }, [suppliers, searchTerm]);

  const selectedSupplier = useMemo(() => {
    return suppliers.find(s => s.code === selectedSupplierCode) || (suppliers.length > 0 ? suppliers[0] : null);
  }, [suppliers, selectedSupplierCode]);

  const handleOpenAddModal = () => {
    setIsEditing(false);
    setEditingOldCode(null);
    setFormData({ code: generateNextCode(), name: '', phone: '', balance: '' });
    setIsSupplierModalOpen(true);
  };

  const handleOpenEditModal = (e: React.MouseEvent, supplier: any) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditingOldCode(supplier.code);
    setFormData({
      code: supplier.code,
      name: supplier.name,
      phone: supplier.phone || '',
      balance: formatWithCommas(supplier.balance)
    });
    setIsSupplierModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsSupplierModalOpen(false);
    setIsEditing(false);
    setEditingOldCode(null);
  };

  const handleSubmitSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.code && formData.name) {
      const parsedBal = parseNumberFromCommas(formData.balance);
      if (isEditing && editingOldCode) {
        updateSupplier(editingOldCode, { 
          code: formData.code, 
          name: formData.name, 
          phone: formData.phone, 
          balance: parsedBal 
        });
        handleCloseModal();
      } else {
        if (suppliers.some(s => s.code === formData.code)) {
          alert('هذا الكود مستخدم بالفعل لمورد آخر!');
          return;
        }
        addSupplier({ 
          code: formData.code, 
          name: formData.name, 
          phone: formData.phone, 
          balance: parsedBal, 
          history: [] 
        });
        setSelectedSupplierCode(formData.code);
        handleCloseModal();
      }
    }
  };

  const handleDelete = async (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    if (deleteSupplier) {
      // If deleteSupplier is in context or fallback
    }
    setDeleteConfirmId(null);
    if (selectedSupplierCode === code) {
      const remaining = suppliers.filter(s => s.code !== code);
      setSelectedSupplierCode(remaining.length > 0 ? remaining[0].code : null);
    }
  };

  const handleClearLedger = async () => {
    if (!selectedSupplier) return;
    const success = await clearLedger('SUPPLIER', selectedSupplier.code);
    if (success) {
      setShowClearLedgerConfirm(false);
      alert("تم تصفير الحساب ومسح السجلات بنجاح.");
    }
  };

  const handleViewPurchaseDetails = (description: string) => {
    const match = description.match(/#([A-Za-z0-9-]+)/);
    if (match) {
      const purchaseId = match[1];
      const p = purchases.find(item => item.id === purchaseId);
      if (p) {
        setViewPurchase(p);
      } else {
        alert("عذراً، تفاصيل هذه الفاتورة غير متوفرة في السجل العام (ربما تم حذفها).");
      }
    }
  };

  // Compute itemized ledger rows by expanding purchase invoices into egg items
  const itemizedRows = useMemo(() => {
    if (!selectedSupplier || !selectedSupplier.history) return [];

    const rows: Array<{
      num: number;
      date: string;
      ref: string;
      itemName: string;
      quantity: number | string;
      price: number | string;
      lineTotal: number | string; // الإجمالي
      credit: number; // علينا (له)
      debit: number; // لنا (سداد)
      runningBalance: number;
      status: 'علينا' | 'لنا' | 'متزن';
      isInvoiceItem: boolean;
      purchaseId?: string;
    }> = [];

    let running = 0;
    let counter = 1;

    for (const h of selectedSupplier.history) {
      const isPurchaseInvoice = h.description.includes('فاتورة مشتريات') && !h.description.includes('تعديل');
      const pMatch = h.description.match(/#([A-Za-z0-9-]+)/);
      const pId = pMatch ? pMatch[1] : null;
      const purchase = pId ? purchases.find(p => p.id === pId) : null;

      if (isPurchaseInvoice && purchase && purchase.items && purchase.items.length > 0) {
        // Expand into each item
        purchase.items.forEach((item) => {
          const lineTotal = item.quantity * item.price;
          running += lineTotal; // increases debt to supplier (we owe more)
          rows.push({
            num: counter++,
            date: purchase.date || h.date,
            ref: purchase.id,
            itemName: item.itemName,
            quantity: item.quantity,
            price: item.price,
            lineTotal: lineTotal,
            credit: lineTotal,
            debit: 0,
            runningBalance: running,
            status: running > 0 ? 'علينا' : running < 0 ? 'لنا' : 'متزن',
            isInvoiceItem: true,
            purchaseId: purchase.id
          });
        });
      } else {
        // Other movements (payments, transfers, opening balance)
        const isDebtIncrease = h.amount > 0;
        const credit = isDebtIncrease ? h.amount : 0;
        const debit = !isDebtIncrease ? Math.abs(h.amount) : 0;
        running += h.amount;

        rows.push({
          num: counter++,
          date: h.date,
          ref: pId || '-',
          itemName: h.description,
          quantity: '-',
          price: '-',
          lineTotal: '-',
          credit,
          debit,
          runningBalance: running,
          status: running > 0 ? 'علينا' : running < 0 ? 'لنا' : 'متزن',
          isInvoiceItem: false,
          purchaseId: pId || undefined
        });
      }
    }

    return rows;
  }, [selectedSupplier, purchases]);

  const totalEggQuantity = useMemo(() => {
    return itemizedRows.reduce((sum, r) => typeof r.quantity === 'number' ? sum + r.quantity : sum, 0);
  }, [itemizedRows]);

  const totalItemizedLineTotal = useMemo(() => {
    return itemizedRows.reduce((sum, r) => typeof r.lineTotal === 'number' ? sum + r.lineTotal : sum, 0);
  }, [itemizedRows]);

  const totalItemizedCredit = useMemo(() => {
    return itemizedRows.reduce((sum, r) => sum + r.credit, 0);
  }, [itemizedRows]);

  const totalItemizedDebit = useMemo(() => {
    return itemizedRows.reduce((sum, r) => sum + r.debit, 0);
  }, [itemizedRows]);

  return (
    <div className="flex flex-col gap-2.5 h-[calc(100vh-85px)]">

      {/* Sleek Compact Action Toolbar (Zero Wasted Space) */}
      <div className="bg-white px-3 py-2 rounded-xl shadow-xs border border-brand-100 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-brand-900 text-base">الموردين</span>
            <span className="bg-orange-50 text-orange-700 font-mono font-bold text-xs px-2 py-0.5 rounded-full border border-orange-200">
              {filteredSuppliers.length}
            </span>
          </div>

          {/* Real-time Search Input */}
          <div className="relative">
            <Search size={15} className="absolute right-2.5 top-2.5 text-gray-400" />
            <input 
              type="text"
              placeholder="بحث بالاسم أو الكود..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pr-8 pl-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-orange-500 focus:bg-white w-48 sm:w-64 transition-all"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute left-2.5 top-2 text-gray-400 hover:text-gray-600"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 bg-orange-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-orange-700 transition-colors shadow-xs"
          >
            <PlusCircle size={15} /> إضافة مورد جديد
          </button>
          
          <button 
            onClick={exportAllSuppliersToExcel}
            className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-700 transition-colors shadow-xs"
          >
            <Download size={15} /> تصدير القائمة (Excel)
          </button>
        </div>
      </div>

      {/* Main Grid: Supplier List (col-3) + Statement Ledger (col-9) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 flex-1 min-h-0">
        
        {/* Supplier List Sidebar */}
        <div className="lg:col-span-3 bg-white rounded-xl shadow-xs border border-brand-100 flex flex-col min-h-0 overflow-hidden">
          <div className="p-2.5 bg-orange-50/60 border-b border-orange-100 flex justify-between items-center text-xs font-bold text-orange-950">
            <span>قائمة الموردين</span>
            <span className="text-gray-500 font-normal">اضغط لاختيار المورد</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {filteredSuppliers.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-xs">
                {searchTerm ? 'لا توجد نتائج مطابقة للبحث' : 'لا يوجد موردين مسجلين'}
              </div>
            ) : (
              filteredSuppliers.map(s => {
                const isSelected = selectedSupplier?.code === s.code;
                const isDebtWeOwe = s.balance > 0;
                const isCreditWeAreOwed = s.balance < 0;

                return (
                  <div 
                    key={s.code}
                    onClick={() => setSelectedSupplierCode(s.code)}
                    className={`p-2.5 hover:bg-orange-50/60 cursor-pointer transition-colors relative group flex items-center justify-between ${
                      isSelected ? 'bg-orange-50/90 border-r-4 border-orange-600' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-gray-900 text-xs truncate">{s.name}</span>
                        <span className="text-[10px] bg-gray-100 text-gray-600 px-1 py-0.2 rounded font-mono font-bold">
                          {s.code}
                        </span>
                      </div>
                      {s.phone && (
                        <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1" dir="ltr">
                          <Phone size={10} /> {s.phone}
                        </p>
                      )}
                    </div>

                    <div className="text-left flex items-center gap-1.5">
                      <div className="text-left">
                        <p className={`font-black text-xs font-mono ${isDebtWeOwe ? 'text-green-600' : isCreditWeAreOwed ? 'text-red-600' : 'text-gray-600'}`} dir="ltr">
                          {s.balance.toLocaleString()}
                        </p>
                        <p className="text-[9px] text-gray-400">
                          {isDebtWeOwe ? 'له (علينا)' : isCreditWeAreOwed ? 'لنا (عليه)' : 'متزن'}
                        </p>
                      </div>

                      <button 
                        onClick={(e) => handleOpenEditModal(e, s)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-blue-600 hover:bg-blue-50 rounded transition-all"
                        title="تعديل بيانات المورد"
                      >
                        <Edit size={13} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Supplier Statement (بيان كشف الحساب) - Wide & Roomy */}
        <div className="lg:col-span-9 bg-white rounded-xl shadow-xs border border-brand-100 flex flex-col min-h-0 overflow-hidden">
          {selectedSupplier ? (
            <div className="flex flex-col h-full min-h-0">
              
              {/* Top Compact Supplier Banner + Inline Key Metrics */}
              <div className="p-3 border-b border-gray-200 bg-gradient-to-r from-slate-50 via-white to-orange-50/40">
                <div className="flex flex-wrap justify-between items-center gap-3">
                  
                  {/* Supplier Info */}
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-lg font-black text-brand-900 flex items-center gap-2">
                      {selectedSupplier.name}
                      <button 
                        onClick={(e) => handleOpenEditModal(e, selectedSupplier)}
                        className="text-xs font-normal text-gray-500 hover:text-orange-700 bg-white border border-gray-200 hover:border-orange-300 px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors shadow-2xs"
                        title="تعديل بيانات المورد"
                      >
                        <Edit size={12}/> تعديل
                      </button>
                    </h2>
                    <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-mono font-bold border border-gray-200">
                      كود: {selectedSupplier.code}
                    </span>
                    {selectedSupplier.phone && (
                      <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded text-xs font-bold border border-orange-100 flex items-center gap-1" dir="ltr">
                        <Phone size={11} /> {selectedSupplier.phone}
                      </span>
                    )}
                  </div>

                  {/* Inline Compact Metrics Chips */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="bg-white border border-amber-200 px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 shadow-2xs">
                      <span className="text-gray-500 font-bold">كراتين البيض:</span>
                      <span className="font-mono font-black text-amber-800">{totalEggQuantity.toLocaleString()}</span>
                    </div>

                    <div className="bg-white border border-green-200 px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 shadow-2xs">
                      <span className="text-gray-500 font-bold">توريدات (علينا/دائن):</span>
                      <span className="font-mono font-black text-green-600">{totalItemizedCredit.toLocaleString()} ج.م</span>
                    </div>

                    <div className="bg-white border border-red-200 px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 shadow-2xs">
                      <span className="text-gray-500 font-bold">سدادات (لنا/مدين):</span>
                      <span className="font-mono font-black text-red-600">{totalItemizedDebit.toLocaleString()} ج.م</span>
                    </div>

                    {/* Final Balance Badge */}
                    <div className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 border shadow-2xs ${
                      selectedSupplier.balance > 0 
                        ? 'bg-green-600 text-white border-green-700' 
                        : selectedSupplier.balance < 0 
                        ? 'bg-red-500 text-white border-red-600' 
                        : 'bg-gray-800 text-white border-gray-900'
                    }`}>
                      <span>الرصيد:</span>
                      <span className="font-mono font-black text-sm" dir="ltr">
                        {Math.abs(selectedSupplier.balance).toLocaleString()} ج.م
                      </span>
                      <span className="text-[11px] opacity-90">
                        {selectedSupplier.balance > 0 ? '(له - علينا)' : selectedSupplier.balance < 0 ? '(لنا - عليه)' : '(متزن)'}
                      </span>
                    </div>
                  </div>

                </div>

                {/* Sub-toolbar: View Switch & Actions */}
                <div className="flex flex-wrap justify-between items-center gap-2 mt-2 pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-700 flex items-center gap-1">
                      <FileText size={14} className="text-orange-600" /> شكل العرض:
                    </span>
                    <div className="inline-flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
                      <button
                        type="button"
                        onClick={() => setViewMode('ITEMS')}
                        className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                          viewMode === 'ITEMS' ? 'bg-orange-600 text-white shadow-xs' : 'text-gray-600 hover:text-orange-700'
                        }`}
                      >
                        <Package size={13} /> بيان بالأصناف والأسعار (كالفاتورة)
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('INVOICES')}
                        className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                          viewMode === 'INVOICES' ? 'bg-orange-600 text-white shadow-xs' : 'text-gray-600 hover:text-orange-700'
                        }`}
                      >
                        <Layers size={13} /> مجمع بالفواتير
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {currentUser?.permissions.canDeleteLedgers && (
                      showClearLedgerConfirm ? (
                         <div className="flex items-center gap-1 bg-red-50 px-2 py-1 rounded-lg border border-red-200 animate-fade-in text-xs">
                           <AlertTriangle size={14} className="text-red-500" />
                           <span className="font-bold text-red-600">تأكيد التصفير؟</span>
                           <button 
                             onClick={handleClearLedger}
                             className="bg-red-600 text-white px-2 py-0.5 rounded text-xs font-bold hover:bg-red-700"
                           >
                             نعم
                           </button>
                           <button 
                             onClick={() => setShowClearLedgerConfirm(false)}
                             className="bg-white text-gray-600 px-2 py-0.5 rounded border text-xs font-bold hover:bg-gray-100"
                           >
                             إلغاء
                           </button>
                         </div>
                      ) : (
                        <button 
                          onClick={() => setShowClearLedgerConfirm(true)}
                          className="flex items-center gap-1 bg-red-50 text-red-600 px-2 py-1 rounded-md text-xs font-bold hover:bg-red-100 transition-colors border border-red-200"
                          title="مسح الحركات وتصفير الحساب"
                        >
                          <Trash2 size={13} /> تصفير
                        </button>
                      )
                    )}

                    <button 
                      onClick={() => {
                        printLedger({
                          title: viewMode === 'ITEMS' ? 'بيان كشف حساب مورد تفصيلي بالأصناف والأسعار' : 'كشف حساب مورد مجمع بالفواتير',
                          entityName: selectedSupplier.name,
                          entityCode: selectedSupplier.code,
                          entityPhone: selectedSupplier.phone,
                          type: 'SUPPLIER',
                          rows: viewMode === 'ITEMS' ? itemizedRows : selectedSupplier.history.map((h, i) => ({
                            num: i + 1,
                            date: h.date,
                            ref: h.description.match(/#([A-Za-z0-9-]+)/)?.[1] || '-',
                            itemName: h.description,
                            quantity: '-',
                            price: '-',
                            lineTotal: '-',
                            debit: h.amount < 0 ? Math.abs(h.amount) : 0,
                            credit: h.amount > 0 ? h.amount : 0,
                            runningBalance: selectedSupplier.balance
                          })),
                          totalDebit: totalItemizedDebit,
                          totalCredit: totalItemizedCredit,
                          finalBalance: selectedSupplier.balance
                        });
                      }}
                      className="flex items-center gap-1 bg-blue-600 text-white px-2.5 py-1 rounded-md text-xs font-bold hover:bg-blue-700 transition-colors shadow-2xs"
                    >
                      <Printer size={13} /> طباعة البيان
                    </button>

                    <button 
                      onClick={() => exportLedgerToExcel(
                        selectedSupplier.name, 
                        selectedSupplier.code, 
                        viewMode === 'ITEMS' ? itemizedRows : selectedSupplier.history, 
                        selectedSupplier.balance, 
                        'SUPPLIER',
                        viewMode === 'ITEMS'
                      )}
                      className="flex items-center gap-1 bg-green-600 text-white px-2.5 py-1 rounded-md text-xs font-bold hover:bg-green-700 transition-colors shadow-2xs"
                    >
                      <Download size={13} /> تصدير (Excel)
                    </button>
                  </div>
                </div>
              </div>

              {/* Statement Table Area - Scrollable with Pinned Header & Footer */}
              <div className="flex-1 min-h-0 overflow-auto">
                {viewMode === 'ITEMS' ? (
                  /* ITEM-BY-ITEM DETAILED STATEMENT TABLE (EXACTLY AS IN PURCHASE INVOICE) */
                  <table className="w-full text-xs text-right border-collapse">
                    <thead className="bg-gray-100 text-gray-800 font-bold sticky top-0 z-10 border-b border-gray-300 shadow-2xs">
                      <tr>
                        <th className="p-2 text-center w-8 border-l border-gray-200">م</th>
                        <th className="p-2 text-center w-20 border-l border-gray-200">التاريخ</th>
                        <th className="p-2 text-center w-20 border-l border-gray-200">الفاتورة</th>
                        <th className="p-2 border-l border-gray-200">الصنف / البيان</th>
                        <th className="p-2 text-center w-16 border-l border-gray-200">الكمية</th>
                        <th className="p-2 text-center w-16 border-l border-gray-200">السعر</th>
                        <th className="p-2 text-center w-20 border-l border-gray-200 bg-amber-50/70 text-amber-900">الإجمالي</th>
                        <th className="p-2 text-center w-20 border-l border-gray-200 text-green-700 bg-green-50/50">علينا (له)</th>
                        <th className="p-2 text-center w-20 border-l border-gray-200 text-red-700 bg-red-50/50">لنا (سداد)</th>
                        <th className="p-2 text-center w-24 border-l border-gray-200 bg-gray-50">الرصيد</th>
                        <th className="p-2 text-center w-16">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-150">
                      {itemizedRows.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="p-8 text-center text-gray-400 font-medium">
                            لا توجد حركات مسجلة لهذا المورد حتى الآن
                          </td>
                        </tr>
                      ) : (
                        itemizedRows.map((r, idx) => (
                          <tr 
                            key={idx} 
                            className={`transition-colors ${
                              r.isInvoiceItem ? 'hover:bg-amber-50/50' : 'bg-gray-50/40 hover:bg-gray-100/60'
                            }`}
                          >
                            <td className="p-2 text-center text-gray-500 font-mono border-l border-gray-100">{r.num}</td>
                            <td className="p-2 text-center text-gray-600 whitespace-nowrap font-mono border-l border-gray-100">{r.date}</td>
                            <td className="p-2 text-center font-mono border-l border-gray-100">
                              {r.purchaseId ? (
                                <button 
                                  onClick={() => handleViewPurchaseDetails(`فاتورة #${r.purchaseId}`)}
                                  className="text-orange-700 hover:text-orange-900 bg-orange-50 hover:bg-orange-100 px-1.5 py-0.5 rounded text-[11px] font-bold inline-flex items-center gap-0.5 border border-orange-200"
                                  title="عرض تفاصيل الفاتورة"
                                >
                                  #{r.purchaseId}
                                  <Eye size={11} />
                                </button>
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </td>
                            <td className="p-2 font-bold text-gray-800 border-l border-gray-100">
                              {r.isInvoiceItem ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0"></span>
                                  {r.itemName}
                                </span>
                              ) : (
                                <span className="text-gray-700 font-medium">{r.itemName}</span>
                              )}
                            </td>
                            <td className="p-2 text-center font-bold text-gray-800 border-l border-gray-100">
                              {typeof r.quantity === 'number' ? (
                                <span className="bg-amber-100/70 text-amber-950 px-1.5 py-0.5 rounded font-mono font-black text-xs">
                                  {r.quantity.toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </td>
                            <td className="p-2 text-center font-mono text-gray-700 border-l border-gray-100">
                              {typeof r.price === 'number' ? r.price.toLocaleString() : '-'}
                            </td>
                            <td className="p-2 text-center font-mono font-bold text-amber-900 bg-amber-50/40 border-l border-gray-100">
                              {typeof r.lineTotal === 'number' ? r.lineTotal.toLocaleString() : '-'}
                            </td>
                            <td className="p-2 text-center font-mono font-black text-green-600 bg-green-50/30 border-l border-gray-100">
                              {r.credit > 0 ? r.credit.toLocaleString() : '-'}
                            </td>
                            <td className="p-2 text-center font-mono font-black text-red-600 bg-red-50/30 border-l border-gray-100">
                              {r.debit > 0 ? r.debit.toLocaleString() : '-'}
                            </td>
                            <td className="p-2 text-center font-mono font-black text-gray-900 bg-gray-50/60 border-l border-gray-100" dir="ltr">
                              {r.runningBalance.toLocaleString()}
                            </td>
                            <td className="p-2 text-center font-bold text-[11px]">
                              {r.status === 'علينا' ? (
                                <span className="text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-200">له</span>
                              ) : r.status === 'لنا' ? (
                                <span className="text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">لنا</span>
                              ) : (
                                <span className="text-gray-500">متزن</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {itemizedRows.length > 0 && (
                      <tfoot className="bg-gray-100 font-bold sticky bottom-0 z-10 border-t-2 border-gray-300 shadow-xs">
                        <tr>
                          <td colSpan={4} className="p-2 text-right font-black border-l border-gray-200">الإجماليات:</td>
                          <td className="p-2 text-center text-amber-900 font-black font-mono border-l border-gray-200">
                            {totalEggQuantity.toLocaleString()}
                          </td>
                          <td className="p-2 text-center text-gray-400 border-l border-gray-200">-</td>
                          <td className="p-2 text-center text-amber-950 font-black font-mono border-l border-gray-200 bg-amber-100/60">
                            {totalItemizedLineTotal.toLocaleString()}
                          </td>
                          <td className="p-2 text-center text-green-700 font-black font-mono border-l border-gray-200 bg-green-100/60">
                            {totalItemizedCredit.toLocaleString()}
                          </td>
                          <td className="p-2 text-center text-red-700 font-black font-mono border-l border-gray-200 bg-red-100/60">
                            {totalItemizedDebit.toLocaleString()}
                          </td>
                          <td className="p-2 text-center font-black font-mono text-brand-900 border-l border-gray-200 bg-brand-50" dir="ltr">
                            {selectedSupplier.balance.toLocaleString()}
                          </td>
                          <td className="p-2 text-center font-bold text-xs">
                            {selectedSupplier.balance > 0 ? (
                              <span className="text-green-700 font-black">له (علينا)</span>
                            ) : selectedSupplier.balance < 0 ? (
                              <span className="text-red-700 font-black">لنا (عليه)</span>
                            ) : (
                              <span className="text-gray-600 font-black">متزن</span>
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                ) : (
                  /* SUMMARY INVOICE VIEW */
                  <table className="w-full text-xs text-right border-collapse">
                    <thead className="bg-gray-50 text-gray-800 font-bold sticky top-0 z-10 border-b border-gray-300">
                      <tr>
                        <th className="p-2.5 text-center w-12 border-l border-gray-200">م</th>
                        <th className="p-2.5 text-center w-24 border-l border-gray-200">التاريخ</th>
                        <th className="p-2.5 border-l border-gray-200">البيان</th>
                        <th className="p-2.5 text-center w-28 text-green-700 bg-green-50/50 border-l border-gray-200">علينا (له)</th>
                        <th className="p-2.5 text-center w-28 text-red-700 bg-red-50/50 border-l border-gray-200">لنا (عليه)</th>
                        <th className="p-2.5 text-center w-28 border-l border-gray-200">الرصيد</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedSupplier.history.length === 0 ? (
                        <tr><td colSpan={6} className="p-6 text-center text-gray-400">لا توجد حركات مسجلة</td></tr>
                      ) : (
                        selectedSupplier.history.map((h, idx) => {
                          const isDebtIncrease = h.amount > 0;
                          const isDebtDecrease = h.amount < 0;
                          const pMatch = h.description.match(/#([A-Za-z0-9-]+)/);

                          return (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="p-2.5 text-center text-gray-500 font-mono border-l border-gray-100">{idx + 1}</td>
                              <td className="p-2.5 text-center text-gray-600 whitespace-nowrap font-mono border-l border-gray-100">{h.date}</td>
                              <td className="p-2.5 font-medium text-gray-800 border-l border-gray-100">
                                <div className="flex justify-between items-center">
                                  <span>{h.description}</span>
                                  {pMatch && (
                                    <button 
                                      onClick={() => handleViewPurchaseDetails(h.description)}
                                      className="text-orange-600 hover:text-orange-800 bg-orange-50 hover:bg-orange-100 px-2 py-0.5 rounded text-xs font-bold inline-flex items-center gap-1"
                                      title="عرض تفاصيل الفاتورة"
                                    >
                                      عرض الفاتورة <Eye size={12} />
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="p-2.5 text-center font-bold font-mono text-green-600 bg-green-50/30 border-l border-gray-100">
                                {isDebtIncrease ? h.amount.toLocaleString() : '-'}
                              </td>
                              <td className="p-2.5 text-center font-bold font-mono text-red-600 bg-red-50/30 border-l border-gray-100">
                                {isDebtDecrease ? Math.abs(h.amount).toLocaleString() : '-'}
                              </td>
                              <td className="p-2.5 text-center font-black font-mono text-gray-900" dir="ltr">
                                {selectedSupplier.balance.toLocaleString()}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8">
              <Truck size={44} className="mb-2 opacity-40 text-orange-500"/>
              <p className="font-bold text-sm">اختر مورداً من القائمة لعرض بيان كشف الحساب</p>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Supplier Modal (Clean popup, frees up screen real estate) */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in">
            <div className={`p-4 flex justify-between items-center text-white ${isEditing ? 'bg-orange-600' : 'bg-orange-600'}`}>
              <h3 className="text-base font-bold flex items-center gap-2">
                {isEditing ? <Edit size={18} /> : <Truck size={18} />}
                {isEditing ? 'تعديل بيانات المورد' : 'إضافة مورد جديد'}
              </h3>
              <button onClick={handleCloseModal} className="hover:bg-black/20 p-1 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitSupplier} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">كود المورد</label>
                <input 
                  type="text" 
                  required
                  className={`w-full p-2.5 border rounded-lg outline-none font-mono font-bold text-sm ${isEditing ? 'bg-white border-orange-300' : 'bg-gray-50 border-gray-300'}`}
                  value={formData.code}
                  onChange={e => setFormData({...formData, code: e.target.value})}
                  placeholder="مثال: S001"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">اسم المورد</label>
                <input 
                  type="text" 
                  required
                  className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:border-orange-500 text-sm font-bold"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="اسم المورد أو المزرعة"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">رقم الهاتف</label>
                <input 
                  type="text" 
                  className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:border-orange-500 text-sm font-mono"
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  placeholder="01xxxxxxxxx"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  {isEditing ? 'تعديل الرصيد الحالي' : 'رصيد افتتاحي'}
                </label>
                <div className="relative">
                  <input 
                    type="text" 
                    dir="ltr"
                    placeholder="0"
                    className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:border-orange-500 font-mono font-bold text-center text-sm"
                    value={formData.balance}
                    onChange={e => handleNumericChangeWithCommas(e.target.value, val => setFormData({...formData, balance: val}), true)}
                  />
                  <span className="absolute left-2.5 top-2.5 text-[11px] text-gray-400 pointer-events-none">
                    (موجب = علينا)
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="submit" 
                  className="flex-1 text-white py-2.5 rounded-lg font-bold text-sm bg-orange-600 hover:bg-orange-700 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Check size={16} /> {isEditing ? 'تحديث البيانات' : 'حفظ المورد'}
                </button>
                <button 
                  type="button" 
                  onClick={handleCloseModal}
                  className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-bold text-sm hover:bg-gray-200 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Purchase Invoice Modal */}
      {viewPurchase && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in">
            <div className="bg-orange-600 p-4 flex justify-between items-center text-white">
              <h2 className="text-base font-bold flex items-center gap-2">
                <FileText size={18}/> تفاصيل فاتورة مشتريات {viewPurchase.id}
              </h2>
              <button onClick={() => setViewPurchase(null)} className="hover:bg-orange-700 p-1 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                   <span className="block text-gray-400 text-[10px]">المورد</span>
                   <span className="font-bold text-gray-800 text-sm">{viewPurchase.supplierName}</span>
                   <span className="text-[10px] text-gray-400 block font-mono mt-0.5">({viewPurchase.supplierCode})</span>
                </div>
                <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                   <span className="block text-gray-400 text-[10px]">التاريخ</span>
                   <span className="font-bold text-gray-800 text-sm font-mono">{viewPurchase.date}</span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-gray-700 mb-2 flex items-center gap-1.5 text-xs">
                  <Package size={14} className="text-orange-600" /> الأصناف المسجلة بالفاتورة
                </h4>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs text-right">
                    <thead className="bg-gray-100 text-gray-700 font-bold">
                      <tr>
                        <th className="p-2 border-l border-gray-200">الصنف</th>
                        <th className="p-2 text-center border-l border-gray-200">الكمية</th>
                        <th className="p-2 text-center border-l border-gray-200">السعر</th>
                        <th className="p-2 text-center">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(viewPurchase.items || []).map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="p-2 font-bold text-gray-800 border-l border-gray-100">{item.itemName}</td>
                          <td className="p-2 text-center font-mono font-bold bg-amber-50/60 border-l border-gray-100">{item.quantity} كرتونة</td>
                          <td className="p-2 text-center font-mono border-l border-gray-100">{item.price.toLocaleString()} ج.م</td>
                          <td className="p-2 text-center font-mono font-bold text-green-700">{item.total.toLocaleString()} ج.م</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-orange-50 p-3.5 rounded-xl space-y-1.5 border border-orange-200 text-xs">
                <div className="flex justify-between items-center text-orange-950 font-bold">
                  <span>إجمالي الفاتورة:</span>
                  <span className="text-base font-black font-mono text-orange-700">{viewPurchase.total.toLocaleString()} ج.م</span>
                </div>
                {viewPurchase.previousBalance !== undefined && (
                  <>
                    <div className="flex justify-between items-center text-[11px] text-gray-600 border-t border-orange-200/60 pt-1.5">
                      <span>رصيد سابق:</span>
                      <span className="font-mono">{viewPurchase.previousBalance.toLocaleString()} ج.م</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold text-gray-900 border-t border-orange-200 pt-1.5">
                      <span>الرصيد بعد الفاتورة:</span>
                      <span className="font-mono font-bold">{viewPurchase.currentBalance?.toLocaleString()} ج.م</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="bg-gray-50 p-3.5 border-t border-gray-200 flex justify-end gap-2">
              <button 
                onClick={() => printPurchaseInvoice(viewPurchase)} 
                className="bg-orange-600 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold hover:bg-orange-700 flex items-center gap-1.5 shadow-sm"
              >
                <Printer size={14} /> طباعة الفاتورة
              </button>
              <button 
                onClick={() => setViewPurchase(null)} 
                className="bg-white border text-gray-700 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-100"
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
