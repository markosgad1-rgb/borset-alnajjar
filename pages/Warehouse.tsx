
import React, { useState } from 'react';
import { useERP } from '../context/ERPContext';
import { Search, Edit2, Save, X, Trash2, Check, PlusCircle, PackagePlus } from 'lucide-react';

export const Warehouse: React.FC = () => {
  const { products, addProduct, updateProduct, deleteProduct, currentUser } = useERP();
  const [searchTerm, setSearchTerm] = useState('');
  
  // Add New Product State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProduct, setNewProduct] = useState({
    code: '',
    name: '',
    quantity: 0,
    avgCost: 0,
    price: 0
  });

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', quantity: 0, price: 0 });
  
  // Delete State
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const filteredProducts = products.filter(p => 
    p.name.includes(searchTerm) || p.code.includes(searchTerm)
  );

  // Handlers for Add Product
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.code || !newProduct.name) {
      alert("يرجى إدخال الكود والاسم");
      return;
    }
    if (products.some(p => p.code === newProduct.code)) {
      alert("كود الصنف موجود بالفعل");
      return;
    }

    addProduct({
      code: newProduct.code,
      name: newProduct.name,
      quantity: Number(newProduct.quantity),
      avgCost: Number(newProduct.avgCost),
      price: Number(newProduct.price)
    });

    setNewProduct({ code: '', name: '', quantity: 0, avgCost: 0, price: 0 });
    setShowAddForm(false);
    alert("تم إضافة الصنف بنجاح");
  };

  // Handlers for Edit
  const startEdit = (product: any) => {
    setEditingId(product.code);
    setEditForm({ name: product.name, quantity: product.quantity, price: product.price });
    setDeleteConfirmId(null);
  };

  const saveEdit = (code: string, oldProduct: any) => {
    updateProduct({
      ...oldProduct,
      name: editForm.name,
      quantity: Number(editForm.quantity),
      price: Number(editForm.price)
    });
    setEditingId(null);
  };

  const confirmDelete = (code: string) => {
    deleteProduct(code);
    setDeleteConfirmId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-brand-100">
        <h3 className="text-xl font-bold text-brand-800 flex items-center gap-2">
          <PackagePlus className="text-brand-600" /> جرد المخزن
        </h3>
        
        <div className="flex gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute right-3 top-3 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="بحث بكود أو اسم الصنف..." 
              className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          
          {currentUser?.permissions.canEditWarehouse && (
            <button 
              onClick={() => setShowAddForm(!showAddForm)}
              className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors
                ${showAddForm ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-brand-600 text-white hover:bg-brand-700'}
              `}
            >
              {showAddForm ? <X size={18}/> : <PlusCircle size={18}/>}
              {showAddForm ? 'إلغاء' : 'صنف جديد / رصيد افتتاحي'}
            </button>
          )}
        </div>
      </div>

      {/* Add New Product Form */}
      {showAddForm && currentUser?.permissions.canEditWarehouse && (
        <div className="bg-blue-50 p-6 rounded-xl border border-blue-200 animate-fade-in">
          <h4 className="font-bold text-brand-800 mb-4 flex items-center gap-2">
            <PlusCircle size={18}/> تعريف صنف جديد (أو رصيد أول المدة)
          </h4>
          <form onSubmit={handleAddSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-gray-600 mb-1">كود الصنف</label>
              <input 
                type="text" required
                className="w-full p-2 border rounded focus:outline-none focus:border-brand-500"
                value={newProduct.code} onChange={e => setNewProduct({...newProduct, code: e.target.value})}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-600 mb-1">اسم الصنف</label>
              <input 
                type="text" required
                className="w-full p-2 border rounded focus:outline-none focus:border-brand-500"
                value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})}
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-gray-600 mb-1">الكمية الافتتاحية</label>
              <input 
                type="number" min="0"
                className="w-full p-2 border rounded focus:outline-none focus:border-brand-500 font-bold text-blue-600"
                value={newProduct.quantity} onChange={e => setNewProduct({...newProduct, quantity: Number(e.target.value)})}
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-gray-600 mb-1">سعر التكلفة (متوسط)</label>
              <input 
                type="number" min="0" step="0.01"
                className="w-full p-2 border rounded focus:outline-none focus:border-brand-500"
                value={newProduct.avgCost} onChange={e => setNewProduct({...newProduct, avgCost: Number(e.target.value)})}
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-gray-600 mb-1">سعر البيع</label>
              <input 
                type="number" min="0" step="0.01"
                className="w-full p-2 border rounded focus:outline-none focus:border-brand-500 font-bold text-green-600"
                value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: Number(e.target.value)})}
              />
            </div>
            <div className="md:col-span-6 flex justify-end mt-2">
              <button type="submit" className="bg-brand-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-brand-700 transition-colors">
                حفظ الصنف
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Inventory Table */}
      <div className="bg-white rounded-xl shadow-sm border border-brand-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-brand-50 text-brand-700">
              <tr>
                <th className="p-4 w-32">كود الصنف</th>
                <th className="p-4">اسم الصنف</th>
                <th className="p-4 w-32">الكمية</th>
                <th className="p-4 w-40">سعر البيع</th>
                <th className="p-4 w-40">القيمة (بيع)</th>
                {currentUser?.permissions.canEditWarehouse && <th className="p-4 w-48">إجراءات</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredProducts.map((product) => (
                <tr key={product.code} className="hover:bg-gray-50 group">
                  <td className="p-4 font-mono text-gray-500">{product.code}</td>
                  
                  <td className="p-4">
                    {editingId === product.code ? (
                      <input 
                        className="border border-brand-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-1 focus:ring-brand-500"
                        value={editForm.name} 
                        onChange={e => setEditForm({...editForm, name: e.target.value})} 
                        autoFocus
                      />
                    ) : (
                      <span className="font-medium text-gray-800">{product.name}</span>
                    )}
                  </td>
                  
                  <td className="p-4">
                    {editingId === product.code ? (
                      <input 
                        type="number"
                        className="border border-brand-300 rounded px-2 py-1 w-24 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        value={editForm.quantity} 
                        onChange={e => setEditForm({...editForm, quantity: Number(e.target.value)})} 
                      />
                    ) : (
                      <span className={`font-bold ${product.quantity < 10 ? 'text-red-500' : 'text-blue-600'}`}>
                        {product.quantity}
                      </span>
                    )}
                  </td>

                  <td className="p-4">
                     {editingId === product.code ? (
                      <input 
                        type="number"
                        className="border border-brand-300 rounded px-2 py-1 w-24 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        value={editForm.price} 
                        onChange={e => setEditForm({...editForm, price: Number(e.target.value)})} 
                      />
                    ) : (
                      <span>{product.price.toLocaleString()}</span>
                    )}
                  </td>

                  <td className="p-4 text-emerald-600 font-bold">
                    {(product.quantity * product.price).toLocaleString()}
                  </td>

                  {currentUser?.permissions.canEditWarehouse && (
                    <td className="p-4">
                      {editingId === product.code ? (
                        <div className="flex gap-2">
                          <button onClick={() => saveEdit(product.code, product)} className="bg-green-100 text-green-700 hover:bg-green-200 p-2 rounded transition-colors" title="حفظ"><Check size={18}/></button>
                          <button onClick={() => setEditingId(null)} className="bg-gray-100 text-gray-600 hover:bg-gray-200 p-2 rounded transition-colors" title="إلغاء"><X size={18}/></button>
                        </div>
                      ) : deleteConfirmId === product.code ? (
                         <div className="flex gap-2 items-center bg-red-50 p-1.5 rounded-lg border border-red-100 shadow-sm animate-fade-in">
                           <span className="text-xs font-bold text-red-600 ml-2">حذف؟</span>
                           <button 
                             onClick={() => confirmDelete(product.code)} 
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
                        <div className="flex gap-2">
                          <button 
                            onClick={() => startEdit(product)} 
                            className="text-blue-600 bg-blue-50 hover:bg-blue-100 p-2 rounded transition-colors"
                            title="تعديل"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => setDeleteConfirmId(product.code)} 
                            className="text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded transition-colors"
                            title="حذف"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={currentUser?.permissions.canEditWarehouse ? 6 : 5} className="p-8 text-center text-gray-400">لا توجد أصناف مطابقة للبحث</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
