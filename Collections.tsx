import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useERP } from '../context/ERPContext';
import { Banknote, Save, Search, CheckCircle, AlertCircle, Building2, Wallet, Smartphone, History, Building, MapPin, Check, X } from 'lucide-react';
import { PaymentMethod, BranchId, BRANCHES, getBranchAreas, Customer } from '../types';
import { formatWithCommas, parseNumberFromCommas, handleNumericChangeWithCommas } from '../utils/formatters';

export const Collections: React.FC = () => {
  const { customers, addCollection, treasury } = useERP();
  
  const [selectedBranch, setSelectedBranch] = useState<BranchId>('MARG');
  const [selectedArea, setSelectedArea] = useState<string>('ALL');

  const [formData, setFormData] = useState({
    invoiceId: '',
    customerCode: '',
    customerName: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'CASH' as PaymentMethod,
    notes: ''
  });

  const [customerSearchText, setCustomerSearchText] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const [customerBalance, setCustomerBalance] = useState<number | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node)) {
        setIsCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Exclude deleted customers completely
  const activeCustomers = useMemo(() => {
    return customers.filter(c => !c.isDeleted);
  }, [customers]);

  // Dynamic areas for selected branch (defaults + user customized)
  const availableBranchAreas = useMemo(() => {
    return getBranchAreas(selectedBranch, activeCustomers);
  }, [selectedBranch, activeCustomers]);

  // Filtered active customers for selected branch and area
  const availableCustomers = useMemo(() => {
    let list = activeCustomers.filter(c => (c.branchId || 'MARG') === selectedBranch);
    if (selectedArea && selectedArea !== 'ALL') {
      list = list.filter(c => (c.area || '') === selectedArea);
    }
    return list;
  }, [activeCustomers, selectedBranch, selectedArea]);

  // Unified Label format: [Code] Name - Area (e.g. [C079] مرقص - عين شمس)
  const formatCustomerLabel = (c: Customer): string => {
    return `[${c.code}] ${c.name}${c.area ? ` - ${c.area}` : ''}`;
  };

  // Interactive suggestions
  const filteredCustomerSuggestions = useMemo(() => {
    const q = customerSearchText.trim().toLowerCase();
    if (!q) return availableCustomers.slice(0, 50);
    return availableCustomers.filter(c => {
      const codeMatch = c.code.toLowerCase().includes(q);
      const nameMatch = c.name.toLowerCase().includes(q);
      const areaMatch = c.area?.toLowerCase?.().includes(q);
      const formatted = formatCustomerLabel(c).toLowerCase();
      return codeMatch || nameMatch || areaMatch || formatted.includes(q);
    }).slice(0, 50);
  }, [availableCustomers, customerSearchText]);

  const handleBranchChange = (newBranch: BranchId) => {
    setSelectedBranch(newBranch);
    setSelectedArea('ALL');
    setFormData(prev => ({ ...prev, customerCode: '', customerName: '' }));
    setCustomerSearchText('');
    setCustomerBalance(null);
    setIsCustomerDropdownOpen(false);
  };

  // Select customer strictly by entity / code
  const selectCustomer = (c: Customer | null) => {
    if (c && !c.isDeleted) {
      setFormData(prev => ({
        ...prev,
        customerCode: c.code,
        customerName: c.name
      }));
      setCustomerBalance(c.balance);
      setCustomerSearchText(formatCustomerLabel(c));
      if (c.branchId && c.branchId !== selectedBranch) {
        setSelectedBranch(c.branchId);
      }
      if (c.area && c.area !== selectedArea) {
        setSelectedArea(c.area);
      }
    } else {
      setFormData(prev => ({
        ...prev,
        customerCode: '',
        customerName: ''
      }));
      setCustomerBalance(null);
      setCustomerSearchText('');
    }
    setIsCustomerDropdownOpen(false);
  };

  // Search input change (supports typing [Code], code, name, or area)
  const handleCustomerSearchChange = (val: string) => {
    setCustomerSearchText(val);
    setIsCustomerDropdownOpen(true);
    const trimmed = val.trim();

    if (!trimmed) {
      setFormData(prev => ({ ...prev, customerCode: '', customerName: '' }));
      setCustomerBalance(null);
      return;
    }

    // 1. Bracket match [CODE] e.g. [C079] مرقص - عين شمس
    const bracketMatch = trimmed.match(/^\[([A-Za-z0-9_-]+)\]/);
    if (bracketMatch) {
      const extractedCode = bracketMatch[1].toLowerCase();
      const customer = activeCustomers.find(c => c.code.toLowerCase() === extractedCode);
      if (customer) {
        selectCustomer(customer);
        return;
      }
    }

    // 2. Direct code match
    const byCode = activeCustomers.find(c => c.code.toLowerCase() === trimmed.toLowerCase());
    if (byCode) {
      selectCustomer(byCode);
      return;
    }

    // 3. Exact full name match in available list
    const exactInAvailable = availableCustomers.filter(c => c.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (exactInAvailable.length === 1) {
      selectCustomer(exactInAvailable[0]);
      return;
    }

    // 4. Exact full name match in all active customers
    const exactActive = activeCustomers.filter(c => c.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (exactActive.length === 1) {
      selectCustomer(exactActive[0]);
      return;
    }
  };

  // Code input change
  const handleCustomerCodeChange = (code: string) => {
    const trimmed = code.trim().toLowerCase();
    setFormData(prev => ({ ...prev, customerCode: code }));
    if (!trimmed) {
      setFormData(prev => ({ ...prev, customerName: '' }));
      setCustomerBalance(null);
      setCustomerSearchText('');
      return;
    }
    const customer = activeCustomers.find(c => c.code.toLowerCase() === trimmed);
    if (customer) {
      setFormData(prev => ({ ...prev, customerName: customer.name }));
      setCustomerBalance(customer.balance);
      setCustomerSearchText(formatCustomerLabel(customer));
      if (customer.branchId && customer.branchId !== selectedBranch) {
        setSelectedBranch(customer.branchId);
      }
      if (customer.area && customer.area !== selectedArea) {
        setSelectedArea(customer.area);
      }
    } else {
      setFormData(prev => ({ ...prev, customerName: '' }));
      setCustomerBalance(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseNumberFromCommas(formData.amount);

    if (!formData.customerCode || !formData.customerName) {
      alert('الرجاء اختيار العميل من القائمة');
      return;
    }
    if (amount <= 0) {
      alert('الرجاء إدخال مبلغ تحصيل صحيح');
      return;
    }

    try {
      await addCollection({
        customerCode: formData.customerCode,
        customerName: formData.customerName,
        invoiceId: formData.invoiceId?.trim() || undefined,
        amount: amount,
        date: formData.date,
        paymentMethod: formData.paymentMethod,
        notes: formData.notes?.trim() || undefined
      });

      // Reset Form
      setFormData({
        invoiceId: '',
        customerCode: '',
        customerName: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        paymentMethod: 'CASH',
        notes: ''
      });
      setCustomerSearchText('');
      setCustomerBalance(null);
      alert('تم حفظ عملية التحصيل بنجاح وتحديث رصيد العميل والخزنة فوراً.');
    } catch (err: any) {
      alert('حدث خطأ أثناء حفظ التحصيل: ' + (err?.message || err));
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-brand-100 overflow-hidden">
        <div className="p-6 bg-brand-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Banknote size={28} />
            <h2 className="text-xl font-bold">تسجيل تحصيل نقدية (دفعات عملاء)</h2>
          </div>
          <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-lg text-xs font-bold text-white">
            {selectedBranch === 'NOZHA' ? 'فرع النزهة' : 'فرع المرج'}
          </span>
        </div>
        
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* 3-Step Cascading Customer Filtering and Selection */}
            <div className="p-4 bg-gradient-to-r from-blue-50/70 to-indigo-50/70 border border-blue-200/70 rounded-xl space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                
                {/* Step 1: Branch Selection */}
                <div className="md:col-span-5">
                  <label className="text-xs font-bold text-blue-900 flex items-center gap-1.5 mb-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white inline-flex items-center justify-center text-[11px] font-bold">1</span>
                    اختيار الفرع / الإدارة
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {BRANCHES.map(b => {
                      const isSelected = selectedBranch === b.id;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => handleBranchChange(b.id)}
                          className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600 text-white ring-2 ring-blue-300 shadow-blue-200'
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
                  <label className="text-xs font-bold text-blue-900 flex items-center gap-1.5 mb-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white inline-flex items-center justify-center text-[11px] font-bold">2</span>
                    تحديد المنطقة ({selectedBranch === 'NOZHA' ? 'النزهة' : 'المرج'})
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <MapPin size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <select
                        className="w-full pr-8 pl-3 py-2 border border-blue-200 rounded-lg text-xs font-medium bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                        value={selectedArea}
                        onChange={e => {
                          setSelectedArea(e.target.value);
                          setFormData(prev => ({ ...prev, customerCode: '', customerName: '' }));
                          setCustomerSearchText('');
                          setCustomerBalance(null);
                          setIsCustomerDropdownOpen(false);
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
                          setFormData(prev => ({ ...prev, customerCode: '', customerName: '' }));
                          setCustomerSearchText('');
                          setCustomerBalance(null);
                          setIsCustomerDropdownOpen(false);
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
              <div className="pt-2 border-t border-blue-200/50">
                <label className="text-xs font-bold text-blue-900 flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white inline-flex items-center justify-center text-[11px] font-bold">3</span>
                    اختيار العميل بالاسم أو الكود (مفلتر حسب {selectedBranch === 'NOZHA' ? 'النزهة' : 'المرج'} {selectedArea !== 'ALL' ? `- ${selectedArea}` : ''})
                  </span>
                  <span className="text-[11px] text-blue-600 font-medium">
                    ({availableCustomers.length} عميل نشط)
                  </span>
                </label>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start" ref={customerDropdownRef}>
                  {/* Search Box / Combobox with dropdown popup */}
                  <div className="md:col-span-8 relative">
                    <div className="relative">
                      <input
                        type="text"
                        list="customerNamesList"
                        required
                        className="w-full p-2.5 pr-8 pl-8 border border-blue-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        value={customerSearchText}
                        onChange={e => handleCustomerSearchChange(e.target.value)}
                        onFocus={() => setIsCustomerDropdownOpen(true)}
                        placeholder="ابحث بكود أو اسم العميل: [C079] مرقص - عين شمس..."
                      />
                      <Search size={16} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      {formData.customerCode && (
                        <button
                          type="button"
                          onClick={() => selectCustomer(null)}
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 p-0.5 rounded cursor-pointer transition-colors"
                          title="إلغاء اختيار العميل"
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>

                    <datalist id="customerNamesList">
                      {availableCustomers.map(c => (
                        <option key={`col_cust_${c.code}`} value={formatCustomerLabel(c)}>
                          رصيد سابق: {c.balance.toLocaleString()} ج.م
                        </option>
                      ))}
                    </datalist>

                    {/* Interactive Suggestions Popup */}
                    {isCustomerDropdownOpen && filteredCustomerSuggestions.length > 0 && (
                      <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-blue-200 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-gray-100">
                        {filteredCustomerSuggestions.map(c => {
                          const isSelected = formData.customerCode === c.code;
                          return (
                            <button
                              key={`col_suggest_${c.code}`}
                              type="button"
                              onClick={() => selectCustomer(c)}
                              className={`w-full text-right p-2.5 hover:bg-blue-50 flex items-center justify-between text-xs transition-colors cursor-pointer ${
                                isSelected ? 'bg-blue-50 font-bold border-r-4 border-blue-600' : ''
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 font-mono font-bold rounded text-[11px]">
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
                      className="w-full p-2.5 border border-blue-200 rounded-lg text-sm font-mono bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder="كود العميل"
                      value={formData.customerCode}
                      onChange={e => handleCustomerCodeChange(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Customer Balance Display */}
            {formData.customerCode && customerBalance !== null && (
              <div className={`p-4 rounded-lg border flex items-center gap-3 animate-fade-in
                ${customerBalance < 0 ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}
              `}>
                <AlertCircle size={24} />
                <div>
                  <p className="text-sm font-bold opacity-80">رصيد العميل الحالي (قبل التحصيل)</p>
                  <p className="text-2xl font-bold" dir="ltr">
                    {customerBalance.toLocaleString()} ج.م 
                    <span className="text-xs mr-2">
                      {customerBalance < 0 ? '(عليه - مدين)' : '(له - دائن)'}
                    </span>
                  </p>
                </div>
              </div>
            )}

            {/* Payment Details Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
               {/* Payment Method */}
               <div className="md:col-span-2 space-y-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">طريقة التحصيل (إلى أين ستذهب الأموال؟)</label>
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

              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">رقم الفاتورة (مرجع)</label>
                <input 
                  type="text"
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="اختياري (مثال: N005)"
                  value={formData.invoiceId}
                  onChange={e => setFormData({...formData, invoiceId: e.target.value})}
                />
                <p className="text-xs text-gray-500">اتركه فارغاً إذا كانت دفعة عامة</p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">تاريخ التحصيل</label>
                <input 
                  type="date"
                  required
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                  value={formData.date}
                  onChange={e => setFormData({...formData, date: e.target.value})}
                />
              </div>

              <div className="md:col-span-2 space-y-2">
                <label className="block text-sm font-bold text-gray-700">ملاحظات / بيان إضافي</label>
                <input 
                  type="text"
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="أضف أي ملاحظات أو تفاصيل حول التحصيل..."
                  value={formData.notes}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                />
              </div>

              <div className="md:col-span-2 space-y-2">
                <label className="block text-sm font-bold text-gray-700 text-emerald-700">المبلغ المحصل (تم دفع)</label>
                <div className="relative">
                  <input 
                    type="text"
                    dir="ltr"
                    required
                    className="w-full p-3 border-2 border-emerald-100 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-xl text-center font-mono"
                    placeholder="0"
                    value={formData.amount}
                    onFocus={e => e.target.select()}
                    onChange={e => handleNumericChangeWithCommas(e.target.value, val => setFormData({...formData, amount: val}))}
                  />
                  <span className="absolute left-3 top-4 text-gray-400 font-bold text-sm">ج.م</span>
                </div>
                {parseNumberFromCommas(formData.amount) > 0 && (
                  <p className="text-xs font-bold text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-100 flex justify-between">
                    <span>المبلغ المحدد:</span>
                    <span dir="ltr">{parseNumberFromCommas(formData.amount).toLocaleString()} ج.م</span>
                  </p>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-6">
              <button 
                type="submit"
                className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg transition-all flex justify-center items-center gap-3"
              >
                <Save size={24} />
                حفظ التحصيل
              </button>
            </div>

          </form>
        </div>
      </div>

      {/* Recent Collections Table */}
      <div className="bg-white rounded-xl shadow-sm border border-brand-100 overflow-hidden">
        <div className="p-4 bg-brand-50 border-b border-brand-100 flex items-center justify-between">
          <h3 className="font-bold text-brand-900 flex items-center gap-2">
            <History size={20} className="text-brand-600" />
            سجل عمليات التحصيل الأخيرة المسجلة بالخزنة
          </h3>
          <span className="text-xs text-brand-700 font-bold">
            محدثة تلقائياً مع الخزنة
          </span>
        </div>
        
        {treasury.filter(t => t.id.startsWith('T_COL_') || t.description.includes('تحصيل من عميل')).length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p>لا توجد عمليات تحصيل مسجلة بعد</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-gray-50 text-gray-600 font-bold">
                <tr>
                  <th className="p-3">التاريخ</th>
                  <th className="p-3">الحساب / الخزنة</th>
                  <th className="p-3">البيان</th>
                  <th className="p-3 text-emerald-700 font-bold">المبلغ المسدد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {treasury
                  .filter(t => t.id.startsWith('T_COL_') || t.description.includes('تحصيل من عميل'))
                  .slice(-8)
                  .reverse()
                  .map((t) => (
                    <tr key={t.id} className="hover:bg-brand-50/40 transition-colors">
                      <td className="p-3 text-gray-600 whitespace-nowrap">{t.date}</td>
                      <td className="p-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                          t.paymentMethod === 'BANK_AHLY' ? 'bg-green-50 text-green-700 border-green-200' :
                          t.paymentMethod === 'BANK_MISR' ? 'bg-red-50 text-red-700 border-red-200' :
                          t.paymentMethod === 'VF_CASH_AYMAN' || t.paymentMethod === 'VF_CASH_KYRILLOS' ? 'bg-red-100 text-red-800 border-red-200' :
                          'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {t.paymentMethod === 'BANK_AHLY' ? 'البنك الأهلي' :
                           t.paymentMethod === 'BANK_MISR' ? 'بنك مصر' :
                           t.paymentMethod === 'VF_CASH_AYMAN' ? 'فودافون أيمن' :
                           t.paymentMethod === 'VF_CASH_KYRILLOS' ? 'فودافون كيرلس' : 'خزنة كاش'}
                        </span>
                      </td>
                      <td className="p-3 text-gray-800 font-medium">{t.description}</td>
                      <td className="p-3 font-bold text-emerald-600">
                        {t.credit > 0 ? `${t.credit.toLocaleString()} ج.م` : '-'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Hint Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-500 text-sm">
        <div className="flex items-start gap-2 bg-blue-50 p-4 rounded-lg border border-blue-100">
          <CheckCircle size={16} className="mt-1 text-blue-500"/>
          <p>عند الحفظ، سيتم إضافة المبلغ المدخل إلى <strong>الحساب المختار (خزنة/بنك)</strong> كإيراد ويسمع فوراً في الخزنة.</p>
        </div>
        <div className="flex items-start gap-2 bg-blue-50 p-4 rounded-lg border border-blue-100">
          <CheckCircle size={16} className="mt-1 text-blue-500"/>
          <p>سيتم خصم المبلغ من مديونية العميل وتحديث كشف الحساب تلقائياً.</p>
        </div>
      </div>
    </div>
  );
};
