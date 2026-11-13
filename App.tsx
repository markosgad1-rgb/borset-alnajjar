
import React, { useState, useEffect, useRef } from 'react';
import { ERPProvider, useERP } from './context/ERPContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Purchases } from './pages/Purchases';
import { Warehouse } from './pages/Warehouse';
import { Sales } from './pages/Sales';
import { Customers } from './pages/Customers';
import { Suppliers } from './pages/Suppliers';
import { Employees } from './pages/Employees';
import { Treasury } from './pages/Treasury';
import { Collections } from './pages/Collections';
import { Transfers } from './pages/Transfers';
import { Expenses } from './pages/Expenses';
import { UserManagement } from './pages/UserManagement';
import { SalesHistory } from './pages/SalesHistory';
import { Reports } from './pages/Reports';
import { Trash } from './pages/Trash';
import { ActivityLog } from './pages/ActivityLog';
import { PageView, User, UserPermissions } from './types';
import { setupBackNavigation, clearAllBackHandlers } from './utils/backNavigation';

const AppContent: React.FC = () => {
  const { currentUser } = useERP();
  
  // Determine initial page based on granular permissions
  const getInitialPage = (_user: User): PageView => {
    return 'dashboard';
  };

  const [activePage, setActivePage] = useState<PageView>('dashboard');
  const homePage = 'dashboard';
  const activePageRef = useRef(activePage);
  activePageRef.current = activePage;

  // Browser History & Popstate integration for Back navigation
  useEffect(() => {
    // Set initial history state if not set
    if (!window.history.state || !window.history.state.page) {
      window.history.replaceState({ page: homePage, root: true }, '');
    }

    const cleanup = setupBackNavigation(() => {
      const current = activePageRef.current;
      if (current !== homePage) {
        // Step back to Dashboard
        setActivePage(homePage);
        window.history.replaceState({ page: homePage, root: true }, '');
      }
      // If current === homePage, do not intercept; browser will naturally exit
    });

    return cleanup;
  }, [homePage]);

  const handleNavigate = (page: PageView) => {
    if (page === activePage) return;
    clearAllBackHandlers();

    if (activePage === homePage) {
      // Pushing first page from dashboard creates 1 step history
      window.history.pushState({ page, type: 'page' }, '');
    } else if (page === homePage) {
      // Returning to dashboard keeps history at root
      window.history.replaceState({ page: homePage, root: true }, '');
    } else {
      // Switching between non-dashboard pages replaces current page entry so back goes directly to dashboard
      window.history.replaceState({ page, type: 'page' }, '');
    }

    setActivePage(page);
  };

  // Security Check: Validate Page Permissions on User Change or Navigation
  useEffect(() => {
    if (currentUser) {
      // Admins have unrestricted access to all pages
      if (currentUser.role === 'ADMIN' || currentUser.username === 'admin') {
        return;
      }

      // Map pages to required granular permissions
      const permissionsMap: Partial<Record<PageView, keyof UserPermissions>> = {
        'reports': 'canViewReports',
        'sales': 'canViewSales',
        'sales-history': 'canViewInvoicesLog',
        'purchases': 'canViewPurchases',
        'warehouse': 'canViewInventory',
        'customers': 'canViewCustomers',
        'suppliers': 'canViewSuppliers',
        'treasury': 'canViewTreasury',
        'collections': 'canViewTreasury',
        'transfers': 'canViewTreasury',
        'expenses': 'canViewTreasury',
        'employees': 'canViewTreasury',
        'users': 'admin',
      };

      if (activePage === 'users') {
        if (currentUser.username !== 'admin') {
          setActivePage(getInitialPage(currentUser));
          return;
        }
      }

      if (activePage === 'activity') {
        if (currentUser.username !== 'admin' && (currentUser.role as string) !== 'ADMIN') {
          setActivePage(getInitialPage(currentUser));
        }
        return;
      }

      if (activePage === 'trash') {
        const canTrash = Boolean(
          currentUser.permissions.canDeleteInvoices ||
          currentUser.permissions.canDeleteCustomers ||
          currentUser.permissions.canDeleteSuppliers
        );
        if (!canTrash) {
          setActivePage(getInitialPage(currentUser));
        }
        return;
      }

      const requiredPerm = permissionsMap[activePage];

      // If the current page requires a permission AND the user doesn't have it
      if (requiredPerm && !currentUser.permissions[requiredPerm]) {
        // Redirect to their allowed homepage
        setActivePage(getInitialPage(currentUser));
      }
    }
  }, [currentUser, activePage]);

  if (!currentUser) {
    return <Login />;
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <Dashboard />;
      case 'reports': return <Reports />;
      case 'purchases': return <Purchases />;
      case 'warehouse': return <Warehouse />;
      case 'sales': return <Sales />;
      case 'sales-history': return <SalesHistory />;
      case 'customers': return <Customers />;
      case 'suppliers': return <Suppliers />;
      case 'employees': return <Employees />;
      case 'treasury': return <Treasury />;
      case 'collections': return <Collections />;
      case 'transfers': return <Transfers />;
      case 'expenses': return <Expenses />;
      case 'trash': return <Trash />;
      case 'users': return <UserManagement />;
      case 'activity': return <ActivityLog />;
      default: return <Dashboard />;
    }
  };

  return (
    <Layout activePage={activePage} onNavigate={handleNavigate}>
      <ErrorBoundary>
        {renderPage()}
      </ErrorBoundary>
    </Layout>
  );
};

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error('App ErrorBoundary caught:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-red-50 border border-red-200 p-6 rounded-2xl max-w-md w-full shadow-lg">
            <h2 className="text-lg font-bold text-red-800 mb-2">عذراً، حدث خطأ في تحميل الصفحة</h2>
            <p className="text-xs text-red-600 mb-4 font-mono" dir="ltr">{String(this.state.error?.message || this.state.error)}</p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="bg-brand-600 hover:bg-brand-700 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors"
            >
              إعادة تحميل الصفحة
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const App: React.FC = () => {
  return (
    <ERPProvider>
      <AppContent />
    </ERPProvider>
  );
};

export default App;
