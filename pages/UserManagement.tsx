
import React, { useState } from 'react';
import { useERP } from '../context/ERPContext';
import { Shield, UserPlus, Trash2, Edit, Check, X, Database, Loader2, Upload, Image as ImageIcon, Eye, Lock } from 'lucide-react';
import { User, UserPermissions } from '../types';
import { BackupModal } from '../components/BackupModal';
import { useBackHandler } from '../utils/backNavigation';

const initialPermissions: UserPermissions = {
  canViewSales: false,
  canViewInvoicesLog: false,
  canViewPurchases: false,
  canViewInventory: false,
  canViewCustomers: false,
  canViewSuppliers: false,
  canViewTreasury: false,
  canViewReports: false,
  canDeleteInvoices: false,
  canDeleteCustomers: false,
  canDeleteSuppliers: false,
  canEditPrices: false,
  canEditInvoices: false,
  canManageBackup: false,
  admin: false,
  dashboard: false,
  sales: false,
  warehouse: false,
  financial: false,
  canDeleteLedgers: false,
  canEditWarehouse: false,
  canManageTreasury: false,
  canEditPurchases: false,
};

export const UserManagement: React.FC = () => {
  const { users, addUser, updateUser, deleteUser, currentUser, seedDatabase, updateSystemLogo, companyLogo } = useERP();
  
  const canManageBackup = currentUser?.role === 'ADMIN' || currentUser?.username === 'admin' || Boolean(currentUser?.permissions?.canManageBackup);

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  
  // Inline delete confirmation state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);

  // Hardware Back button handlers
  useBackHandler(() => setIsBackupModalOpen(false), isBackupModalOpen, 'user-mgmt-backup-modal');
  useBackHandler(() => setDeleteConfirmId(null), !!deleteConfirmId, 'user-mgmt-delete-confirm');
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullName: '',
    role: 'USER' as 'ADMIN' | 'USER',
    permissions: initialPermissions
  });

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      fullName: '',
      role: 'USER',
      permissions: initialPermissions
    });
    setIsEditing(false);
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalRole = formData.permissions.admin ? 'ADMIN' : formData.role;
    
    if (isEditing && editingId) {
      const target = users.find(u => u.id === editingId);
      if (editingId === '1' || target?.username === 'admin') {
        alert('حساب الأدمن الأساسي محمي ولا يمكن تعديل بياناته أو كلمة مروره.');
        resetForm();
        return;
      }
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
    if (user.username === 'admin') {
      alert('حساب الأدمن الأساسي محمي ولا يمكن تعديل بياناته أو كلمة مروره.');
      return;
    }
    setIsEditing(true);
    setEditingId(user.id);
    const userPerms = user.permissions || {};
    setFormData({
      username: user.username,
      password: user.password,
      fullName: user.fullName,
      role: user.role,
      permissions: {
        canViewSales: Boolean(userPerms.canViewSales ?? userPerms.sales),
        canViewInvoicesLog: Boolean(userPerms.canViewInvoicesLog ?? userPerms.sales),
        canViewPurchases: Boolean(userPerms.canViewPurchases ?? userPerms.warehouse),
        canViewInventory: Boolean(userPerms.canViewInventory ?? userPerms.warehouse),
        canViewCustomers: Boolean(userPerms.canViewCustomers ?? userPerms.sales),
        canViewSuppliers: Boolean(userPerms.canViewSuppliers ?? userPerms.warehouse),
        canViewTreasury: Boolean(userPerms.canViewTreasury ?? userPerms.financial),
        canViewReports: Boolean(userPerms.canViewReports ?? (userPerms.dashboard || userPerms.financial)),
        canDeleteInvoices: Boolean(userPerms.canDeleteInvoices ?? userPerms.admin),
        canDeleteCustomers: Boolean(userPerms.canDeleteCustomers ?? userPerms.admin),
        canDeleteSuppliers: Boolean(userPerms.canDeleteSuppliers ?? userPerms.admin),
        canEditPrices: Boolean(userPerms.canEditPrices ?? userPerms.admin),
        canEditInvoices: Boolean(userPerms.canEditInvoices ?? userPerms.admin),
        canManageBackup: Boolean(userPerms.canManageBackup ?? userPerms.admin),
        admin: Boolean(userPerms.admin || user.role === 'ADMIN'),
        dashboard: Boolean(userPerms.dashboard),
        sales: Boolean(userPerms.sales),
        warehouse: Boolean(userPerms.warehouse),
        financial: Boolean(userPerms.financial),
        canDeleteLedgers: Boolean(userPerms.canDeleteLedgers),
        canEditWarehouse: Boolean(userPerms.canEditWarehouse),
        canManageTreasury: Boolean(userPerms.canManageTreasury),
        canEditPurchases: Boolean(userPerms.canEditPurchases),
      }
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const initiateDelete = (id: string) => {
    const target = users.find(u => u.id === id);
    if (id === '1' || target?.username === 'admin') {
      alert('لا يمكن حذف حساب الأدمن الأساسي (admin).');
      return;
    }
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

  const handlePermissionChange = (key: keyof UserPermissions) => {
    setFormData(prev => {
      const nextVal = !prev.permissions[key];
      const updated: UserPermissions = {
        ...prev.permissions,
        [key]: nextVal
      };

      if (key === 'admin' && nextVal) {
        updated.canViewSales = true;
        updated.canViewInvoicesLog = true;
        updated.canViewPurchases = true;
        updated.canViewInventory = true;
        updated.canViewCustomers = true;
        updated.canViewSuppliers = true;
        updated.canViewTreasury = true;
        updated.canViewReports = true;
        updated.canDeleteInvoices = true;
        updated.canDeleteCustomers = true;
        updated.canDeleteSuppliers = true;
        updated.canEditPrices = true;
        updated.canEditInvoices = true;
        updated.canManageBackup = true;
      }
      return {
        ...prev,
        permissions: updated
      };
    });
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
      
      {/* Header with Backup & Seed Button */}
      <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-brand-100 gap-4">
        <h2 className="text-xl font-bold text-brand-800 flex items-center gap-2">
           <Shield className="text-brand-600" /> إدارة المستخدمين والإعدادات
        </h2>
        <div className="flex items-center gap-2.5 flex-wrap">
          {canManageBackup && (
            <button 
              type="button"
              onClick={() => setIsBackupModalOpen(true)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-brand-950 font-black rounded-lg text-sm flex items-center gap-2 transition-colors shadow-xs"
            >
              <Database size={16} /> النسخ الاحتياطي والاسترجاع
            </button>
          )}


        </div>
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

          <div className="space-y-6">
            {/* القسم الأول: صلاحيات الوصول للصفحات */}
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="text-blue-600" size={18} />
                <h4 className="text-sm font-bold text-gray-800">
                  القسم الأول: صلاحيات الوصول للصفحات (تظهر في القائمة الجانبية فقط الصفحات الممنوحة)
                </h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-lg border border-gray-200 hover:border-blue-400 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={formData.permissions.canViewSales}
                    onChange={() => handlePermissionChange('canViewSales')}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="font-semibold text-gray-800 text-sm">فواتير البيع (canViewSales)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-lg border border-gray-200 hover:border-blue-400 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={formData.permissions.canViewInvoicesLog}
                    onChange={() => handlePermissionChange('canViewInvoicesLog')}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="font-semibold text-gray-800 text-sm">سجل الفواتير (canViewInvoicesLog)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-lg border border-gray-200 hover:border-blue-400 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={formData.permissions.canViewPurchases}
                    onChange={() => handlePermissionChange('canViewPurchases')}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="font-semibold text-gray-800 text-sm">المشتريات (canViewPurchases)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-lg border border-gray-200 hover:border-blue-400 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={formData.permissions.canViewInventory}
                    onChange={() => handlePermissionChange('canViewInventory')}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="font-semibold text-gray-800 text-sm">المخزن والجرد (canViewInventory)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-lg border border-gray-200 hover:border-blue-400 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={formData.permissions.canViewCustomers}
                    onChange={() => handlePermissionChange('canViewCustomers')}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="font-semibold text-gray-800 text-sm">العملاء (canViewCustomers)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-lg border border-gray-200 hover:border-blue-400 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={formData.permissions.canViewSuppliers}
                    onChange={() => handlePermissionChange('canViewSuppliers')}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="font-semibold text-gray-800 text-sm">الموردين (canViewSuppliers)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-lg border border-gray-200 hover:border-blue-400 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={formData.permissions.canViewTreasury}
                    onChange={() => handlePermissionChange('canViewTreasury')}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="font-semibold text-gray-800 text-sm">الخزينة والمصروفات (canViewTreasury)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-lg border border-gray-200 hover:border-blue-400 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={formData.permissions.canViewReports}
                    onChange={() => handlePermissionChange('canViewReports')}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="font-semibold text-gray-800 text-sm">التقارير (canViewReports)</span>
                </label>
              </div>
            </div>

            {/* القسم الثاني: صلاحيات الإجراءات الحساسة */}
            <div className="bg-red-50/50 p-5 rounded-xl border border-red-200">
              <div className="flex items-center gap-2 mb-3">
                <Lock className="text-red-600" size={18} />
                <h4 className="text-sm font-bold text-gray-800">
                  القسم الثاني: صلاحيات الإجراءات الحساسة (الحذف والتعديل)
                </h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-lg border border-red-200 hover:border-red-400 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={formData.permissions.canDeleteInvoices}
                    onChange={() => handlePermissionChange('canDeleteInvoices')}
                    className="w-5 h-5 text-red-600 rounded focus:ring-red-500"
                  />
                  <span className="font-semibold text-red-700 text-sm">حذف فواتير البيع</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-lg border border-red-200 hover:border-red-400 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={formData.permissions.canDeleteCustomers}
                    onChange={() => handlePermissionChange('canDeleteCustomers')}
                    className="w-5 h-5 text-red-600 rounded focus:ring-red-500"
                  />
                  <span className="font-semibold text-red-700 text-sm">حذف العملاء</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-lg border border-red-200 hover:border-red-400 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={formData.permissions.canDeleteSuppliers}
                    onChange={() => handlePermissionChange('canDeleteSuppliers')}
                    className="w-5 h-5 text-red-600 rounded focus:ring-red-500"
                  />
                  <span className="font-semibold text-red-700 text-sm">حذف الموردين</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-lg border border-amber-200 hover:border-amber-400 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={formData.permissions.canEditPrices}
                    onChange={() => handlePermissionChange('canEditPrices')}
                    className="w-5 h-5 text-amber-600 rounded focus:ring-amber-500"
                  />
                  <span className="font-semibold text-amber-800 text-sm">تعديل أسعار البيع والتكلفة</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-lg border border-purple-200 hover:border-purple-400 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={formData.permissions.canEditInvoices}
                    onChange={() => handlePermissionChange('canEditInvoices')}
                    className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <span className="font-semibold text-purple-800 text-sm">تعديل الفواتير السابقة</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-lg border border-amber-300 hover:border-amber-500 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={formData.permissions.canManageBackup}
                    onChange={() => handlePermissionChange('canManageBackup')}
                    className="w-5 h-5 text-amber-600 rounded focus:ring-amber-500"
                  />
                  <span className="font-semibold text-amber-900 text-sm">النسخ الاحتياطي والاسترجاع (canManageBackup)</span>
                </label>
              </div>
            </div>

            {/* مدير نظام كامل */}
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-300">
              <label className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={formData.permissions.admin}
                  onChange={() => handlePermissionChange('admin')}
                  className="w-6 h-6 text-brand-700 rounded focus:ring-brand-500"
                />
                <div>
                  <span className="font-bold text-brand-900 block">مدير نظام كامل (Full Admin)</span>
                  <span className="text-xs text-gray-600">يمنح جميع صلاحيات الوصول والإجراءات الحساسة بدون أي قيود</span>
                </div>
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
              {users
                .filter((u) => currentUser?.username === 'admin' || u.username !== 'admin')
                .map(user => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="p-4 font-bold text-gray-800">{user.fullName}</td>
                  <td className="p-4 text-gray-600">{user.username}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${user.role === 'ADMIN' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                      {user.role === 'ADMIN' ? 'مسؤول' : 'مستخدم'}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-gray-500">
                    <div className="flex gap-1 flex-wrap max-w-md">
                       {(user.role === 'ADMIN' || user.permissions.admin) ? (
                         <span className="bg-red-50 text-red-700 font-bold px-2.5 py-1 rounded border border-red-200 text-xs">صلاحيات كاملة (Admin)</span>
                       ) : (
                         <>
                           {user.permissions.canViewSales && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 text-xs">فواتير البيع</span>}
                           {user.permissions.canViewInvoicesLog && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 text-xs">سجل الفواتير</span>}
                           {user.permissions.canViewPurchases && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 text-xs">المشتريات</span>}
                           {user.permissions.canViewInventory && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 text-xs">المخزن والجرد</span>}
                           {user.permissions.canViewCustomers && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 text-xs">العملاء</span>}
                           {user.permissions.canViewSuppliers && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 text-xs">الموردين</span>}
                           {user.permissions.canViewTreasury && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 text-xs">الخزينة</span>}
                           {user.permissions.canViewReports && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 text-xs">التقارير</span>}
                           {user.permissions.canDeleteInvoices && <span className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded border border-red-200 text-xs">حذف فواتير</span>}
                           {user.permissions.canDeleteCustomers && <span className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded border border-red-200 text-xs">حذف عملاء</span>}
                           {user.permissions.canDeleteSuppliers && <span className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded border border-red-200 text-xs">حذف موردين</span>}
                           {user.permissions.canEditPrices && <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200 text-xs">تعديل أسعار</span>}
                           {user.permissions.canEditInvoices && <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 text-xs">تعديل فواتير</span>}
                           {user.permissions.canManageBackup && <span className="bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded border border-amber-300 text-xs font-bold">نسخ احتياطي</span>}
                         </>
                       )}
                    </div>
                  </td>
                  <td className="p-4">
                    {user.username === 'admin' ? (
                      <span className="inline-block text-xs bg-amber-50 text-amber-800 border border-amber-200 font-bold px-2.5 py-1 rounded-md">
                        حساب نظام محمي
                      </span>
                    ) : deleteConfirmId === user.id ? (
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

      {/* Backup & Restore Modal */}
      <BackupModal 
        isOpen={isBackupModalOpen} 
        onClose={() => setIsBackupModalOpen(false)} 
      />
    </div>
  );
};
