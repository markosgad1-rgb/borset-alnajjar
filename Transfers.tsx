
import React, { useState } from 'react';
import { useERP } from '../context/ERPContext';
import { ArrowRightLeft, Save, Search, AlertCircle, ArrowDownCircle, ArrowUpCircle, Users, Truck, Briefcase } from 'lucide-react';

export const Transfers: React.FC = () => {
  const { customers, suppliers, employees, addTransfer } = useERP();
  
  const [entityType, setEntityType] = useState<'CUSTOMER' | 'SUPPLIER' | 'EMPLOYEE'>('CUSTOMER');
  
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    amount: '',
    type: 'IN' as 'IN' | 'OUT',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [currentBalance, setCurrentBalance] = useState<number | null>(null);

  // Determine which list to use
  const activeList = entityType === 'CUSTOMER' 
    ? customers 
    : entityType === 'SUPPLIER' 
      ? suppliers 
      : employees;

  const handleNameChange = (name: string) => {
    const entity = activeList.find(e => e.name === name);
    if (entity) {
      setFormData(prev => ({ 
        ...prev, 
        name: name, 
        code: entity.code 
      }));
      setCurrentBalance(entity.balance);
    } else {
      setFormData(prev => ({ ...prev, name: name }));
      setCurrentBalance(null);
    }
  };

  const handleCodeChange = (code: string) => {
    const entity = activeList.find(e => e.code === code);
    if (entity) {
      setFormData(prev => ({ 
        ...prev, 
        code: code, 
        name: entity.name 
      }));
      setCurrentBalance(entity.balance);
    } else {
      setFormData(prev => ({ ...prev, code: code }));
      setCurrentBalance(null);
    }
  };

  const handleTypeToggle = (newType: 'CUSTOMER' | 'SUPPLIER' | 'EMPLOYEE') => {
    setEntityType(newType);
    setFormData(prev => ({ ...prev, code: '', name: '' }));
    setCurrentBalance(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(formData.amount);

    if (!formData.code || !formData.name) {
      alert('الرجاء اختيار الاسم');
      return;
    }
    if (amount <= 0) {
      alert('الرجاء إدخال قيمة صحيحة');
      return;
    }

    addTransfer({
      entityType: entityType,
      entityCode: formData.code,
      amount: amount,
      type: formData.type,
      date: formData.date,
      notes: formData.notes
    });

    setFormData(prev => ({
      ...prev,
      amount: '',
      notes: ''
    }));
    setCurrentBalance(null); 
    alert('تم حفظ عملية التحويل بنجاح');
  };

  // Helper text for UI
  const getEntityLabel = () => {
      if (entityType === 'CUSTOMER') return 'العميل';
      if (entityType === 'SUPPLIER') return 'المورد';
      return 'الموظف';
  };

  const getInLabel = () => {
      if (entityType === 'CUSTOMER') return 'استلام نقدية من عميل';
      if (entityType === 'SUPPLIER') return 'استلام نقدية من مورد (مرتجع)';
      return 'استرداد سلفة من موظف';
  };

  const getOutLabel = () => {
      if (entityType === 'CUSTOMER') return 'دفع نقدية لعميل';
      if (entityType === 'SUPPLIER') return 'دفع مستحقات لمورد';
      return 'صرف راتب / سلفة لموظف';
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-brand-100 overflow-hidden">
        <div className="p-6 bg-purple-600 text-white flex items-center gap-3">
          <ArrowRightLeft size={28} />
          <h2 className="text-xl font-bold">تسجيل التحويلات المالية (خزنة)</h2>
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

            {/* Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">اسم {getEntityLabel()}</label>
                <div className="relative">
                  <input 
                    type="text"
                    list="namesList"
                    required
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none pr-10"
                    placeholder="بحث بالاسم..."
                    value={formData.name}
                    onChange={e => handleNameChange(e.target.value)}
                  />
                  <Search className="absolute left-3 top-3.5 text-gray-400" size={18}/>
                  <datalist id="namesList">
                    {activeList.map(e => <option key={e.code} value={e.name} />)}
                  </datalist>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">الكود</label>
                <input 
                  type="text"
                  list="codesList"
                  required
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none font-mono bg-gray-50"
                  placeholder="Code"
                  value={formData.code}
                  onChange={e => handleCodeChange(e.target.value)}
                />
                <datalist id="codesList">
                   {activeList.map(e => <option key={e.code} value={e.code} />)}
                </datalist>
              </div>
            </div>

             {/* Balance Display */}
             {formData.name && currentBalance !== null && (
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
                            ? (currentBalance < 0 ? '(مستحقات له)' : '(سلف عليه)') 
                            : (currentBalance < 0 ? '(عليه/مديونية)' : '(له/رصيد)')
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
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    className="w-full p-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none font-bold text-xl"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={e => setFormData({...formData, amount: e.target.value})}
                  />
                  <span className="absolute left-3 top-4 text-gray-400 font-bold text-sm">ج.م</span>
                </div>
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
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg transition-all flex justify-center items-center gap-3"
              >
                <Save size={24} />
                حفظ التحويل
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};
