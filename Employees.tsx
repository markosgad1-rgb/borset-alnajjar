
import React, { useState, useEffect } from 'react';
import { useERP } from '../context/ERPContext';
import { UserPlus, FileText, Edit, Briefcase } from 'lucide-react';

export const Employees: React.FC = () => {
  const { employees, addEmployee, updateEmployee } = useERP();
  
  const [formData, setFormData] = useState({ code: '', name: '', role: '', salary: 0, balance: 0 });
  const [selectedEmployeeCode, setSelectedEmployeeCode] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingOldCode, setEditingOldCode] = useState<string | null>(null);

  const generateNextCode = () => {
    if (employees.length === 0) return 'E001';
    const maxId = employees.reduce((max, e) => {
      const num = parseInt(e.code.replace(/\D/g, ''));
      return !isNaN(num) && num > max ? num : max;
    }, 0);
    return `E${(maxId + 1).toString().padStart(3, '0')}`;
  };

  useEffect(() => {
    if (!isEditing) {
      setFormData(prev => ({ ...prev, code: generateNextCode() }));
    }
  }, [employees, isEditing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.code && formData.name) {
      if (isEditing && editingOldCode) {
        updateEmployee(editingOldCode, { 
          code: formData.code, 
          name: formData.name, 
          role: formData.role,
          salary: Number(formData.salary),
          balance: Number(formData.balance) 
        });
        handleCancelEdit();
      } else {
        if (employees.some(e => e.code === formData.code)) {
          alert('هذا الكود مستخدم بالفعل لموظف آخر!');
          return;
        }
        addEmployee({ ...formData, salary: Number(formData.salary), balance: Number(formData.balance), history: [] });
        setFormData({ code: '', name: '', role: '', salary: 0, balance: 0 });
      }
    }
  };

  const handleEditClick = (e: React.MouseEvent, employee: any) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditingOldCode(employee.code);
    setFormData({
      code: employee.code,
      name: employee.name,
      role: employee.role,
      salary: employee.salary,
      balance: employee.balance
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingOldCode(null);
    setFormData({ code: generateNextCode(), name: '', role: '', salary: 0, balance: 0 });
  };

  const selectedEmployee = employees.find(e => e.code === selectedEmployeeCode);

  return (
    <div className="space-y-8">
      
      {/* Add/Edit Employee Section */}
      <div className={`p-6 rounded-xl shadow-sm border transition-colors duration-300 ${isEditing ? 'bg-teal-50 border-teal-200' : 'bg-white border-brand-100'}`}>
        <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${isEditing ? 'text-teal-800' : 'text-brand-800'}`}>
          {isEditing ? <Edit size={20} /> : <Briefcase size={20} />} 
          {isEditing ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}
        </h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="md:col-span-1">
            <label className="block text-sm text-gray-600 mb-1">كود الموظف</label>
            <input 
              type="text" 
              required
              className={`w-full p-2 border rounded-lg outline-none focus:border-brand-500 font-mono font-bold ${isEditing ? 'bg-white border-teal-300' : 'bg-gray-50'}`}
              value={formData.code}
              onChange={e => setFormData({...formData, code: e.target.value})}
              placeholder="تلقائي"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-600 mb-1">اسم الموظف</label>
            <input 
              type="text" 
              required
              className="w-full p-2 border rounded-lg outline-none focus:border-brand-500"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              placeholder="اسم الموظف"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-600 mb-1">الوظيفة</label>
            <input 
              type="text" 
              className="w-full p-2 border rounded-lg outline-none focus:border-brand-500"
              value={formData.role}
              onChange={e => setFormData({...formData, role: e.target.value})}
              placeholder="مثال: سائق، محاسب"
            />
          </div>
          <div className="md:col-span-1">
            <label className="block text-sm text-gray-600 mb-1">الراتب الشهري</label>
            <input 
              type="number" 
              className="w-full p-2 border rounded-lg outline-none focus:border-brand-500"
              value={formData.salary}
              onChange={e => setFormData({...formData, salary: Number(e.target.value)})}
            />
          </div>
          <div className="md:col-span-2">
             <label className="block text-sm text-gray-600 mb-1">{isEditing ? 'تعديل الرصيد الحالي' : 'رصيد افتتاحي'}</label>
             <div className="relative">
               <input 
                type="number" 
                className="w-full p-2 border rounded-lg outline-none focus:border-brand-500"
                value={formData.balance}
                onChange={e => setFormData({...formData, balance: Number(e.target.value)})}
              />
              <span className="absolute left-2 top-2 text-xs text-gray-400 pointer-events-none">
                (سالب = مستحقات له)
              </span>
             </div>
          </div>
          <div className="md:col-span-2 flex gap-2">
            <button type="submit" className={`flex-1 px-6 py-2.5 rounded-lg font-bold text-white transition-colors shadow-sm ${isEditing ? 'bg-teal-600 hover:bg-teal-700' : 'bg-brand-600 hover:bg-brand-700'}`}>
              {isEditing ? 'حفظ التعديلات' : 'إضافة'}
            </button>
            {isEditing && (
              <button type="button" onClick={handleCancelEdit} className="bg-white text-gray-600 border border-gray-300 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                إلغاء
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-brand-100 overflow-hidden">
          <div className="p-4 bg-brand-50 border-b border-brand-100">
            <h3 className="font-bold text-brand-800">قائمة الموظفين</h3>
          </div>
          <div className="overflow-y-auto max-h-[500px]">
            <ul className="divide-y divide-gray-100">
              {employees.map(e => (
                <li 
                  key={e.code} 
                  onClick={() => setSelectedEmployeeCode(e.code)}
                  className={`p-4 cursor-pointer hover:bg-brand-50 transition-colors flex justify-between items-center group
                    ${selectedEmployeeCode === e.code ? 'bg-brand-50 border-r-4 border-brand-500' : ''}
                  `}
                >
                  <div className="flex-1">
                    <p className="font-bold text-gray-800">{e.name}</p>
                    <p className="text-xs text-gray-500">{e.role} - #{e.code}</p>
                  </div>
                  <div className="text-left flex items-center gap-3">
                    <div>
                      <p className={`font-bold text-sm ${e.balance < 0 ? 'text-red-600' : e.balance > 0 ? 'text-green-600' : 'text-gray-600'}`} dir="ltr">
                        {e.balance.toLocaleString()}
                      </p>
                    </div>
                    <button 
                      onClick={(e) => handleEditClick(e, e)}
                      className="opacity-0 group-hover:opacity-100 p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-all"
                    >
                      <Edit size={16} />
                    </button>
                  </div>
                </li>
              ))}
              {employees.length === 0 && (
                <li className="p-4 text-center text-gray-400 text-sm">لا يوجد موظفين</li>
              )}
            </ul>
          </div>
        </div>

        {/* Ledger Details */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-brand-100 p-6 min-h-[400px]">
           {selectedEmployee ? (
             <div className="space-y-6">
                <div className="flex justify-between items-start border-b pb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-brand-900 flex items-center gap-3">
                      {selectedEmployee.name}
                      <button 
                        onClick={(e) => handleEditClick(e, selectedEmployee)}
                        className="text-sm font-normal bg-gray-100 text-gray-600 hover:bg-gray-200 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                      >
                        <Edit size={14}/> تعديل
                      </button>
                    </h2>
                    <div className="flex gap-2 mt-1">
                        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-mono">#{selectedEmployee.code}</span>
                        <span className="bg-teal-100 text-teal-700 px-2 py-1 rounded text-xs font-bold">{selectedEmployee.role}</span>
                    </div>
                  </div>
                  <div className="text-left bg-brand-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-500">الرصيد الحالي</p>
                    <p className={`text-2xl font-bold ${selectedEmployee.balance < 0 ? 'text-red-600' : selectedEmployee.balance > 0 ? 'text-green-600' : 'text-gray-800'}`} dir="ltr">
                      {selectedEmployee.balance.toLocaleString()} ج.م
                    </p>
                    <p className="text-xs text-gray-400">
                      {selectedEmployee.balance < 0 ? '(مستحقات له)' : selectedEmployee.balance > 0 ? '(سلفة عليه)' : 'متزن'}
                    </p>
                  </div>
                </div>

                <div className="bg-blue-50 p-3 rounded text-blue-800 text-sm font-bold mb-4 flex justify-between">
                    <span>الراتب الأساسي المسجل:</span>
                    <span>{selectedEmployee.salary.toLocaleString()} ج.م</span>
                </div>

                <div>
                  <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <FileText size={18} /> سجل الرواتب والسلف
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                      <thead className="bg-gray-50 text-gray-600 border-y">
                        <tr>
                          <th className="p-3">التاريخ</th>
                          <th className="p-3 w-1/3">البيان</th>
                          <th className="p-3 text-red-600">مستحق له (راتب)</th>
                          <th className="p-3 text-green-600">مدفوع له (صرف/سلفة)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedEmployee.history.length === 0 ? (
                          <tr><td colSpan={4} className="p-4 text-center text-gray-400">لا توجد حركات مسجلة</td></tr>
                        ) : (
                          selectedEmployee.history.map((h, idx) => {
                            // Employee Logic:
                            // Negative Amount = Liability Increases (Salary Due) or Payment Received?
                            // Let's trace Context:
                            // OUT (We pay him) -> Balance +Amount. (Reduces Negative or Adds Positive).
                            // So Positive Amount in history = We Paid Him (Cash Out).
                            // Negative Amount in history = He Paid Us (Rare) OR We set salary due (Not implemented yet as auto, but logically).
                            
                            // Based on current Transfers Context:
                            // OUT (Payment) -> +Amount.
                            // IN (Collection) -> -Amount.
                            
                            const isPaymentToEmployee = h.amount > 0;
                            const isReturnFromEmployee = h.amount < 0;

                            return (
                              <tr key={idx}>
                                <td className="p-3 text-gray-600 whitespace-nowrap">{h.date}</td>
                                <td className="p-3 font-medium text-gray-800">{h.description}</td>
                                <td className="p-3 font-bold text-red-600 bg-red-50/30">
                                  {isReturnFromEmployee ? Math.abs(h.amount).toLocaleString() : '-'}
                                </td>
                                <td className="p-3 font-bold text-green-600 bg-green-50/30">
                                  {isPaymentToEmployee ? h.amount.toLocaleString() : '-'}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
             </div>
           ) : (
             <div className="h-full flex flex-col items-center justify-center text-gray-400">
               <Briefcase size={48} className="mb-4 opacity-50"/>
               <p>اختر موظف لعرض التفاصيل</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};
