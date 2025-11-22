import React from 'react';
import { useERP } from '../context/ERPContext';
import { Wallet, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';

export const Treasury: React.FC = () => {
  const { treasury, currentTreasuryBalance } = useERP();

  // Calculate totals for summary
  const totalIn = treasury.reduce((acc, t) => acc + t.credit, 0);
  const totalOut = treasury.reduce((acc, t) => acc + t.debit, 0);

  return (
    <div className="space-y-8">
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-full"><Wallet size={32}/></div>
            <div>
              <p className="text-emerald-100 text-sm">الرصيد الحالي</p>
              <h2 className="text-3xl font-bold">{currentTreasuryBalance.toLocaleString()}</h2>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="bg-green-100 text-green-600 p-3 rounded-full"><ArrowUpCircle size={32}/></div>
          <div>
            <p className="text-gray-500 text-sm">إجمالي الوارد (دائن)</p>
            <h2 className="text-2xl font-bold text-green-600">{totalIn.toLocaleString()}</h2>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="bg-red-100 text-red-600 p-3 rounded-full"><ArrowDownCircle size={32}/></div>
          <div>
             <p className="text-gray-500 text-sm">إجمالي الصادر (مدين)</p>
             <h2 className="text-2xl font-bold text-red-600">{totalOut.toLocaleString()}</h2>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-brand-100 overflow-hidden">
        <div className="p-6 border-b border-brand-50">
          <h3 className="text-lg font-bold text-brand-800">حركة الخزنة</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-brand-50 text-brand-700">
              <tr>
                <th className="p-4">التاريخ</th>
                <th className="p-4">رقم الفاتورة / المرجع</th>
                <th className="p-4 w-1/3">البيان</th>
                <th className="p-4 text-green-700">دائن (وارد)</th>
                <th className="p-4 text-red-700">مدين (صادر)</th>
                <th className="p-4 text-blue-700">الرصيد</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[...treasury].reverse().map((t) => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 text-gray-600 whitespace-nowrap">{t.date}</td>
                  <td className="p-4 font-mono text-sm text-gray-500">{t.invoiceNumber || t.id}</td>
                  <td className="p-4 text-gray-800 font-medium">{t.description}</td>
                  <td className="p-4 font-bold text-green-600">
                    {t.credit > 0 ? t.credit.toLocaleString() : '-'}
                  </td>
                  <td className="p-4 font-bold text-red-500">
                    {t.debit > 0 ? t.debit.toLocaleString() : '-'}
                  </td>
                  <td className="p-4 font-bold text-blue-600 bg-blue-50/30">
                    {t.balance.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};