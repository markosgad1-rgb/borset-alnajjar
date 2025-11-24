
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
      {renderPage()}
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <ERPProvider>
      <AppContent />
    </ERPProvider>
  );
};

export default App;
