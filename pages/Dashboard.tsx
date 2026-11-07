
import React, { useState } from 'react';
import { useERP } from '../context/ERPContext';
import { TrendingUp, Users, Package, Truck, Trash2, Check, X, AlertTriangle, Clock, ShoppingCart } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export const Dashboard: React.FC = () => {
  const { 
    products, 
    customers, 
    suppliers, 
    purchases,
    currentTreasuryBalance, 
    currentTreasuryBalanceMarg,
    currentTreasuryBalanceNozha,
    invoices, 
    deleteInvoice,
    currentUser
  } = useERP();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const canDeleteInvoices = currentUser?.role === 'ADMIN' || currentUser?.username === 'admin' || Boolean(currentUser?.permissions?.canDeleteInvoices);

  // Filter out deleted items (Soft Delete)
  const activeCustomers = customers.filter(c => !c.isDeleted);
  const activeSuppliers = suppliers.filter(s => !s.isDeleted);
  const activeInvoices = invoices.filter(i => !i.isDeleted);
  const activePurchases = purchases.filter(p => !p.isDeleted);

  const pendingPurchases = activePurchases.filter(p => p.pricingStatus === 'PENDING_PRICE');

  // Calculations for Stock
  const totalStockValue = products.reduce((sum, p) => sum + (p.quantity * p.price), 0);
  const totalStockMargValue = products.reduce((sum, p) => sum + ((p.quantityMarg ?? p.quantity) * p.price), 0);
  const totalStockNozhaValue = products.reduce((sum, p) => sum + ((p.quantityNozha ?? 0) * p.price), 0);

  // Calculations for Customer Debt (Split by branch)
  const totalCustomerDebt = activeCustomers.reduce((sum, c) => sum + c.balance, 0);
  const customerDebtMarg = activeCustomers
    .filter(c => (c.branchId || 'MARG') === 'MARG')
    .reduce((sum, c) => sum + c.balance, 0);
  const customerDebtNozha = activeCustomers
    .filter(c => c.branchId === 'NOZHA')
    .reduce((sum, c) => sum + c.balance, 0);

  // Calculations for Supplier Debt (Split by branch delivery attribution)
  const totalSupplierDebt = activeSuppliers.reduce((sum, s) => sum + (s.balance > 0 ? s.balance : 0), 0);
  const purchasesMargTotal = activePurchases
    .filter(p => (p.branchId || 'MARG') === 'MARG' && p.pricingStatus !== 'PENDING_PRICE')
    .reduce((sum, p) => sum + (p.total || 0), 0);
  const purchasesNozhaTotal = activePurchases
    .filter(p => p.branchId === 'NOZHA' && p.pricingStatus !== 'PENDING_PRICE')
    .reduce((sum, p) => sum + (p.total || 0), 0);
  const totalPurchasesSum = purchasesMargTotal + purchasesNozhaTotal;
  const supplierDebtMarg = totalPurchasesSum > 0 
    ? Math.round(totalSupplierDebt * (purchasesMargTotal / totalPurchasesSum))
    : Math.round(totalSupplierDebt / 2);
  const supplierDebtNozha = totalSupplierDebt - supplierDebtMarg;
  
  const recentSales = activeInvoices.slice(0, 5);

  const handleDelete = async (id: string) => {
    await deleteInvoice(id);
    setDeleteConfirmId(null);
  };

  const statCards = [
    { 
      title: 'رصيد الخزنة', 
      value: `${currentTreasuryBalance.toLocaleString()} ج.م`, 
      margLabel: `المرج: ${currentTreasuryBalanceMarg.toLocaleString()} ج.م`,
      nozhaLabel: `النزهة: ${currentTreasuryBalanceNozha.toLocaleString()} ج.م`,
      icon: <TrendingUp size={24} />, 
      color: 'bg-emerald-500' 
    },
    { 
      title: 'قيمة المخزون', 
      value: `${totalStockValue.toLocaleString()} ج.م`, 
      margLabel: `المرج: ${totalStockMargValue.toLocaleString()} ج.م`,
      nozhaLabel: `النزهة: ${totalStockNozhaValue.toLocaleString()} ج.م`,
      icon: <Package size={24} />, 
      color: 'bg-blue-500' 
    },
    { 
      title: 'مديونيات العملاء', 
      value: `${totalCustomerDebt.toLocaleString()} ج.م`, 
      margLabel: `المرج: ${customerDebtMarg.toLocaleString()} ج.م`,
      nozhaLabel: `النزهة: ${customerDebtNozha.toLocaleString()} ج.م`,
      icon: <Users size={24} />, 
      color: 'bg-orange-500' 
    },
    { 
      title: 'مديونيات الموردين (علينا)', 
      value: `${totalSupplierDebt.toLocaleString()} ج.م`, 
      margLabel: `المرج: ${supplierDebtMarg.toLocaleString()} ج.م`,
      nozhaLabel: `النزهة: ${supplierDebtNozha.toLocaleString()} ج.م`,
      icon: <Truck size={24} />, 
      color: 'bg-red-600' 
    },
  ];

  const chartData = products.slice(0, 10).map(p => ({
    name: p.name,
    stockMarg: p.quantityMarg !== undefined ? p.quantityMarg : p.quantity,
    stockNozha: p.quantityNozha !== undefined ? p.quantityNozha : 0,
  }));

  return (
    <div className="space-y-6">
      {/* Alert Card for Pending Price Purchases */}
      {pendingPurchases.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-2 border-amber-400 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-500 text-white rounded-xl shadow-md shrink-0">
              <Clock size={28} className="animate-spin" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-amber-950">
                  تنبيه: يوجد ({pendingPurchases.length}) فواتير مشتريات معلقة السعر!
                </h3>
                <span className="bg-amber-200 text-amber-900 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  إجراء مطلوب
                </span>
              </div>
              <p className="text-xs md:text-sm text-amber-800 mt-1">
                تم استلام بضائع هذه الفواتير ودخلت رصيد المخزن بالفعل، ولكن لم يُحدد سعر الشراء النهائي ولم يتم قيد المديونية للموردين.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-900 bg-amber-100/70 px-4 py-2 rounded-xl border border-amber-300">
            <span>الفواتير:</span>
            <span className="font-mono">{pendingPurchases.map(p => `#${p.id}`).join(', ')}</span>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <div key={index} className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow border border-brand-100 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-500 text-xs font-bold mb-1">{stat.title}</p>
                <h3 className="text-2xl font-black text-brand-900 font-mono" dir="ltr">{stat.value}</h3>
              </div>
              <div className={`${stat.color} text-white p-2.5 rounded-xl shadow-md shrink-0`}>
                {stat.icon}
              </div>
            </div>

            <div className="flex justify-between items-center text-[11px] font-bold mt-3 pt-2.5 border-t border-gray-100">
              <span className="text-blue-700 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block"></span>
                <span>{stat.margLabel}</span>
              </span>
              <span className="text-gray-300">|</span>
              <span className="text-purple-700 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-600 inline-block"></span>
                <span>{stat.nozhaLabel}</span>
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-brand-100 overflow-hidden">
          <h3 className="text-lg font-bold text-brand-900 mb-4">أحدث الفواتير</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-brand-50 text-brand-700 font-bold">
                <tr>
                  <th className="p-3">رقم الفاتورة</th>
                  <th className="p-3">العميل</th>
                  <th className="p-3">الأصناف</th>
                  <th className="p-3">الاجمالي</th>
                  {canDeleteInvoices && (
                    <th className="p-3 w-16 text-center">حذف</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-50">
                {recentSales.length === 0 ? (
                  <tr><td colSpan={canDeleteInvoices ? 5 : 4} className="p-6 text-center text-gray-400">لا توجد مبيعات حديثة</td></tr>
                ) : (
                  recentSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-brand-50/50 transition-colors">
                      <td className="p-3 font-mono font-bold text-brand-800">{sale.id}</td>
                      <td className="p-3 font-bold text-gray-800">{sale.customerName}</td>
                      <td className="p-3 text-xs text-gray-500">
                        {sale.items.length > 1 
                          ? `${sale.items[0].itemName} (+${sale.items.length - 1})` 
                          : sale.items[0]?.itemName}
                      </td>
                      <td className="p-3 font-bold font-mono text-emerald-600">{sale.total.toLocaleString()}</td>
                      {canDeleteInvoices && (
                        <td className="p-3 text-center">
                          {deleteConfirmId === sale.id ? (
                            <div className="flex items-center justify-center gap-1">
                               <button 
                                 onClick={() => handleDelete(sale.id)} 
                                 className="bg-red-500 text-white p-1 rounded hover:bg-red-600 transition-colors cursor-pointer"
                                 title="تأكيد الحذف (نقل إلى سلة المهملات)"
                               >
                                 <Check size={14}/>
                               </button>
                               <button 
                                 onClick={() => setDeleteConfirmId(null)} 
                                 className="bg-gray-200 text-gray-600 p-1 rounded hover:bg-gray-300 transition-colors cursor-pointer"
                                 title="إلغاء"
                               >
                                 <X size={14}/>
                               </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => setDeleteConfirmId(sale.id)}
                              className="text-red-400 hover:text-red-600 transition-colors p-1.5 rounded-lg hover:bg-red-50 cursor-pointer"
                              title="حذف الفاتورة (نقل إلى سلة المهملات)"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stock Quantities Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-brand-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-brand-900">كميات المخزون (مقارنة الإدارتين)</h3>
            <span className="text-xs text-gray-400 font-mono">أول {chartData.length} أصناف</span>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="stockMarg" name="مخزن المرج" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="stockNozha" name="مخزن النزهة" fill="#9333ea" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
