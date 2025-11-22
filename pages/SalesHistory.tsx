
import React, { useState } from 'react';
import { useERP } from '../context/ERPContext';
import { Calendar, Search, FileText, X, Printer } from 'lucide-react';
import { SalesInvoice } from '../types';

export const SalesHistory: React.FC = () => {
  const { invoices, printInvoice } = useERP();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(null);

  // Filter Invoices
  const filteredInvoices = invoices.filter(inv => {
    const matchesDate = inv.date === selectedDate;
    const matchesSearch = 
      inv.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
      inv.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesDate && matchesSearch;
  });

  // Calculate Day Totals
  const dayTotal = filteredInvoices.reduce((sum, inv) => sum + inv.total, 0);

  return (
    <div className="space-y-6">
      
      {/* Header & Search */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-brand-100 flex flex-col md:flex-row gap-4 justify-between items-end">
        <div className="flex-1 w-full">
          <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
            <Calendar size={16}/> اختر تاريخ الفواتير
          </label>
          <input 
            type="date"
            className="w-full p-3 border border-brand-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
          />
        </div>

        <div className="flex-1 w-full">
          <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
            <Search size={16}/> بحث برقم الفاتورة أو العميل
          </label>
          <input 
            type="text"
            className="w-full p-3 border border-brand-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
            placeholder="بحث..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="bg-brand-50 p-3 rounded-lg border border-brand-200 text-center min-w-[200px]">
           <span className="block text-xs text-brand-600 mb-1">إجمالي مبيعات اليوم</span>
           <span className="block text-xl font-bold text-brand-900">{dayTotal.toLocaleString()} ج.م</span>
        </div>
      </div>

      {/* Invoices List */}
      <div className="bg-white rounded-xl shadow-sm border border-brand-100 overflow-hidden">
        <div className="p-4 border-b border-brand-50 bg-brand-50 flex justify-between items-center">
           <h3 className="font-bold text-brand-800">سجل فواتير يوم {selectedDate}</h3>
           <span className="text-xs bg-white px-2 py-1 rounded border text-gray-500">عدد الفواتير: {filteredInvoices.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-4"># الرقم</th>
                <th className="p-4">الوقت</th>
                <th className="p-4">العميل</th>
                <th className="p-4">عدد الأصناف</th>
                <th className="p-4">الإجمالي</th>
                <th className="p-4">التفاصيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-mono font-bold text-brand-700">{inv.id}</td>
                  <td className="p-4 text-gray-500 text-sm">{inv.time}</td>
                  <td className="p-4 font-bold text-gray-800">{inv.customerName}</td>
                  <td className="p-4 text-sm text-gray-600">{inv.items.length} صنف</td>
                  <td className="p-4 font-bold text-emerald-600">{inv.total.toLocaleString()}</td>
                  <td className="p-4">
                    <button 
                      onClick={() => setSelectedInvoice(inv)}
                      className="bg-brand-100 text-brand-700 hover:bg-brand-200 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                    >
                      <FileText size={16} /> عرض
                    </button>
                  </td>
                </tr>
              ))}
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-gray-400 flex flex-col items-center gap-2">
                    <FileText size={40} className="opacity-20"/>
                    لا توجد فواتير مسجلة في هذا التاريخ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Details Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in">
            {/* Modal Header */}
            <div className="bg-brand-600 p-4 flex justify-between items-center text-white">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <FileText size={20}/> تفاصيل الفاتورة {selectedInvoice.id}
              </h2>
              <button onClick={() => setSelectedInvoice(null)} className="hover:bg-brand-700 p-1 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
              
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-50 p-3 rounded-lg">
                   <span className="block text-gray-500 text-xs">العميل</span>
                   <span className="font-bold text-gray-800 text-lg">{selectedInvoice.customerName}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                   <span className="block text-gray-500 text-xs">التاريخ والوقت</span>
                   <span className="font-bold text-gray-800">{selectedInvoice.date} - {selectedInvoice.time}</span>
                </div>
              </div>

              {/* Items Table */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-right text-sm">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="p-3">الصنف</th>
                      <th className="p-3">الكمية</th>
                      <th className="p-3">السعر</th>
                      <th className="p-3">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedInvoice.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-3 font-medium">{item.itemName} <span className="text-xs text-gray-400">({item.itemCode})</span></td>
                        <td className="p-3">{item.quantity}</td>
                        <td className="p-3">{item.price.toLocaleString()}</td>
                        <td className="p-3 font-bold">{item.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              <div className="flex justify-end">
                <div className="bg-gray-900 text-white p-4 rounded-xl w-full md:w-1/2">
                  <div className="flex justify-between items-center text-lg font-bold">
                     <span>إجمالي الفاتورة</span>
                     <span>{selectedInvoice.total.toLocaleString()} ج.م</span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-700 text-xs text-gray-400 flex justify-between">
                     <span>رصيد سابق: {selectedInvoice.previousBalance.toLocaleString()}</span>
                     <span>رصيد بعد الفاتورة: {selectedInvoice.currentBalance.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 p-4 border-t flex justify-end gap-3">
              <button 
                onClick={() => printInvoice(selectedInvoice)} 
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 flex items-center gap-2"
              >
                <Printer size={16}/> طباعة
              </button>
              <button 
                onClick={() => setSelectedInvoice(null)} 
                className="px-6 py-2 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700"
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
