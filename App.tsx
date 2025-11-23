
import React, { useState } from 'react';
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
    return 'dashboard'; // Fallback
  };

  const [activePage, setActivePage] = useState<PageView>(() => {
    return currentUser ? getInitialPage(currentUser) : 'dashboard';
  });

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
