
import React, { useState, useEffect, useMemo } from 'react';
import { useERP } from '../context/ERPContext';
import { UserPlus, FileText, Edit, Truck, Download, Phone, RefreshCcw, Trash2, AlertTriangle, Eye, Printer, Package, Layers, X } from 'lucide-react';
import { Purchase } from '../types';
import { formatWithCommas, parseNumberFromCommas, handleNumericChangeWithCommas } from '../utils/formatters';

export const Suppliers: React.FC = () => {
  const { suppliers, addSupplier, updateSupplier, exportLedgerToExcel, exportAllSuppliersToExcel, clearLedger, currentUser, purchases, printLedger, printPurchaseInvoice } = useERP();
  
  const [formData, setFormData] = useState({ code: '', name: '', phone: '', balance: '' });
  const [selectedSupplierCode, setSelectedSupplierCode] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingOldCode, setEditingOldCode] = useState<string | null>(null);

  // Clear Ledger confirmation state
  const [showClearLedgerConfirm, setShowClearLedgerConfirm] = useState(false);

  // View Purchase Modal State
  const [viewPurchase, setViewPurchase] = useState<Purchase | null>(null);

  const generateNextCode = () => {
    if (suppliers.length === 0) return 'S001';
    const maxId = suppliers.reduce((max, s) => {
      const num = parseInt(s.code.replace(/\D/g, ''));
      return !isNaN(num) && num > max ? num : max;
    }, 0);
    return `S${(maxId + 1).toString().padStart(3, '0')}`;
  };

  useEffect(() => {
    if (!isEditing) {
      setFormData(prev => ({ ...prev, code: generateNextCode() }));
    }
  }, [suppliers, isEditing]);

  const handleSubmit = (e: React.FormEvent) => {
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
        handleCancelEdit();
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
        setFormData({ code: '', name: '', phone: '', balance: '' });
      }
    }
  };

  const handleEditClick = (e: React.MouseEvent, supplier: any) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditingOldCode(supplier.code);
    setFormData({
      code: supplier.code,
      name: supplier.name,
      phone: supplier.phone || '',
      balance: formatWithCommas(supplier.balance)
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingOldCode(null);
    setFormData({ code: generateNextCode(), name: '', phone: '', balance: '' });
  };

  const handleClearLedger = async () => {
    if (!selectedSupplier) return;
    const success = await clearLedger('SUPPLIER', selectedSupplier.code);
    if (success) {
      setShowClearLedgerConfirm(false);
      alert("تم تصفير الحساب ومسح السجلات بنجاح.");
    }
  };

  // View Mode for Ledger: 'ITEMS' (default, itemized breakdown) or 'INVOICES' (summary)
  const [viewMode, setViewMode] = useState<'ITEMS' | 'INVOICES'>('ITEMS');

  const selectedSupplier = suppliers.find(s => s.code === selectedSupplierCode);

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
      credit: number; // علينا (له)
      debit: number; // لنا (سداد)
      runningBalance: number;
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
          const itemTotal = item.quantity * item.price;
          running += itemTotal; // increases debt to supplier
          rows.push({
            num: counter++,
            date: purchase.date || h.date,
            ref: purchase.id,
            itemName: item.itemName,
            quantity: item.quantity,
            price: item.price,
            credit: itemTotal,
            debit: 0,
            runningBalance: running,
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
          credit,
          debit,
          runningBalance: running,
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

  const totalItemizedCredit = useMemo(() => {
    return itemizedRows.reduce((sum, r) => sum + r.credit, 0);
  }, [itemizedRows]);

  const totalItemizedDebit = useMemo(() => {
    return itemizedRows.reduce((sum, r) => sum + r.debit, 0);
  }, [itemizedRows]);

  return (
    <div className="space-y-8">

      {/* Header with Bulk Export */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-brand-100">
        <h2 className="text-xl font-bold text-brand-800">إدارة الموردين</h2>
        <button 
          onClick={exportAllSuppliersToExcel}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-700 transition-colors shadow-sm"
        >
          <Download size={18} /> تصدير قائمة الموردين (Excel)
        </button>
      </div>
      
      {/* Add/Edit Supplier Section */}
      <div className={`p-6 rounded-xl shadow-sm border transition-colors duration-300 ${isEditing ? 'bg-orange-50 border-orange-200' : 'bg-white border-brand-100'}`}>
        <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${isEditing ? 'text-orange-800' : 'text-brand-800'}`}>
          {isEditing ? <Edit size={20} /> : <Truck size={20} />} 
          {isEditing ? 'تعديل بيانات المورد' : 'إضافة مورد جديد'}
        </h3>
        <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-sm text-gray-600 mb-1">كود المورد</label>
            <input 
              type="text" 
              required
              className={`w-full p-2 border rounded-lg outline-none focus:border-brand-500 font-mono font-bold ${isEditing ? 'bg-white border-orange-300' : 'bg-gray-50'}`}
              value={formData.code}
              onChange={e => setFormData({...formData, code: e.target.value})}
              placeholder="تلقائي"
            />
          </div>
          <div className="flex-[2] w-full">
            <label className="block text-sm text-gray-600 mb-1">اسم المورد</label>
            <input 
              type="text" 
              required
              className="w-full p-2 border rounded-lg outline-none focus:border-brand-500"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              placeholder="اسم المورد"
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
                type="text" 
                dir="ltr"
                placeholder="0"
                className="w-full p-2 border rounded-lg outline-none focus:border-brand-500 font-mono font-bold text-center"
                value={formData.balance}
                onChange={e => handleNumericChangeWithCommas(e.target.value, val => setFormData({...formData, balance: val}), true)}
              />
              <span className="absolute left-2 top-2 text-xs text-gray-400 pointer-events-none">
                (موجب = علينا)
              </span>
             </div>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button type="submit" className={`flex-1 md:flex-auto px-6 py-2.5 rounded-lg font-bold text-white transition-colors shadow-sm ${isEditing ? 'bg-orange-600 hover:bg-orange-700' : 'bg-brand-600 hover:bg-brand-700'}`}>
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
        {/* List */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-brand-100 overflow-hidden">
          <div className="p-4 bg-brand-50 border-b border-brand-100">
            <h3 className="font-bold text-brand-800">قائمة الموردين</h3>
          </div>
          <div className="overflow-y-auto max-h-[500px]">
            <ul className="divide-y divide-gray-100">
              {suppliers.map(s => (
                <li 
                  key={s.code} 
                  onClick={() => {
                    setSelectedSupplierCode(s.code);
                    setShowClearLedgerConfirm(false);
                  }}
                  className={`p-4 cursor-pointer hover:bg-brand-50 transition-colors flex justify-between items-center group
                    ${selectedSupplierCode === s.code ? 'bg-brand-50 border-r-4 border-brand-500' : ''}
                  `}
                >
                  <div className="flex-1">
                    <p className="font-bold text-gray-800">{s.name}</p>
                    <p className="text-xs text-gray-500">#{s.code} {s.phone ? `- ${s.phone}` : ''}</p>
                  </div>
                  <div className="text-left flex items-center gap-3">
                    <div>
                      {/* Positive = We Owe Him (Green - as requested), Negative = He Owes Us (Red - as requested) */}
                      <p className={`font-bold text-sm ${s.balance > 0 ? 'text-green-600' : s.balance < 0 ? 'text-red-600' : 'text-gray-600'}`} dir="ltr">
                        {s.balance.toLocaleString()}
                      </p>
                    </div>
                    <button 
                      onClick={(e) => handleEditClick(e, s)}
                      className="opacity-0 group-hover:opacity-100 p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-all"
                    >
                      <Edit size={16} />
                    </button>
                  </div>
                </li>
              ))}
              {suppliers.length === 0 && (
                <li className="p-4 text-center text-gray-400 text-sm">لا يوجد موردين</li>
              )}
            </ul>
          </div>
        </div>

        {/* Ledger Details */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-brand-100 p-6 min-h-[400px]">
           {selectedSupplier ? (
             <div className="space-y-6">
                <div className="flex justify-between items-start border-b pb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-brand-900 flex items-center gap-3">
                      {selectedSupplier.name}
                      <button 
                        onClick={(e) => handleEditClick(e, selectedSupplier)}
                        className="text-sm font-normal bg-gray-100 text-gray-600 hover:bg-gray-200 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                      >
                        <Edit size={14}/> تعديل
                      </button>
                    </h2>
                    <div className="flex flex-col gap-1 mt-1">
                      <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-mono w-fit">Code: {selectedSupplier.code}</span>
                      {selectedSupplier.phone && (
                        <span className="bg-orange-50 text-orange-600 px-2 py-1 rounded text-xs w-fit flex items-center gap-1">
                          <Phone size={10} /> {selectedSupplier.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-left bg-brand-50 p-3 rounded-lg border border-brand-200">
                    <p className="text-sm text-gray-500 font-bold">الرصيد الحالي</p>
                    <p className={`text-2xl font-black ${selectedSupplier.balance > 0 ? 'text-green-600' : selectedSupplier.balance < 0 ? 'text-red-600' : 'text-gray-800'}`} dir="ltr">
                      {selectedSupplier.balance.toLocaleString()} ج.م
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {selectedSupplier.balance > 0 ? '(دائن - له مديونية علينا)' : selectedSupplier.balance < 0 ? '(مدين - عليه رصيد لنا)' : 'متزن'}
                    </p>
                  </div>
                </div>

                {/* Summary Strip for Itemized Activity */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-xs">
                    <span className="text-xs text-gray-500 block mb-1 font-bold">إجمالي كراتين البيض</span>
                    <span className="text-lg font-black text-amber-700 flex items-center justify-center gap-1">
                      <Package size={16} /> {totalEggQuantity.toLocaleString()}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-xs">
                    <span className="text-xs text-gray-500 block mb-1 font-bold">إجمالي التوريدات (علينا)</span>
                    <span className="text-lg font-black text-green-600" dir="ltr">
                      {totalItemizedCredit.toLocaleString()} ج.م
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-xs">
                    <span className="text-xs text-gray-500 block mb-1 font-bold">إجمالي السداد (لنا)</span>
                    <span className="text-lg font-black text-red-600" dir="ltr">
                      {totalItemizedDebit.toLocaleString()} ج.م
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-xs">
                    <span className="text-xs text-gray-500 block mb-1 font-bold">صافي المديونية</span>
                    <span className={`text-lg font-black ${selectedSupplier.balance > 0 ? 'text-green-600' : 'text-red-600'}`} dir="ltr">
                      {selectedSupplier.balance.toLocaleString()} ج.م
                    </span>
                  </div>
                </div>

                <div>
                  {/* Ledger Actions & View Mode Toggle */}
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-3 gap-3">
                    <div className="flex items-center gap-3">
                      <h4 className="font-bold text-gray-800 flex items-center gap-2">
                        <FileText size={18} className="text-brand-600" /> كشف الحساب
                      </h4>

                      {/* View Mode Toggle Switch */}
                      <div className="inline-flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                        <button
                          type="button"
                          onClick={() => setViewMode('ITEMS')}
                          className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${viewMode === 'ITEMS' ? 'bg-brand-600 text-white shadow-xs' : 'text-gray-600 hover:text-brand-700'}`}
                        >
                          <Package size={14} /> تفصيلي بالأصناف
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewMode('INVOICES')}
                          className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${viewMode === 'INVOICES' ? 'bg-brand-600 text-white shadow-xs' : 'text-gray-600 hover:text-brand-700'}`}
                        >
                          <Layers size={14} /> مجمع بالفواتير
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                        {currentUser?.permissions.canDeleteLedgers && (
                          showClearLedgerConfirm ? (
                             <div className="flex items-center gap-2 bg-red-50 p-1.5 rounded-lg border border-red-200 animate-fade-in">
                               <AlertTriangle size={16} className="text-red-500" />
                               <span className="text-xs font-bold text-red-600">تأكيد الحذف؟</span>
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
                              className="flex items-center gap-1.5 bg-red-50 text-red-600 px-2.5 py-1.5 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors border border-red-200"
                            >
                              <Trash2 size={14} /> تصفير الحساب
                            </button>
                          )
                        )}

                        <button 
                          onClick={() => {
                            printLedger({
                              title: viewMode === 'ITEMS' ? 'كشف حساب مورد تفصيلي بالأصناف' : 'كشف حساب مورد مجمع بالفواتير',
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
                                debit: h.amount < 0 ? Math.abs(h.amount) : 0,
                                credit: h.amount > 0 ? h.amount : 0,
                                runningBalance: selectedSupplier.balance
                              })),
                              totalDebit: totalItemizedDebit,
                              totalCredit: totalItemizedCredit,
                              finalBalance: selectedSupplier.balance
                            });
                          }}
                          className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-xs"
                        >
                          <Printer size={15} /> طباعة كشف الحساب
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
                          className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-700 transition-colors shadow-xs"
                        >
                          <Download size={15} /> تصدير (Excel)
                        </button>
                    </div>
                  </div>

                  {/* Table Display */}
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    {viewMode === 'ITEMS' ? (
                      /* ITEM-BY-ITEM VIEW */
                      <table className="w-full text-xs text-right">
                        <thead className="bg-gray-100 text-gray-700 border-b border-gray-200 font-bold">
                          <tr>
                            <th className="p-2.5 text-center w-10">م</th>
                            <th className="p-2.5 text-center w-24">التاريخ</th>
                            <th className="p-2.5 text-center w-24">الفاتورة</th>
                            <th className="p-2.5">الصنف / البيان</th>
                            <th className="p-2.5 text-center w-24">الكمية (كرتونة)</th>
                            <th className="p-2.5 text-center w-24">السعر</th>
                            <th className="p-2.5 text-center w-28 text-green-700">علينا (له)</th>
                            <th className="p-2.5 text-center w-28 text-red-700">لنا (سداد)</th>
                            <th className="p-2.5 text-center w-28">الرصيد</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {itemizedRows.length === 0 ? (
                            <tr><td colSpan={9} className="p-6 text-center text-gray-400">لا توجد حركات مسجلة لهذا المورد</td></tr>
                          ) : (
                            itemizedRows.map((r, idx) => (
                              <tr key={idx} className={r.isInvoiceItem ? 'hover:bg-amber-50/40' : 'bg-gray-50/60 hover:bg-gray-100/60'}>
                                <td className="p-2.5 text-center text-gray-500 font-mono">{r.num}</td>
                                <td className="p-2.5 text-center text-gray-600 whitespace-nowrap font-mono">{r.date}</td>
                                <td className="p-2.5 text-center font-mono">
                                  {r.purchaseId ? (
                                    <button 
                                      onClick={() => handleViewPurchaseDetails(`فاتورة #${r.purchaseId}`)}
                                      className="text-orange-700 hover:text-orange-900 bg-orange-50 hover:bg-orange-100 px-1.5 py-0.5 rounded text-xs font-bold inline-flex items-center gap-1"
                                      title="عرض فاتورة الشراء"
                                    >
                                      #{r.purchaseId}
                                      <Eye size={12} />
                                    </button>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                                <td className="p-2.5 font-bold text-gray-800">
                                  {r.isInvoiceItem ? (
                                    <span className="inline-flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                                      {r.itemName}
                                    </span>
                                  ) : (
                                    <span className="text-gray-700 font-medium">{r.itemName}</span>
                                  )}
                                </td>
                                <td className="p-2.5 text-center font-bold text-gray-800">
                                  {typeof r.quantity === 'number' ? (
                                    <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-mono font-bold">
                                      {r.quantity.toLocaleString()}
                                    </span>
                                  ) : '-'}
                                </td>
                                <td className="p-2.5 text-center font-mono text-gray-700">
                                  {typeof r.price === 'number' ? `${r.price.toLocaleString()} ج.م` : '-'}
                                </td>
                                <td className="p-2.5 text-center font-bold text-green-600 bg-green-50/30 font-mono">
                                  {r.credit > 0 ? r.credit.toLocaleString() : '-'}
                                </td>
                                <td className="p-2.5 text-center font-bold text-red-600 bg-red-50/30 font-mono">
                                  {r.debit > 0 ? r.debit.toLocaleString() : '-'}
                                </td>
                                <td className="p-2.5 text-center font-black font-mono text-gray-900" dir="ltr">
                                  {r.runningBalance.toLocaleString()}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                        {itemizedRows.length > 0 && (
                          <tfoot className="bg-gray-100 font-bold border-t-2 border-gray-300">
                            <tr>
                              <td colSpan={4} className="p-3 text-right font-black">الإجماليات:</td>
                              <td className="p-3 text-center text-amber-800 font-black font-mono">{totalEggQuantity.toLocaleString()} كرتونة</td>
                              <td className="p-3 text-center text-gray-400">-</td>
                              <td className="p-3 text-center text-green-700 font-black font-mono">{totalItemizedCredit.toLocaleString()}</td>
                              <td className="p-3 text-center text-red-700 font-black font-mono">{totalItemizedDebit.toLocaleString()}</td>
                              <td className="p-3 text-center font-black font-mono text-brand-900" dir="ltr">{selectedSupplier.balance.toLocaleString()}</td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    ) : (
                      /* SUMMARY INVOICE VIEW */
                      <table className="w-full text-sm text-right">
                        <thead className="bg-gray-50 text-gray-600 border-y">
                          <tr>
                            <th className="p-3">التاريخ</th>
                            <th className="p-3 w-1/3">البيان</th>
                            <th className="p-3 text-green-600">علينا (له)</th>
                            <th className="p-3 text-red-600">لنا (عليه)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {selectedSupplier.history.length === 0 ? (
                            <tr><td colSpan={4} className="p-4 text-center text-gray-400">لا توجد حركات مسجلة</td></tr>
                          ) : (
                            selectedSupplier.history.map((h, idx) => {
                              const isDebtIncrease = h.amount > 0;
                              const isDebtDecrease = h.amount < 0;
                              const pMatch = h.description.match(/#([A-Za-z0-9-]+)/);

                              return (
                                <tr key={idx}>
                                  <td className="p-3 text-gray-600 whitespace-nowrap">{h.date}</td>
                                  <td className="p-3 font-medium text-gray-800">
                                    <div className="flex justify-between items-center">
                                      <span>{h.description}</span>
                                      {pMatch && (
                                        <button 
                                          onClick={() => handleViewPurchaseDetails(h.description)}
                                          className="text-orange-600 hover:text-orange-800 bg-orange-50 hover:bg-orange-100 p-1 rounded transition-colors"
                                          title="عرض تفاصيل الفاتورة"
                                        >
                                          <Eye size={16} />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-3 font-bold text-green-600 bg-green-50/30">
                                    {isDebtIncrease ? h.amount.toLocaleString() : '-'}
                                  </td>
                                  <td className="p-3 font-bold text-red-600 bg-red-50/30">
                                    {isDebtDecrease ? Math.abs(h.amount).toLocaleString() : '-'}
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
             </div>
           ) : (
             <div className="h-full flex flex-col items-center justify-center text-gray-400">
               <Truck size={48} className="mb-4 opacity-50"/>
               <p>اختر مورد لعرض التفاصيل</p>
             </div>
           )}
        </div>
      </div>

      {/* View Purchase Invoice Modal */}
      {viewPurchase && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in">
            <div className="bg-orange-600 p-4 flex justify-between items-center text-white">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <FileText size={20}/> تفاصيل فاتورة مشتريات {viewPurchase.id}
              </h2>
              <button onClick={() => setViewPurchase(null)} className="hover:bg-orange-700 p-1 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-50 p-3 rounded-lg">
                   <span className="block text-gray-500 text-xs">المورد</span>
                   <span className="font-bold text-gray-800 text-base">{viewPurchase.supplierName}</span>
                   <span className="text-xs text-gray-400 block mt-0.5">({viewPurchase.supplierCode})</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                   <span className="block text-gray-500 text-xs">التاريخ</span>
                   <span className="font-bold text-gray-800 text-base font-mono">{viewPurchase.date}</span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-gray-700 mb-2 flex items-center gap-1.5 text-sm">
                  <Package size={16} /> الأصناف المسجلة بالفاتورة
                </h4>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-xs text-right">
                    <thead className="bg-gray-100 text-gray-700">
                      <tr>
                        <th className="p-2.5">الصنف</th>
                        <th className="p-2.5 text-center">الكمية</th>
                        <th className="p-2.5 text-center">السعر</th>
                        <th className="p-2.5 text-center">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(viewPurchase.items || []).map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="p-2.5 font-bold text-gray-800">{item.itemName}</td>
                          <td className="p-2.5 text-center font-mono font-bold bg-amber-50">{item.quantity} كرتونة</td>
                          <td className="p-2.5 text-center font-mono">{item.price.toLocaleString()} ج.م</td>
                          <td className="p-2.5 text-center font-mono font-bold text-green-700">{item.total.toLocaleString()} ج.م</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-orange-50 p-4 rounded-xl space-y-2 border border-orange-100 text-sm">
                <div className="flex justify-between items-center text-orange-950 font-bold">
                  <span>إجمالي الفاتورة:</span>
                  <span className="text-lg font-black font-mono text-orange-700">{viewPurchase.total.toLocaleString()} ج.م</span>
                </div>
                {viewPurchase.previousBalance !== undefined && (
                  <>
                    <div className="flex justify-between items-center text-xs text-gray-600 border-t border-orange-200/60 pt-2">
                      <span>رصيد سابق:</span>
                      <span className="font-mono">{viewPurchase.previousBalance.toLocaleString()} ج.م</span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-bold text-gray-900 border-t border-orange-200 pt-2">
                      <span>الرصيد بعد الفاتورة:</span>
                      <span className="font-mono">{viewPurchase.currentBalance?.toLocaleString()} ج.م</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="bg-gray-50 p-4 border-t flex justify-end gap-3">
              <button 
                onClick={() => printPurchaseInvoice(viewPurchase)} 
                className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-orange-700 flex items-center gap-2 shadow-sm"
              >
                <Printer size={16} /> طباعة الفاتورة
              </button>
              <button 
                onClick={() => setViewPurchase(null)} 
                className="bg-white border text-gray-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-100"
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
