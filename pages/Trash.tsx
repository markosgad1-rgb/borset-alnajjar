import React, { useState, useMemo } from 'react';
import { useERP } from '../context/ERPContext';
import { 
  Trash2, RotateCcw, AlertTriangle, FileText, ShoppingCart, Users, Truck, 
  Search, Calendar, Clock, CheckCircle2, ShieldAlert
} from 'lucide-react';
import { SalesInvoice, Purchase, Customer, Supplier } from '../types';
import { formatWithCommas } from '../utils/formatters';

type TrashTab = 'INVOICES' | 'CUSTOMERS' | 'SUPPLIERS';

interface PermanentDeleteTarget {
  type: 'invoice' | 'purchase' | 'customer' | 'supplier';
  id: string;
  name: string;
  label: string;
}

export const Trash: React.FC = () => {
  const { 
    invoices, purchases, customers, suppliers, 
    restoreEntity, permanentDeleteEntity 
  } = useERP();

  const [activeTab, setActiveTab] = useState<TrashTab>('INVOICES');
  const [searchTerm, setSearchTerm] = useState('');
  const [invoiceTypeFilter, setInvoiceTypeFilter] = useState<'ALL' | 'SALES' | 'PURCHASE'>('ALL');
  
  // Action loading state & notifications
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<PermanentDeleteTarget | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // 1. Deleted Sales Invoices & Purchases
  const deletedSalesInvoices = useMemo(() => invoices.filter(i => i.isDeleted), [invoices]);
  const deletedPurchases = useMemo(() => purchases.filter(p => p.isDeleted), [purchases]);

  // Combined deleted invoices
  const filteredDeletedInvoices = useMemo(() => {
    type CombinedInv = 
      | { kind: 'SALES'; data: SalesInvoice }
      | { kind: 'PURCHASE'; data: Purchase };

    let list: CombinedInv[] = [];
    if (invoiceTypeFilter === 'ALL' || invoiceTypeFilter === 'SALES') {
      deletedSalesInvoices.forEach(i => list.push({ kind: 'SALES', data: i }));
    }
    if (invoiceTypeFilter === 'ALL' || invoiceTypeFilter === 'PURCHASE') {
      deletedPurchases.forEach(p => list.push({ kind: 'PURCHASE', data: p }));
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(item => {
        if (item.kind === 'SALES') {
          return item.data.id.toLowerCase().includes(q) || item.data.customerName.toLowerCase().includes(q);
        } else {
          return item.data.id.toLowerCase().includes(q) || item.data.supplierName.toLowerCase().includes(q);
        }
      });
    }

    // Sort by deletedAt desc or date desc
    list.sort((a, b) => {
      const timeA = a.data.deletedAt || a.data.date || '';
      const timeB = b.data.deletedAt || b.data.date || '';
      return timeB.localeCompare(timeA);
    });

    return list;
  }, [deletedSalesInvoices, deletedPurchases, invoiceTypeFilter, searchTerm]);

  // 2. Deleted Customers
  const deletedCustomers = useMemo(() => {
    let list = customers.filter(c => c.isDeleted);
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(c => 
        c.name.toLowerCase().includes(q) || 
        c.code.toLowerCase().includes(q) || 
        (c.phone && c.phone.includes(q))
      );
    }
    list.sort((a, b) => (b.deletedAt || '').localeCompare(a.deletedAt || ''));
    return list;
  }, [customers, searchTerm]);

  // 3. Deleted Suppliers
  const deletedSuppliers = useMemo(() => {
    let list = suppliers.filter(s => s.isDeleted);
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(s => 
        s.name.toLowerCase().includes(q) || 
        s.code.toLowerCase().includes(q) || 
        (s.phone && s.phone.includes(q))
      );
    }
    list.sort((a, b) => (b.deletedAt || '').localeCompare(a.deletedAt || ''));
    return list;
  }, [suppliers, searchTerm]);

  // Handle Restore
  const handleRestore = async (type: 'customer' | 'supplier' | 'invoice' | 'purchase', id: string, name: string) => {
    setProcessingId(id);
    try {
      const res = await restoreEntity(type, id);
      if (res.success) {
        showNotification(`تم استرجاع (${name}) بنجاح إلى النظام.`);
      } else {
        showNotification(res.message || 'حدث خطأ أثناء الاسترجاع.', 'error');
      }
    } finally {
      setProcessingId(null);
    }
  };

  // Handle Permanent Delete Execution
  const handleExecutePermanentDelete = async () => {
    if (!confirmDeleteTarget) return;
    const { type, id, name } = confirmDeleteTarget;
    setProcessingId(id);
    try {
      const res = await permanentDeleteEntity(type, id);
      if (res.success) {
        showNotification(`تم حذف (${name}) نهائياً من قاعدة البيانات.`);
      } else {
        showNotification(res.message || 'حدث خطأ أثناء الحذف النهائي.', 'error');
      }
    } finally {
      setProcessingId(null);
      setConfirmDeleteTarget(null);
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'غير محدد';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return `${d.toLocaleDateString('ar-EG')} ${d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-50 text-red-600 rounded-2xl border border-red-100">
            <Trash2 size={26} />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
              سلة المهملات (Trash Bin)
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              استرجاع العناصر المحذوفة أو حذفها نهائياً من قاعدة البيانات
            </p>
          </div>
        </div>

        {/* Global Stats */}
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span className="bg-orange-50 text-orange-800 border border-orange-200 px-3 py-1 rounded-xl font-bold">
            فواتير: {deletedSalesInvoices.length + deletedPurchases.length}
          </span>
          <span className="bg-blue-50 text-blue-800 border border-blue-200 px-3 py-1 rounded-xl font-bold">
            عملاء: {deletedCustomers.length}
          </span>
          <span className="bg-purple-50 text-purple-800 border border-purple-200 px-3 py-1 rounded-xl font-bold">
            موردين: {deletedSuppliers.length}
          </span>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md animate-fadeIn ${
          notification.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Tabs & Search Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
        {/* Tabs */}
        <div className="flex bg-gray-100 p-1 rounded-xl gap-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('INVOICES')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'INVOICES' 
                ? 'bg-white text-orange-950 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileText size={15} />
            <span>فواتير محذوفة</span>
            <span className="bg-gray-200 text-gray-700 px-1.5 py-0.2 rounded-full text-[10px]">
              {deletedSalesInvoices.length + deletedPurchases.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('CUSTOMERS')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'CUSTOMERS' 
                ? 'bg-white text-orange-950 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users size={15} />
            <span>عملاء محذوفون</span>
            <span className="bg-gray-200 text-gray-700 px-1.5 py-0.2 rounded-full text-[10px]">
              {deletedCustomers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('SUPPLIERS')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'SUPPLIERS' 
                ? 'bg-white text-orange-950 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Truck size={15} />
            <span>موردون محذوفون</span>
            <span className="bg-gray-200 text-gray-700 px-1.5 py-0.2 rounded-full text-[10px]">
              {deletedSuppliers.length}
            </span>
          </button>
        </div>

        {/* Search & Sub-filters */}
        <div className="flex items-center gap-2 flex-1 md:max-w-md">
          {activeTab === 'INVOICES' && (
            <select
              value={invoiceTypeFilter}
              onChange={(e) => setInvoiceTypeFilter(e.target.value as any)}
              className="bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold rounded-xl px-2.5 py-2 outline-none focus:border-orange-500"
            >
              <option value="ALL">كل الفواتير</option>
              <option value="SALES">فواتير بيع</option>
              <option value="PURCHASE">فواتير شراء</option>
            </select>
          )}

          <div className="relative flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث في العناصر المحذوفة..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pr-9 pl-3 py-2 text-xs text-gray-800 placeholder-gray-400 outline-none focus:border-orange-500 transition-all"
            />
            <Search size={15} className="absolute right-3 top-2.5 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* TAB 1: INVOICES */}
        {activeTab === 'INVOICES' && (
          <div>
            {filteredDeletedInvoices.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mx-auto mb-3">
                  <FileText size={32} />
                </div>
                <h3 className="text-sm font-bold text-gray-700">لا توجد فواتير محذوفة</h3>
                <p className="text-xs text-gray-400 mt-1">
                  {searchTerm ? 'لا توجد نتائج مطابقة لبحثك' : 'سلة مهملات الفواتير فارغة'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-100">
                    <tr>
                      <th className="p-3">النوع</th>
                      <th className="p-3">رقم الفاتورة</th>
                      <th className="p-3">تاريخ الفاتورة</th>
                      <th className="p-3">الطرف الثاني</th>
                      <th className="p-3">الإجمالي</th>
                      <th className="p-3">تاريخ الحذف</th>
                      <th className="p-3 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredDeletedInvoices.map((item, idx) => {
                      const isSales = item.kind === 'SALES';
                      const inv = item.data;
                      const isProcessing = processingId === inv.id;

                      return (
                        <tr key={`${item.kind}_${inv.id}_${idx}`} className="hover:bg-gray-50/70 transition-colors">
                          <td className="p-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[10px] ${
                              isSales 
                                ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}>
                              {isSales ? <FileText size={10} /> : <ShoppingCart size={10} />}
                              {isSales ? 'فاتورة بيع' : 'فاتورة مشتريات'}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-bold text-brand-900">
                            #{inv.id}
                          </td>
                          <td className="p-3 text-gray-600">
                            {inv.date}
                          </td>
                          <td className="p-3 font-bold text-gray-800">
                            {isSales ? (inv as SalesInvoice).customerName : (inv as Purchase).supplierName}
                          </td>
                          <td className="p-3 font-mono font-bold text-brand-900" dir="ltr">
                            {formatWithCommas(inv.total)} ج.م
                          </td>
                          <td className="p-3 text-gray-500 text-[11px]">
                            {formatDate(inv.deletedAt)}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Restore Button */}
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => handleRestore(
                                  isSales ? 'invoice' : 'purchase', 
                                  inv.id, 
                                  `فاتورة #${inv.id}`
                                )}
                                className="inline-flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg font-bold transition-all disabled:opacity-50"
                                title="استرجاع الفاتورة إلى سجلاتها وحساباتها"
                              >
                                <RotateCcw size={12} />
                                <span>استرجاع</span>
                              </button>

                              {/* Permanent Delete Button */}
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => setConfirmDeleteTarget({
                                  type: isSales ? 'invoice' : 'purchase',
                                  id: inv.id,
                                  name: `فاتورة #${inv.id}`,
                                  label: isSales ? 'فاتورة مبيعات' : 'فاتورة مشتريات'
                                })}
                                className="inline-flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-2.5 py-1 rounded-lg font-bold transition-all disabled:opacity-50"
                                title="حذف نهائي لا يمكن استرجاعه"
                              >
                                <Trash2 size={12} />
                                <span>حذف نهائي</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CUSTOMERS */}
        {activeTab === 'CUSTOMERS' && (
          <div>
            {deletedCustomers.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Users size={32} />
                </div>
                <h3 className="text-sm font-bold text-gray-700">لا يوجد عملاء محذوفون</h3>
                <p className="text-xs text-gray-400 mt-1">
                  {searchTerm ? 'لا توجد نتائج مطابقة لبحثك' : 'سلة مهملات العملاء فارغة'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-100">
                    <tr>
                      <th className="p-3">الكود</th>
                      <th className="p-3">اسم العميل</th>
                      <th className="p-3">رقم الهاتف</th>
                      <th className="p-3">الفرع والمنطقة</th>
                      <th className="p-3">الرصيد المسجل</th>
                      <th className="p-3">تاريخ الحذف</th>
                      <th className="p-3 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {deletedCustomers.map((c, idx) => {
                      const isProcessing = processingId === c.code;

                      return (
                        <tr key={`${c.code}_${idx}`} className="hover:bg-gray-50/70 transition-colors">
                          <td className="p-3 font-mono font-bold text-gray-700">
                            {c.code}
                          </td>
                          <td className="p-3 font-bold text-gray-900">
                            {c.name}
                          </td>
                          <td className="p-3 text-gray-600 font-mono" dir="ltr">
                            {c.phone || '-'}
                          </td>
                          <td className="p-3 text-gray-600">
                            <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[10px] font-bold ml-1">
                              {c.branchId === 'NOZHA' ? 'النزهة' : 'المرج'}
                            </span>
                            <span>{c.area || '-'}</span>
                          </td>
                          <td className="p-3 font-mono font-bold" dir="ltr">
                            <span className={c.balance > 0 ? 'text-green-600' : c.balance < 0 ? 'text-red-600' : 'text-gray-600'}>
                              {formatWithCommas(c.balance)} ج.م
                            </span>
                          </td>
                          <td className="p-3 text-gray-500 text-[11px]">
                            {formatDate(c.deletedAt)}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Restore Button */}
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => handleRestore('customer', c.code, c.name)}
                                className="inline-flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg font-bold transition-all disabled:opacity-50"
                                title="استرجاع العميل إلى القائمة النشطة"
                              >
                                <RotateCcw size={12} />
                                <span>استرجاع</span>
                              </button>

                              {/* Permanent Delete Button */}
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => setConfirmDeleteTarget({
                                  type: 'customer',
                                  id: c.code,
                                  name: c.name,
                                  label: 'عميل'
                                })}
                                className="inline-flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-2.5 py-1 rounded-lg font-bold transition-all disabled:opacity-50"
                                title="حذف نهائي لا يمكن استرجاعه"
                              >
                                <Trash2 size={12} />
                                <span>حذف نهائي</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SUPPLIERS */}
        {activeTab === 'SUPPLIERS' && (
          <div>
            {deletedSuppliers.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Truck size={32} />
                </div>
                <h3 className="text-sm font-bold text-gray-700">لا يوجد موردون محذوفون</h3>
                <p className="text-xs text-gray-400 mt-1">
                  {searchTerm ? 'لا توجد نتائج مطابقة لبحثك' : 'سلة مهملات الموردين فارغة'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-100">
                    <tr>
                      <th className="p-3">الكود</th>
                      <th className="p-3">اسم المورد</th>
                      <th className="p-3">رقم الهاتف</th>
                      <th className="p-3">الرصيد المسجل</th>
                      <th className="p-3">تاريخ الحذف</th>
                      <th className="p-3 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {deletedSuppliers.map((s, idx) => {
                      const isProcessing = processingId === s.code;

                      return (
                        <tr key={`${s.code}_${idx}`} className="hover:bg-gray-50/70 transition-colors">
                          <td className="p-3 font-mono font-bold text-gray-700">
                            {s.code}
                          </td>
                          <td className="p-3 font-bold text-gray-900">
                            {s.name}
                          </td>
                          <td className="p-3 text-gray-600 font-mono" dir="ltr">
                            {s.phone || '-'}
                          </td>
                          <td className="p-3 font-mono font-bold" dir="ltr">
                            <span className={s.balance > 0 ? 'text-green-600' : s.balance < 0 ? 'text-red-600' : 'text-gray-600'}>
                              {formatWithCommas(s.balance)} ج.م
                            </span>
                          </td>
                          <td className="p-3 text-gray-500 text-[11px]">
                            {formatDate(s.deletedAt)}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Restore Button */}
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => handleRestore('supplier', s.code, s.name)}
                                className="inline-flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg font-bold transition-all disabled:opacity-50"
                                title="استرجاع المورد إلى القائمة النشطة"
                              >
                                <RotateCcw size={12} />
                                <span>استرجاع</span>
                              </button>

                              {/* Permanent Delete Button */}
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => setConfirmDeleteTarget({
                                  type: 'supplier',
                                  id: s.code,
                                  name: s.name,
                                  label: 'مورد'
                                })}
                                className="inline-flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-2.5 py-1 rounded-lg font-bold transition-all disabled:opacity-50"
                                title="حذف نهائي لا يمكن استرجاعه"
                              >
                                <Trash2 size={12} />
                                <span>حذف نهائي</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Permanent Delete Confirmation Modal */}
      {confirmDeleteTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-gray-100 text-right transform transition-all">
            <div className="flex items-center gap-3 text-red-600 mb-3 border-b border-red-100 pb-3">
              <div className="p-2.5 bg-red-50 rounded-xl">
                <ShieldAlert size={24} className="text-red-600 shrink-0" />
              </div>
              <div>
                <h3 className="text-base font-black text-gray-900">تأكيد الحذف النهائي</h3>
                <p className="text-xs text-red-600 font-bold">تحذير: لا يمكن التراجع عن هذا الإجراء أبداً</p>
              </div>
            </div>

            <div className="mb-4 text-xs space-y-2">
              <p className="text-sm font-bold text-gray-800 leading-relaxed">
                هل أنت متأكد من الحذف النهائي لـ {confirmDeleteTarget.label} ({confirmDeleteTarget.name})؟
              </p>
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-900 leading-relaxed">
                سيتم إزالة هذا المستند نهائياً من قاعدة بيانات Firestore ولن يظهر في سلة المهملات مجدداً.
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleExecutePermanentDelete}
                disabled={processingId !== null}
                className="flex-1 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
              >
                <Trash2 size={14} />
                <span>{processingId ? 'جاري الحذف...' : 'نعم، حذف نهائي'}</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteTarget(null)}
                disabled={processingId !== null}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 px-4 rounded-xl font-bold text-xs transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
