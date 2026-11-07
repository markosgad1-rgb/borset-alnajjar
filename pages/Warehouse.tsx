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
  Package,
  Sparkles,
  ArrowLeftRight,
  Building,
  Layers,
  ArrowRight
} from 'lucide-react';
import { Product, BranchId, BRANCHES } from '../types';
import { parseNumberFromCommas, handleNumericChangeWithCommas } from '../utils/formatters';
import { useBackHandler } from '../utils/backNavigation';

export const Warehouse: React.FC = () => {
  const { 
    products, 
    addProduct, 
    updateProduct, 
    deleteProduct, 
    clearAllProducts, 
    deduplicateProducts, 
    transferStockBetweenBranches,
    currentUser 
  } = useERP();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranchTab, setSelectedBranchTab] = useState<'ALL' | 'MARG' | 'NOZHA'>('ALL');
  
  // Add New Product State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProduct, setNewProduct] = useState<{
    code: string;
    name: string;
    quantityMarg: number | '';
    quantityNozha: number | '';
    avgCost: string;
    price: string;
  }>({
    code: '',
    name: '',
    quantityMarg: '',
    quantityNozha: '',
    avgCost: '',
    price: ''
  });

  // Inter-branch Stock Transfer Modal State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferItemCode, setTransferItemCode] = useState('');
  const [transferFromBranch, setTransferFromBranch] = useState<BranchId>('MARG');
  const [transferToBranch, setTransferToBranch] = useState<BranchId>('NOZHA');
  const [transferQuantity, setTransferQuantity] = useState<number | ''>('');
  const [transferNotes, setTransferNotes] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  // Submission and Loading States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeduplicating, setIsDeduplicating] = useState(false);

  // Edit State - track by exact unique row key so editing one item NEVER affects another
  const [editingRowKey, setEditingRowKey] = useState<string | null>(null);
  const [originalCode, setOriginalCode] = useState<string>('');
  const [editForm, setEditForm] = useState<{
    code: string;
    name: string;
    quantityMarg: number | '';
    quantityNozha: number | '';
    avgCost: string;
    price: string;
  }>({
    code: '',
    name: '',
    quantityMarg: 0,
    quantityNozha: 0,
    avgCost: '0',
    price: '0'
  });
  
  // Delete State
  const [deleteConfirmKey, setDeleteConfirmKey] = useState<string | null>(null);

  // Clear All Modal State
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Hardware Back button handlers
  useBackHandler(() => setShowAddForm(false), showAddForm, 'warehouse-add-form');
  useBackHandler(() => setShowTransferModal(false), showTransferModal, 'warehouse-transfer-modal');
  useBackHandler(() => setShowClearAllModal(false), showClearAllModal, 'warehouse-clear-all-modal');
  useBackHandler(() => setDeleteConfirmKey(null), !!deleteConfirmKey, 'warehouse-delete-confirm');

  // Real-time check for duplicate code while adding
  const cleanAddCode = newProduct.code.trim();
  const isAddCodeDuplicate = useMemo(() => {
    if (!cleanAddCode) return false;
    return products.some(p => (p.code || '').trim().toLowerCase() === cleanAddCode.toLowerCase());
  }, [products, cleanAddCode]);

  // Real-time check for duplicate code while editing
  const cleanEditCode = editForm.code.trim();
  const isEditCodeDuplicate = useMemo(() => {
    if (!cleanEditCode) return false;
    return products.some(p => 
      (p.code || '').trim().toLowerCase() !== originalCode.trim().toLowerCase() &&
      (p.code || '').trim().toLowerCase() === cleanEditCode.toLowerCase()
    );
  }, [products, cleanEditCode, originalCode]);

  // Detect duplicate codes in raw products to warn user and allow one-click fix
  const duplicateCodes = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach(p => {
      const c = (p.code || '').trim();
      if (c) counts[c.toLowerCase()] = (counts[c.toLowerCase()] || 0) + 1;
    });
    const dupKeys = new Set(Object.keys(counts).filter(k => counts[k] > 1));
    const result: string[] = [];
    products.forEach(p => {
      const c = (p.code || '').trim();
      if (c && dupKeys.has(c.toLowerCase()) && !result.includes(c)) {
        result.push(c);
      }
    });
    return result;
  }, [products]);

  // Deduplicate products by code and normalize branch quantities
  const deduplicatedProducts = useMemo(() => {
    const codeMap = new Map<string, Product>();
    
    products.forEach(p => {
      const cleanCode = (p.code || '').trim();
      if (!cleanCode) return;
      const key = cleanCode.toLowerCase();

      const qMarg = p.quantityMarg !== undefined ? Number(p.quantityMarg) : Number(p.quantity || 0);
      const qNozha = p.quantityNozha !== undefined ? Number(p.quantityNozha) : 0;
      const totalQ = qMarg + qNozha;
      
      if (!codeMap.has(key)) {
        codeMap.set(key, { 
          ...p, 
          code: cleanCode, 
          name: (p.name || '').trim(),
          quantityMarg: qMarg,
          quantityNozha: qNozha,
          quantity: totalQ
        });
      } else {
        const existing = codeMap.get(key)!;
        const combinedMarg = Math.max(existing.quantityMarg || 0, qMarg);
        const combinedNozha = Math.max(existing.quantityNozha || 0, qNozha);
        codeMap.set(key, {
          ...existing,
          code: cleanCode,
          name: existing.name || (p.name || '').trim(),
          quantityMarg: combinedMarg,
          quantityNozha: combinedNozha,
          quantity: combinedMarg + combinedNozha,
          avgCost: existing.avgCost || p.avgCost || 0,
          price: existing.price || p.price || 0
        });
      }
    });

    return Array.from(codeMap.values());
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    let list = deduplicatedProducts;
    if (q) {
      list = list.filter(p => 
        (p.name || '').toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [deduplicatedProducts, searchTerm]);

  // Metrics for inventory valuation
  const metrics = useMemo(() => {
    let totalPiecesMarg = 0;
    let totalValueMarg = 0;
    let totalPiecesNozha = 0;
    let totalValueNozha = 0;

    deduplicatedProducts.forEach(p => {
      const qM = p.quantityMarg !== undefined ? p.quantityMarg : p.quantity;
      const qN = p.quantityNozha !== undefined ? p.quantityNozha : 0;
      const pr = p.price || 0;

      totalPiecesMarg += qM;
      totalValueMarg += qM * pr;
      totalPiecesNozha += qN;
      totalValueNozha += qN * pr;
    });

    return {
      totalItems: deduplicatedProducts.length,
      totalPiecesMarg,
      totalValueMarg,
      totalPiecesNozha,
      totalValueNozha,
      overallPieces: totalPiecesMarg + totalPiecesNozha,
      overallValue: totalValueMarg + totalValueNozha
    };
  }, [deduplicatedProducts]);

  // Handlers for Add Product
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const cleanCode = newProduct.code.trim();
    const cleanName = newProduct.name.trim();

    if (!cleanCode || !cleanName) {
      alert("يرجى إدخال الكود واسم الصنف");
      return;
    }

    if (products.some(p => (p.code || '').trim().toLowerCase() === cleanCode.toLowerCase())) {
      alert(`كود الصنف (${cleanCode}) مسجل بالفعل لصنف آخر، يرجى اختيار كود مختلف`);
      return;
    }

    setIsSubmitting(true);
    try {
      const qMarg = typeof newProduct.quantityMarg === 'number' ? newProduct.quantityMarg : 0;
      const qNozha = typeof newProduct.quantityNozha === 'number' ? newProduct.quantityNozha : 0;
      const cost = parseNumberFromCommas(newProduct.avgCost);
      const salePrice = parseNumberFromCommas(newProduct.price);

      const success = await addProduct({
        code: cleanCode,
        name: cleanName,
        quantityMarg: qMarg,
        quantityNozha: qNozha,
        quantity: qMarg + qNozha,
        avgCost: cost,
        price: salePrice
      });

      if (success !== false) {
        setNewProduct({ code: '', name: '', quantityMarg: '', quantityNozha: '', avgCost: '', price: '' });
        setShowAddForm(false);
      }
    } catch (err: any) {
      alert(err?.message || "حدث خطأ أثناء حفظ الصنف");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handlers for Edit
  const startEdit = (product: Product, rowKey: string) => {
    setEditingRowKey(rowKey);
    setOriginalCode(product.code);
    const qMarg = product.quantityMarg !== undefined ? product.quantityMarg : product.quantity;
    const qNozha = product.quantityNozha !== undefined ? product.quantityNozha : 0;
    setEditForm({
      code: product.code,
      name: product.name,
      quantityMarg: qMarg,
      quantityNozha: qNozha,
      avgCost: String(product.avgCost || 0),
      price: String(product.price || 0)
    });
    setDeleteConfirmKey(null);
  };

  const cancelEdit = () => {
    setEditingRowKey(null);
    setOriginalCode('');
  };

  const saveEdit = async (rowKey: string) => {
    if (isSavingEdit) return;

    const newCode = editForm.code.trim();
    const newName = editForm.name.trim();

    if (!newCode || !newName) {
      alert("يرجى إدخال الكود واسم الصنف");
      return;
    }

    if (
      newCode.toLowerCase() !== originalCode.toLowerCase() && 
      products.some(p => (p.code || '').trim().toLowerCase() === newCode.toLowerCase())
    ) {
      alert(`كود الصنف الجديد (${newCode}) مستخدم بالفعل لصنف آخر. يرجى اختيار كود فريد.`);
      return;
    }

    setIsSavingEdit(true);
    try {
      const qMarg = typeof editForm.quantityMarg === 'number' ? editForm.quantityMarg : 0;
      const qNozha = typeof editForm.quantityNozha === 'number' ? editForm.quantityNozha : 0;
      const cost = parseNumberFromCommas(editForm.avgCost);
      const salePrice = parseNumberFromCommas(editForm.price);

      await updateProduct({
        code: newCode,
        name: newName,
        quantityMarg: qMarg,
        quantityNozha: qNozha,
        quantity: qMarg + qNozha,
        avgCost: cost,
        price: salePrice
      }, originalCode);

      setEditingRowKey(null);
      setOriginalCode('');
    } catch (err: any) {
      alert(err?.message || "حدث خطأ أثناء تعديل الصنف");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const confirmDelete = async (code: string) => {
    await deleteProduct(code);
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

  const handleDeduplicate = async () => {
    setIsDeduplicating(true);
    try {
      await deduplicateProducts();
      alert(`تم تنظيف السجلات المكررة بنجاح! تم معالجة وإزالة التكرارات.`);
    } catch (err: any) {
      alert(err?.message || "حدث خطأ أثناء تنظيف السجلات المكررة");
    } finally {
      setIsDeduplicating(false);
    }
  };

  // Handle Inter-branch Stock Transfer
  const handleOpenTransferModal = (productCode?: string) => {
    if (productCode) {
      setTransferItemCode(productCode);
    } else if (products.length > 0) {
      setTransferItemCode(products[0].code);
    }
    setTransferFromBranch('MARG');
    setTransferToBranch('NOZHA');
    setTransferQuantity('');
    setTransferNotes('');
    setShowTransferModal(true);
  };

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isTransferring) return;

    if (!transferItemCode) {
      alert("يرجى اختيار الصنف المراد تحويله");
      return;
    }

    if (transferFromBranch === transferToBranch) {
      alert("لا يمكن التحويل لنفس الإدارة");
      return;
    }

    const qty = Number(transferQuantity);
    if (isNaN(qty) || qty <= 0) {
      alert("يرجى إدخال كمية صحيحة للتحويل");
      return;
    }

    setIsTransferring(true);
    try {
      const success = await transferStockBetweenBranches({
        itemCode: transferItemCode,
        fromBranch: transferFromBranch,
        toBranch: transferToBranch,
        quantity: qty,
        notes: transferNotes
      });

      if (success) {
        alert("تم تحويل البضاعة بين المخازن وتحديث الأرصدة بنجاح");
        setShowTransferModal(false);
      }
    } catch (err: any) {
      alert(err?.message || "حدث خطأ أثناء تحويل البضاعة");
    } finally {
      setIsTransferring(false);
    }
  };

  // Currently selected product for stock transfer preview
  const selectedTransferProduct = useMemo(() => {
    return products.find(p => (p.code || '').trim().toLowerCase() === transferItemCode.trim().toLowerCase());
  }, [products, transferItemCode]);

  const sourceAvailableStock = useMemo(() => {
    if (!selectedTransferProduct) return 0;
    return transferFromBranch === 'NOZHA'
      ? (selectedTransferProduct.quantityNozha !== undefined ? selectedTransferProduct.quantityNozha : 0)
      : (selectedTransferProduct.quantityMarg !== undefined ? selectedTransferProduct.quantityMarg : selectedTransferProduct.quantity);
  }, [selectedTransferProduct, transferFromBranch]);

  return (
    <div className="space-y-6">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-5 rounded-xl shadow-sm border border-brand-100">
        <div>
          <h3 className="text-xl font-bold text-brand-800 flex items-center gap-2">
            <PackagePlus className="text-brand-600" /> جرد المخزن وفصل الإدارات
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">متابعة دقيقة لأرصدة الأصناف بين مخزن المرج ومخزن النزهة والتحويل بينهما</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
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
                onClick={() => handleOpenTransferModal()}
                className="px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer shadow-xs"
                title="تحويل بضاعة بين مخزن المرج ومخزن النزهة"
              >
                <ArrowLeftRight size={16} />
                <span>تحويل بين المخازن</span>
              </button>

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
                <span className="hidden sm:inline">مسح الأصناف</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Branch Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Marg Branch Card */}
        <div 
          onClick={() => setSelectedBranchTab('MARG')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            selectedBranchTab === 'MARG'
              ? 'bg-blue-50/90 border-blue-400 ring-2 ring-blue-300 shadow-sm'
              : 'bg-white border-gray-200 hover:border-blue-200 hover:bg-blue-50/30'
          }`}
        >
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
              <Building size={16} className="text-blue-600" /> مخزن إدارة المرج
            </span>
            <span className="text-[11px] font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">
              MARG
            </span>
          </div>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-gray-500">الكمية بالمخزن:</span>
              <span className="text-lg font-black text-blue-800 font-mono">
                {metrics.totalPiecesMarg.toLocaleString()} <span className="text-xs font-normal">قطعة</span>
              </span>
            </div>
            <div className="flex justify-between items-baseline pt-1 border-t border-blue-100">
              <span className="text-xs text-gray-500">القيمة التقديرية (بيع):</span>
              <span className="text-sm font-black text-emerald-700 font-mono">
                {metrics.totalValueMarg.toLocaleString()} ج.م
              </span>
            </div>
          </div>
        </div>

        {/* Nozha Branch Card */}
        <div 
          onClick={() => setSelectedBranchTab('NOZHA')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            selectedBranchTab === 'NOZHA'
              ? 'bg-purple-50/90 border-purple-400 ring-2 ring-purple-300 shadow-sm'
              : 'bg-white border-gray-200 hover:border-purple-200 hover:bg-purple-50/30'
          }`}
        >
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
              <Building size={16} className="text-purple-600" /> مخزن إدارة النزهة
            </span>
            <span className="text-[11px] font-mono bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-bold">
              NOZHA
            </span>
          </div>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-gray-500">الكمية بالمخزن:</span>
              <span className="text-lg font-black text-purple-800 font-mono">
                {metrics.totalPiecesNozha.toLocaleString()} <span className="text-xs font-normal">قطعة</span>
              </span>
            </div>
            <div className="flex justify-between items-baseline pt-1 border-t border-purple-100">
              <span className="text-xs text-gray-500">القيمة التقديرية (بيع):</span>
              <span className="text-sm font-black text-emerald-700 font-mono">
                {metrics.totalValueNozha.toLocaleString()} ج.م
              </span>
            </div>
          </div>
        </div>

        {/* Total Overall Card */}
        <div 
          onClick={() => setSelectedBranchTab('ALL')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            selectedBranchTab === 'ALL'
              ? 'bg-emerald-50/90 border-emerald-400 ring-2 ring-emerald-300 shadow-sm'
              : 'bg-white border-gray-200 hover:border-emerald-200 hover:bg-emerald-50/30'
          }`}
        >
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
              <Layers size={16} className="text-emerald-600" /> الإجمالي العام (المخزنين)
            </span>
            <span className="text-[11px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
              {metrics.totalItems} صنف
            </span>
          </div>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-gray-500">إجمالي القطع الكلي:</span>
              <span className="text-lg font-black text-emerald-800 font-mono">
                {metrics.overallPieces.toLocaleString()} <span className="text-xs font-normal">قطعة</span>
              </span>
            </div>
            <div className="flex justify-between items-baseline pt-1 border-t border-emerald-100">
              <span className="text-xs text-gray-500">القيمة الكلية للبضاعة:</span>
              <span className="text-sm font-black text-emerald-700 font-mono">
                {metrics.overallValue.toLocaleString()} ج.م
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Branch Filter Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-3">
        <span className="text-xs font-bold text-gray-600 ml-2">عرض بيانات:</span>
        <button
          type="button"
          onClick={() => setSelectedBranchTab('ALL')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
            selectedBranchTab === 'ALL'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          جميع المخازن (المرج + النزهة)
        </button>
        <button
          type="button"
          onClick={() => setSelectedBranchTab('MARG')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
            selectedBranchTab === 'MARG'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-blue-700 border border-blue-200 hover:bg-blue-50'
          }`}
        >
          <Building size={14} /> مخزن المرج فقط
        </button>
        <button
          type="button"
          onClick={() => setSelectedBranchTab('NOZHA')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
            selectedBranchTab === 'NOZHA'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-white text-purple-700 border border-purple-200 hover:bg-purple-50'
          }`}
        >
          <Building size={14} /> مخزن النزهة فقط
        </button>
      </div>

      {/* Duplicate Code Warning Banner */}
      {duplicateCodes.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-in text-xs text-amber-950 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-black text-sm text-amber-900">تنبيه: تم رصد أكواد مكررة في سجلات المخزن!</p>
              <p className="text-amber-800 leading-relaxed">
                الأكواد المكررة: <strong className="font-mono text-amber-950">({duplicateCodes.join(', ')})</strong>. 
                تم دمج هذه السجلات تلقائياً في الجدول لمنع تكرار العرض.
              </p>
            </div>
          </div>
          {currentUser?.permissions.canEditWarehouse && (
            <button
              type="button"
              onClick={handleDeduplicate}
              disabled={isDeduplicating}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white font-black rounded-lg text-xs flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer transition-colors"
            >
              {isDeduplicating ? (
                <>
                  <RotateCcw size={14} className="animate-spin" />
                  <span>جاري التنظيف...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>دمج وتنظيف التكرار بقاعدة البيانات</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Add New Product Form */}
      {showAddForm && currentUser?.permissions.canEditWarehouse && (
        <div className="bg-blue-50/80 p-5 rounded-xl border border-blue-200 animate-fade-in space-y-3">
          <h4 className="font-bold text-brand-900 flex items-center gap-2 text-sm">
            <PlusCircle size={17} className="text-brand-600"/> تعريف صنف جديد وتحديد أرصدة المخازن
          </h4>
          <form onSubmit={handleAddSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-3 items-end">
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-gray-700 mb-1">كود الصنف (فريد)</label>
              <input 
                type="text" required
                placeholder="مثال: P001"
                className={`w-full p-2 border rounded-lg focus:outline-none font-mono font-bold text-xs transition-colors ${
                  isAddCodeDuplicate 
                    ? 'border-red-500 bg-red-50/60 text-red-900 focus:ring-2 focus:ring-red-400' 
                    : 'border-gray-300 focus:border-brand-500 focus:ring-1 focus:ring-brand-500'
                }`}
                value={newProduct.code} 
                onChange={e => setNewProduct({...newProduct, code: e.target.value})}
              />
              {isAddCodeDuplicate && (
                <p className="text-[10px] text-red-600 font-black mt-1 flex items-center gap-1 animate-fade-in">
                  <AlertCircle size={12} className="shrink-0" /> كود مسجل مسبقاً!
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-700 mb-1">اسم الصنف</label>
              <input 
                type="text" required
                placeholder="اسم الصنف"
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-500 text-xs font-bold"
                value={newProduct.name} 
                onChange={e => setNewProduct({...newProduct, name: e.target.value})}
              />
            </div>

            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-blue-700 mb-1 flex items-center gap-1">
                <Building size={12} /> رصيد المرج
              </label>
              <input 
                type="number" min="0"
                placeholder="0"
                className="w-full p-2 border border-blue-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold text-blue-700 text-center text-xs"
                value={newProduct.quantityMarg} 
                onFocus={e => e.target.select()}
                onChange={e => setNewProduct({...newProduct, quantityMarg: e.target.value === '' ? '' : Number(e.target.value)})}
              />
            </div>

            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-purple-700 mb-1 flex items-center gap-1">
                <Building size={12} /> رصيد النزهة
              </label>
              <input 
                type="number" min="0"
                placeholder="0"
                className="w-full p-2 border border-purple-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 font-bold text-purple-700 text-center text-xs"
                value={newProduct.quantityNozha} 
                onFocus={e => e.target.select()}
                onChange={e => setNewProduct({...newProduct, quantityNozha: e.target.value === '' ? '' : Number(e.target.value)})}
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
                onFocus={e => e.target.select()}
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
                onFocus={e => e.target.select()}
                onChange={e => handleNumericChangeWithCommas(e.target.value, val => setNewProduct({...newProduct, price: val}))}
              />
            </div>

            <div className="md:col-span-7 flex flex-wrap justify-between items-center gap-2 pt-2 border-t border-blue-200/60">
              <div className="text-xs text-gray-600 font-medium">
                إجمالي رصيد الصنف في المخزنين: <span className="font-bold text-brand-700 font-mono">{((typeof newProduct.quantityMarg === 'number' ? newProduct.quantityMarg : 0) + (typeof newProduct.quantityNozha === 'number' ? newProduct.quantityNozha : 0)).toLocaleString()}</span> قطعة
              </div>
              <div className="flex gap-2">
                <button 
                  type="button" 
                  onClick={() => setShowAddForm(false)} 
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-50 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting || isAddCodeDuplicate || !newProduct.code.trim() || !newProduct.name.trim()}
                  className="bg-brand-600 text-white px-6 py-2 rounded-lg text-xs font-black hover:bg-brand-700 disabled:bg-gray-400 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <RotateCcw size={14} className="animate-spin" />
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <span>حفظ الصنف وتوزيع الأرصدة</span>
                  )}
                </button>
              </div>
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
                <th className="p-3.5 w-28">كود الصنف</th>
                <th className="p-3.5">اسم الصنف</th>

                {selectedBranchTab === 'ALL' && (
                  <>
                    <th className="p-3.5 w-28 text-center text-blue-700 bg-blue-50/50">رصيد المرج</th>
                    <th className="p-3.5 w-28 text-center text-purple-700 bg-purple-50/50">رصيد النزهة</th>
                    <th className="p-3.5 w-28 text-center">إجمالي الكمية</th>
                  </>
                )}

                {selectedBranchTab === 'MARG' && (
                  <th className="p-3.5 w-32 text-center text-blue-700 bg-blue-50/50">رصيد مخزن المرج</th>
                )}

                {selectedBranchTab === 'NOZHA' && (
                  <th className="p-3.5 w-32 text-center text-purple-700 bg-purple-50/50">رصيد مخزن النزهة</th>
                )}

                <th className="p-3.5 w-28 text-center">سعر التكلفة</th>
                <th className="p-3.5 w-28 text-center">سعر البيع</th>
                
                <th className="p-3.5 w-36 text-center">
                  {selectedBranchTab === 'MARG' 
                    ? 'قيمة مخزن المرج (بيع)' 
                    : selectedBranchTab === 'NOZHA' 
                      ? 'قيمة مخزن النزهة (بيع)' 
                      : 'إجمالي القيمة (بيع)'}
                </th>

                {currentUser?.permissions.canEditWarehouse && <th className="p-3.5 w-36 text-center">إجراءات</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredProducts.map((product, idx) => {
                const rowKey = `${product.code}_${idx}`;
                const isEditingThisRow = editingRowKey === rowKey;
                const isDeletingThisRow = deleteConfirmKey === rowKey;
                const isDuplicate = duplicateCodes.includes((product.code || '').trim());

                const qMarg = product.quantityMarg !== undefined ? product.quantityMarg : product.quantity;
                const qNozha = product.quantityNozha !== undefined ? product.quantityNozha : 0;
                const totalQ = qMarg + qNozha;

                const displayQty = selectedBranchTab === 'MARG' 
                  ? qMarg 
                  : selectedBranchTab === 'NOZHA' 
                    ? qNozha 
                    : totalQ;

                const lineTotalVal = displayQty * (product.price || 0);

                return (
                  <tr key={rowKey} className={`hover:bg-gray-50/80 transition-colors ${isDuplicate ? 'bg-amber-50/40' : ''}`}>
                    {/* Code */}
                    <td className="p-3.5 font-mono text-xs">
                      {isEditingThisRow ? (
                        <div>
                          <input 
                            type="text"
                            className={`border rounded px-2 py-1 w-full focus:outline-none font-mono font-bold text-xs ${
                              isEditCodeDuplicate 
                                ? 'border-red-500 bg-red-50 text-red-900 focus:ring-1 focus:ring-red-500' 
                                : 'border-brand-300 focus:ring-1 focus:ring-brand-500'
                            }`}
                            value={editForm.code} 
                            onChange={e => setEditForm({...editForm, code: e.target.value})} 
                            title="تعديل الكود"
                          />
                          {isEditCodeDuplicate && (
                            <span className="text-[9px] text-red-600 font-black block mt-0.5">كود مستخدم!</span>
                          )}
                        </div>
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

                    {/* ALL TAB Quantities */}
                    {selectedBranchTab === 'ALL' && (
                      <>
                        {/* Marg Qty */}
                        <td className="p-3.5 text-center bg-blue-50/30">
                          {isEditingThisRow ? (
                            <input 
                              type="number"
                              className="border border-blue-300 rounded px-2 py-1 w-20 text-center focus:outline-none font-bold text-xs text-blue-700"
                              value={editForm.quantityMarg} 
                              onChange={e => setEditForm({...editForm, quantityMarg: e.target.value === '' ? '' : Number(e.target.value)})} 
                              placeholder="المرج"
                            />
                          ) : (
                            <span className="font-bold text-blue-700 font-mono">
                              {qMarg.toLocaleString()}
                            </span>
                          )}
                        </td>

                        {/* Nozha Qty */}
                        <td className="p-3.5 text-center bg-purple-50/30">
                          {isEditingThisRow ? (
                            <input 
                              type="number"
                              className="border border-purple-300 rounded px-2 py-1 w-20 text-center focus:outline-none font-bold text-xs text-purple-700"
                              value={editForm.quantityNozha} 
                              onChange={e => setEditForm({...editForm, quantityNozha: e.target.value === '' ? '' : Number(e.target.value)})} 
                              placeholder="النزهة"
                            />
                          ) : (
                            <span className="font-bold text-purple-700 font-mono">
                              {qNozha.toLocaleString()}
                            </span>
                          )}
                        </td>

                        {/* Total Qty */}
                        <td className="p-3.5 text-center">
                          {isEditingThisRow ? (
                            <span className="font-black text-gray-700 font-mono text-xs">
                              {((typeof editForm.quantityMarg === 'number' ? editForm.quantityMarg : 0) + (typeof editForm.quantityNozha === 'number' ? editForm.quantityNozha : 0)).toLocaleString()}
                            </span>
                          ) : (
                            <span className={`font-black ${totalQ < 10 ? 'text-red-600 bg-red-50 px-2 py-0.5 rounded' : 'text-gray-900 font-mono'}`}>
                              {totalQ.toLocaleString()}
                            </span>
                          )}
                        </td>
                      </>
                    )}

                    {/* MARG ONLY TAB */}
                    {selectedBranchTab === 'MARG' && (
                      <td className="p-3.5 text-center bg-blue-50/30">
                        {isEditingThisRow ? (
                          <input 
                            type="number"
                            className="border border-blue-300 rounded px-2 py-1 w-20 text-center focus:outline-none font-bold text-xs text-blue-700"
                            value={editForm.quantityMarg} 
                            onChange={e => setEditForm({...editForm, quantityMarg: e.target.value === '' ? '' : Number(e.target.value)})} 
                          />
                        ) : (
                          <span className={`font-black font-mono ${qMarg < 5 ? 'text-red-600 bg-red-50 px-2 py-0.5 rounded' : 'text-blue-700'}`}>
                            {qMarg.toLocaleString()}
                          </span>
                        )}
                      </td>
                    )}

                    {/* NOZHA ONLY TAB */}
                    {selectedBranchTab === 'NOZHA' && (
                      <td className="p-3.5 text-center bg-purple-50/30">
                        {isEditingThisRow ? (
                          <input 
                            type="number"
                            className="border border-purple-300 rounded px-2 py-1 w-20 text-center focus:outline-none font-bold text-xs text-purple-700"
                            value={editForm.quantityNozha} 
                            onChange={e => setEditForm({...editForm, quantityNozha: e.target.value === '' ? '' : Number(e.target.value)})} 
                          />
                        ) : (
                          <span className={`font-black font-mono ${qNozha < 5 ? 'text-red-600 bg-red-50 px-2 py-0.5 rounded' : 'text-purple-700'}`}>
                            {qNozha.toLocaleString()}
                          </span>
                        )}
                      </td>
                    )}

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
                      {lineTotalVal.toLocaleString()} ج.م
                    </td>

                    {/* Actions */}
                    {currentUser?.permissions.canEditWarehouse && (
                      <td className="p-3.5 text-center">
                        {isEditingThisRow ? (
                          <div className="flex gap-1.5 justify-center">
                            <button 
                              onClick={() => saveEdit(rowKey)} 
                              disabled={isSavingEdit || isEditCodeDuplicate || !editForm.code.trim() || !editForm.name.trim()}
                              className="bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-gray-400 disabled:opacity-50 p-1.5 rounded-lg shadow-xs transition-colors cursor-pointer flex items-center justify-center min-w-[28px] min-h-[28px]" 
                              title="حفظ التعديل"
                            >
                              {isSavingEdit ? <RotateCcw size={14} className="animate-spin" /> : <Check size={16}/>}
                            </button>
                            <button 
                              onClick={cancelEdit} 
                              disabled={isSavingEdit}
                              className="bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 p-1.5 rounded-lg transition-colors cursor-pointer border border-gray-300" 
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
                              onClick={() => handleOpenTransferModal(product.code)}
                              className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 p-1.5 rounded-lg transition-colors cursor-pointer"
                              title="تحويل من هذا الصنف بين المخازن"
                            >
                              <ArrowLeftRight size={15} />
                            </button>
                            <button 
                              onClick={() => startEdit(product, rowKey)} 
                              className="text-blue-600 bg-blue-50 hover:bg-blue-100 p-1.5 rounded-lg transition-colors cursor-pointer"
                              title="تعديل بيانات ورصيد الصنف"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button 
                              onClick={() => setDeleteConfirmKey(rowKey)} 
                              className="text-red-600 bg-red-50 hover:bg-red-100 p-1.5 rounded-lg transition-colors cursor-pointer"
                              title="حذف هذا الصنف"
                            >
                              <Trash2 size={15} />
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
                  <td colSpan={10} className="p-10 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Package size={36} className="text-gray-300" />
                      <p className="font-bold">لا توجد أصناف مطابقة للبحث أو العرض</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inter-branch Stock Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-indigo-100 overflow-hidden space-y-4 p-6">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-black text-indigo-900 flex items-center gap-2">
                <ArrowLeftRight className="text-indigo-600" size={18} /> تحويل بضاعة بين المخازن
              </h3>
              <button 
                type="button" 
                onClick={() => setShowTransferModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleExecuteTransfer} className="space-y-4">
              {/* Product Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">الصنف المراد تحويله</label>
                <select
                  required
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-xs font-bold bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={transferItemCode}
                  onChange={e => setTransferItemCode(e.target.value)}
                >
                  <option value="">-- اختر الصنف --</option>
                  {deduplicatedProducts.map(p => (
                    <option key={p.code} value={p.code}>
                      {p.name} ({p.code}) - [المرج: {p.quantityMarg ?? p.quantity} | النزهة: {p.quantityNozha ?? 0}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Direction: From -> To */}
              <div className="grid grid-cols-2 gap-3 items-center bg-indigo-50/60 p-3 rounded-xl border border-indigo-100">
                <div>
                  <label className="block text-xs font-bold text-indigo-900 mb-1">من مخزن</label>
                  <select
                    className="w-full p-2 border border-indigo-200 rounded-lg text-xs font-bold bg-white"
                    value={transferFromBranch}
                    onChange={e => {
                      const from = e.target.value as BranchId;
                      setTransferFromBranch(from);
                      setTransferToBranch(from === 'MARG' ? 'NOZHA' : 'MARG');
                    }}
                  >
                    <option value="MARG">مخزن إدارة المرج</option>
                    <option value="NOZHA">مخزن إدارة النزهة</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-indigo-900 mb-1">إلى مخزن</label>
                  <select
                    className="w-full p-2 border border-indigo-200 rounded-lg text-xs font-bold bg-white"
                    value={transferToBranch}
                    onChange={e => {
                      const to = e.target.value as BranchId;
                      setTransferToBranch(to);
                      setTransferFromBranch(to === 'MARG' ? 'NOZHA' : 'MARG');
                    }}
                  >
                    <option value="NOZHA">مخزن إدارة النزهة</option>
                    <option value="MARG">مخزن إدارة المرج</option>
                  </select>
                </div>
              </div>

              {/* Source Available Stock Info */}
              <div className="flex justify-between items-center text-xs p-2 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-gray-600">الرصيد المتاح للتحويل في مخزن المصدر:</span>
                <span className={`font-bold font-mono ${sourceAvailableStock <= 0 ? 'text-red-600' : 'text-blue-700'}`}>
                  {sourceAvailableStock.toLocaleString()} قطعة
                </span>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">الكمية المراد نقلها</label>
                <input
                  type="number"
                  required
                  min="1"
                  max={sourceAvailableStock}
                  placeholder="أدخل عدد القطع..."
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-sm font-bold text-center font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={transferQuantity}
                  onChange={e => setTransferQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">ملاحظات / سبب التحويل (اختياري)</label>
                <input
                  type="text"
                  placeholder="مثال: إمداد مخزن النزهة بناء على طلب فرع النزهة"
                  className="w-full p-2 border border-gray-300 rounded-lg text-xs"
                  value={transferNotes}
                  onChange={e => setTransferNotes(e.target.value)}
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="submit"
                  disabled={isTransferring || sourceAvailableStock <= 0 || !transferQuantity || Number(transferQuantity) <= 0 || Number(transferQuantity) > sourceAvailableStock}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
                >
                  {isTransferring ? (
                    <>
                      <RotateCcw size={16} className="animate-spin" />
                      <span>جاري التحويل...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>تأكيد نقل البضاعة وتحديث الرصيد</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  disabled={isTransferring}
                  className="py-2.5 px-4 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
