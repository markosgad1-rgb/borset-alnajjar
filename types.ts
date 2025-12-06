
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
  phone?: string; // New Field
  balance: number; // Negative = Debt (Owes us), Positive = Credit (We owe him)
  history: CustomerHistory[];
}

export interface Supplier {
  code: string;
  name: string;
  phone?: string; // New Field
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
  date: string;
  total: number;
  items: InvoiceItem[]; // New: Multiple items support
  previousBalance?: number; // Snapshot of balance before this invoice
  currentBalance?: number; // Snapshot of balance after this invoice
  // Deprecated single-item fields (kept optional for backward compatibility if needed)
  itemCode?: string;
  itemName?: string;
  quantity?: number;
  price?: number;
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

export type PaymentMethod = 'CASH' | 'BANK_MISR' | 'BANK_AHLY' | 'VF_CASH_AYMAN' | 'VF_CASH_KYRILLOS';

export interface TreasuryTransaction {
  id: string;
  invoiceNumber?: string;
  date: string;
  credit: number; // Incoming
  debit: number; // Outgoing
  balance: number; // Running balance (Global)
  paymentMethod: PaymentMethod; // New field
  description: string;
}

export interface User {
  id: string;
  username: string;
  password: string;
  fullName: string;
  role: 'ADMIN' | 'USER';
  permissions: {
    dashboard: boolean;
    sales: boolean;
    warehouse: boolean;
    financial: boolean;
    admin: boolean;
    canDeleteLedgers: boolean;
    canEditWarehouse: boolean; // New: Add/Edit/Delete Products
    canManageTreasury: boolean; // New: Add Opening Balance
    canEditPurchases: boolean; // New: Edit/Delete Purchases
  };
}

export type PageView = 'dashboard' | 'purchases' | 'warehouse' | 'sales' | 'sales-history' | 'customers' | 'suppliers' | 'employees' | 'treasury' | 'collections' | 'transfers' | 'expenses' | 'users';
