
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, ShoppingCart, Package, FileText, Users, Wallet, Menu, X, Banknote, ArrowRightLeft, Truck, Briefcase, LogOut, Shield, Download, Wifi, WifiOff, History, Receipt, Database, BarChart3, AlertTriangle, Clock, Trash2 } from 'lucide-react';
import { PageView, UserPermissions } from '../types';
import { useERP } from '../context/ERPContext';
import { BackupModal } from './BackupModal';
import { useBackHandler } from '../utils/backNavigation';

interface LayoutProps {
  children: React.ReactNode;
  activePage: PageView;
  onNavigate: (page: PageView) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activePage, onNavigate }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const { currentUser, logout, isOnline, permissionError, purchases } = useERP();
  
  const canManageBackup = currentUser?.role === 'ADMIN' || currentUser?.username === 'admin' || Boolean(currentUser?.permissions?.canManageBackup);

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const pendingPurchasesCount = purchases.filter(p => p.pricingStatus === 'PENDING_PRICE').length;

  // Back Button integration for mobile sidebar menu & backup modal
  useBackHandler(() => setIsSidebarOpen(false), isSidebarOpen, 'layout-mobile-sidebar');
  useBackHandler(() => setIsBackupModalOpen(false), isBackupModalOpen, 'layout-backup-modal');

  // Listen for the beforeinstallprompt event
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    // Check if running in an iframe/preview environment
    const isInFrame = window.self !== window.top;
    
    if (isInFrame) {
      alert('يرجى فتح التطبيق في نافذة جديدة (New Tab) أولاً لتتمكن من تثبيته.');
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      alert('للتثبيت، يرجى الضغط على أيقونة التثبيت (+) في شريط عنوان المتصفح، أو استخدام خيار "Add to Home Screen" من القائمة.');
    }
  };

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
  ];

  // Filter items based on permission
  const filteredNav = navItems.filter(item => {
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

      {/* Mobile Header */}
      <div className="md:hidden print:hidden bg-brand-600 text-white p-3 flex justify-between items-center shadow-md z-20 sticky top-0">
        <h1 className="text-lg font-bold">بورصة النجار</h1>
        <div className="flex items-center gap-1.5">
          {canManageBackup && (
            <button 
              onClick={() => setIsBackupModalOpen(true)}
              className="flex items-center gap-1 bg-brand-700 hover:bg-brand-800 text-amber-300 px-2 py-1 rounded-lg text-xs font-bold transition-colors border border-brand-500/40"
              title="نسخ احتياطي واسترجاع البيانات"
            >
              <Database size={14} />
              <span>نسخ احتياطي</span>
            </button>
          )}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1 rounded-lg hover:bg-brand-700">
            {isSidebarOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside className={`
        print:hidden fixed md:static inset-y-0 right-0 z-10 w-64 bg-gradient-to-b from-brand-800 to-brand-900 text-white shadow-xl transform transition-transform duration-300 ease-in-out flex flex-col
        ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
      `}>
        <div className="p-6 border-b border-brand-700">
          <h1 className="text-2xl font-bold text-center text-white tracking-wider">بورصة النجار</h1>
          <div className="flex items-center justify-center gap-2 mt-2 bg-brand-900/50 py-1 px-2 rounded-full">
             {isOnline ? (
               <>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-[10px] text-green-200">متصل (أونلاين)</span>
               </>
             ) : (
               <>
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                <span className="text-[10px] text-gray-400">محلي (أوفلاين)</span>
               </>
             )}
          </div>
        </div>

        <nav className="flex-1 mt-6 px-2 overflow-y-auto">
          {filteredNav.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onNavigate(item.id);
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 mb-2 rounded-lg transition-all duration-200
                ${activePage === item.id 
                  ? 'bg-brand-50 text-brand-900 font-bold shadow-lg translate-x-[-5px]' 
                  : 'text-brand-100 hover:bg-brand-700 hover:text-white'
                }
              `}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.id === 'purchases' && pendingPurchasesCount > 0 && (
                <span className="mr-auto bg-amber-400 text-amber-950 text-xs px-2 py-0.5 rounded-full font-black animate-pulse shadow-xs">
                  {pendingPurchasesCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Sidebar Footer (Backup, Install, User Profile & Logout) */}
        <div className="p-4 border-t border-brand-700 bg-brand-800 space-y-2.5">
           
           {/* Backup & Restore Button */}
           {canManageBackup && (
             <button 
               onClick={() => {
                 setIsBackupModalOpen(true);
                 setIsSidebarOpen(false);
               }}
               className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-brand-950 py-2 rounded-lg transition-colors text-xs font-black shadow-sm"
             >
               <Database size={15} /> نسخ احتياطي واسترجاع
             </button>
           )}

           {/* Install Button */}
           <button 
             onClick={handleInstallClick}
             className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg transition-colors text-xs font-bold shadow-sm"
           >
             <Download size={15} /> تثبيت التطبيق
           </button>

           <div className="flex items-center gap-3 px-2 pt-1">
             <div className="w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center font-bold">
                {currentUser?.fullName.charAt(0)}
             </div>
             <div className="overflow-hidden">
                <p className="text-sm font-bold truncate">{currentUser?.fullName}</p>
                <p className="text-xs text-brand-300 truncate">{currentUser?.role === 'ADMIN' ? 'مدير النظام' : 'مستخدم'}</p>
             </div>
           </div>
           <button 
             onClick={logout}
             className="w-full flex items-center justify-center gap-2 bg-red-600/20 hover:bg-red-600 text-red-200 hover:text-white py-1.5 rounded-lg transition-colors text-xs font-bold"
           >
             <LogOut size={15} /> تسجيل الخروج
           </button>
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
                {!isOnline && (
                  <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-lg flex items-center gap-1 border border-amber-200">
                     <WifiOff size={12}/> وضع غير متصل (Offline)
                  </span>
                )}
                {isOnline && (
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-lg flex items-center gap-1 border border-green-200">
                     <Wifi size={12}/> متصل (Online)
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
          className="fixed inset-0 bg-black bg-opacity-50 z-0 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}
    </div>
  );
};
