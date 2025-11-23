
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, ShoppingCart, Package, FileText, Users, Wallet, Menu, X, Banknote, ArrowRightLeft, Truck, Briefcase, LogOut, Shield, Download, Wifi, WifiOff, History, Receipt } from 'lucide-react';
import { PageView } from '../types';
import { useERP } from '../context/ERPContext';

interface LayoutProps {
  children: React.ReactNode;
  activePage: PageView;
  onNavigate: (page: PageView) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activePage, onNavigate }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { currentUser, logout, isOnline, permissionError } = useERP();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

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

  const navItems: { id: PageView; label: string; icon: React.ReactNode; permission?: keyof typeof currentUser.permissions }[] = [
    { id: 'dashboard', label: 'الرئيسية', icon: <LayoutDashboard size={20} />, permission: 'dashboard' }, // Now controlled by permission
    { id: 'sales', label: 'فواتير البيع', icon: <FileText size={20} />, permission: 'sales' },
    { id: 'sales-history', label: 'سجل الفواتير', icon: <History size={20} />, permission: 'sales' },
    { id: 'purchases', label: 'المشتريات', icon: <ShoppingCart size={20} />, permission: 'warehouse' },
    { id: 'warehouse', label: 'المخزن', icon: <Package size={20} />, permission: 'warehouse' },
    { id: 'customers', label: 'العملاء', icon: <Users size={20} />, permission: 'sales' },
    { id: 'suppliers', label: 'الموردين', icon: <Truck size={20} />, permission: 'warehouse' },
    { id: 'employees', label: 'الموظفين', icon: <Briefcase size={20} />, permission: 'financial' },
    { id: 'collections', label: 'التحصيل', icon: <Banknote size={20} />, permission: 'financial' },
    { id: 'transfers', label: 'التحويلات', icon: <ArrowRightLeft size={20} />, permission: 'financial' },
    { id: 'expenses', label: 'المصروفات', icon: <Receipt size={20} />, permission: 'financial' },
    { id: 'treasury', label: 'الخزنة', icon: <Wallet size={20} />, permission: 'financial' },
    { id: 'users', label: 'المستخدمين', icon: <Shield size={20} />, permission: 'admin' },
  ];

  // Filter items based on permission
  const filteredNav = navItems.filter(item => {
    if (!item.permission) return true; 
    return currentUser?.permissions[item.permission];
  });

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-brand-50">
      {/* Error Banner for Permissions */}
      {permissionError && (
        <div className="fixed top-0 left-0 right-0 bg-red-600 text-white p-4 z-50 text-center shadow-xl animate-bounce-in">
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
      <div className="md:hidden bg-brand-600 text-white p-4 flex justify-between items-center shadow-md z-20 sticky top-0">
        <h1 className="text-xl font-bold">بورصة النجار</h1>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
          {isSidebarOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 right-0 z-10 w-64 bg-gradient-to-b from-brand-800 to-brand-900 text-white shadow-xl transform transition-transform duration-300 ease-in-out flex flex-col
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
            </button>
          ))}
        </nav>

        {/* Sidebar Footer (Install, User Profile & Logout) */}
        <div className="p-4 border-t border-brand-700 bg-brand-800 space-y-3">
           
           {/* Install Button */}
           <button 
             onClick={handleInstallClick}
             className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg transition-colors text-sm font-bold shadow-sm"
           >
             <Download size={16} /> تثبيت التطبيق
           </button>

           <div className="flex items-center gap-3 px-2 pt-2">
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
             className="w-full flex items-center justify-center gap-2 bg-red-600/20 hover:bg-red-600 text-red-200 hover:text-white py-2 rounded-lg transition-colors text-sm font-bold"
           >
             <LogOut size={16} /> تسجيل الخروج
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 h-screen">
        <header className="mb-8 hidden md:flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
           <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold text-brand-900">
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
           <div className="text-brand-600 text-sm font-medium">
             {new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
           </div>
        </header>
        <div className="animate-fade-in pb-20 md:pb-0">
          {children}
        </div>
      </main>

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
