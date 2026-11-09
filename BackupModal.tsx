import React, { useState, useRef } from 'react';
import { useERP } from '../context/ERPContext';
import { SystemBackup } from '../types';
import { 
  Database, 
  Download, 
  Upload, 
  CheckCircle, 
  AlertTriangle, 
  X, 
  FileJson, 
  Users, 
  Truck, 
  FileText, 
  ShoppingCart, 
  Wallet, 
  Package, 
  Loader2,
  Calendar,
  UserCheck,
  RotateCcw,
  FileCheck
} from 'lucide-react';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({ isOpen, onClose }) => {
  const { 
    customers, 
    suppliers, 
    invoices, 
    purchases, 
    products, 
    treasury, 
    employees, 
    exportBackupData, 
    restoreBackupData,
    currentUser
  } = useERP();

  const canManageBackup = currentUser?.role === 'ADMIN' || currentUser?.username === 'admin' || Boolean(currentUser?.permissions?.canManageBackup);

  const [activeTab, setActiveTab] = useState<'EXPORT' | 'RESTORE'>('RESTORE');
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [parsedBackup, setParsedBackup] = useState<SystemBackup | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<{ success: boolean; message: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !canManageBackup) return null;

  const handleExport = () => {
    if (!canManageBackup) {
      alert('ليس لديك صلاحية تصدير النسخ الاحتياطي.');
      return;
    }
    try {
      exportBackupData();
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (e: any) {
      alert('حدث خطأ أثناء تحميل النسخة الاحتياطية: ' + e.message);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParseError(null);
    setRestoreResult(null);
    setShowConfirmDialog(false);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawContent = event.target?.result as string;
        if (!rawContent || !rawContent.trim()) {
          throw new Error('الملف المختار فارغ تماماً.');
        }

        // Clean UTF-8 BOM if present and trim
        const cleanContent = rawContent.replace(/^\uFEFF/, '').trim();
        const json = JSON.parse(cleanContent);

        if (!json || typeof json !== 'object') {
          throw new Error('محتوى الملف غير صالح أو ليس بصيغة JSON.');
        }

        // Extract data payload whether wrapped in .data or directly at root
        const data = (json.data && typeof json.data === 'object') ? json.data : json;

        const custs = Array.isArray(data.customers) ? data.customers : [];
        const supps = Array.isArray(data.suppliers) ? data.suppliers : [];
        const invs = Array.isArray(data.invoices) ? data.invoices : [];
        const purs = Array.isArray(data.purchases) ? data.purchases : [];
        const prods = Array.isArray(data.products) ? data.products : [];
        const treas = Array.isArray(data.treasury) ? data.treasury : [];
        const emps = Array.isArray(data.employees) ? data.employees : [];

        const totalRecords = custs.length + supps.length + invs.length + purs.length + prods.length + treas.length + emps.length;

        if (totalRecords === 0) {
          throw new Error('الملف المختار لا يحتوي على أي بيانات صالحة للنظام (عملاء، موردين، فواتير، أو خزينة).');
        }

        const normalizedBackup: SystemBackup = {
          version: json.version || '1.0',
          systemName: json.systemName || 'بورصة النجار',
          exportedAt: json.exportedAt || new Date().toISOString(),
          exportedBy: json.exportedBy || 'نسخة احتياطية',
          stats: {
            customersCount: custs.length,
            suppliersCount: supps.length,
            invoicesCount: invs.length,
            purchasesCount: purs.length,
            productsCount: prods.length,
            treasuryCount: treas.length,
            employeesCount: emps.length,
            usersCount: Array.isArray(data.users) ? data.users.length : 0
          },
          data: {
            customers: custs,
            suppliers: supps,
            invoices: invs,
            purchases: purs,
            products: prods,
            treasury: treas,
            employees: emps,
            users: Array.isArray(data.users) ? data.users : undefined,
            companyLogo: data.companyLogo || null
          }
        };

        setParsedBackup(normalizedBackup);
      } catch (err: any) {
        console.error('File parse error:', err);
        setParseError(err.message || 'الملف المختار تالف أو ليس بصيغة JSON صحيحة.');
        setParsedBackup(null);
      }
    };

    reader.onerror = () => {
      setParseError('فشل قراءة الملف من الجهاز. يرجى المحاولة مرة أخرى.');
      setParsedBackup(null);
    };

    reader.readAsText(file);
  };

  const executeRestore = async () => {
    if (!parsedBackup) return;
    if (!canManageBackup) {
      alert('ليس لديك صلاحية استرجاع البيانات والنسخ الاحتياطي.');
      return;
    }

    setIsRestoring(true);
    setRestoreResult(null);

    try {
      const res = await restoreBackupData(parsedBackup);
      setRestoreResult(res);
      if (res.success) {
        setParsedBackup(null);
        setFileName('');
        setShowConfirmDialog(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } catch (err: any) {
      setRestoreResult({ success: false, message: err.message || 'فشل الاسترجاع' });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleResetFile = () => {
    setParsedBackup(null);
    setFileName('');
    setParseError(null);
    setRestoreResult(null);
    setShowConfirmDialog(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-brand-900 to-brand-800 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <Database size={22} className="text-amber-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black">النسخ الاحتياطي واسترجاع البيانات</h2>
              <p className="text-xs text-brand-200">سحب نسخة كاملة أو استرجاع وتثبيت نسخة سابقة بأمان</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 bg-gray-50/70 p-1.5 gap-1.5 shrink-0">
          <button
            onClick={() => { setActiveTab('RESTORE'); setRestoreResult(null); }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'RESTORE'
                ? 'bg-white text-emerald-800 shadow-xs border border-gray-200 ring-1 ring-emerald-500/20'
                : 'text-gray-600 hover:text-brand-800 hover:bg-gray-100/70'
            }`}
          >
            <Upload size={16} className="text-emerald-600" />
            <span>استرجاع وتثبيت نسخة (رفع ملف)</span>
          </button>

          <button
            onClick={() => { setActiveTab('EXPORT'); setRestoreResult(null); }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'EXPORT'
                ? 'bg-white text-brand-900 shadow-xs border border-gray-200'
                : 'text-gray-600 hover:text-brand-800 hover:bg-gray-100/70'
            }`}
          >
            <Download size={16} className="text-brand-600" />
            <span>أخذ نسخة احتياطية (تنزيل)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 space-y-4">
          
          {/* TAB 1: RESTORE BACKUP */}
          {activeTab === 'RESTORE' && (
            <div className="space-y-4">
              
              <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 sm:p-4 text-xs text-emerald-950 leading-relaxed">
                <p className="font-black mb-1 flex items-center gap-1.5 text-emerald-900">
                  <Upload size={16} className="text-emerald-600" /> طريقة استرجاع وتثبيت النسخة:
                </p>
                <p>
                  اختر ملف النسخة الاحتياطية <strong>(.json)</strong> المحفوظ على جهازك، وسيقوم النظام فوراً بفحص الملف وعرض عدد السجلات، ثم اضغط على زر <strong>(تثبيت النسخة الآن)</strong> لتحديث الحسابات والخزينة فوراً.
                </p>
              </div>

              {/* File Upload Box */}
              <div>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  accept=".json,application/json,text/plain,*/*"
                  onClick={() => {
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  onChange={handleFileChange}
                  className="hidden" 
                  id="backup-file-input"
                />

                <label
                  htmlFor="backup-file-input"
                  className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all block ${
                    parsedBackup 
                      ? 'border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50/70' 
                      : 'border-gray-300 hover:border-brand-500 bg-gray-50/50 hover:bg-brand-50/30'
                  }`}
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className={`p-3 rounded-full shadow-xs border ${
                      parsedBackup ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-white border-gray-200 text-brand-600'
                    }`}>
                      {parsedBackup ? <FileCheck size={28} /> : <FileJson size={28} />}
                    </div>
                    <span className="text-xs sm:text-sm font-black text-gray-800">
                      {fileName ? `الملف المحدد: ${fileName}` : 'اضغط هنا لاختيار ملف النسخة الاحتياطية (.json)'}
                    </span>
                    <span className="text-[11px] text-gray-500">
                      {parsedBackup ? 'تم قراءة الملف بنجاح! اضغط أدناه لتثبيته في النظام' : 'يدعم جميع ملفات النسخ الاحتياطية من الهاتف أو الكمبيوتر'}
                    </span>
                  </div>
                </label>
              </div>

              {/* Parse Error Notification */}
              {parseError && (
                <div className="p-3.5 bg-red-50 border border-red-300 text-red-800 rounded-xl text-xs font-bold flex items-start gap-2 animate-fade-in">
                  <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-black">تعذر قراءة ملف النسخة</p>
                    <p className="font-normal text-red-700">{parseError}</p>
                    <button 
                      type="button" 
                      onClick={() => fileInputRef.current?.click()} 
                      className="text-xs text-red-900 underline font-bold mt-1 block cursor-pointer"
                    >
                      اضغط هنا لاختيار ملف آخر
                    </button>
                  </div>
                </div>
              )}

              {/* Inline Confirmation View */}
              {showConfirmDialog && parsedBackup && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 sm:p-5 text-center space-y-4 animate-fade-in">
                  <div className="w-12 h-12 mx-auto bg-amber-100 text-amber-700 rounded-full flex items-center justify-center shadow-xs">
                    <AlertTriangle size={28} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-amber-950">تأكيد استرجاع وتثبيت البيانات</h3>
                    <p className="text-xs text-amber-900 mt-1.5 leading-relaxed max-w-md mx-auto">
                      سيتم استبدال الحسابات وفواتير البيع والشراء والخزينة الحالية بالبيانات الموجودة في الملف <strong>({fileName})</strong>.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5 justify-center pt-1">
                    <button
                      type="button"
                      onClick={executeRestore}
                      disabled={isRestoring}
                      className="flex-1 py-3 px-5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white rounded-xl text-sm font-black flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all"
                    >
                      {isRestoring ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          <span>جاري التثبيت ومزامنة البيانات...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle size={18} />
                          <span>نعم، ثبّت النسخة الآن في البرنامج</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowConfirmDialog(false)}
                      disabled={isRestoring}
                      className="py-3 px-5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-xl text-sm font-bold cursor-pointer transition-colors"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              )}

              {/* File Preview & Direct Install Trigger */}
              {parsedBackup && !showConfirmDialog && (
                <div className="bg-slate-50 border-2 border-emerald-300 rounded-2xl p-4 space-y-3.5 animate-fade-in text-xs shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                    <div className="flex items-center gap-2">
                      <FileCheck size={18} className="text-emerald-600" />
                      <span className="font-black text-slate-900 text-sm">محتويات النسخة الجاهزة للتثبيت:</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleResetFile}
                      className="text-xs text-gray-500 hover:text-red-600 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw size={12} />
                      <span>اختيار ملف آخر</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={13} className="text-brand-600" />
                      <span>تاريخ النسخة:</span>
                      <strong className="text-slate-900 font-mono" dir="ltr">
                        {parsedBackup.exportedAt ? new Date(parsedBackup.exportedAt).toLocaleString('ar-EG') : 'غير محدد'}
                      </strong>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <UserCheck size={13} className="text-brand-600" />
                      <span>بواسطة:</span>
                      <strong className="text-slate-900">{parsedBackup.exportedBy || 'مستخدم النظام'}</strong>
                    </div>
                  </div>

                  {/* Record Counts in Backup */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1 border-t border-slate-200 text-center">
                    <div className="bg-white p-2 rounded-xl border border-slate-200">
                      <span className="text-gray-500 block text-[10px]">العملاء</span>
                      <span className="font-mono font-black text-brand-900 text-sm">
                        {parsedBackup.data?.customers?.length || 0}
                      </span>
                    </div>

                    <div className="bg-white p-2 rounded-xl border border-slate-200">
                      <span className="text-gray-500 block text-[10px]">الموردين</span>
                      <span className="font-mono font-black text-orange-950 text-sm">
                        {parsedBackup.data?.suppliers?.length || 0}
                      </span>
                    </div>

                    <div className="bg-white p-2 rounded-xl border border-slate-200">
                      <span className="text-gray-500 block text-[10px]">فواتير بيع</span>
                      <span className="font-mono font-black text-emerald-900 text-sm">
                        {parsedBackup.data?.invoices?.length || 0}
                      </span>
                    </div>

                    <div className="bg-white p-2 rounded-xl border border-slate-200">
                      <span className="text-gray-500 block text-[10px]">فواتير شراء</span>
                      <span className="font-mono font-black text-purple-900 text-sm">
                        {parsedBackup.data?.purchases?.length || 0}
                      </span>
                    </div>

                    <div className="bg-white p-2 rounded-xl border border-slate-200">
                      <span className="text-gray-500 block text-[10px]">حركات خزينة</span>
                      <span className="font-mono font-black text-teal-900 text-sm">
                        {parsedBackup.data?.treasury?.length || 0}
                      </span>
                    </div>

                    <div className="bg-white p-2 rounded-xl border border-slate-200">
                      <span className="text-gray-500 block text-[10px]">الأصناف</span>
                      <span className="font-mono font-black text-amber-900 text-sm">
                        {parsedBackup.data?.products?.length || 0}
                      </span>
                    </div>
                  </div>

                  {/* PROMINENT INSTALL BUTTON */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowConfirmDialog(true)}
                      className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-black flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all cursor-pointer"
                    >
                      <CheckCircle size={20} />
                      <span>تثبيت واسترجاع هذه النسخة الآن في البرنامج</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Restore Result Message */}
              {restoreResult && (
                <div className={`p-4 rounded-xl border text-xs font-bold flex items-start gap-3 animate-fade-in ${
                  restoreResult.success 
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-900' 
                    : 'bg-red-50 border-red-300 text-red-900'
                }`}>
                  {restoreResult.success ? (
                    <CheckCircle size={22} className="text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle size={22} className="text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1.5 flex-1">
                    <p className="font-black text-sm">{restoreResult.success ? 'تم تثبيت النسخة بنجاح!' : 'خطأ في الاسترجاع'}</p>
                    <p className="font-normal text-slate-800 leading-relaxed">{restoreResult.message}</p>
                    {restoreResult.success && (
                      <div className="pt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            window.location.reload();
                          }}
                          className="py-1.5 px-3 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors cursor-pointer"
                        >
                          تحديث الصفحة لإظهار كل البيانات
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 2: EXPORT / DOWNLOAD BACKUP */}
          {activeTab === 'EXPORT' && (
            <div className="space-y-4">
              
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 sm:p-4 text-xs text-blue-900 leading-relaxed">
                <p className="font-bold mb-1 flex items-center gap-1.5 text-blue-950">
                  <Database size={15} className="text-blue-600" /> حفظ نسخة آمنة من جميع بياناتك:
                </p>
                <p className="text-blue-800">
                  سيتم إنشاء ملف منظم بصيغة <strong>(.json)</strong> يحتوي على كامل بياناتك (العملاء، الموردين، فواتير المبيعات، فواتير المشتريات، الخزينة، الأصناف، والموظفين). احتفظ بهذا الملف على جهازك للرجوع إليه عند الحاجة.
                </p>
              </div>

              {/* Current Database Summary Grid */}
              <div>
                <h4 className="text-xs font-bold text-gray-500 mb-2">إجمالي السجلات التي سيتم تضمينها في النسخة:</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-bold text-gray-700">
                      <Users size={14} className="text-brand-600" /> العملاء
                    </span>
                    <span className="font-mono font-black text-brand-900">{customers.length}</span>
                  </div>

                  <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-bold text-gray-700">
                      <Truck size={14} className="text-orange-600" /> الموردين
                    </span>
                    <span className="font-mono font-black text-orange-950">{suppliers.length}</span>
                  </div>

                  <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-bold text-gray-700">
                      <FileText size={14} className="text-emerald-600" /> فواتير البيع
                    </span>
                    <span className="font-mono font-black text-emerald-900">{invoices.length}</span>
                  </div>

                  <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-bold text-gray-700">
                      <ShoppingCart size={14} className="text-purple-600" /> فواتير الشراء
                    </span>
                    <span className="font-mono font-black text-purple-900">{purchases.length}</span>
                  </div>

                  <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-bold text-gray-700">
                      <Package size={14} className="text-amber-600" /> الأصناف
                    </span>
                    <span className="font-mono font-black text-amber-900">{products.length}</span>
                  </div>

                  <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-bold text-gray-700">
                      <Wallet size={14} className="text-teal-600" /> حركات الخزينة
                    </span>
                    <span className="font-mono font-black text-teal-900">{treasury.length}</span>
                  </div>
                </div>
              </div>

              {/* Success Notification */}
              {downloadSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-fade-in">
                  <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                  <span>تم تجهيز النسخة الاحتياطية وتنزيل الملف على جهازك بنجاح!</span>
                </div>
              )}

              {/* Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleExport}
                  className="w-full py-3 px-4 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-black flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
                >
                  <Download size={18} />
                  <span>تحميل ملف النسخة الاحتياطية (.json) الآن</span>
                </button>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-gray-50 border-t border-gray-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};
