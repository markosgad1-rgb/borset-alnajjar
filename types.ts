
export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export interface Product {
  code: string;
  name: string;
  quantity: number;
  avgCost: number;
  price: number; // Selling price
}

export interface Customer {
  code: string;
  name: string;
  balance: number; // Negative = Debt (Owes us), Positive = Credit (We owe him)
  history: CustomerHistory[];
}

export interface Supplier {
  code: string;
  name: string;
  balance: number; // Negative = We Owe Him (Liability), Positive = He Owes Us (Asset)
  history: CustomerHistory[];
}

export interface Employee {
  code: string;
  name: string;
  role: string; // Job Title
  salary: number; // Monthly Salary
  balance: number; // Negative = Unpaid Salary (We owe him), Positive = Advance/Solfa (He owes us)
  history: CustomerHistory[];
}

export interface CustomerHistory {
  date: string;
  description: string;
  amount: number; // Change in balance
}

export interface Purchase {
  id: string;
  supplierCode: string; // Linked to Supplier
  supplierName: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  price: number;
  total: number;
  date: string;
}

export interface InvoiceItem {
  itemCode: string;
  itemName: string;
  quantity: number;
  price: number;
  total: number;
}

export interface SalesInvoice {
  id: string; // Invoice Number
  date: string;
  time: string;
  customerCode: string;
  customerName: string;
  items: InvoiceItem[];
  total: number;
  previousBalance: number;
  currentBalance: number;
}

export interface TreasuryTransaction {
  id: string;
  invoiceNumber?: string;
  date: string;
  credit: number; // Incoming
  debit: number; // Outgoing
  balance: number; // Running balance
  description: string;
}

export interface User {
  id: string;
  username: string;
  password: string;
  fullName: string;
  role: 'ADMIN' | 'USER';
  permissions: {
    sales: boolean;      // Access Sales & Customers
    warehouse: boolean;  // Access Warehouse, Purchases & Suppliers
    financial: boolean;  // Access Treasury, Collections, Transfers & Employees
    admin: boolean;      // Access User Management
  };
}

export type PageView = 'dashboard' | 'purchases' | 'warehouse' | 'sales' | 'sales-history' | 'customers' | 'suppliers' | 'employees' | 'treasury' | 'collections' | 'transfers' | 'users';
