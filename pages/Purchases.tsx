
import React, { useState } from 'react';
import { useERP } from '../context/ERPContext';
import { Plus, Search, Trash2, Check, X } from 'lucide-react';

export const Purchases: React.FC = () => {
  const { addPurchase, purchases, products, suppliers, deletePurchase } = useERP();
  const [formData, setFormData] = useState({
    supplierCode: '',
    supplierName: '',
    itemCode: '',
    itemName: '',
    quantity: 0,
    price: 0,
  });

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleSupplierChange = (name: string) => {
    const supplier = suppliers.find(s => s.name === name);
    if (supplier) {
      setFormData(prev => ({ ...prev, supplierName: name, supplierCode: supplier.code }));
    } else {
      setFormData(prev => ({ ...prev, supplierName: name, supplierCode: '' }));
    }
  };

  const handleProductCodeChange = (code: string) => {
    const product = products.find(p => p.code === code);
    if (product) {
      setFormData(prev => ({ ...prev, itemCode: code, itemName: product.name }));
    } else {
      setFormData(prev => ({ ...prev, itemCode: code }));
    }
  };

  const total = formData.quantity * formData.price;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.itemCode || !formData.itemName || formData.quantity <= 0 || formData.price <= 0) {
      alert("الرجاء إدخال بيانات صحيحة");
      return;
    }

    if (!formData.supplierCode) {
      if(!confirm("اسم المورد غير مسجل في قاعدة البيانات. هل تريد المتابعة بدون ربط الحساب؟ (لن يظهر في كشف حساب الموردين)")) {
        return;
      }
    }

    addPurchase({
      supplierCode: formData.supplierCode || 'UNKNOWN',
      supplierName: formData.supplierName,
      itemCode: formData.itemCode,
      itemName: formData.itemName,
      quantity: Number(formData.quantity),
      price: Number(formData.price),
      total: total,
      date: new Date().toISOString().split('T')[0]
    });

    // Reset
    setFormData(prev => ({ ...prev, itemCode: '', itemName: '', quantity: 0, price: 0 }));
    alert("تم حفظ الفاتورة وإضافتها لحساب المورد");
  };

  const handleDelete = async (id: string) => {
    await deletePurchase(id);
    setDeleteConfirmId(null);
  };

  const currentSupplier = suppliers.find(s => s.code === formData.supplierCode);

  return (
    <div className="space-y-8">
      {/* Purchase Form */}
      <div className="bg-white rounded-xl shadow-sm border border-brand-100 p-6">
        <h3 className="text-xl font-bold text-brand-800 mb-6 flex items-center gap-2">
          <Plus className="bg-brand-100 p-1 rounded-full text-brand-600" size={28} />
          تسجيل مشتريات جديدة (آجل)
        </h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">اسم المورد</label>
            <div className="relative">
              <input 
                type="text" 
                required
                list="suppliersList"
                className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all"
                placeholder="اسم المورد"
                value={formData.supplierName}
                onChange={e => handleSupplierChange(e.target.value)}
              />
              <datalist id="suppliersList">
                {suppliers.map(s => <option key={s.code} value={s.name} />)}
              </datalist>
            </div>
            {currentSupplier && (
              <p className={`text-xs font-bold ${currentSupplier.balance < 0 ? 'text-red-500' : 'text-green-500'}`}>
                الرصيد الحالي: {currentSupplier.balance.toLocaleString()}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">كود الصنف</label>
            <div className="relative">
              <input 
                type="text" 
                required
                list="productCodes"
                className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all"
                placeholder="كود الصنف"
                value={formData.itemCode}
                onChange={e => handleProductCodeChange(e.target.value)}
              />
              <datalist id="productCodes">
                {products.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
              </datalist>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">اسم الصنف</label>
            <input 
              type="text" 
              required
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all"
              placeholder="اسم الصنف"
              value={formData.itemName}
              onChange={e => setFormData({...formData, itemName: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">الكمية</label>
            <input 
              type="number" 
              min="1"
              required
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all"
              value={formData.quantity || ''}
              onChange={e => setFormData({...formData, quantity: Number(e.target.value)})}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">سعر الشراء (للوحدة)</label>
            <input 
              type="number" 
              min="0"
              step="0.01"
              required
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all"
              value={formData.price || ''}
              onChange={e => setFormData({...formData, price: Number(e.target.value)})}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">الاجمالي</label>
            <div className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-brand-700 font-bold">
              {total.toLocaleString()} ج.م
            </div>
          </div>

          <div className="md:col-span-2 lg:col-span-3 mt-4">
             <button type="submit" className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 px-6 rounded-lg shadow-md transition-colors duration-200 flex justify-center items-center gap-2">
               <Plus size={20} />
               حفظ وإضافة للمخزن وحساب المورد
             </button>
          </div>
        </form>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl shadow-sm border border-brand-100 overflow-hidden">
        <div className="p-6 border-b border-brand-50">
          <h3 className="text-lg font-bold text-brand-800">سجل المشتريات</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-brand-50 text-brand-700">
              <tr>
                <th className="p-4">التاريخ</th>
                <th className="p-4">المورد</th>
                <th className="p-4">الصنف</th>
                <th className="p-4">الكمية</th>
                <th className="p-4">السعر</th>
                <th className="p-4">الاجمالي</th>
                <th className="p-4 w-24">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {purchases.map((purchase) => (
                <tr key={purchase.id} className="hover:bg-gray-50">
                  <td className="p-4 text-gray-600">{purchase.date}</td>
                  <td className="p-4 font-medium text-gray-800">{purchase.supplierName}</td>
                  <td className="p-4 text-gray-600">{purchase.itemName} ({purchase.itemCode})</td>
                  <td className="p-4 text-blue-600 font-bold">{purchase.quantity}</td>
                  <td className="p-4">{purchase.price.toLocaleString()}</td>
                  <td className="p-4 text-emerald-600 font-bold">{purchase.total.toLocaleString()}</td>
                  <td className="p-4">
                    {deleteConfirmId === purchase.id ? (
                      <div className="flex items-center gap-2 bg-red-50 p-1.5 rounded-lg border border-red-100 shadow-sm animate-fade-in">
                         <button 
                           onClick={() => handleDelete(purchase.id)} 
                           className="bg-red-500 text-white p-1.5 rounded hover:bg-red-600 transition-colors shadow-sm" 
                           title="تأكيد الحذف"
                         >
                           <Check size={16}/>
                         </button>
                         <button 
                           onClick={() => setDeleteConfirmId(null)} 
                           className="bg-white text-gray-500 p-1.5 rounded border border-gray-200 hover:bg-gray-100 transition-colors" 
                           title="إلغاء"
                         >
                           <X size={16}/>
                         </button>
                       </div>
                    ) : (
                      <button 
                        onClick={() => setDeleteConfirmId(purchase.id)}
                        className="text-red-400 hover:bg-red-50 hover:text-red-600 p-2 rounded transition-colors"
                        title="حذف السجل"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {purchases.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400">لا توجد مشتريات مسجلة</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
