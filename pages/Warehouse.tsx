import React, { useState, useMemo } from 'react';
import { useERP } from '../context/ERPContext';
import { 
  Search, 
  Edit2, 
  X, 
  Trash2, 
  Check, 
  PlusCircle, 
  PackagePlus, 
  AlertTriangle, 
  RotateCcw,
  AlertCircle,
  Package
} from 'lucide-react';
import { Product } from '../types';
import { parseNumberFromCommas, handleNumericChangeWithCommas } from '../utils/formatters';

export const Warehouse: React.FC = () => {
  const { products, addProduct, updateProduct, deleteProduct, clearAllProducts, currentUser } = useERP();
  const [searchTerm, setSearchTerm] = useState('');
  
  // Add New Product State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProduct, setNewProduct] = useState<{
    code: string;
    name: string;
    quantity: number | '';
    avgCost: string;
    price: string;
  }>({
    code: '',
    name: '',
    quantity: '',
    avgCost: '',
    price: ''
  });

  // Edit State - track by exact unique row key so editing one item NEVER affects another
  const [editingRowKey, setEditingRowKey] = useState<string | null>(null);
  const [originalCode, setOriginalCode] = useState<string>('');
  const [editForm, setEditForm] = useState<{
    code: string;
    name: string;
    quantity: number | '';
    avgCost: string;
    price: string;
  }>({
    code: '',
    name: '',
    quantity: 0,
    avgCost: '0',
    price: '0'
  });
  
  // Delete State
  const [deleteConfirmKey, setDeleteConfirmKey] = useState<string | null>(null);

  // Clear All Modal State
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Detect duplicate codes to warn user and allow fixing
  const duplicateCodes = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach(p => {
      const c = (p.code || '').trim();
      if (c) counts[c] = (counts[c] || 0) + 1;
    });
    return Object.keys(counts).filter(c => counts[c] > 1);
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      (p.name || '').includes(searchTerm) || (p.code || '').includes(searchTerm)
    );
  }, [products, searchTerm]);

  // Handlers for Add Product
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = newProduct.code.trim();
    const cleanName = newProduct.name.trim();

    if (!cleanCode || !cleanName) {
      alert("يرجى إدخال الكود واسم الصنف");
      return;
    }
    if (products.some(p => p.code === cleanCode)) {
      alert(`كود الصنف (${cleanCode}) مسجل بالفعل لصنف آخر، يرجى اختيار كود مختلف`);
      return;
    }

    const qty = typeof newProduct.quantity === 'number' ? newProduct.quantity : 0;
    const cost = parseNumberFromCommas(newProduct.avgCost);
    const salePrice = parseNumberFromCommas(newProduct.price);

    addProduct({
      code: cleanCode,
      name: cleanName,
      quantity: qty,
      avgCost: cost,
      price: salePrice
    });

    setNewProduct({ code: '', name: '', quantity: '', avgCost: '', price: '' });
    setShowAddForm(false);
  };

  // Handlers for Edit
  const startEdit = (product: Product, rowKey: string) => {
    setEditingRowKey(rowKey);
    setOriginalCode(product.code);
    setEditForm({
      code: product.code,
      name: product.name,
      quantity: product.quantity,
      avgCost: String(product.avgCost || 0),
      price: String(product.price || 0)
    });
    setDeleteConfirmKey(null);
  };

  const cancelEdit = () => {
    setEditingRowKey(null);
    setOriginalCode('');
  };

  const saveEdit = (rowKey: string) => {
    const newCode = editForm.code.trim();
    const newName = editForm.name.trim();

    if (!newCode || !newName) {
      alert("يرجى إدخال الكود واسم الصنف");
      return;
    }

    // Check if new code collides with another product (other than the one we are editing)
    if (newCode !== originalCode && products.some(p => p.code === newCode)) {
      alert(`كود الصنف الجديد (${newCode}) مستخدم بالفعل لصنف آخر. يرجى اختيار كود فريد.`);
      return;
    }

    const qty = typeof editForm.quantity === 'number' ? editForm.quantity : 0;
    const cost = parseNumberFromCommas(editForm.avgCost);
    const salePrice = parseNumberFromCommas(editForm.price);

    updateProduct({
      code: newCode,
      name: newName,
      quantity: qty,
      avgCost: cost,
      price: salePrice
    }, originalCode);

    setEditingRowKey(null);
    setOriginalCode('');
  };

  const confirmDelete = (code: string) => {
    deleteProduct(code);
    setDeleteConfirmKey(null);
    if (editingRowKey?.startsWith(code)) {
      setEditingRowKey(null);
    }
  };

  const handleClearAll = async () => {
    setIsClearing(true);
    try {
      const success = await clearAllProducts();
      if (success) {
        setShowClearAllModal(false);
        setEditingRowKey(null);
        setDeleteConfirmKey(null);
      }
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-brand-100">
        <div>
          <h3 className="text-xl font-bold text-brand-800 flex items-center gap-2">
            <PackagePlus className="text-brand-600" /> جرد المخزن
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">إدارة ومتابعة أرصدة وأسعار الأصناف في المخزن</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute right-3 top-2.5 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="بحث بكود أو اسم الصنف..." 
              className="w-full pr-9 pl-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          
          {currentUser?.permissions.canEditWarehouse && (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowAddForm(!showAddForm)}
                className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors cursor-pointer
                  ${showAddForm ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm'}
                `}
              >
                {showAddForm ? <X size={16}/> : <PlusCircle size={16}/>}
                <span>{showAddForm ? 'إلغاء' : 'صنف جديد'}</span>
              </button>

              <button 
                onClick={() => setShowClearAllModal(true)}
                disabled={products.length === 0}
                className="px-3 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="مسح جميع الأصناف والبدء من جديد"
              >
                <Trash2 size={16} className="text-red-600" />
                <span>مسح الأصناف كلها</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Duplicate Code Warning Banner */}
      {duplicateCodes.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 flex items-start gap-3 animate-fade-in text-xs text-amber-950">
          <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-black text-sm text-amber-900">تنبيه: تم رصد أصناف تشترك في نفس الكود بالمخزن!</p>
            <p className="text-amber-800 leading-relaxed">
              الأكواد المكررة الحالية: <strong className="font-mono text-amber-950">({duplicateCodes.join(', ')})</strong>. 
              وجود أكثر من صنف بنفس الكود هو سبب تعديل صنف آخر بالخطأ. يمكنك الآن الضغط على زر التعديل (القلم) لتغيير كود أي صنف مكرر، أو الضغط على زر <strong>(مسح الأصناف كلها)</strong> لمسح المخزن بالكامل والبدء من جديد ببيانات نظيفة.
            </p>
          </div>
        </div>
      )}

      {/* Add New Product Form */}
      {showAddForm && currentUser?.permissions.canEditWarehouse && (
        <div className="bg-blue-50/80 p-5 rounded-xl border border-blue-200 animate-fade-in space-y-3">
          <h4 className="font-bold text-brand-900 flex items-center gap-2 text-sm">
            <PlusCircle size={17} className="text-brand-600"/> تعريف صنف جديد (أو رصيد أول المدة)
          </h4>
          <form onSubmit={handleAddSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 items-end">
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-gray-700 mb-1">كود الصنف (فريد)</label>
              <input 
                type="text" required
                placeholder="مثال: P001"
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-500 font-mono font-bold text-xs"
                value={newProduct.code} 
                onChange={e => setNewProduct({...newProduct, code: e.target.value})}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-700 mb-1">اسم الصنف</label>
              <input 
                type="text" required
                placeholder="مثال: كرتونة بيض أحمر"
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-500 text-xs font-bold"
                value={newProduct.name} 
                onChange={e => setNewProduct({...newProduct, name: e.target.value})}
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-gray-700 mb-1">الكمية الافتتاحية</label>
              <input 
                type="number" min="0"
                placeholder="0"
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-500 font-bold text-blue-600 text-center text-xs"
                value={newProduct.quantity} 
                onChange={e => setNewProduct({...newProduct, quantity: e.target.value === '' ? '' : Number(e.target.value)})}
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-gray-700 mb-1">سعر التكلفة</label>
              <input 
                type="text" 
                dir="ltr"
                placeholder="0"
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-500 font-mono font-bold text-center text-xs"
                value={newProduct.avgCost} 
                onChange={e => handleNumericChangeWithCommas(e.target.value, val => setNewProduct({...newProduct, avgCost: val}))}
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-gray-700 mb-1">سعر البيع</label>
              <input 
                type="text" 
                dir="ltr"
                placeholder="0"
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-500 font-mono font-bold text-green-700 text-center text-xs"
                value={newProduct.price} 
                onChange={e => handleNumericChangeWithCommas(e.target.value, val => setNewProduct({...newProduct, price: val}))}
              />
            </div>
            <div className="md:col-span-6 flex justify-end gap-2 pt-1">
              <button 
                type="button" 
                onClick={() => setShowAddForm(false)} 
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button 
                type="submit" 
                className="bg-brand-600 text-white px-6 py-2 rounded-lg text-xs font-black hover:bg-brand-700 transition-colors shadow-sm cursor-pointer"
              >
                حفظ الصنف
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Inventory Table */}
      <div className="bg-white rounded-xl shadow-sm border border-brand-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-brand-50 text-brand-700 text-xs font-black border-b border-brand-100">
              <tr>
                <th className="p-3.5 w-32">كود الصنف</th>
                <th className="p-3.5">اسم الصنف</th>
                <th className="p-3.5 w-28 text-center">الكمية</th>
                <th className="p-3.5 w-32 text-center">سعر التكلفة</th>
                <th className="p-3.5 w-32 text-center">سعر البيع</th>
                <th className="p-3.5 w-36 text-center">إجمالي القيمة (بيع)</th>
                {currentUser?.permissions.canEditWarehouse && <th className="p-3.5 w-36 text-center">إجراءات</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredProducts.map((product, idx) => {
                const rowKey = `${product.code}_${idx}`;
                const isEditingThisRow = editingRowKey === rowKey;
                const isDeletingThisRow = deleteConfirmKey === rowKey;
                const isDuplicate = duplicateCodes.includes((product.code || '').trim());

                return (
                  <tr key={rowKey} className={`hover:bg-gray-50/80 transition-colors ${isDuplicate ? 'bg-amber-50/40' : ''}`}>
                    {/* Code */}
                    <td className="p-3.5 font-mono text-xs">
                      {isEditingThisRow ? (
                        <input 
                          type="text"
                          className="border border-brand-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono font-bold"
                          value={editForm.code} 
                          onChange={e => setEditForm({...editForm, code: e.target.value})} 
                          title="تعديل الكود"
                        />
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-gray-700">{product.code}</span>
                          {isDuplicate && (
                            <span className="bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded-sm">
                              مكرر
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    
                    {/* Name */}
                    <td className="p-3.5">
                      {isEditingThisRow ? (
                        <input 
                          type="text"
                          className="border border-brand-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-1 focus:ring-brand-500 font-bold text-xs"
                          value={editForm.name} 
                          onChange={e => setEditForm({...editForm, name: e.target.value})} 
                          autoFocus
                        />
                      ) : (
                        <span className="font-bold text-gray-900">{product.name}</span>
                      )}
                    </td>
                    
                    {/* Quantity */}
                    <td className="p-3.5 text-center">
                      {isEditingThisRow ? (
                        <input 
                          type="number"
                          className="border border-brand-300 rounded px-2 py-1 w-20 text-center focus:outline-none focus:ring-1 focus:ring-brand-500 font-bold text-xs"
                          value={editForm.quantity} 
                          onChange={e => setEditForm({...editForm, quantity: e.target.value === '' ? '' : Number(e.target.value)})} 
                        />
                      ) : (
                        <span className={`font-black ${product.quantity < 10 ? 'text-red-600 bg-red-50 px-2 py-0.5 rounded' : 'text-blue-700 font-mono'}`}>
                          {product.quantity.toLocaleString()}
                        </span>
                      )}
                    </td>

                    {/* Avg Cost */}
                    <td className="p-3.5 text-center font-mono text-xs">
                      {isEditingThisRow ? (
                        <input 
                          type="text"
                          dir="ltr"
                          className="border border-brand-300 rounded px-2 py-1 w-20 text-center focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono text-xs"
                          value={editForm.avgCost} 
                          onChange={e => handleNumericChangeWithCommas(e.target.value, val => setEditForm({...editForm, avgCost: val}))} 
                        />
                      ) : (
                        <span className="text-gray-600">{(product.avgCost || 0).toLocaleString()} ج.م</span>
                      )}
                    </td>

                    {/* Price */}
                    <td className="p-3.5 text-center font-mono text-xs">
                       {isEditingThisRow ? (
                        <input 
                          type="text"
                          dir="ltr"
                          className="border border-brand-300 rounded px-2 py-1 w-20 text-center focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono font-bold text-green-700 text-xs"
                          value={editForm.price} 
                          onChange={e => handleNumericChangeWithCommas(e.target.value, val => setEditForm({...editForm, price: val}))} 
                        />
                      ) : (
                        <span className="font-bold text-green-700">{product.price.toLocaleString()} ج.م</span>
                      )}
                    </td>

                    {/* Line Total */}
                    <td className="p-3.5 text-center text-emerald-700 font-black font-mono text-xs">
                      {(product.quantity * product.price).toLocaleString()} ج.م
                    </td>

                    {/* Actions */}
                    {currentUser?.permissions.canEditWarehouse && (
                      <td className="p-3.5 text-center">
                        {isEditingThisRow ? (
                          <div className="flex gap-1.5 justify-center">
                            <button 
                              onClick={() => saveEdit(rowKey)} 
                              className="bg-emerald-600 text-white hover:bg-emerald-700 p-1.5 rounded-lg shadow-xs transition-colors cursor-pointer" 
                              title="حفظ التعديل"
                            >
                              <Check size={16}/>
                            </button>
                            <button 
                              onClick={cancelEdit} 
                              className="bg-gray-150 text-gray-600 hover:bg-gray-200 p-1.5 rounded-lg transition-colors cursor-pointer border border-gray-300" 
                              title="إلغاء التعديل"
                            >
                              <X size={16}/>
                            </button>
                          </div>
                        ) : isDeletingThisRow ? (
                           <div className="flex gap-1.5 items-center justify-center bg-red-50 p-1 rounded-lg border border-red-200 animate-fade-in">
                             <span className="text-[11px] font-bold text-red-700 ml-1">تأكيد؟</span>
                             <button 
                               onClick={() => confirmDelete(product.code)} 
                               className="bg-red-600 text-white p-1 rounded hover:bg-red-700 transition-colors shadow-xs cursor-pointer" 
                               title="تأكيد الحذف"
                             >
                               <Check size={14}/>
                             </button>
                             <button 
                               onClick={() => setDeleteConfirmKey(null)} 
                               className="bg-white text-gray-600 p-1 rounded border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer" 
                               title="إلغاء"
                             >
                               <X size={14}/>
                             </button>
                           </div>
                        ) : (
                          <div className="flex gap-1.5 justify-center">
                            <button 
                              onClick={() => startEdit(product, rowKey)} 
                              className="text-blue-600 bg-blue-50 hover:bg-blue-100 p-1.5 rounded-lg transition-colors cursor-pointer"
                              title="تعديل هذا الصنف فقط"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => setDeleteConfirmKey(rowKey)} 
                              className="text-red-600 bg-red-50 hover:bg-red-100 p-1.5 rounded-lg transition-colors cursor-pointer"
                              title="حذف هذا الصنف"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}

              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={currentUser?.permissions.canEditWarehouse ? 7 : 6} className="p-10 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Package size={36} className="text-gray-300" />
                      <p className="font-bold">لا توجد أصناف مسجلة في المخزن</p>
                      <p className="text-xs text-gray-400">اضغط على زر (صنف جديد) في الأعلى لإضافة أول صنف</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Clear All Products Confirmation Modal */}
      {showClearAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-red-100 overflow-hidden space-y-4 p-6">
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
              <AlertTriangle size={32} />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-black text-gray-900">تصفير المخزن ومسح جميع الأصناف؟</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                سيتم مسح جميع الأصناف المسجلة في المخزن ({products.length} صنف) نهائياً لتتمكن من البدء من جديد وتسجيل أصنافك بأكواد نظيفة وغير مكررة.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 leading-relaxed">
              <strong>ملاحظة:</strong> لن تتأثر فواتير البيع أو فواتير الشراء السابقة، بل سيتم فقط تفريغ جدول المخزن الحالي للبدء من الصفر.
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleClearAll}
                disabled={isClearing}
                className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
              >
                {isClearing ? (
                  <>
                    <RotateCcw size={16} className="animate-spin" />
                    <span>جاري المسح...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>نعم، احذف الأصناف كلها وابدأ من جديد</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowClearAllModal(false)}
                disabled={isClearing}
                className="py-3 px-5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer"
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
