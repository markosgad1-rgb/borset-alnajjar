
import React, { useState } from 'react';
import { useERP } from '../context/ERPContext';
import { TrendingUp, Users, Package, Truck, Trash2, Check, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export const Dashboard: React.FC = () => {
  const { products, customers, suppliers, currentTreasuryBalance, invoices, deleteInvoice } = useERP();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Calculations
  const totalStockValue = products.reduce((sum, p) => sum + (p.quantity * p.price), 0);
  const totalCustomerDebt = customers.reduce((sum, c) => sum + c.balance, 0);
  // Supplier Debt: Sum of POSITIVE balances (Liability on us)
  const totalSupplierDebt = suppliers.reduce((sum, s) => sum + (s.balance > 0 ? s.balance : 0), 0);
  
  const recentSales = invoices.slice(0, 5);

  const handleDelete = async (id: string) => {
    await deleteInvoice(id);
    setDeleteConfirmId(null);
  };

  const statCards = [
    { title: 'رصيد الخزنة', value: `${currentTreasuryBalance.toLocaleString()} ج.م`, icon: <TrendingUp />, color: 'bg-emerald-500' },
    { title: 'قيمة المخزون', value: `${totalStockValue.toLocaleString()} ج.م`, icon: <Package />, color: 'bg-blue-500' },
    { title: 'مديونيات العملاء', value: `${totalCustomerDebt.toLocaleString()} ج.م`, icon: <Users />, color: 'bg-orange-500' },
    { title: 'مديونيات الموردين (علينا)', value: `${totalSupplierDebt.toLocaleString()} ج.م`, icon: <Truck />, color: 'bg-red-600' },
  ];

  const chartData = products.map(p => ({
    name: p.name,
    stock: p.quantity,
  }));

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <div key={index} className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow border border-brand-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm mb-1">{stat.title}</p>
                <h3 className="text-2xl font-bold text-brand-900">{stat.value}</h3>
              </div>
              <div className={`${stat.color} text-white p-3 rounded-full shadow-lg`}>
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-brand-100">
          <h3 className="text-lg font-bold text-brand-800 mb-4">كميات المخزون</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="stock" name="الكمية" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-brand-100 overflow-hidden">
          <h3 className="text-lg font-bold text-brand-800 mb-4">أحدث الفواتير</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-brand-50 text-brand-700">
                <tr>
                  <th className="p-3 rounded-r-lg">رقم الفاتورة</th>
                  <th className="p-3">العميل</th>
                  <th className="p-3">الأصناف</th>
                  <th className="p-3">الاجمالي</th>
                  <th className="p-3 rounded-l-lg w-20">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-50">
                {recentSales.length === 0 ? (
                  <tr><td colSpan={5} className="p-4 text-center text-gray-400">لا توجد مبيعات حديثة</td></tr>
                ) : (
                  recentSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-brand-50/50">
                      <td className="p-3 font-medium">{sale.id}</td>
                      <td className="p-3 text-gray-600">{sale.customerName}</td>
                      <td className="p-3 text-xs text-gray-500">
                        {sale.items.length > 1 
                          ? `${sale.items[0].itemName} (+${sale.items.length - 1})` 
                          : sale.items[0]?.itemName}
                      </td>
                      <td className="p-3 font-bold text-emerald-600">{sale.total.toLocaleString()}</td>
                      <td className="p-3">
                        {deleteConfirmId === sale.id ? (
                          <div className="flex items-center gap-1">
                             <button 
                               onClick={() => handleDelete(sale.id)} 
                               className="bg-red-500 text-white p-1 rounded hover:bg-red-600 transition-colors"
                               title="تأكيد"
                             >
                               <Check size={14}/>
                             </button>
                             <button 
                               onClick={() => setDeleteConfirmId(null)} 
                               className="bg-gray-200 text-gray-600 p-1 rounded hover:bg-gray-300 transition-colors"
                               title="إلغاء"
                             >
                               <X size={14}/>
                             </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setDeleteConfirmId(sale.id)}
                            className="text-red-400 hover:text-red-600 transition-colors p-1 rounded hover:bg-red-50"
                            title="حذف الفاتورة"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
