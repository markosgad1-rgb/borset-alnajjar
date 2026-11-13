
export type BranchId = 'MARG' | 'NOZHA';

export const BRANCHES: { id: BranchId; name: string; nameShort: string }[] = [
  { id: 'MARG', name: 'إدارة المرج', nameShort: 'المرج' },
  { id: 'NOZHA', name: 'إدارة النزهة', nameShort: 'النزهة' }
];

export const BRANCH_AREAS: Record<BranchId, string[]> = {
  MARG: [
    'المرج القديمة',
    'المرج الجديدة',
    'مؤسسة الزكاة',
    '23 يوليو',
    'بركة الحاج',
    'كفر الشرفا',
    'القلج',
    'الخانكة',
    'الخصوص',
    'أخرى'
  ],
  NOZHA: [
    'النزهة الجديدة',
    'مساكن الشيراتون',
    'الحجاز',
    'الألف مسكن',
    'ميدان الحجاز',
    'جسر السويس',
    'مصر الجديدة',
    'عين شمس',
    'أخرى'
  ]
};

// Returns default areas combined with any custom user-entered areas for that branch
export const getBranchAreas = (branchId: BranchId, customersList: { branchId?: BranchId; area?: string }[] = []): string[] => {
  const defaultList = BRANCH_AREAS[branchId] || [];
  const set = new Set<string>(defaultList);
  customersList.forEach(c => {
    if ((c.branchId || 'MARG') === branchId && c.area && c.area.trim()) {
      set.add(c.area.trim());
    }
  });
  return Array.from(set);
};

export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export interface Product {
  code: string;
  name: string;
  quantity: number; // Global / total quantity
  quantityMarg?: number; // Quantity in MARG branch
  quantityNozha?: number; // Quantity in NOZHA branch
  branchQuantities?: {
    MARG: number;
    NOZHA: number;
  };
  avgCost: number;
  cost?: number; // Cost alias
  price: number; // Selling price
}

export interface ManualCustomerTransaction {
  id: string;
  date: string;
  type: 'DEBIT' | 'CREDIT';
  amount: number;
  description: string;
  createdAt: string;
  createdBy?: string;
}

export interface ManualSupplierTransaction {
  id: string;
  date: string;
  type: 'DEBIT' | 'CREDIT';
  amount: number;
  description: string;
  createdAt: string;
  createdBy?: string;
}

export interface Customer {
  code: string;
  name: string;
  phone?: string;
  branchId: BranchId; // Mandatory branch ('MARG' | 'NOZHA')
  area: string; // Mandatory area under branch
  balance: number; // Negative = Debt (Owes us), Positive = Credit (We owe him)
  currentBalance?: number;
  history: CustomerHistory[];
  manualTransactions?: ManualCustomerTransaction[];
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface Supplier {
  code: string;
  name: string;
  phone?: string; // New Field
  balance: number; // Negative = We Owe Him (Liability), Positive = He Owes Us (Asset)
  openingBalance?: number; // Opening balance upon creation (negative = debt to supplier / له علينا, positive = advance payment / لنا عليه)
  createdAt?: string; // Creation date for opening movement
  history: CustomerHistory[];
  manualTransactions?: ManualSupplierTransaction[];
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface SupplierStatementRow {
  id?: string;
  num: number;
  date: string;
  ref: string;
  itemName: string;
  quantity: number | string;
  price: number | string;
  lineTotal: number | string;
  credit: number; // دائن (علينا / توريدات)
  debit: number;  // مدين (لنا / سدادات)
  runningBalance: number;
  status: 'له (علينا)' | 'لنا (عليه)' | 'متزن';
  isInvoiceItem: boolean;
  purchaseId?: string;
  invoiceId?: string;
  invoiceNo?: string;
  paymentId?: string;
  type?: string;
  isOpeningBalance?: boolean;
  description?: string;
  amount?: number;
  historyIndex?: number;
}

export interface Employee {
  code: string;
  name: string;
  role: string; // Job Title
  salary: number; // Monthly Salary
  balance: number; // Negative = Unpaid Salary (We owe him), Positive = Advance/Solfa (He owes us)
  history: CustomerHistory[];
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface CustomerHistory {
  id?: string;
  date: string;
  description: string;
  amount: number; // Change in balance
  invoiceId?: string;
  invoiceNo?: string;
  purchaseId?: string;
  paymentId?: string;
  type?: string;
  rawDescription?: string;
  historyIndex?: number;
}

export interface Purchase {
  id: string;
  branchId?: BranchId; // Receiving branch (defaults to MARG)
  supplierCode: string; // Linked to Supplier
  supplierName: string;
  date: string;
  total: number;
  items: InvoiceItem[]; // Multiple items support
  pricingStatus?: 'PRICED' | 'PENDING_PRICE'; // Support for pending purchase prices
  paid?: number; // Immediate down payment to supplier
  paidAmount?: number;
  remaining?: number; // Remaining debt on invoice
  remainingAmount?: number;
  paymentMethod?: PaymentMethod; // Treasury account used for payment
  previousBalance?: number; // Snapshot of balance before this invoice
  currentBalance?: number; // Snapshot of balance after this invoice
  createdAt?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  supplierPhone?: string;
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
  branchId: BranchId; // Sales branch ('MARG' | 'NOZHA')
  area?: string; // Geographical area
  date: string;
  time: string;
  customerCode: string;
  customerName: string;
  customerPhone?: string;
  items: InvoiceItem[];
  total: number;
  paid?: number;
  paidAmount?: number; // Amount paid immediately
  remaining?: number;
  remainingAmount?: number; // Total - paidAmount
  paymentMethod?: PaymentMethod; // Treasury account where payment was deposited
  previousBalance: number;
  currentBalance: number;
  isDeleted?: boolean;
  deletedAt?: string;
}

export type PaymentMethod = 'CASH' | 'BANK_MISR' | 'BANK_AHLY' | 'VF_CASH_AYMAN' | 'VF_CASH_KYRILLOS';

export interface TreasuryTransaction {
  id: string;
  branchId?: BranchId; // Branch ('MARG' | 'NOZHA', defaults to 'MARG')
  invoiceNumber?: string;
  date: string;
  credit: number; // Incoming
  debit: number; // Outgoing
  balance: number; // Running balance (Global)
  paymentMethod: PaymentMethod; // Treasury account
  description: string;
  type?: 'INCOME' | 'EXPENSE' | TransactionType;
  amount?: number;
  source?: string;
  createdAt?: string;
  timestamp?: number;
  entityType?: 'CUSTOMER' | 'SUPPLIER' | 'EMPLOYEE';
  entityCode?: string;
  entityName?: string;
  transferType?: 'IN' | 'OUT';
}

export interface UserPermissions {
  // القسم الأول: صلاحيات الوصول للصفحات
  canViewSales: boolean;
  canViewInvoicesLog: boolean;
  canViewPurchases: boolean;
  canViewInventory: boolean;
  canViewCustomers: boolean;
  canViewSuppliers: boolean;
  canViewTreasury: boolean;
  canViewReports: boolean;

  // القسم الثاني: صلاحيات الإجراءات الحساسة (الحذف والتعديل)
  canDeleteInvoices: boolean;
  canDeleteCustomers: boolean;
  canDeleteSuppliers: boolean;
  canEditPrices: boolean;
  canEditInvoices: boolean;
  canManageBackup?: boolean;

  // الحقول السابقة للتوافق الكامل
  dashboard?: boolean;
  sales?: boolean;
  warehouse?: boolean;
  financial?: boolean;
  admin?: boolean;
  canDeleteLedgers?: boolean;
  canEditWarehouse?: boolean;
  canManageTreasury?: boolean;
  canEditPurchases?: boolean;
  canDeletePurchases?: boolean;
}

export interface User {
  id: string;
  username: string;
  password: string;
  fullName: string;
  role: 'ADMIN' | 'USER';
  permissions: UserPermissions;
}

export type PageView = 'dashboard' | 'reports' | 'purchases' | 'warehouse' | 'sales' | 'sales-history' | 'customers' | 'suppliers' | 'employees' | 'treasury' | 'collections' | 'transfers' | 'expenses' | 'users' | 'trash' | 'activity';

export interface SystemBackup {
  version: string;
  systemName: string;
  exportedAt: string;
  exportedBy: string;
  stats: {
    customersCount: number;
    suppliersCount: number;
    invoicesCount: number;
    purchasesCount: number;
    productsCount: number;
    treasuryCount: number;
    employeesCount: number;
    usersCount: number;
  };
  data: {
    customers: Customer[];
    suppliers: Supplier[];
    products: Product[];
    employees: Employee[];
    invoices: SalesInvoice[];
    purchases: Purchase[];
    treasury: TreasuryTransaction[];
    users?: User[];
    companyLogo?: string | null;
  };
}
