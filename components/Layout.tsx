
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, ShoppingCart, Package, FileText, Users, Wallet, Menu, X, Banknote, ArrowRightLeft, ArrowRight, Truck, Briefcase, LogOut, Shield, Wifi, WifiOff, History, Receipt, Database, BarChart3, AlertTriangle, Clock, Trash2, Activity } from 'lucide-react';
import { PageView, UserPermissions } from '../types';
import { useERP } from '../context/ERPContext';
import { BackupModal } from './BackupModal';
import { useBackHandler } from '../utils/backNavigation';
import { useNetworkStatus, usePendingWrites, usePersistenceOk } from '../utils/useNetworkStatus';
import { onOfflineSave } from '../utils/connectionStatus';

interface LayoutProps {
  children: React.ReactNode;
  activePage: PageView;
  onNavigate: (page: PageView) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activePage, onNavigate }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const { currentUser, logout, isOnline, permissionError, purchases } = useERP();
  const netUp = useNetworkStatus();
  const pendingWrites = usePendingWrites();
  const persistenceOk = usePersistenceOk();
  const [offlineSaveToast, setOfflineSaveToast] = useState<string | null>(null);

  // Tell the user when something was saved only on this device (offline)
  useEffect(() => {
    let t: any;
    const off = onOfflineSave((name) => {
      const what = name === 'invoices' ? 'الفاتورة' : name === 'purchases' ? 'فاتورة المشتريات' : 'العملية';
      setOfflineSaveToast(`⚠️ أنت الآن في وضع أوفلاين! تم حفظ ${what} على جهازك فقط، وستُرفع تلقائياً عند عودة الإنترنت. لا تمسح بيانات المتصفح ولا تغلق البرنامج قبل أن يتحول المؤشر إلى أخضر (متصل).`);
      clearTimeout(t);
      t = setTimeout(() => setOfflineSaveToast(null), 12000);
    });
    return () => { off(); clearTimeout(t); };
  }, []);

  // Warn before closing the page while some data is not uploaded yet
  useEffect(() => {
    if (pendingWrites <= 0) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [pendingWrites]);
  
  const canManageBackup = currentUser?.role === 'ADMIN' || currentUser?.username === 'admin' || Boolean(currentUser?.permissions?.canManageBackup);

  const pendingPurchasesCount = purchases.filter(p => p.pricingStatus === 'PENDING_PRICE').length;

  // Back Button integration for mobile sidebar menu & backup modal
  useBackHandler(() => setIsSidebarOpen(false), isSidebarOpen, 'layout-mobile-sidebar');
  useBackHandler(() => setIsBackupModalOpen(false), isBackupModalOpen, 'layout-backup-modal');

  const navItems: { id: PageView; label: string; icon: React.ReactNode; permission?: keyof UserPermissions }[] = [
    { id: 'dashboard', label: 'الرئيسية', icon: <LayoutDashboard size={20} /> },
    { id: 'sales', label: 'فواتير البيع', icon: <FileText size={20} />, permission: 'canViewSales' },
    { id: 'sales-history', label: 'سجل الفواتير', icon: <History size={20} />, permission: 'canViewInvoicesLog' },
    { id: 'purchases', label: 'المشتريات', icon: <ShoppingCart size={20} />, permission: 'canViewPurchases' },
    { id: 'warehouse', label: 'المخزن', icon: <Package size={20} />, permission: 'canViewInventory' },
    { id: 'customers', label: 'العملاء', icon: <Users size={20} />, permission: 'canViewCustomers' },
    { id: 'suppliers', label: 'الموردين', icon: <Truck size={20} />, permission: 'canViewSuppliers' },
    { id: 'employees', label: 'الموظفين', icon: <Briefcase size={20} />, permission: 'canViewTreasury' },
    { id: 'collections', label: 'التحصيل', icon: <Banknote size={20} />, permission: 'canViewTreasury' },
    { id: 'transfers', label: 'التحويلات', icon: <ArrowRightLeft size={20} />, permission: 'canViewTreasury' },
    { id: 'expenses', label: 'المصروفات', icon: <Receipt size={20} />, permission: 'canViewTreasury' },
    { id: 'treasury', label: 'الخزنة', icon: <Wallet size={20} />, permission: 'canViewTreasury' },
    { id: 'reports', label: 'التقارير', icon: <BarChart3 size={20} />, permission: 'canViewReports' },
    { id: 'trash', label: 'سلة المهملات', icon: <Trash2 size={20} /> },
    { id: 'users', label: 'المستخدمين', icon: <Shield size={20} />, permission: 'admin' },
    { id: 'activity', label: 'سجل النشاط', icon: <Activity size={20} /> },
  ];

  // Filter items based on permission
  const filteredNav = navItems.filter(item => {
    // إتاحة صفحة إدارة المستخدمين للسوبر أدمن الأساسي فقط (admin)
    if (item.id === 'users') {
      return currentUser?.username === 'admin';
    }
    if (item.id === 'activity') {
      return currentUser?.username === 'admin' || currentUser?.role === 'ADMIN';
    }
    if (currentUser?.role === 'ADMIN' || currentUser?.username === 'admin') return true;
    if (item.id === 'trash') {
      return Boolean(
        currentUser?.permissions?.canDeleteInvoices ||
        currentUser?.permissions?.canDeleteCustomers ||
        currentUser?.permissions?.canDeleteSuppliers
      );
    }
    if (!item.permission) return true; 
    return Boolean(currentUser?.permissions?.[item.permission]);
  });

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-brand-50 print:bg-white print:block">
      {!persistenceOk && (
        <div className="fixed top-0 left-0 right-0 bg-red-700 text-white text-sm font-bold p-2 z-50 text-center print:hidden">
          ⚠️ هذا المتصفح لا يحفظ البيانات على الجهاز (غالباً وضع التصفح الخاص). لا تعتمد على العمل أوفلاين هنا، واستخدم نافذة عادية.
        </div>
      )}
      {offlineSaveToast && (
        <div className="fixed top-14 md:top-3 left-1/2 -translate-x-1/2 bg-red-600 text-white text-xs md:text-sm font-bold px-3 py-2 md:px-4 md:py-3 rounded-xl shadow-2xl z-[60] max-w-[92vw] md:max-w-xl text-center print:hidden" onClick={() => setOfflineSaveToast(null)}>
          {offlineSaveToast}
        </div>
      )}
      <div className="fixed bottom-3 left-3 hidden xl:flex flex-col gap-2 z-50 print:hidden pointer-events-none">
        {!netUp && (
          <div className="bg-red-600 text-white text-sm font-bold px-4 py-2 rounded-full shadow-lg">
            أوفلاين: لا يوجد إنترنت، الشغل مستمر وسيتم رفع البيانات تلقائياً عند عودة الاتصال
          </div>
        )}
        {pendingWrites > 0 && (
          <div className="bg-amber-500 text-white text-sm font-bold px-4 py-2 rounded-full shadow-lg">
            {netUp ? 'جاري رفع البيانات...' : 'بيانات محفوظة على الجهاز ولم تُرفع بعد'}
          </div>
        )}
      </div>
      {/* Error Banner for Permissions */}
      {permissionError && (
        <div className="fixed top-0 left-0 right-0 bg-red-600 text-white p-4 z-50 text-center shadow-xl animate-bounce-in print:hidden">
          <div className="flex flex-col items-center gap-2">
            <h3 className="font-bold text-lg flex items-center gap-2">
               <Shield size={24} /> تنبيه: لا يمكن حفظ البيانات!
            </h3>
            <p className="text-sm">
              قاعدة البيانات ترفض الكتابة. يرجى الذهاب إلى <strong>Firebase Console &gt; Firestore Database &gt; Rules</strong> وتغيير الكود إلى:
            </p>
            <code className="bg-red-800 px-4 py-1 rounded font-mono text-sm ltr">
              allow read, write: if true;
            </code>
          </div>
        </div>
      )}

      {/* Mobile Header with Home/Back Navigation */}
      <div className="md:hidden print:hidden bg-brand-600 text-white p-2.5 flex justify-between items-center shadow-md z-20 sticky top-0">
        <div className="flex items-center gap-2 min-w-0">
          {activePage !== 'dashboard' && (
            <button 
              onClick={() => onNavigate('dashboard')}
              className="flex items-center gap-1 bg-brand-700 hover:bg-brand-800 text-white px-2 py-1 rounded-lg text-xs font-bold transition-all border border-brand-500/40 shrink-0"
              title="العودة للرئيسية"
            >
              <ArrowRight size={15} />
              <span>الرئيسية</span>
            </button>
          )}
          <h1 className="text-base font-bold truncate">بورصة النجار</h1>
          {netUp ? (
            <span className="flex items-center gap-1 bg-green-600/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
              <span className="w-1.5 h-1.5 bg-white rounded-full"></span>متصل
            </span>
          ) : (
            <span className="flex items-center gap-1 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 animate-pulse">
              <span className="w-1.5 h-1.5 bg-white rounded-full"></span>أوفلاين
            </span>
          )}
          {pendingWrites > 0 && (
            <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
              {netUp ? 'جاري الرفع' : 'لم تُرفع'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {canManageBackup && (
            <button 
              onClick={() => setIsBackupModalOpen(true)}
              className="flex items-center gap-1 bg-brand-700 hover:bg-brand-800 text-amber-300 px-2 py-1 rounded-lg text-xs font-bold transition-colors border border-brand-500/40"
              title="نسخ احتياطي واسترجاع البيانات"
            >
              <Database size={14} />
              <span className="hidden sm:inline">نسخ احتياطي</span>
            </button>
          )}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1 rounded-lg hover:bg-brand-700" title="القائمة">
            {isSidebarOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside className={`
        print:hidden fixed md:static inset-y-0 right-0 z-50 w-72 md:w-64 bg-gradient-to-b from-brand-800 to-brand-900 text-white shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col scrollbar-none no-scrollbar
        ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
      `}>
        {/* Drawer Header: Compact on Mobile, Luxurious & Centered on Desktop */}
        <div className="py-2.5 px-3 border-b border-brand-700/80 shrink-0 flex items-center justify-between lg:block lg:py-5 lg:px-4 lg:text-center">
          <div className="flex items-center gap-2 min-w-0 lg:block">
            <h1 className="text-base lg:text-lg xl:text-xl font-black text-white tracking-wide lg:tracking-wider truncate">بورصة النجار</h1>
            <div className="flex items-center gap-1 lg:gap-1.5 bg-brand-900/60 py-0.5 px-2 lg:py-1 lg:px-3 rounded-full border border-brand-700/40 shrink-0 lg:mt-2 lg:mx-auto lg:w-fit">
              {netUp ? (
                <>
                  <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-[10px] lg:text-xs text-green-300 font-bold">متصل (أونلاين)</span>
                </>
              ) : (
                <>
                  <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-[10px] lg:text-xs text-red-400 font-bold">غير متصل (أوفلاين)</span>
                </>
              )}
            </div>
          </div>

          {/* Mobile Close Button in the same row on mobile, hidden on desktop */}
          <button 
            type="button"
            onClick={() => setIsSidebarOpen(false)} 
            className="lg:hidden p-1.5 text-brand-200 hover:text-white hover:bg-brand-700/80 rounded-lg transition-all border border-brand-700/50 flex items-center justify-center cursor-pointer shadow-xs active:scale-95 shrink-0"
            title="إغلاق القائمة"
            aria-label="إغلاق القائمة"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 mt-1.5 lg:mt-3 px-2 lg:px-3 overflow-y-auto scrollbar-none no-scrollbar lg:space-y-1.5">
          {filteredNav.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onNavigate(item.id);
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 lg:gap-3 px-3 py-1.5 lg:py-2.5 lg:px-3.5 mb-1 lg:mb-0 rounded-lg lg:rounded-xl transition-all duration-150 text-sm font-medium lg:font-bold
                ${activePage === item.id 
                  ? 'bg-brand-50 text-brand-900 font-bold shadow-md translate-x-[-3px] lg:translate-x-[-4px]' 
                  : 'text-brand-100 hover:bg-brand-700 hover:text-white'
                }
              `}
            >
              <span className="shrink-0 [&>svg]:w-4.5 [&>svg]:h-4.5 lg:[&>svg]:w-5 lg:[&>svg]:h-5">{item.icon}</span>
              <span className="truncate">{item.label}</span>
              {item.id === 'purchases' && pendingPurchasesCount > 0 && (
                <span className="mr-auto bg-amber-400 text-amber-950 text-[10px] lg:text-xs px-1.5 py-0.5 lg:px-2 rounded-full font-black animate-pulse shadow-xs">
                  {pendingPurchasesCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Sidebar Footer (Responsive & Balanced) */}
        <div className="p-2.5 lg:p-3 border-t border-brand-700 bg-brand-800 space-y-2 lg:space-y-2.5 shrink-0">
           {/* Backup & Restore Button */}
           {canManageBackup && (
             <button 
               onClick={() => {
                 setIsBackupModalOpen(true);
                 setIsSidebarOpen(false);
               }}
               className="w-full flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-brand-950 py-1.5 lg:py-2 rounded-lg transition-colors text-xs font-black shadow-xs cursor-pointer"
             >
               <Database size={14} className="lg:w-4 lg:h-4" /> <span>نسخ احتياطي واسترجاع</span>
             </button>
           )}

           <div className="flex items-center justify-between gap-2 px-1">
             <div className="flex items-center gap-2 min-w-0">
               <div className="w-7 h-7 lg:w-8 lg:h-8 bg-brand-600 rounded-full flex items-center justify-center font-bold text-xs lg:text-sm shrink-0">
                  {currentUser?.fullName?.charAt(0) || 'U'}
               </div>
               <div className="overflow-hidden">
                  <p className="text-xs lg:text-sm font-bold truncate leading-tight">{currentUser?.fullName}</p>
                  <p className="text-[10px] lg:text-xs text-brand-300 truncate">{currentUser?.role === 'ADMIN' ? 'مدير النظام' : 'مستخدم'}</p>
               </div>
             </div>
             <button 
               onClick={logout}
               className="flex items-center gap-1 bg-red-600/20 hover:bg-red-600 text-red-200 hover:text-white py-1 px-2 lg:py-1.5 lg:px-2.5 rounded-lg transition-colors text-xs font-bold shrink-0 cursor-pointer"
               title="تسجيل الخروج"
             >
               <LogOut size={13} className="lg:w-3.5 lg:h-3.5" />
               <span>خروج</span>
             </button>
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto print:overflow-visible print:h-auto print:p-0 p-2 md:p-4 h-screen">
        {activePage !== 'customers' && activePage !== 'suppliers' && (
          <header className="mb-3 hidden md:flex print:hidden justify-between items-center bg-white py-2 px-4 rounded-xl shadow-xs border border-brand-100">
             <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold text-brand-900">
                  {navItems.find(i => i.id === activePage)?.label}
                </h2>
                {!netUp && (
                  <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-lg flex items-center gap-1 border border-red-300">
                     <WifiOff size={12}/> وضع غير متصل (Offline)
                  </span>
                )}
                {netUp && (
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-lg flex items-center gap-1 border border-green-200">
                     <Wifi size={12}/> متصل (Online)
                  </span>
                )}
                {pendingWrites > 0 && (
                  <span className="xl:hidden bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-lg border border-amber-300">
                     {netUp ? 'جاري رفع البيانات...' : 'بيانات لم تُرفع بعد'}
                  </span>
                )}
             </div>
             <div className="flex items-center gap-3">
               {canManageBackup && (
                 <button
                   onClick={() => setIsBackupModalOpen(true)}
                   className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-2xs"
                 >
                   <Database size={14} className="text-amber-600" />
                   <span>النسخ الاحتياطي والاسترجاع</span>
                 </button>
               )}
               <div className="text-brand-600 text-sm font-medium">
                 {new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
               </div>
             </div>
          </header>
        )}
        {/* Persistent Pending Price Alert Banner */}
        {pendingPurchasesCount > 0 && activePage !== 'purchases' && (
          <div className="mb-4 bg-amber-500/10 border-2 border-amber-500/40 rounded-xl p-3 md:p-4 text-amber-950 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs animate-fade-in print:hidden">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-xs shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h4 className="font-bold text-sm md:text-base text-amber-900 flex items-center gap-2">
                  <span>تنبيه: فواتير مشتريات معلقة السعر</span>
                  <span className="bg-amber-200 text-amber-950 text-xs px-2 py-0.5 rounded-full font-black">
                    {pendingPurchasesCount}
                  </span>
                </h4>
                <p className="text-xs md:text-sm text-amber-800">
                  يوجد لديك عدد ({pendingPurchasesCount}) فواتير مشتريات معلقة لم يتم تحديد سعر الشراء لها بعد! دخلت الكميات للمخزن ولكن لم تُسجل المديونية للموردين.
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('purchases')}
              className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-xs md:text-sm font-bold shadow-xs transition-colors flex items-center gap-1.5"
            >
              <ShoppingCart size={16} />
              <span>تسعير الفواتير الآن</span>
            </button>
          </div>
        )}

        <div className="animate-fade-in pb-20 md:pb-0">
          {children}
        </div>
      </main>

      {/* Backup & Restore Modal */}
      <BackupModal 
        isOpen={isBackupModalOpen} 
        onClose={() => setIsBackupModalOpen(false)} 
      />


      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}
    </div>
  );
};
