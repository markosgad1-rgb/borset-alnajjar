import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useERP } from '../context/ERPContext';
import { 
  ArrowRightLeft, Save, Search, AlertCircle, ArrowDownCircle, ArrowUpCircle, 
  Users, Truck, Briefcase, Wallet, Building2, Smartphone, Building, MapPin, Check, X,
  History, Trash2, CheckCircle
} from 'lucide-react';
import { PaymentMethod, BranchId, BRANCHES, getBranchAreas, Customer, Supplier, Employee } from '../types';
import { formatWithCommas, parseNumberFromCommas, handleNumericChangeWithCommas } from '../utils/formatters';
import { useDialog } from '../utils/useDialog';

export const Transfers: React.FC = () => {
  const { customers, suppliers, employees, treasury, addTransfer, deleteTransfer } = useERP();
  const { confirm: askConfirm, notify, dialog } = useDialog();
  
  const [entityType, setEntityType] = useState<'CUSTOMER' | 'SUPPLIER' | 'EMPLOYEE'>('CUSTOMER');
  
  const [selectedBranch, setSelectedBranch] = useState<BranchId>('MARG');
  const [selectedArea, setSelectedArea] = useState<string>('ALL');

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    amount: '',
    type: 'IN' as 'IN' | 'OUT',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    paymentMethod: 'CASH' as PaymentMethod
  });

  const [entitySearchText, setEntitySearchText] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [currentBalance, setCurrentBalance] = useState<number | null>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Exclude deleted entities strictly
  const activeCustomers = useMemo(() => customers.filter(c => !c.isDeleted), [customers]);
  const activeSuppliers = useMemo(() => suppliers.filter(s => !s.isDeleted), [suppliers]);
  const activeEmployees = useMemo(() => employees.filter(e => !(e as any).isDeleted), [employees]);

  // Dynamic areas for customers in selected branch
  const availableBranchAreas = useMemo(() => {
    return getBranchAreas(selectedBranch, activeCustomers);
  }, [selectedBranch, activeCustomers]);

  // Customers filtered by branch and area
  const availableCustomers = useMemo(() => {
    let list = activeCustomers.filter(c => (c.branchId || 'MARG') === selectedBranch);
    if (selectedArea && selectedArea !== 'ALL') {
      list = list.filter(c => (c.area || '') === selectedArea);
    }
    return list;
  }, [activeCustomers, selectedBranch, selectedArea]);

  // Display list based on entityType
  const currentDisplayList = useMemo(() => {
    if (entityType === 'CUSTOMER') return availableCustomers;
    if (entityType === 'SUPPLIER') return activeSuppliers;
    return activeEmployees;
  }, [entityType, availableCustomers, activeSuppliers, activeEmployees]);

  // All active entities of this type (for direct code lookup regardless of filters)
  const allActiveOfType = useMemo(() => {
    if (entityType === 'CUSTOMER') return activeCustomers;
    if (entityType === 'SUPPLIER') return activeSuppliers;
    return activeEmployees;
  }, [entityType, activeCustomers, activeSuppliers, activeEmployees]);

  // Unified Label format: [Code] Name - Area/Phone/Role (e.g. [C079] مرقص - عين شمس)
  const formatEntityLabel = (e: Customer | Supplier | Employee): string => {
    if (entityType === 'CUSTOMER') {
      const c = e as Customer;
      return `[${c.code}] ${c.name}${c.area ? ` - ${c.area}` : ''}`;
    }
    if (entityType === 'SUPPLIER') {
      const s = e as Supplier;
      return `[${s.code}] ${s.name}${s.phone ? ` - ${s.phone}` : ''}`;
    }
    const emp = e as Employee;
    return `[${emp.code}] ${emp.name}${emp.role ? ` - ${emp.role}` : ''}`;
  };

  // Interactive suggestions
  const filteredSuggestions = useMemo(() => {
    const q = entitySearchText.trim().toLowerCase();
    if (!q) return currentDisplayList.slice(0, 50);
    return currentDisplayList.filter(e => {
      const codeMatch = e.code.toLowerCase().includes(q);
      const nameMatch = e.name.toLowerCase().includes(q);
      const labelMatch = formatEntityLabel(e).toLowerCase().includes(q);
      let extraMatch = false;
      if (entityType === 'CUSTOMER') {
        extraMatch = (e as Customer).area?.toLowerCase?.().includes(q) || false;
      } else if (entityType === 'SUPPLIER') {
        extraMatch = (e as Supplier).phone?.toLowerCase?.().includes(q) || false;
      } else if (entityType === 'EMPLOYEE') {
        extraMatch = (e as Employee).role?.toLowerCase?.().includes(q) || false;
      }
      return codeMatch || nameMatch || labelMatch || extraMatch;
    }).slice(0, 50);
  }, [currentDisplayList, entitySearchText, entityType]);

  const selectEntity = (entity: Customer | Supplier | Employee | null) => {
    if (entity && !(entity as any).isDeleted) {
      setFormData(prev => ({
        ...prev,
        code: entity.code,
        name: entity.name
      }));
      setCurrentBalance(entity.balance);
      setEntitySearchText(formatEntityLabel(entity));

      if (entityType === 'CUSTOMER') {
        const c = entity as Customer;
        if (c.branchId && c.branchId !== selectedBranch) {
          setSelectedBranch(c.branchId);
        }
        if (c.area && c.area !== selectedArea) {
          setSelectedArea(c.area);
        }
      }
    } else {
      setFormData(prev => ({ ...prev, code: '', name: '' }));
      setCurrentBalance(null);
      setEntitySearchText('');
    }
    setIsDropdownOpen(false);
  };

  const handleSearchChange = (val: string) => {
    setEntitySearchText(val);
    setIsDropdownOpen(true);
    const trimmed = val.trim();

    if (!trimmed) {
      setFormData(prev => ({ ...prev, code: '', name: '' }));
      setCurrentBalance(null);
      return;
    }

    // 1. Bracket match [CODE] e.g. [C079] مرقص - عين شمس
    const bracketMatch = trimmed.match(/^\[([A-Za-z0-9_-]+)\]/);
    if (bracketMatch) {
      const extractedCode = bracketMatch[1].toLowerCase();
      const entity = allActiveOfType.find(e => e.code.toLowerCase() === extractedCode);
      if (entity) {
        selectEntity(entity);
        return;
      }
    }

    // 2. Direct code match
    const byCode = allActiveOfType.find(e => e.code.toLowerCase() === trimmed.toLowerCase());
    if (byCode) {
      selectEntity(byCode);
      return;
    }

    // 3. Exact name match in currently displayed list
    const exactInDisplayed = currentDisplayList.filter(e => e.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (exactInDisplayed.length === 1) {
      selectEntity(exactInDisplayed[0]);
      return;
    }

    // 4. Exact name match in all active entities of type
    const exactInAll = allActiveOfType.filter(e => e.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (exactInAll.length === 1) {
      selectEntity(exactInAll[0]);
      return;
    }
  };

  const handleCodeChange = (code: string) => {
    const trimmed = code.trim().toLowerCase();
    setFormData(prev => ({ ...prev, code }));
    if (!trimmed) {
      setFormData(prev => ({ ...prev, name: '' }));
      setCurrentBalance(null);
      setEntitySearchText('');
      return;
    }
    const entity = allActiveOfType.find(e => e.code.toLowerCase() === trimmed);
    if (entity) {
      setFormData(prev => ({ ...prev, name: entity.name }));
      setCurrentBalance(entity.balance);
      setEntitySearchText(formatEntityLabel(entity));
      if (entityType === 'CUSTOMER') {
        const c = entity as Customer;
        if (c.branchId && c.branchId !== selectedBranch) {
          setSelectedBranch(c.branchId);
        }
        if (c.area && c.area !== selectedArea) {
          setSelectedArea(c.area);
        }
      }
    } else {
      setFormData(prev => ({ ...prev, name: '' }));
      setCurrentBalance(null);
    }
  };

  const handleTypeToggle = (newType: 'CUSTOMER' | 'SUPPLIER' | 'EMPLOYEE') => {
    setEntityType(newType);
    setFormData(prev => ({ ...prev, code: '', name: '' }));
    setEntitySearchText('');
    setCurrentBalance(null);
    setIsDropdownOpen(false);
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter and sort transfers strictly descending: newest first
  const recentTransfers = useMemo(() => {
    return treasury
      .filter(t => 
        t.source === 'TRANSFER' || 
        t.id.startsWith('TR') || 
        t.transferType !== undefined ||
        t.description.includes('صرف لعميل') ||
        t.description.includes('دفع لمورد') ||
        t.description.includes('استلام من مورد') ||
        t.description.includes('صرف لموظف') ||
        t.description.includes('استرداد من موظف') ||
        (t.id.startsWith('TR') && t.description.includes('تحصيل من عميل'))
      )
      .sort((a, b) => {
        const timeA = a.timestamp || (a.createdAt ? new Date(a.createdAt).getTime() : (a.date ? new Date(a.date).getTime() : 0));
        const timeB = b.timestamp || (b.createdAt ? new Date(b.createdAt).getTime() : (b.date ? new Date(b.date).getTime() : 0));
        if (timeB !== timeA) return timeB - timeA;
        return (b.date || '').localeCompare(a.date || '');
      });
  }, [treasury]);

  const handleDeleteTransfer = async (t: any) => {
    const isIncoming = t.transferType === 'IN' || t.credit > 0;
    const amountVal = t.amount || (t.credit > 0 ? t.credit : t.debit);
    const amountStr = `${amountVal.toLocaleString()} ج.م`;
    const directionStr = isIncoming ? 'وارد (استلام)' : 'صادر (دفع)';
    
    const confirmed = await askConfirm(
      `هل أنت متأكد من حذف حركة التحويل بقيمة ${amountStr} (${directionStr})؟ سيتم إلغاء أثرها تلقائياً من الخزنة ومن كشف الحساب المرتبط.`
    );
    
    if (!confirmed) return;
    
    try {
      const res = await deleteTransfer(t.id);
      if (res.success) {
        notify('تم حذف حركة التحويل وإلغاء أثرها من الخزينة وكشف الحساب بنجاح.');
      } else {
        notify('فشل في حذف التحويل: ' + (res.message || 'حدث خطأ غير متوقع'));
      }
    } catch (err: any) {
      console.error('Delete transfer error:', err);
      notify('حدث خطأ أثناء حذف التحويل: ' + (err?.message || err));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseNumberFromCommas(formData.amount);

    if (!formData.code || !formData.name) {
      notify('الرجاء اختيار ' + getEntityLabel());
      return;
    }
    if (amount <= 0) {
      notify('الرجاء إدخال قيمة صحيحة أكبر من الصفر');
      return;
    }

    try {
      setIsSubmitting(true);
      await addTransfer({
        branchId: entityType === 'CUSTOMER' ? selectedBranch : undefined,
        entityType: entityType,
        entityCode: formData.code,
        amount: amount,
        type: formData.type,
        date: formData.date,
        notes: formData.notes,
        paymentMethod: formData.paymentMethod
      });

      // Update current displayed balance
      if (currentBalance !== null) {
        let delta = 0;
        if (entityType === 'CUSTOMER') delta = formData.type === 'IN' ? amount : -amount;
        else if (entityType === 'SUPPLIER') delta = formData.type === 'OUT' ? amount : -amount;
        else delta = formData.type === 'OUT' ? amount : -amount;
        setCurrentBalance(currentBalance + delta);
      }

      setFormData(prev => ({
        ...prev,
        amount: '',
        notes: ''
      }));
      notify('تم حفظ عملية التحويل وتحديث الخزنة والحساب بنجاح.');
    } catch (err: any) {
      console.error("Transfer submission error:", err);
      notify('حدث خطأ أثناء حفظ التحويل: ' + (err?.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper text for UI
  const getEntityLabel = () => {
      if (entityType === 'CUSTOMER') return 'العميل';
      if (entityType === 'SUPPLIER') return 'المورد';
      return 'الموظف';
  };

  const getInLabel = () => {
      if (entityType === 'CUSTOMER') return 'استلام من عميل';
      if (entityType === 'SUPPLIER') return 'استلام من مورد';
      return 'استرداد من موظف';
  };

  const getOutLabel = () => {
      if (entityType === 'CUSTOMER') return 'دفع لعميل';
      if (entityType === 'SUPPLIER') return 'دفع لمورد';
      return 'صرف لموظف';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-brand-100 overflow-hidden">
        <div className="p-6 bg-purple-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ArrowRightLeft size={28} />
            <h2 className="text-xl font-bold">تسجيل التحويلات المالية</h2>
          </div>
          {entityType === 'CUSTOMER' && (
            <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-lg text-xs font-bold text-white">
              {selectedBranch === 'NOZHA' ? 'فرع النزهة' : 'فرع المرج'}
            </span>
          )}
        </div>
        
        <div className="p-8">
          
          {/* Entity Type Switcher */}
          <div className="flex bg-gray-100 p-1 rounded-xl mb-8 overflow-x-auto">
             <button 
               onClick={() => handleTypeToggle('CUSTOMER')}
               className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg transition-all font-bold whitespace-nowrap
                 ${entityType === 'CUSTOMER' ? 'bg-white shadow-md text-purple-700' : 'text-gray-500 hover:bg-gray-200'}
               `}
             >
               <Users size={20} /> عملاء
             </button>
             <button 
               onClick={() => handleTypeToggle('SUPPLIER')}
               className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg transition-all font-bold whitespace-nowrap
                 ${entityType === 'SUPPLIER' ? 'bg-white shadow-md text-orange-600' : 'text-gray-500 hover:bg-gray-200'}
               `}
             >
               <Truck size={20} /> موردين
             </button>
             <button 
               onClick={() => handleTypeToggle('EMPLOYEE')}
               className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg transition-all font-bold whitespace-nowrap
                 ${entityType === 'EMPLOYEE' ? 'bg-white shadow-md text-teal-600' : 'text-gray-500 hover:bg-gray-200'}
               `}
             >
               <Briefcase size={20} /> موظفين
             </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Money Flow Type Toggle */}
            <div className="flex justify-center gap-6 mb-8">
              <label className={`
                flex-1 p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col items-center gap-2
                ${formData.type === 'IN' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 hover:border-gray-300'}
              `}>
                <input 
                  type="radio" 
                  name="type" 
                  value="IN" 
                  checked={formData.type === 'IN'} 
                  onChange={() => setFormData({...formData, type: 'IN'})}
                  className="hidden"
                />
                <ArrowDownCircle size={32} className={formData.type === 'IN' ? 'text-green-600' : 'text-gray-400'} />
                <span className="font-bold text-lg">داخل (وارد)</span>
                <span className="text-xs text-center">{getInLabel()}</span>
              </label>

              <label className={`
                flex-1 p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col items-center gap-2
                ${formData.type === 'OUT' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 hover:border-gray-300'}
              `}>
                <input 
                  type="radio" 
                  name="type" 
                  value="OUT" 
                  checked={formData.type === 'OUT'} 
                  onChange={() => setFormData({...formData, type: 'OUT'})}
                  className="hidden"
                />
                <ArrowUpCircle size={32} className={formData.type === 'OUT' ? 'text-red-600' : 'text-gray-400'} />
                <span className="font-bold text-lg">خارج (صادر)</span>
                <span className="text-xs text-center">{getOutLabel()}</span>
              </label>
            </div>

            {/* Method Toggle */}
            <div className="space-y-2">
               <label className="block text-sm font-bold text-gray-700 mb-2">طريقة الدفع/التحصيل</label>
               <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                 <label className={`
                   flex flex-col items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all text-center
                   ${formData.paymentMethod === 'CASH' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-1 ring-emerald-500' : 'bg-white border-gray-200 hover:bg-gray-50'}
                 `}>
                   <input 
                     type="radio" 
                     name="method" 
                     value="CASH" 
                     checked={formData.paymentMethod === 'CASH'}
                     onChange={() => setFormData({...formData, paymentMethod: 'CASH'})} 
                     className="hidden"
                   />
                   <Wallet size={20} />
                   <span className="font-bold text-xs">خزنة (كاش)</span>
                 </label>

                 <label className={`
                   flex flex-col items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all text-center
                   ${formData.paymentMethod === 'BANK_AHLY' ? 'bg-green-50 border-green-600 text-green-800 ring-1 ring-green-600' : 'bg-white border-gray-200 hover:bg-gray-50'}
                 `}>
                   <input 
                     type="radio" 
                     name="method" 
                     value="BANK_AHLY" 
                     checked={formData.paymentMethod === 'BANK_AHLY'}
                     onChange={() => setFormData({...formData, paymentMethod: 'BANK_AHLY'})} 
                     className="hidden"
                   />
                   <Building2 size={20} />
                   <span className="font-bold text-xs">البنك الأهلي</span>
                 </label>

                 <label className={`
                   flex flex-col items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all text-center
                   ${formData.paymentMethod === 'BANK_MISR' ? 'bg-red-50 border-red-600 text-red-800 ring-1 ring-red-600' : 'bg-white border-gray-200 hover:bg-gray-50'}
                 `}>
                   <input 
                     type="radio" 
                     name="method" 
                     value="BANK_MISR" 
                     checked={formData.paymentMethod === 'BANK_MISR'}
                     onChange={() => setFormData({...formData, paymentMethod: 'BANK_MISR'})} 
                     className="hidden"
                   />
                   <Building2 size={20} />
                   <span className="font-bold text-xs">بنك مصر</span>
                 </label>

                 <label className={`
                   flex flex-col items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all text-center
                   ${formData.paymentMethod === 'VF_CASH_AYMAN' ? 'bg-red-50 border-red-600 text-red-800 ring-1 ring-red-600' : 'bg-white border-gray-200 hover:bg-gray-50'}
                 `}>
                   <input 
                     type="radio" 
                     name="method" 
                     value="VF_CASH_AYMAN" 
                     checked={formData.paymentMethod === 'VF_CASH_AYMAN'}
                     onChange={() => setFormData({...formData, paymentMethod: 'VF_CASH_AYMAN'})} 
                     className="hidden"
                   />
                   <Smartphone size={20} />
                   <span className="font-bold text-xs">فودافون كاش أيمن</span>
                 </label>

                 <label className={`
                   flex flex-col items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all text-center
                   ${formData.paymentMethod === 'VF_CASH_KYRILLOS' ? 'bg-red-50 border-red-600 text-red-800 ring-1 ring-red-600' : 'bg-white border-gray-200 hover:bg-gray-50'}
                 `}>
                   <input 
                     type="radio" 
                     name="method" 
                     value="VF_CASH_KYRILLOS" 
                     checked={formData.paymentMethod === 'VF_CASH_KYRILLOS'}
                     onChange={() => setFormData({...formData, paymentMethod: 'VF_CASH_KYRILLOS'})} 
                     className="hidden"
                   />
                   <Smartphone size={20} />
                   <span className="font-bold text-xs">فودافون كاش كيرلس</span>
                 </label>
               </div>
            </div>

            {/* Entity Selection Section */}
            {entityType === 'CUSTOMER' ? (
              /* Cascading Filter for Customer: Branch -> Area -> Customer */
              <div className="p-4 bg-gradient-to-r from-purple-50/70 to-indigo-50/70 border border-purple-200/70 rounded-xl space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  
                  {/* Step 1: Branch Selection */}
                  <div className="md:col-span-5">
                    <label className="text-xs font-bold text-purple-900 flex items-center gap-1.5 mb-1.5">
                      <span className="w-5 h-5 rounded-full bg-purple-600 text-white inline-flex items-center justify-center text-[11px] font-bold">1</span>
                      اختيار الفرع / الإدارة
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {BRANCHES.map(b => {
                        const isSelected = selectedBranch === b.id;
                        return (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => {
                              setSelectedBranch(b.id);
                              setSelectedArea('ALL');
                              setFormData(prev => ({ ...prev, code: '', name: '' }));
                              setEntitySearchText('');
                              setCurrentBalance(null);
                              setIsDropdownOpen(false);
                            }}
                            className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer ${
                              isSelected
                                ? 'bg-purple-600 text-white ring-2 ring-purple-300 shadow-purple-200'
                                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <Building size={14} />
                            <span>{b.name}</span>
                            {isSelected && <Check size={14} className="mr-auto" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 2: Dynamic Area Selection */}
                  <div className="md:col-span-7">
                    <label className="text-xs font-bold text-purple-900 flex items-center gap-1.5 mb-1.5">
                      <span className="w-5 h-5 rounded-full bg-purple-600 text-white inline-flex items-center justify-center text-[11px] font-bold">2</span>
                      تحديد المنطقة ({selectedBranch === 'NOZHA' ? 'النزهة' : 'المرج'})
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <MapPin size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <select
                          className="w-full pr-8 pl-3 py-2 border border-purple-200 rounded-lg text-xs font-medium bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none cursor-pointer"
                          value={selectedArea}
                          onChange={e => {
                            setSelectedArea(e.target.value);
                            setFormData(prev => ({ ...prev, code: '', name: '' }));
                            setEntitySearchText('');
                            setCurrentBalance(null);
                            setIsDropdownOpen(false);
                          }}
                        >
                          <option value="ALL">جميع مناطق {selectedBranch === 'NOZHA' ? 'إدارة النزهة' : 'إدارة المرج'} ({availableCustomers.length} عميل)</option>
                          {availableBranchAreas.map(area => (
                            <option key={area} value={area}>{area}</option>
                          ))}
                        </select>
                      </div>
                      {selectedArea !== 'ALL' && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedArea('ALL');
                            setFormData(prev => ({ ...prev, code: '', name: '' }));
                            setEntitySearchText('');
                            setCurrentBalance(null);
                            setIsDropdownOpen(false);
                          }}
                          className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                          title="عرض جميع مناطق الإدارة"
                        >
                          إلغاء الفلتر
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Step 3: Cascading Customer Selection */}
                <div className="pt-2 border-t border-purple-200/50">
                  <label className="text-xs font-bold text-purple-900 flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-purple-600 text-white inline-flex items-center justify-center text-[11px] font-bold">3</span>
                      اختيار العميل بالاسم أو الكود (مفلتر حسب {selectedBranch === 'NOZHA' ? 'النزهة' : 'المرج'} {selectedArea !== 'ALL' ? `- ${selectedArea}` : ''})
                    </span>
                    <span className="text-[11px] text-purple-600 font-medium">
                      ({availableCustomers.length} عميل نشط)
                    </span>
                  </label>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start" ref={dropdownRef}>
                    {/* Search Box / Combobox with dropdown popup */}
                    <div className="md:col-span-8 relative">
                      <div className="relative">
                        <input
                          type="text"
                          list="transfersEntityList"
                          required
                          className="w-full p-2.5 pr-8 pl-8 border border-purple-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                          value={entitySearchText}
                          onChange={e => handleSearchChange(e.target.value)}
                          onFocus={() => setIsDropdownOpen(true)}
                          placeholder="ابحث بكود أو اسم العميل: [C079] مرقص - عين شمس..."
                        />
                        <Search size={16} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        {formData.code && (
                          <button
                            type="button"
                            onClick={() => selectEntity(null)}
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 p-0.5 rounded cursor-pointer transition-colors"
                            title="إلغاء الاختيار"
                          >
                            <X size={15} />
                          </button>
                        )}
                      </div>

                      <datalist id="transfersEntityList">
                        {availableCustomers.map(c => (
                          <option key={`tr_cust_${c.code}`} value={formatEntityLabel(c)}>
                            رصيد سابق: {c.balance.toLocaleString()} ج.م
                          </option>
                        ))}
                      </datalist>

                      {/* Interactive Suggestions Popup */}
                      {isDropdownOpen && filteredSuggestions.length > 0 && (
                        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-purple-200 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-gray-100">
                          {filteredSuggestions.map(e => {
                            const c = e as Customer;
                            const isSelected = formData.code === c.code;
                            return (
                              <button
                                key={`tr_suggest_${c.code}`}
                                type="button"
                                onClick={() => selectEntity(c)}
                                className={`w-full text-right p-2.5 hover:bg-purple-50 flex items-center justify-between text-xs transition-colors cursor-pointer ${
                                  isSelected ? 'bg-purple-50 font-bold border-r-4 border-purple-600' : ''
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 font-mono font-bold rounded text-[11px]">
                                    {c.code}
                                  </span>
                                  <span className="font-bold text-gray-800 text-sm">
                                    {c.name}
                                  </span>
                                  {c.area && (
                                    <span className="text-gray-500 text-[11px]">
                                      - {c.area}
                                    </span>
                                  )}
                                </div>
                                <div className="text-left shrink-0">
                                  <span className={`font-mono text-xs font-bold ${
                                    c.balance < 0 ? 'text-red-600' : c.balance > 0 ? 'text-emerald-700' : 'text-gray-500'
                                  }`} dir="ltr">
                                    {c.balance.toLocaleString()} ج.م
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Code Input (Synced) */}
                    <div className="md:col-span-4 relative">
                      <input 
                        type="text"
                        required
                        className="w-full p-2.5 border border-purple-200 rounded-lg text-sm font-mono bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        placeholder="كود العميل"
                        value={formData.code}
                        onChange={e => handleCodeChange(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* For Supplier / Employee */
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                <label className="text-xs font-bold text-gray-800 flex items-center justify-between">
                  <span>اختيار {getEntityLabel()} (بحث بالكود أو الاسم)</span>
                  <span className="text-gray-500 text-[11px]">({currentDisplayList.length} نشط)</span>
                </label>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start" ref={dropdownRef}>
                  <div className="md:col-span-8 relative">
                    <div className="relative">
                      <input
                        type="text"
                        list="transfersEntityList"
                        required
                        className="w-full p-2.5 pr-8 pl-8 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        value={entitySearchText}
                        onChange={e => handleSearchChange(e.target.value)}
                        onFocus={() => setIsDropdownOpen(true)}
                        placeholder={`ابحث بكود أو اسم ${getEntityLabel()}: [${entityType === 'SUPPLIER' ? 'S001' : 'E001'}] ...`}
                      />
                      <Search size={16} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      {formData.code && (
                        <button
                          type="button"
                          onClick={() => selectEntity(null)}
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 p-0.5 rounded cursor-pointer transition-colors"
                          title="إلغاء الاختيار"
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>

                    <datalist id="transfersEntityList">
                      {currentDisplayList.map(e => (
                        <option key={`tr_ent_${e.code}`} value={formatEntityLabel(e)}>
                          رصيد: {e.balance.toLocaleString()} ج.م
                        </option>
                      ))}
                    </datalist>

                    {/* Interactive Suggestions Popup */}
                    {isDropdownOpen && filteredSuggestions.length > 0 && (
                      <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-gray-100">
                        {filteredSuggestions.map(e => {
                          const isSelected = formData.code === e.code;
                          const subtitle = entityType === 'SUPPLIER' ? (e as Supplier).phone : (e as Employee).role;
                          return (
                            <button
                              key={`tr_suggest_${e.code}`}
                              type="button"
                              onClick={() => selectEntity(e)}
                              className={`w-full text-right p-2.5 hover:bg-purple-50 flex items-center justify-between text-xs transition-colors cursor-pointer ${
                                isSelected ? 'bg-purple-50 font-bold border-r-4 border-purple-600' : ''
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="px-1.5 py-0.5 bg-gray-200 text-gray-800 font-mono font-bold rounded text-[11px]">
                                  {e.code}
                                </span>
                                <span className="font-bold text-gray-800 text-sm">
                                  {e.name}
                                </span>
                                {subtitle && (
                                  <span className="text-gray-500 text-[11px]">
                                    - {subtitle}
                                  </span>
                                )}
                              </div>
                              <div className="text-left shrink-0">
                                <span className={`font-mono text-xs font-bold ${
                                  e.balance < 0 ? 'text-red-600' : e.balance > 0 ? 'text-emerald-700' : 'text-gray-500'
                                }`} dir="ltr">
                                  {e.balance.toLocaleString()} ج.م
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-4 relative">
                    <input 
                      type="text"
                      required
                      className="w-full p-2.5 border border-gray-300 rounded-lg text-sm font-mono bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      placeholder="الكود"
                      value={formData.code}
                      onChange={e => handleCodeChange(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

             {/* Balance Display */}
             {formData.code && currentBalance !== null && (
              <div className={`p-4 rounded-lg border flex items-center gap-3 animate-fade-in
                ${currentBalance < 0 ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}
              `}>
                <AlertCircle size={24} />
                <div>
                  <p className="text-sm font-bold opacity-80">الرصيد الحالي</p>
                  <p className="text-2xl font-bold" dir="ltr">
                    {currentBalance.toLocaleString()} ج.م 
                    <span className="text-xs mr-2 text-gray-600">
                        {entityType === 'EMPLOYEE' 
                            ? (currentBalance < 0 ? '(مستحقات له)' : currentBalance > 0 ? '(سلف عليه)' : '(متزن)') 
                            : entityType === 'SUPPLIER'
                            ? (currentBalance < 0 ? '(له / مديونية علينا)' : currentBalance > 0 ? '(لنا عليه / رصيد)' : '(متزن)')
                            : (currentBalance < 0 ? '(عليه / مديونية)' : currentBalance > 0 ? '(له / رصيد)' : '(متزن)')
                        }
                    </span>
                  </p>
                </div>
              </div>
            )}

            {/* Amount & Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">قيمة التحويل</label>
                <div className="relative">
                  <input 
                    type="text"
                    dir="ltr"
                    required
                    className="w-full p-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none font-bold text-xl text-center font-mono"
                    placeholder="0"
                    value={formData.amount}
                    onChange={e => handleNumericChangeWithCommas(e.target.value, val => setFormData({...formData, amount: val}))}
                  />
                  <span className="absolute left-3 top-4 text-gray-400 font-bold text-sm">ج.م</span>
                </div>
                {parseNumberFromCommas(formData.amount) > 0 && (
                  <div className="space-y-1 mt-1">
                    <p className="text-xs font-bold text-purple-700 bg-purple-50 p-2 rounded border border-purple-100 flex justify-between">
                      <span>المبلغ المحدد:</span>
                      <span dir="ltr">{parseNumberFromCommas(formData.amount).toLocaleString()} ج.م</span>
                    </p>
                    {currentBalance !== null && (() => {
                      const enteredAmt = parseNumberFromCommas(formData.amount);
                      let projectedDelta = 0;
                      if (entityType === 'CUSTOMER') projectedDelta = formData.type === 'IN' ? enteredAmt : -enteredAmt;
                      else if (entityType === 'SUPPLIER') projectedDelta = formData.type === 'OUT' ? enteredAmt : -enteredAmt;
                      else projectedDelta = formData.type === 'OUT' ? enteredAmt : -enteredAmt;
                      const projectedBal = currentBalance + projectedDelta;
                      return (
                        <p className="text-xs font-bold text-gray-700 bg-gray-50 p-2 rounded border border-gray-200 flex justify-between items-center">
                          <span>الرصيد المتوقع بعد التحويل:</span>
                          <span className={`font-mono font-bold ${projectedBal < 0 ? 'text-red-600' : projectedBal > 0 ? 'text-green-700' : 'text-gray-800'}`} dir="ltr">
                            {projectedBal.toLocaleString()} ج.م
                          </span>
                        </p>
                      );
                    })()}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">التاريخ</label>
                <input 
                  type="date"
                  required
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                  value={formData.date}
                  onChange={e => setFormData({...formData, date: e.target.value})}
                />
              </div>

              <div className="md:col-span-2 space-y-2">
                <label className="block text-sm font-bold text-gray-700">ملاحظات (بيان)</label>
                <input 
                  type="text"
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                  placeholder="أضف أي ملاحظات إضافية هنا..."
                  value={formData.notes}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                />
              </div>
            </div>

            <div className="pt-6">
              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-bold py-4 px-8 rounded-xl shadow-lg transition-all flex justify-center items-center gap-3 cursor-pointer disabled:cursor-not-allowed"
              >
                <Save size={24} />
                {isSubmitting ? 'جاري الحفظ...' : 'حفظ التحويل'}
              </button>
            </div>

          </form>
        </div>
      </div>

      {/* Recent Transfers Table */}
      <div className="bg-white rounded-xl shadow-sm border border-purple-100 overflow-hidden">
        <div className="p-4 bg-purple-50 border-b border-purple-100 flex items-center justify-between">
          <h3 className="font-bold text-purple-900 flex items-center gap-2">
            <History size={20} className="text-purple-600" />
            سجل عمليات التحويل الأخيرة المسجلة بالخزنة
            <span className="px-2 py-0.5 rounded-full bg-purple-200/60 text-purple-800 text-xs font-mono font-bold">
              ({recentTransfers.length})
            </span>
          </h3>
          <span className="text-xs text-purple-700 font-bold bg-white/80 px-2.5 py-1 rounded-md border border-purple-200">
            محدثة تلقائياً والأحدث دائماً في الأعلى
          </span>
        </div>
        
        {recentTransfers.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p>لا توجد عمليات تحويل مسجلة بعد</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-gray-50 text-gray-600 font-bold">
                <tr>
                  <th className="p-3 w-12 text-center">#</th>
                  <th className="p-3">التاريخ والوقت</th>
                  <th className="p-3 text-center">النوع</th>
                  <th className="p-3">الحساب / الخزنة</th>
                  <th className="p-3">الطرف / البيان</th>
                  <th className="p-3 text-center">قيمة التحويل</th>
                  <th className="p-3 w-16 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentTransfers.slice(0, 30).map((t, idx) => {
                  const isIncoming = t.transferType === 'IN' || t.credit > 0 || (t.type === 'INCOME' && (!t.debit || t.debit === 0));
                  const amount = t.amount || (t.credit > 0 ? t.credit : t.debit);

                  return (
                    <tr key={t.id} className="hover:bg-purple-50/40 transition-colors">
                      <td className="p-3 text-center text-gray-400 font-mono text-xs">{idx + 1}</td>
                      <td className="p-3 text-gray-600 whitespace-nowrap">
                        <div className="font-mono font-bold text-xs">{t.date?.split(' ')[0] || t.date}</div>
                        {t.date?.includes(' ') && (
                          <div className="text-[10px] text-gray-400 font-mono" dir="ltr">{t.date.split(' ')[1]}</div>
                        )}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        {isIncoming ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <ArrowDownCircle size={13} className="text-emerald-600" />
                            داخل / وارد
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                            <ArrowUpCircle size={13} className="text-rose-600" />
                            خارج / صادر
                          </span>
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                          t.paymentMethod === 'BANK_AHLY' ? 'bg-green-50 text-green-700 border-green-200' :
                          t.paymentMethod === 'BANK_MISR' ? 'bg-red-50 text-red-700 border-red-200' :
                          t.paymentMethod === 'VF_CASH_AYMAN' || t.paymentMethod === 'VF_CASH_KYRILLOS' ? 'bg-red-100 text-red-800 border-red-200' :
                          'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {t.paymentMethod === 'BANK_AHLY' ? 'البنك الأهلي' :
                           t.paymentMethod === 'BANK_MISR' ? 'بنك مصر' :
                           t.paymentMethod === 'VF_CASH_AYMAN' ? 'فودافون كاش أيمن' :
                           t.paymentMethod === 'VF_CASH_KYRILLOS' ? 'فودافون كاش كيرلس' : 'خزنة كاش'}
                        </span>
                      </td>
                      <td className="p-3 text-gray-800 font-medium">
                        <div>
                          {t.entityName && (
                            <span className="font-bold text-gray-900 block text-xs">
                              {t.entityName} {t.entityCode ? `(${t.entityCode})` : ''}
                            </span>
                          )}
                          <span className="text-xs text-gray-600">{t.description}</span>
                        </div>
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-sm whitespace-nowrap">
                        <span className={isIncoming ? 'text-emerald-600' : 'text-rose-600'} dir="ltr">
                          {isIncoming ? `+${amount.toLocaleString()} ج.م` : `-${amount.toLocaleString()} ج.م`}
                        </span>
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTransfer(t);
                          }}
                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="حذف حركة التحويل وإلغاؤها"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Hint Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-500 text-sm">
        <div className="flex items-start gap-2 bg-purple-50 p-4 rounded-lg border border-purple-100">
          <CheckCircle size={16} className="mt-1 text-purple-600 shrink-0"/>
          <p>عند الحفظ، سيتم تحديث <strong>الحساب المختار (خزنة/بنك)</strong> فوراً وتسجيل الحركة في الخزينة وكشف حساب الطرف المعني.</p>
        </div>
        <div className="flex items-start gap-2 bg-purple-50 p-4 rounded-lg border border-purple-100">
          <CheckCircle size={16} className="mt-1 text-purple-600 shrink-0"/>
          <p>يمكنك التراجع عن أي عملية تحويل أو حذفها عبر أيقونة <strong>سلة المهملات 🗑️</strong> لإلغاء أثرها تلقائياً.</p>
        </div>
      </div>

      {dialog}
    </div>
  );
};
