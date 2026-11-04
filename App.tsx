
import React, { useState, useEffect } from 'react';
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
import { PageView, User } from './types';

const AppContent: React.FC = () => {
  const { currentUser } = useERP();
  
  // Determine initial page based on permissions
  const getInitialPage = (user: User): PageView => {
    if (user.permissions.dashboard) return 'dashboard';
    if (user.permissions.sales) return 'sales';
    if (user.permissions.warehouse) return 'warehouse';
    if (user.permissions.financial) return 'treasury';
    if (user.permissions.admin) return 'users';
    return 'sales'; // Fallback safe page
  };

  const [activePage, setActivePage] = useState<PageView>('dashboard');

  // Security Check: Validate Page Permissions on User Change
  useEffect(() => {
    if (currentUser) {
      // Map pages to required permissions
      const permissionsMap: Partial<Record<PageView, keyof typeof currentUser.permissions>> = {
        'dashboard': 'dashboard',
        'users': 'admin',
        'sales': 'sales',
        'sales-history': 'sales',
        'customers': 'sales',
        'purchases': 'warehouse',
        'warehouse': 'warehouse',
        'suppliers': 'warehouse',
        'treasury': 'financial',
        'collections': 'financial',
        'transfers': 'financial',
        'expenses': 'financial',
        'employees': 'financial'
      };

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
      case 'users': return <UserManagement />;
      default: return <Dashboard />;
    }
  };

  return (
    <Layout activePage={activePage} onNavigate={setActivePage}>
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
