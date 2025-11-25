
import React, { useState } from 'react';
import { useERP } from '../context/ERPContext';
import { Shield, UserPlus, Trash2, Edit, Check, X, Database, Loader2, Upload, Image as ImageIcon } from 'lucide-react';
import { User } from '../types';

export const UserManagement: React.FC = () => {
  const { users, addUser, updateUser, deleteUser, currentUser, seedDatabase, updateSystemLogo, companyLogo } = useERP();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  
  // Inline delete confirmation state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullName: '',
    role: 'USER' as 'ADMIN' | 'USER',
    permissions: {
      dashboard: false,
      sales: false,
      warehouse: false,
      financial: false,
      admin: false,
      canDeleteLedgers: false,
      canEditWarehouse: false, // New
      canManageTreasury: false // New
    }
  });

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      fullName: '',
      role: 'USER',
      permissions: { 
        dashboard: false, sales: false, warehouse: false, financial: false, admin: false, canDeleteLedgers: false,
        canEditWarehouse: false, canManageTreasury: false
      }
    });
    setIsEditing(false);
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalRole = formData.permissions.admin ? 'ADMIN' : formData.role;
    
    if (isEditing && editingId) {
      updateUser(editingId, { ...formData, role: finalRole });
    } else {
      if (users.some(u => u.username === formData.username)) {
        alert('اسم المستخدم موجود بالفعل');
        return;
      }
      addUser({
        id: Date.now().toString(),
        ...formData,
        role: finalRole
      });
    }
    resetForm();
  };

  const handleEditClick = (user: User) => {
    setIsEditing(true);
    setEditingId(user.id);
    setFormData({
      username: user.username,
      password: user.password,
      fullName: user.fullName,
      role: user.role,
      permissions: { 
        dashboard: user.permissions.dashboard || false,
        sales: user.permissions.sales,
        warehouse: user.permissions.warehouse,
        financial: user.permissions.financial,
        admin: user.permissions.admin,
        canDeleteLedgers: user.permissions.canDeleteLedgers || false,
        canEditWarehouse: user.permissions.canEditWarehouse || false,
        canManageTreasury: user.permissions.canManageTreasury || false
      }
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const initiateDelete = (id: string) => {
    if (id === currentUser?.id) {
      alert('لا يمكنك حذف حسابك الحالي');
      return;
    }
    setDeleteConfirmId(id);
  };

  const confirmDelete = async (id: string) => {
    setLoadingActionId(id);
    const success = await deleteUser(id);
    setLoadingActionId(null);
    
    if (success) {
      alert("تم الحذف بنجاح");
      setDeleteConfirmId(null);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmId(null);
  };

  const handlePermissionChange = (key: keyof typeof formData.permissions) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [key]: !prev.permissions[key]
      }
    }));
  };

  const handleSeedClick = async () => {
    setIsSeeding(true);
    try {
      await seedDatabase();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        await updateSystemLogo(base64String);
        alert("تم تحديث لوجو الشركة بنجاح! سيظهر الآن في جميع الفواتير.");
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-8">
      
      {/* Header with Seed Button */}
      <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-brand-100 gap-4">
        <h2 className="text-xl font-bold text-brand-800 flex items-center gap-2">
           <Shield className="text-brand-600" /> إدارة المستخدمين والإعدادات
        </h2>
        {currentUser?.role === 'ADMIN' && (
           <button 
             onClick={handleSeedClick}
             disabled={isSeeding}
             className={`
               px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors
               ${isSeeding ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-orange-100 text-orange-700 hover:bg-orange-200'}
             `}
           >
             {isSeeding ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
             {isSeeding ? 'جاري الاتصال بالسيرفر...' : 'إنشاء بيانات تجريبية (للبدء)'}
           </button>
        )}
      </div>

      {/* System Settings (Logo) - Only for Admins */}
      {currentUser?.role === 'ADMIN' && (
        <div className="bg-white rounded-xl shadow-sm border border-brand-100 p-6">
          <h3 className="text-lg font-bold text-brand-800 mb-4 flex items-center gap-2">
            <ImageIcon size={20} /> إعدادات النظام (اللوجو)
          </h3>
          <div className="flex items-center gap-6">
             <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 flex flex-col items-center justify-center w-40 h-40 bg-gray-50 relative overflow-hidden">
                {companyLogo ? (
                  <img src={companyLogo} alt="Company Logo" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-gray-400 text-xs text-center">لا يوجد لوجو</span>
                )}
             </div>
             <div>
               <p className="text-sm text-gray-600 mb-2">قم برفع لوجو الشركة ليظهر في الفواتير المطبوعة.</p>
               <label className="cursor-pointer bg-brand-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-brand-700 transition-colors flex items-center gap-2 w-fit">
                 <Upload size={18} /> رفع صورة اللوجو
                 <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
               </label>
             </div>
          </div>
        </div>
      )}

      {/* Add/Edit Form */}
      <div className="bg-white rounded-xl shadow-sm border border-brand-100 p-6">
        <div className="flex items-center gap-3 mb-6 border-b pb-4">
          <UserPlus className="text-brand-600" size={24} />
          <h3 className="text-xl font-bold text-brand-800">
            {isEditing ? 'تعديل بيانات المستخدم' : 'إضافة مستخدم جديد'}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">اسم المستخدم (للدخول)</label>
              <input 
                type="text" 
                required
                className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                value={formData.username}
                onChange={e => setFormData({...formData, username: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">كلمة المرور</label>
              <input 
                type="text" 
                required
                className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none font-mono"
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">الاسم الكامل (للعرض)</label>
              <input 
                type="text" 
                required
                className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                value={formData.fullName}
                onChange={e => setFormData({...formData, fullName: e.target.value})}
              />
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <label className="block text-sm font-bold text-gray-800 mb-3">الصلاحيات الممنوحة</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-lg border border-gray-200 hover:border-brand-400 transition-colors">
                <input 
                  type="checkbox" 
                  checked={formData.permissions.dashboard}
                  onChange={() => handlePermissionChange('dashboard')}
                  className="w-5 h-5 text-brand-600 rounded focus:ring-brand-500"
                />
                <span className="font-medium">الرئيسية (Dashboard)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-lg border border-gray-200 hover:border-brand-400 transition-colors">
                <input 
                  type="checkbox" 
                  checked={formData.permissions.sales}
                  onChange={() => handlePermissionChange('sales')}
                  className="w-5 h-5 text-brand-600 rounded focus:ring-brand-500"
                />
                <span className="font-medium">مبيعات وعملاء</span>
              </label>
              
              <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-lg border border-gray-200 hover:border-brand-400 transition-colors">
                <input 
                  type="checkbox" 
                  checked={formData.permissions.warehouse}
                  onChange={() => handlePermissionChange('warehouse')}
                  className="w-5 h-5 text-brand-600 rounded focus:ring-brand-500"
                />
                <span className="font-medium">مخازن ومشتريات</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-lg border border-gray-200 hover:border-brand-400 transition-colors">
                <input 
                  type="checkbox" 
                  checked={formData.permissions.financial}
                  onChange={() => handlePermissionChange('financial')}
                  className="w-5 h-5 text-brand-600 rounded focus:ring-brand-500"
                />
                <span className="font-medium">حسابات وخزنة</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-lg border border-gray-200 hover:border-brand-400 transition-colors">
                <input 
                  type="checkbox" 
                  checked={formData.permissions.canDeleteLedgers}
                  onChange={() => handlePermissionChange('canDeleteLedgers')}
                  className="w-5 h-5 text-red-600 rounded focus:ring-red-500"
                />
                <span className="font-bold text-red-700">حذف كشوف الحسابات</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-lg border border-gray-200 hover:border-brand-400 transition-colors">
                <input 
                  type="checkbox" 
                  checked={formData.permissions.canEditWarehouse}
                  onChange={() => handlePermissionChange('canEditWarehouse')}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="font-medium text-blue-700">تعديل المخزن (أصناف)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-lg border border-gray-200 hover:border-brand-400 transition-colors">
                <input 
                  type="checkbox" 
                  checked={formData.permissions.canManageTreasury}
                  onChange={() => handlePermissionChange('canManageTreasury')}
                  className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                />
                <span className="font-medium text-green-700">إدارة رصيد الخزنة</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer bg-red-50 p-3 rounded-lg border border-red-200 hover:border-red-400 transition-colors md:col-span-full xl:col-span-1">
                <input 
                  type="checkbox" 
                  checked={formData.permissions.admin}
                  onChange={() => handlePermissionChange('admin')}
                  className="w-5 h-5 text-red-600 rounded focus:ring-red-500"
                />
                <span className="font-bold text-red-700">مدير نظام (كامل)</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3">
            <button 
              type="submit" 
              className={`flex-1 py-3 rounded-lg font-bold text-white shadow-sm transition-colors flex justify-center items-center gap-2
                ${isEditing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-brand-600 hover:bg-brand-700'}
              `}
            >
              {isEditing ? <><Edit size={20}/> حفظ التعديلات</> : <><UserPlus size={20}/> إضافة المستخدم</>}
            </button>
            
            {isEditing && (
               <button 
                 type="button"
                 onClick={resetForm}
                 className="px-6 py-3 bg-white border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition-colors"
               >
                 إلغاء
               </button>
            )}
          </div>
        </form>
      </div>

      {/* Users List */}
      <div className="bg-white rounded-xl shadow-sm border border-brand-100 overflow-hidden">
        <div className="p-6 border-b border-brand-50">
          <h3 className="text-lg font-bold text-brand-800">المستخدمين المسجلين</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-brand-50 text-brand-700">
              <tr>
                <th className="p-4">الاسم الكامل</th>
                <th className="p-4">اسم المستخدم</th>
                <th className="p-4">الدور</th>
                <th className="p-4">الصلاحيات</th>
                <th className="p-4">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="p-4 font-bold text-gray-800">{user.fullName}</td>
                  <td className="p-4 text-gray-600">{user.username}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${user.role === 'ADMIN' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                      {user.role === 'ADMIN' ? 'مسؤول' : 'مستخدم'}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-gray-500">
                    <div className="flex gap-1 flex-wrap">
                       {user.permissions.dashboard && <span className="bg-gray-100 px-2 rounded border">الرئيسية</span>}
                       {user.permissions.sales && <span className="bg-gray-100 px-2 rounded border">مبيعات</span>}
                       {user.permissions.warehouse && <span className="bg-gray-100 px-2 rounded border">مخازن</span>}
                       {user.permissions.financial && <span className="bg-gray-100 px-2 rounded border">مالية</span>}
                       {user.permissions.canDeleteLedgers && <span className="bg-red-50 text-red-700 px-2 rounded border border-red-100">تصفير</span>}
                       {user.permissions.canEditWarehouse && <span className="bg-blue-50 text-blue-700 px-2 rounded border border-blue-100">تعديل أصناف</span>}
                       {user.permissions.canManageTreasury && <span className="bg-green-50 text-green-700 px-2 rounded border border-green-100">إدارة خزنة</span>}
                       {user.permissions.admin && <span className="bg-red-50 text-red-600 px-2 rounded border border-red-100">إدارة</span>}
                    </div>
                  </td>
                  <td className="p-4">
                    {deleteConfirmId === user.id ? (
                       <div className="flex items-center gap-2 bg-red-50 p-2 rounded animate-fade-in">
                         {loadingActionId === user.id ? (
                            <span className="text-red-600 text-xs font-bold flex items-center gap-1">
                              <Loader2 size={14} className="animate-spin" /> جاري الحذف...
                            </span>
                         ) : (
                           <>
                             <span className="text-xs text-red-600 font-bold">حذف؟</span>
                             <button onClick={() => confirmDelete(user.id)} className="bg-red-600 text-white p-1.5 rounded hover:bg-red-700 transition-colors" title="تأكيد">
                               <Check size={16} />
                             </button>
                             <button onClick={cancelDelete} className="bg-white text-gray-600 p-1.5 rounded border hover:bg-gray-100 transition-colors" title="إلغاء">
                               <X size={16} />
                             </button>
                           </>
                         )}
                       </div>
                    ) : (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleEditClick(user)} 
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="تعديل"
                        >
                          <Edit size={18} />
                        </button>
                        <button 
                          onClick={() => initiateDelete(user.id)} 
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="حذف"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    )}
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
