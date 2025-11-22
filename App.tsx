
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
import { UserManagement } from './pages/UserManagement';
import { SalesHistory } from './pages/SalesHistory';
import { PageView } from './types';

const AppContent: React.FC = () => {
  const { currentUser } = useERP();
  const [activePage, setActivePage] = useState<PageView>('dashboard');

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
