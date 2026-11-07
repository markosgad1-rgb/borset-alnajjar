
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Product, Customer, Supplier, Employee, Purchase, SalesInvoice, TreasuryTransaction, InvoiceItem, User, PaymentMethod, SystemBackup, BranchId } from '../types';
import { app, db, isFirebaseConfigured, firebaseConfig } from '../firebaseConfig';
import * as XLSX from 'xlsx';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy 
} from 'firebase/firestore';

interface ERPContextType {
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  employees: Employee[];
  purchases: Purchase[];
  invoices: SalesInvoice[];
  treasury: TreasuryTransaction[];
  users: User[];
  currentUser: User | null;
  isOnline: boolean;
  permissionError: boolean;
  companyLogo: string | null;
  
  // Auth
  login: (username: string, password: string) => boolean;
  logout: () => void;
  
  // CRUD
  addProduct: (product: Product) => Promise<boolean>;
  updateProduct: (product: Product, oldCode?: string) => Promise<boolean>;
  deleteProduct: (code: string) => Promise<boolean>;
  clearAllProducts: () => Promise<boolean>;
  deduplicateProducts: () => Promise<{ duplicatesRemoved: number }>;
  transferStockBetweenBranches: (params: {
    itemCode: string;
    fromBranch: BranchId;
    toBranch: BranchId;
    quantity: number;
    notes?: string;
  }) => Promise<boolean>;
  transferCashBetweenBranches: (params: {
    fromBranch: BranchId;
    toBranch: BranchId;
    amount: number;
    paymentMethod: PaymentMethod;
    date: string;
    notes?: string;
  }) => Promise<boolean>;
  addPurchase: (purchase: Omit<Purchase, 'previousBalance' | 'currentBalance'>) => void;
  updatePurchase: (oldPurchase: Purchase, newPurchaseData: Purchase) => Promise<void>;
  finalizePurchasePrice: (purchaseId: string, updatedItems: InvoiceItem[], newTotal: number) => Promise<boolean>;
  deletePurchase: (id: string) => Promise<void>;
  addInvoice: (invoiceData: {
    id: string;
    branchId?: BranchId;
    area?: string;
    date: string;
    time: string;
    customerCode: string;
    customerName: string;
    items: InvoiceItem[];
    total: number;
    paidAmount?: number;
    remainingAmount?: number;
    paymentMethod?: PaymentMethod;
  }) => Promise<void>;
  updateInvoice: (oldInvoice: SalesInvoice, newInvoiceData: SalesInvoice) => Promise<void>; 
  deleteInvoice: (id: string) => Promise<void>;
  clearAllInvoices: () => Promise<boolean>; 
  addCollection: (data: {
    customerCode: string;
    customerName?: string;
    invoiceId?: string;
    amount: number;
    date: string;
    paymentMethod: PaymentMethod;
    notes?: string;
  }) => Promise<void>;
  addTransfer: (data: {
    branchId?: BranchId;
    entityType: 'CUSTOMER' | 'SUPPLIER' | 'EMPLOYEE';
    entityCode: string;
    amount: number;
    type: 'IN' | 'OUT';
    date: string;
    notes?: string;
    paymentMethod: PaymentMethod;
  }) => Promise<void>;
  addExpense: (data: {
    branchId?: BranchId;
    name: string;
    amount: number;
    date: string;
    notes?: string;
  }) => Promise<void>;
  addOpeningBalance: (data: {
    branchId?: BranchId;
    amount: number;
    date: string;
    paymentMethod: PaymentMethod;
    notes?: string;
  }) => Promise<void>; 

  addCustomer: (customer: Customer) => void;
  updateCustomer: (code: string, updatedData: Partial<Customer>) => void;
  deleteCustomer: (code: string) => Promise<void>;
  addSupplier: (supplier: Supplier) => void;
  updateSupplier: (code: string, updatedData: Partial<Supplier>) => void;
  deleteSupplier: (code: string) => Promise<{ success: boolean; message?: string }>;
  addEmployee: (employee: Employee) => void;
  updateEmployee: (code: string, updatedData: Partial<Employee>) => void;
  deleteEmployee: (code: string) => Promise<void>;
  
  // Trash and Soft Delete operations
  restoreEntity: (type: 'customer' | 'supplier' | 'invoice' | 'purchase', id: string) => Promise<{ success: boolean; message?: string }>;
  permanentDeleteEntity: (type: 'customer' | 'supplier' | 'invoice' | 'purchase', id: string) => Promise<{ success: boolean; message?: string }>;
  
  // User Management
  addUser: (user: User) => void;
  updateUser: (id: string, updatedData: Partial<User>) => void;
  deleteUser: (id: string) => Promise<boolean>;
  updateSystemLogo: (base64Image: string) => Promise<void>;

  seedDatabase: () => Promise<void>;
  printInvoice: (invoice: SalesInvoice) => void;
  printPurchaseInvoice: (purchase: Purchase) => void; 
  printLedger: (options: {
    title: string;
    entityName: string;
    entityCode: string;
    entityPhone?: string;
    type: 'CUSTOMER' | 'SUPPLIER';
    rows: Array<{
      num: number;
      date: string;
      ref?: string;
      itemName: string;
      quantity?: number | string;
      price?: number | string;
      lineTotal?: number | string;
      debit: number;
      credit: number;
      runningBalance: number;
    }>;
    totalDebit: number;
    totalCredit: number;
    finalBalance: number;
    dateRange?: { from?: string; to?: string };
  }) => void;
  printConsolidatedLedger: (options: {
    title: string;
    reportType: 'CUSTOMERS' | 'SUPPLIERS' | 'ALL';
    dateRange?: { from?: string; to?: string };
    mode: 'BALANCES' | 'MOVEMENTS';
    balanceRows?: Array<{
      num: number;
      code: string;
      name: string;
      phone?: string;
      entityType?: 'CUSTOMER' | 'SUPPLIER';
      priorBalance: number;
      debit: number;
      credit: number;
      finalBalance: number;
      status: 'مدين' | 'دائن' | 'متزن';
    }>;
    movementRows?: Array<{
      num: number;
      date: string;
      entityName: string;
      entityCode: string;
      ref?: string;
      itemName: string;
      quantity?: number | string;
      price?: number | string;
      lineTotal?: number | string;
      debit: number;
      credit: number;
    }>;
    totalDebit: number;
    totalCredit: number;
    finalBalance: number;
  }) => void;
  exportLedgerToExcel: (entityName: string, entityCode: string, history: any[], currentBalance: number, type: 'CUSTOMER' | 'SUPPLIER', isItemized?: boolean) => void;
  exportAllCustomersToExcel: () => void;
  exportAllSuppliersToExcel: () => void;
  clearLedger: (entityType: 'CUSTOMER' | 'SUPPLIER' | 'EMPLOYEE', code: string) => Promise<boolean>;
  clearTreasury: () => Promise<boolean>;
  exportBackupData: () => SystemBackup;
  restoreBackupData: (backup: SystemBackup) => Promise<{ success: boolean; message: string }>;

  currentTreasuryBalance: number;
  currentTreasuryBalanceMarg: number;
  currentTreasuryBalanceNozha: number;
  balances: {
    cash: number;
    bankMisr: number;
    bankAhly: number;
    vfCashAyman: number;
    vfCashKyrillos: number;
  };
}

const ERPContext = createContext<ERPContextType | undefined>(undefined);

// --- Storage Helpers (Local) ---
const STORAGE_KEYS = {
  USERS: 'erp_users',
  PRODUCTS: 'erp_products',
  CUSTOMERS: 'erp_customers',
  SUPPLIERS: 'erp_suppliers',
  EMPLOYEES: 'erp_employees',
  PURCHASES: 'erp_purchases',
  INVOICES: 'erp_invoices',
  TREASURY: 'erp_treasury',
  CURRENT_USER: 'erp_current_user',
  COMPANY_LOGO: 'erp_logo'
};

// Helper to recursively remove all undefined properties so Firestore never throws unsupported field value error
export const cleanDoc = <T = any>(obj: T): T => {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(cleanDoc) as any;
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) {
        res[k] = cleanDoc(v);
      }
    }
    return res as any;
  }
  return obj;
};

// Helper to patch user objects with granular permissions
const sanitizeUser = (user: any): User => {
  if (!user) return user;
  
  // If admin or role === 'ADMIN', grant full unrestricted permissions
  if (user.role === 'ADMIN' || user.username === 'admin') {
    return {
      ...user,
      role: 'ADMIN',
      permissions: {
        canViewSales: true,
        canViewInvoicesLog: true,
        canViewPurchases: true,
        canViewInventory: true,
        canViewCustomers: true,
        canViewSuppliers: true,
        canViewTreasury: true,
        canViewReports: true,
        canDeleteInvoices: true,
        canDeleteCustomers: true,
        canDeleteSuppliers: true,
        canEditPrices: true,
        canEditInvoices: true,
        canManageBackup: true,
        dashboard: true,
        sales: true,
        warehouse: true,
        financial: true,
        admin: true,
        canDeleteLedgers: true,
        canEditWarehouse: true,
        canManageTreasury: true,
        canEditPurchases: true,
      }
    };
  }

  const p = user.permissions || {};
  return {
    ...user,
    permissions: {
      canViewSales: Boolean(p.canViewSales ?? p.sales ?? false),
      canViewInvoicesLog: Boolean(p.canViewInvoicesLog ?? p.sales ?? false),
      canViewPurchases: Boolean(p.canViewPurchases ?? p.warehouse ?? false),
      canViewInventory: Boolean(p.canViewInventory ?? p.warehouse ?? false),
      canViewCustomers: Boolean(p.canViewCustomers ?? p.sales ?? false),
      canViewSuppliers: Boolean(p.canViewSuppliers ?? p.warehouse ?? false),
      canViewTreasury: Boolean(p.canViewTreasury ?? p.financial ?? false),
      canViewReports: Boolean(p.canViewReports ?? p.dashboard ?? false),
      canDeleteInvoices: Boolean(p.canDeleteInvoices ?? false),
      canDeleteCustomers: Boolean(p.canDeleteCustomers ?? false),
      canDeleteSuppliers: Boolean(p.canDeleteSuppliers ?? false),
      canEditPrices: Boolean(p.canEditPrices ?? p.canEditWarehouse ?? false),
      canEditInvoices: Boolean(p.canEditInvoices ?? false),
      canManageBackup: Boolean(p.canManageBackup ?? p.admin ?? false),
      dashboard: Boolean(p.dashboard ?? p.canViewReports ?? false),
      sales: Boolean(p.sales ?? p.canViewSales ?? false),
      warehouse: Boolean(p.warehouse ?? p.canViewInventory ?? false),
      financial: Boolean(p.financial ?? p.canViewTreasury ?? false),
      admin: Boolean(p.admin ?? false),
      canDeleteLedgers: Boolean(p.canDeleteLedgers ?? false),
      canEditWarehouse: Boolean(p.canEditWarehouse ?? p.canEditPrices ?? false),
      canManageTreasury: Boolean(p.canManageTreasury ?? false),
      canEditPurchases: Boolean(p.canEditPurchases ?? false),
    }
  };
};

// Initial Mock Data
const INITIAL_USERS: User[] = [
  sanitizeUser({ 
    id: '1', 
    username: 'admin', 
    password: 'Mero@2211', 
    fullName: 'المدير العام', 
    role: 'ADMIN', 
    permissions: {} 
  })
];

export const ERPProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Mode Flag
  const isOnline = !!db;
  const [permissionError, setPermissionError] = useState(false);

  // --- State ---
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      return saved ? sanitizeUser(JSON.parse(saved)) : null;
    }
    return null;
  });
  
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [treasury, setTreasury] = useState<TreasuryTransaction[]>([]);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);

  // Calculate Balances dynamically
  const currentTreasuryBalance = treasury.reduce((acc, t) => acc + (t.credit - t.debit), 0);
  const currentTreasuryBalanceMarg = treasury.filter(t => (t.branchId || 'MARG') === 'MARG').reduce((acc, t) => acc + (t.credit - t.debit), 0);
  const currentTreasuryBalanceNozha = treasury.filter(t => t.branchId === 'NOZHA').reduce((acc, t) => acc + (t.credit - t.debit), 0);
  
  const balances = {
    cash: treasury.filter(t => t.paymentMethod === 'CASH' || !t.paymentMethod).reduce((acc, t) => acc + (t.credit - t.debit), 0),
    bankMisr: treasury.filter(t => t.paymentMethod === 'BANK_MISR').reduce((acc, t) => acc + (t.credit - t.debit), 0),
    bankAhly: treasury.filter(t => t.paymentMethod === 'BANK_AHLY').reduce((acc, t) => acc + (t.credit - t.debit), 0),
    vfCashAyman: treasury.filter(t => t.paymentMethod === 'VF_CASH_AYMAN').reduce((acc, t) => acc + (t.credit - t.debit), 0),
    vfCashKyrillos: treasury.filter(t => t.paymentMethod === 'VF_CASH_KYRILLOS').reduce((acc, t) => acc + (t.credit - t.debit), 0),
  };

  // --- Data Sync Logic (Effect) ---
  useEffect(() => {
    if (isOnline) {
      const unsubs: Function[] = [];
      const handleSnapshotError = (error: any) => {
        console.error("Firestore onSnapshot listener error:", error);
        if (error.code === 'permission-denied' || error.message?.includes('permission-denied')) {
          setPermissionError(true);
        }
      };

      try {
        // 1. Settings (Company Logo & Info)
        unsubs.push(onSnapshot(doc(db, 'settings', 'general'), (docSnap: any) => {
           if (docSnap.exists()) {
             const data = docSnap.data();
             if (data.logo) setCompanyLogo(data.logo);
           }
        }, handleSnapshotError));

        // 2. Users Collection
        unsubs.push(onSnapshot(collection(db, 'users'), (snap: any) => {
           setPermissionError(false);
           const loadedUsers = snap.docs.map((d: any) => sanitizeUser({ ...d.data(), id: d.id || d.data().id }));
           setUsers(loadedUsers);
           
           if (loadedUsers.length === 0) {
              const adminUser = sanitizeUser({ 
                id: '1', username: 'admin', password: 'Mero@2211', fullName: 'المدير العام', role: 'ADMIN', permissions: {} 
              });
              setDoc(doc(db, 'users', '1'), adminUser).catch(console.error);
           } else {
              setCurrentUser(prev => {
                if (!prev) return null;
                const live = loadedUsers.find(u => u.id === prev.id || u.username === prev.username);
                return live ? sanitizeUser(live) : prev;
              });
           }
        }, handleSnapshotError));

        // 3. Products Collection
        unsubs.push(onSnapshot(collection(db, 'products'), (snap: any) => {
          const map = new Map<string, Product>();
          snap.docs.forEach((d: any) => {
            const data = d.data() as Product;
            const code = (data.code || d.id || '').trim();
            if (!code) return;
            const key = code.toLowerCase();

            const rawMarg = data.quantityMarg !== undefined ? Number(data.quantityMarg) : (data.quantity !== undefined ? Number(data.quantity) : 0);
            const rawNozha = data.quantityNozha !== undefined ? Number(data.quantityNozha) : 0;
            const qMarg = isNaN(rawMarg) ? 0 : rawMarg;
            const qNozha = isNaN(rawNozha) ? 0 : rawNozha;
            const totalQ = qMarg + qNozha;

            map.set(key, {
              ...data,
              code,
              name: data.name || code,
              quantityMarg: qMarg,
              quantityNozha: qNozha,
              quantity: totalQ,
              avgCost: typeof data.avgCost === 'number' ? data.avgCost : (Number(data.avgCost) || 0),
              price: typeof data.price === 'number' ? data.price : (Number(data.price) || 0)
            });
          });
          setProducts(Array.from(map.values()));
        }, handleSnapshotError));

        // 4. Customers Collection
        unsubs.push(onSnapshot(collection(db, 'customers'), (snap: any) => {
          const map = new Map<string, Customer>();
          snap.docs.forEach((d: any) => {
            const data = d.data() as Customer;
            const code = (data.code || d.id || '').trim();
            if (!code) return;
            const key = code.toLowerCase();
            const bId: BranchId = data.branchId === 'NOZHA' ? 'NOZHA' : 'MARG';
            const cArea = data.area || (bId === 'NOZHA' ? 'النزهة الجديدة' : 'المرج القديمة');

            map.set(key, {
              ...data,
              code,
              name: data.name || code,
              phone: data.phone || '',
              branchId: bId,
              area: cArea,
              balance: typeof data.balance === 'number' ? data.balance : (Number(data.balance) || 0),
              history: Array.isArray(data.history) ? data.history : [],
              isDeleted: Boolean(data.isDeleted)
            });
          });
          setCustomers(Array.from(map.values()));
        }, handleSnapshotError));

        // 5. Suppliers Collection
        unsubs.push(onSnapshot(collection(db, 'suppliers'), (snap: any) => {
          const map = new Map<string, Supplier>();
          snap.docs.forEach((d: any) => {
            const data = d.data() as Supplier;
            const code = (data.code || d.id || '').trim();
            if (!code) return;
            const key = code.toLowerCase();
            map.set(key, {
              ...data,
              code,
              name: data.name || code,
              phone: data.phone || '',
              balance: typeof data.balance === 'number' ? data.balance : (Number(data.balance) || 0),
              history: Array.isArray(data.history) ? data.history : [],
              isDeleted: Boolean(data.isDeleted)
            });
          });
          setSuppliers(Array.from(map.values()));
        }, handleSnapshotError));

        // 6. Employees Collection
        unsubs.push(onSnapshot(collection(db, 'employees'), (snap: any) => {
          const map = new Map<string, Employee>();
          snap.docs.forEach((d: any) => {
            const data = d.data() as Employee;
            const code = (data.code || d.id || '').trim();
            if (!code) return;
            const key = code.toLowerCase();
            map.set(key, {
              ...data,
              code,
              name: data.name || code,
              role: data.role || '',
              salary: typeof data.salary === 'number' ? data.salary : (Number(data.salary) || 0),
              balance: typeof data.balance === 'number' ? data.balance : (Number(data.balance) || 0),
              history: Array.isArray(data.history) ? data.history : [],
              isDeleted: Boolean(data.isDeleted)
            });
          });
          setEmployees(Array.from(map.values()));
        }, handleSnapshotError));
        
        // 7. Purchases Collection
        unsubs.push(onSnapshot(collection(db, 'purchases'), (snap: any) => {
          const list = snap.docs.map((d: any) => {
            const data = d.data() as Purchase;
            return {
              ...data,
              id: data.id || d.id,
              branchId: (data.branchId === 'NOZHA' ? 'NOZHA' : 'MARG') as BranchId
            };
          });
          list.sort((a: any, b: any) => {
            const dateComp = (b.date || '').localeCompare(a.date || '');
            if (dateComp !== 0) return dateComp;
            return (b.id || '').localeCompare(a.id || '');
          });
          setPurchases(list);
        }, handleSnapshotError));
        
        // 8. Invoices Collection
        unsubs.push(onSnapshot(collection(db, 'invoices'), (snap: any) => {
          const list = snap.docs.map((d: any) => {
            const data = d.data() as SalesInvoice;
            return {
              ...data,
              id: data.id || d.id,
              branchId: (data.branchId === 'NOZHA' ? 'NOZHA' : 'MARG') as BranchId,
              area: data.area || ''
            };
          });
          list.sort((a: any, b: any) => {
            const dateComp = (b.date || '').localeCompare(a.date || '');
            if (dateComp !== 0) return dateComp;
            return (b.id || '').localeCompare(a.id || '');
          });
          setInvoices(list);
        }, handleSnapshotError));
        
        // 9. Treasury Collection
        unsubs.push(onSnapshot(collection(db, 'treasury'), (snap: any) => {
           const data = snap.docs.map((d: any) => {
             const t = d.data() as TreasuryTransaction;
             return {
               ...t,
               id: t.id || d.id,
               branchId: (t.branchId === 'NOZHA' ? 'NOZHA' : 'MARG') as BranchId,
               debit: Number(t.debit) || 0,
               credit: Number(t.credit) || 0
             };
           });
           data.sort((a: any, b: any) => {
             const dateComp = (b.date || '').localeCompare(a.date || '');
             if (dateComp !== 0) return dateComp;
             return (b.id || '').localeCompare(a.id || '');
           });
           setTreasury(data);
        }, handleSnapshotError));
      } catch (err) {
        console.error("Error setting up Firestore real-time listeners:", err);
      }

      return () => unsubs.forEach(u => u && u());

    } else {
      // In online cloud mode, Firestore is the sole source of truth.
    }
  }, [isOnline]);

  useEffect(() => {
    if (!isOnline) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
      localStorage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify(suppliers));
      localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees));
      localStorage.setItem(STORAGE_KEYS.PURCHASES, JSON.stringify(purchases));
      localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(invoices));
      localStorage.setItem(STORAGE_KEYS.TREASURY, JSON.stringify(treasury));
      if(companyLogo) localStorage.setItem(STORAGE_KEYS.COMPANY_LOGO, companyLogo);
    }
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
  }, [users, products, customers, suppliers, employees, purchases, invoices, treasury, currentUser, companyLogo, isOnline]);


  const handleFirebaseError = (error: any) => {
    console.error("Firebase Error:", error);
    const msg = error?.message || JSON.stringify(error);
    if (error.code === 'permission-denied' || msg.includes('permission-denied')) {
      setPermissionError(true);
      alert("⛔ خطأ حرج: ممنوع الكتابة في قاعدة البيانات!\n\nالسبب: إعدادات الأمان (Rules) في Firebase تمنع الحفظ.\n\nالحل: افتح موقع Firebase > Firestore Database > Rules\nوغير الكود إلى: allow read, write: if true;");
    } else {
      alert("حدث خطأ أثناء الاتصال بقاعدة البيانات:\n" + msg);
    }
  };

  const login = (usernameInput: string, passwordInput: string) => {
    const username = usernameInput.trim();
    const password = passwordInput.trim();

    if (username === 'admin' && password === 'Mero@2211') {
       const adminUser = sanitizeUser({ 
         id: '1', 
         username: 'admin', 
         password: 'Mero@2211', 
         fullName: 'المدير العام', 
         role: 'ADMIN', 
         permissions: {} 
       });
       setCurrentUser(adminUser);
       if (isOnline) {
         setDoc(doc(db, 'users', '1'), adminUser).catch((e: any) => console.log("Admin seed check:", e));
       }
       return true;
    }

    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      setCurrentUser(sanitizeUser(user));
      return true;
    }
    
    return false;
  };

  const logout = () => setCurrentUser(null);

  const addProduct = async (product: Product): Promise<boolean> => {
    const cleanCode = (product.code || '').trim();
    const cleanName = (product.name || '').trim();
    if (!cleanCode || !cleanName) return false;

    const rawMarg = product.quantityMarg !== undefined ? Number(product.quantityMarg) : Number(product.quantity || 0);
    const rawNozha = product.quantityNozha !== undefined ? Number(product.quantityNozha) : 0;
    const qMarg = isNaN(rawMarg) ? 0 : rawMarg;
    const qNozha = isNaN(rawNozha) ? 0 : rawNozha;

    const sanitizedProduct: Product = {
      ...product,
      code: cleanCode,
      name: cleanName,
      quantityMarg: qMarg,
      quantityNozha: qNozha,
      quantity: qMarg + qNozha
    };

    // Strict duplicate check against current products state (case-insensitive & trimmed)
    const exists = products.some(p => (p.code || '').trim().toLowerCase() === cleanCode.toLowerCase());
    if (exists) {
      alert(`كود الصنف (${cleanCode}) مسجل بالفعل مسبقاً! يرجى اختيار كود آخر.`);
      return false;
    }

    if (isOnline) {
      try {
        await setDoc(doc(db, 'products', cleanCode), cleanDoc(sanitizedProduct));
        // Synchronous & deduplicated state update so UI updates immediately without duplicates
        setProducts(prev => {
          const map = new Map<string, Product>();
          prev.forEach(p => {
            const c = (p.code || '').trim();
            if (c) map.set(c.toLowerCase(), { ...p, code: c });
          });
          map.set(cleanCode.toLowerCase(), sanitizedProduct);
          return Array.from(map.values());
        });
        return true;
      } catch (e) {
        handleFirebaseError(e);
        return false;
      }
    } else {
      setProducts(prev => {
        const map = new Map<string, Product>();
        prev.forEach(p => {
          const c = (p.code || '').trim();
          if (c) map.set(c.toLowerCase(), { ...p, code: c });
        });
        map.set(cleanCode.toLowerCase(), sanitizedProduct);
        return Array.from(map.values());
      });
      return true;
    }
  };

  const updateProduct = async (updatedProduct: Product, oldCode?: string): Promise<boolean> => {
    const cleanNewCode = (updatedProduct.code || '').trim();
    const cleanOldCode = (oldCode || cleanNewCode).trim();

    const rawMarg = updatedProduct.quantityMarg !== undefined ? Number(updatedProduct.quantityMarg) : Number(updatedProduct.quantity || 0);
    const rawNozha = updatedProduct.quantityNozha !== undefined ? Number(updatedProduct.quantityNozha) : 0;
    const qMarg = isNaN(rawMarg) ? 0 : rawMarg;
    const qNozha = isNaN(rawNozha) ? 0 : rawNozha;

    const sanitizedProduct: Product = {
      ...updatedProduct,
      code: cleanNewCode,
      name: (updatedProduct.name || '').trim(),
      quantityMarg: qMarg,
      quantityNozha: qNozha,
      quantity: qMarg + qNozha
    };

    setProducts(prev => {
      const map = new Map<string, Product>();
      prev.forEach(p => {
        const c = (p.code || '').trim();
        if (c && c.toLowerCase() !== cleanOldCode.toLowerCase()) {
          map.set(c.toLowerCase(), { ...p, code: c });
        }
      });
      map.set(cleanNewCode.toLowerCase(), sanitizedProduct);
      return Array.from(map.values());
    });

    if (isOnline) {
      try {
        if (cleanOldCode && cleanOldCode.toLowerCase() !== cleanNewCode.toLowerCase()) {
          await deleteDoc(doc(db, 'products', cleanOldCode));
          await setDoc(doc(db, 'products', cleanNewCode), cleanDoc(sanitizedProduct));
        } else {
          await setDoc(doc(db, 'products', cleanNewCode), cleanDoc(sanitizedProduct));
        }
        return true;
      } catch (e) {
        handleFirebaseError(e);
        return false;
      }
    }
    return true;
  };

  const deleteProduct = async (code: string): Promise<boolean> => {
    const cleanCode = (code || '').trim();
    setProducts(prev => prev.filter(p => (p.code || '').trim().toLowerCase() !== cleanCode.toLowerCase()));
    if (isOnline) {
      try {
        await deleteDoc(doc(db, 'products', cleanCode));
        return true;
      } catch (e) {
        handleFirebaseError(e);
        return false;
      }
    }
    return true;
  };

  const deduplicateProducts = async (): Promise<{ duplicatesRemoved: number }> => {
    const map = new Map<string, Product>();
    let dupCount = 0;

    products.forEach(p => {
      const c = (p.code || '').trim();
      if (!c) return;
      const key = c.toLowerCase();
      if (map.has(key)) {
        dupCount++;
        const ex = map.get(key)!;
        map.set(key, {
          ...ex,
          name: ex.name || p.name,
          quantity: Math.max(ex.quantity || 0, p.quantity || 0),
          avgCost: ex.avgCost || p.avgCost || 0,
          price: ex.price || p.price || 0,
          code: c
        });
      } else {
        map.set(key, { ...p, code: c });
      }
    });

    const uniqueProducts = Array.from(map.values());
    setProducts(uniqueProducts);
    try {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(uniqueProducts));
    } catch (_) {}

    if (isOnline) {
      try {
        const colRef = collection(db, 'products');
        const snap = await getDocs(colRef);
        const seenCodes = new Set<string>();
        for (const d of snap.docs) {
          const data = d.data() as Product;
          const codeKey = (data.code || d.id || '').trim().toLowerCase();
          if (seenCodes.has(codeKey) || d.id !== data.code) {
            await deleteDoc(d.ref).catch(console.warn);
            dupCount++;
          } else {
            seenCodes.add(codeKey);
          }
        }
        for (const prod of uniqueProducts) {
          await setDoc(doc(db, 'products', prod.code), cleanDoc(prod));
        }
      } catch (e) {
        console.error("Firestore deduplicate error:", e);
      }
    }

    return { duplicatesRemoved: dupCount };
  };

  const clearAllProducts = async (): Promise<boolean> => {
    try {
      setProducts([]);
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify([]));
      if (isOnline) {
        const q = query(collection(db, 'products'));
        const snapshot = await getDocs(q);
        const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
        await Promise.all(deletePromises);
      }
      return true;
    } catch (e) {
      handleFirebaseError(e);
      return false;
    }
  };

  const transferStockBetweenBranches = async (params: {
    itemCode: string;
    fromBranch: BranchId;
    toBranch: BranchId;
    quantity: number;
    notes?: string;
  }): Promise<boolean> => {
    const { itemCode, fromBranch, toBranch, quantity } = params;
    if (fromBranch === toBranch) {
      alert("لا يمكن التحويل لنفس الإدارة");
      return false;
    }
    if (quantity <= 0) {
      alert("يرجى إدخال كمية صحيحة للتحويل");
      return false;
    }
    const cleanCode = itemCode.trim();
    const product = products.find(p => (p.code || '').trim().toLowerCase() === cleanCode.toLowerCase());
    if (!product) {
      alert("الصنف غير موجود بالمخزن");
      return false;
    }

    const fromStock = fromBranch === 'NOZHA' 
      ? (product.quantityNozha !== undefined ? product.quantityNozha : 0) 
      : (product.quantityMarg !== undefined ? product.quantityMarg : product.quantity);

    if (quantity > fromStock) {
      alert(`الكمية المطلوبة للتحويل (${quantity}) أكبر من الرصيد المتوفر في ${fromBranch === 'NOZHA' ? 'إدارة النزهة' : 'إدارة المرج'} (${fromStock})`);
      return false;
    }

    const currentMarg = product.quantityMarg !== undefined ? product.quantityMarg : product.quantity;
    const currentNozha = product.quantityNozha !== undefined ? product.quantityNozha : 0;

    const newMarg = fromBranch === 'MARG' ? currentMarg - quantity : currentMarg + quantity;
    const newNozha = fromBranch === 'NOZHA' ? currentNozha - quantity : currentNozha + quantity;
    const totalQ = newMarg + newNozha;

    const updatedProduct: Product = {
      ...product,
      quantityMarg: newMarg,
      quantityNozha: newNozha,
      quantity: totalQ
    };

    setProducts(prev => prev.map(p => (p.code || '').trim().toLowerCase() === cleanCode.toLowerCase() ? updatedProduct : p));

    if (isOnline) {
      try {
        const pRef = doc(db, 'products', product.code);
        await updateDoc(pRef, {
          quantityMarg: newMarg,
          quantityNozha: newNozha,
          quantity: totalQ
        });
      } catch (e) {
        handleFirebaseError(e);
        return false;
      }
    }
    return true;
  };

  const transferCashBetweenBranches = async (params: {
    fromBranch: BranchId;
    toBranch: BranchId;
    amount: number;
    paymentMethod: PaymentMethod;
    date: string;
    notes?: string;
  }): Promise<boolean> => {
    const { fromBranch, toBranch, amount, paymentMethod, date, notes } = params;
    if (fromBranch === toBranch) {
      alert("لا يمكن التحويل لنفس الخزينة");
      return false;
    }
    if (amount <= 0) {
      alert("يرجى إدخال مبلغ صحيح");
      return false;
    }

    const fromName = fromBranch === 'NOZHA' ? 'إدارة النزهة' : 'إدارة المرج';
    const toName = toBranch === 'NOZHA' ? 'إدارة النزهة' : 'إدارة المرج';

    const tOutId = `TR_OUT_${Date.now()}`;
    const tInId = `TR_IN_${Date.now() + 1}`;

    const txOut: TreasuryTransaction = {
      id: tOutId,
      branchId: fromBranch,
      date,
      credit: 0,
      debit: amount,
      balance: 0,
      paymentMethod,
      description: `تحويل نقدية إلى ${toName}${notes ? ` - ${notes}` : ''}`
    };

    const txIn: TreasuryTransaction = {
      id: tInId,
      branchId: toBranch,
      date,
      credit: amount,
      debit: 0,
      balance: 0,
      paymentMethod,
      description: `تحويل نقدية وارد من ${fromName}${notes ? ` - ${notes}` : ''}`
    };

    setTreasury(prev => [...prev, txOut, txIn]);

    if (isOnline) {
      try {
        await setDoc(doc(db, 'treasury', tOutId), cleanDoc(txOut));
        await setDoc(doc(db, 'treasury', tInId), cleanDoc(txIn));
      } catch (e) {
        handleFirebaseError(e);
        return false;
      }
    }
    return true;
  };
  
  const addCustomer = async (customer: Customer) => {
    const cleanCode = (customer.code || '').trim();
    if (!cleanCode) return;
    const bId: BranchId = customer.branchId === 'NOZHA' ? 'NOZHA' : 'MARG';
    const cArea = customer.area?.trim() || (bId === 'NOZHA' ? 'النزهة الجديدة' : 'المرج القديمة');
    const sanitized: Customer = {
      ...customer,
      code: cleanCode,
      name: (customer.name || '').trim(),
      branchId: bId,
      area: cArea
    };
    setCustomers(prev => {
      const map = new Map<string, Customer>();
      prev.forEach(c => {
        const code = (c.code || '').trim();
        if (code) map.set(code.toLowerCase(), { ...c, code });
      });
      map.set(cleanCode.toLowerCase(), sanitized);
      return Array.from(map.values());
    });
    if (isOnline) {
      try { await setDoc(doc(db, 'customers', cleanCode), cleanDoc(sanitized)); }
      catch (e) { handleFirebaseError(e); }
    }
  };

  const updateCustomer = async (code: string, updatedData: Partial<Customer>) => {
    const cleanCode = (code || '').trim();
    const customer = customers.find(c => (c.code || '').trim().toLowerCase() === cleanCode.toLowerCase());
    if (!customer) return;
    const newCustomer = { ...customer, ...updatedData };
    if (updatedData.code) newCustomer.code = updatedData.code.trim();
    if (updatedData.branchId) newCustomer.branchId = updatedData.branchId;
    if (updatedData.area !== undefined) newCustomer.area = updatedData.area;

    setCustomers(prev => {
      const map = new Map<string, Customer>();
      prev.forEach(c => {
        const cCode = (c.code || '').trim();
        if (cCode && cCode.toLowerCase() !== cleanCode.toLowerCase()) {
          map.set(cCode.toLowerCase(), { ...c, code: cCode });
        }
      });
      map.set((newCustomer.code || cleanCode).toLowerCase(), newCustomer);
      return Array.from(map.values());
    });

    if (isOnline) {
      try {
        if (updatedData.code && updatedData.code.trim().toLowerCase() !== cleanCode.toLowerCase()) {
          await deleteDoc(doc(db, 'customers', cleanCode));
          await setDoc(doc(db, 'customers', newCustomer.code), cleanDoc(newCustomer));
        } else {
          await setDoc(doc(db, 'customers', cleanCode), cleanDoc(newCustomer));
        }
      } catch (e) { handleFirebaseError(e); }
    }
  };

  const deleteCustomer = async (code: string) => {
    const cleanCode = (code || '').trim();
    const now = new Date().toISOString();
    setCustomers(prev => prev.map(c => (c.code || '').trim().toLowerCase() === cleanCode.toLowerCase() ? { ...c, isDeleted: true, deletedAt: now } : c));
    if (isOnline) {
      try { 
        await setDoc(doc(db, 'customers', cleanCode), cleanDoc({ isDeleted: true, deletedAt: now }), { merge: true }); 
      }
      catch (e) { handleFirebaseError(e); }
    }
  };

  const addSupplier = async (supplier: Supplier) => {
    const cleanCode = (supplier.code || '').trim();
    if (!cleanCode) return;
    const sanitized = { ...supplier, code: cleanCode, name: (supplier.name || '').trim() };
    setSuppliers(prev => {
      const map = new Map<string, Supplier>();
      prev.forEach(s => {
        const code = (s.code || '').trim();
        if (code) map.set(code.toLowerCase(), { ...s, code });
      });
      map.set(cleanCode.toLowerCase(), sanitized);
      return Array.from(map.values());
    });
    if (isOnline) {
      try { await setDoc(doc(db, 'suppliers', cleanCode), cleanDoc(sanitized)); }
      catch (e) { handleFirebaseError(e); }
    }
  };

  const updateSupplier = async (code: string, updatedData: Partial<Supplier>) => {
    const cleanCode = (code || '').trim();
    const supplier = suppliers.find(s => (s.code || '').trim().toLowerCase() === cleanCode.toLowerCase());
    if (!supplier) return;
    const newSupplier = { ...supplier, ...updatedData };
    if (updatedData.code) newSupplier.code = updatedData.code.trim();

    setSuppliers(prev => {
      const map = new Map<string, Supplier>();
      prev.forEach(s => {
        const sCode = (s.code || '').trim();
        if (sCode && sCode.toLowerCase() !== cleanCode.toLowerCase()) {
          map.set(sCode.toLowerCase(), { ...s, code: sCode });
        }
      });
      map.set((newSupplier.code || cleanCode).toLowerCase(), newSupplier);
      return Array.from(map.values());
    });

    if (isOnline) {
      try {
        if (updatedData.code && updatedData.code.trim().toLowerCase() !== cleanCode.toLowerCase()) {
          await deleteDoc(doc(db, 'suppliers', cleanCode));
          await setDoc(doc(db, 'suppliers', newSupplier.code), cleanDoc(newSupplier));
        } else {
          await setDoc(doc(db, 'suppliers', cleanCode), cleanDoc(newSupplier));
        }
      } catch (e) { handleFirebaseError(e); }
    }
  };

  const deleteSupplier = async (code: string): Promise<{ success: boolean; message?: string }> => {
    const cleanCode = (code || '').trim();
    const supplier = suppliers.find(s => (s.code || '').trim().toLowerCase() === cleanCode.toLowerCase());
    if (!supplier) {
      return { success: false, message: 'المورد غير موجود بالبيانات.' };
    }

    // Safety checks: check if supplier has purchases, balance, or history
    const hasPurchases = purchases.some(p => !p.isDeleted && (p.supplierCode || '').trim().toLowerCase() === cleanCode.toLowerCase());
    const hasBalance = Number(supplier.balance || 0) !== 0;
    const hasHistory = Array.isArray(supplier.history) && supplier.history.length > 0;

    if (hasPurchases || hasBalance || hasHistory) {
      const reason = hasPurchases 
        ? 'لوجود فواتير مشتريات مسجلة باسم هذا المورد' 
        : hasBalance 
        ? `لوجود رصيد مالي قائم (${supplier.balance.toLocaleString()} ج.م)` 
        : 'لوجود حركات مالية مسجلة بكشف حسابه';
      const msg = `لا يمكن حذف المورد (${supplier.name}) ${reason}، يمكنك تعديل بياناته فقط.`;
      return { success: false, message: msg };
    }

    const now = new Date().toISOString();
    // Soft delete update
    setSuppliers(prev => prev.map(s => (s.code || '').trim().toLowerCase() === cleanCode.toLowerCase() ? { ...s, isDeleted: true, deletedAt: now } : s));

    if (isOnline) {
      try {
        await setDoc(doc(db, 'suppliers', cleanCode), cleanDoc({ isDeleted: true, deletedAt: now }), { merge: true });
        return { success: true };
      } catch (e) {
        handleFirebaseError(e);
        return { success: false, message: 'حدث خطأ أثناء الاتصال بقاعدة البيانات لحذف المورد.' };
      }
    }

    return { success: true };
  };

  const addEmployee = async (employee: Employee) => {
    const cleanCode = (employee.code || '').trim();
    if (!cleanCode) return;
    const sanitized = { ...employee, code: cleanCode, name: (employee.name || '').trim() };
    setEmployees(prev => {
      const map = new Map<string, Employee>();
      prev.forEach(e => {
        const code = (e.code || '').trim();
        if (code) map.set(code.toLowerCase(), { ...e, code });
      });
      map.set(cleanCode.toLowerCase(), sanitized);
      return Array.from(map.values());
    });
    if (isOnline) {
      try { await setDoc(doc(db, 'employees', cleanCode), cleanDoc(sanitized)); }
      catch (e) { handleFirebaseError(e); }
    }
  };

  const updateEmployee = async (code: string, updatedData: Partial<Employee>) => {
    const cleanCode = (code || '').trim();
    const employee = employees.find(e => (e.code || '').trim().toLowerCase() === cleanCode.toLowerCase());
    if (!employee) return;
    const newEmployee = { ...employee, ...updatedData };
    if (updatedData.code) newEmployee.code = updatedData.code.trim();

    setEmployees(prev => {
      const map = new Map<string, Employee>();
      prev.forEach(e => {
        const eCode = (e.code || '').trim();
        if (eCode && eCode.toLowerCase() !== cleanCode.toLowerCase()) {
          map.set(eCode.toLowerCase(), { ...e, code: eCode });
        }
      });
      map.set((newEmployee.code || cleanCode).toLowerCase(), newEmployee);
      return Array.from(map.values());
    });

    if (isOnline) {
      try {
        if (updatedData.code && updatedData.code.trim().toLowerCase() !== cleanCode.toLowerCase()) {
          await deleteDoc(doc(db, 'employees', cleanCode));
          await setDoc(doc(db, 'employees', newEmployee.code), cleanDoc(newEmployee));
        } else {
          await setDoc(doc(db, 'employees', cleanCode), cleanDoc(newEmployee));
        }
      } catch (e) { handleFirebaseError(e); }
    }
  };

  const deleteEmployee = async (code: string) => {
    const cleanCode = (code || '').trim();
    setEmployees(prev => prev.filter(e => (e.code || '').trim().toLowerCase() !== cleanCode.toLowerCase()));
    if (isOnline) {
      try { await deleteDoc(doc(db, 'employees', cleanCode)); }
      catch (e) { handleFirebaseError(e); }
    }
  };

  // --- Purchase Logic ---

  const addPurchase = async (purchaseData: Omit<Purchase, 'previousBalance' | 'currentBalance'>) => {
    // Determine ID if not provided (fallback, but page should provide)
    const id = purchaseData.id || `R${Date.now()}`;
    const isPendingPrice = purchaseData.pricingStatus === 'PENDING_PRICE';
    
    // Calculate balances snapshot
    const supplier = suppliers.find(s => s.code === purchaseData.supplierCode);
    const prevBalance = supplier ? supplier.balance : 0;
    // If pending price, supplier balance is unchanged until price is finalized
    const newBalance = isPendingPrice ? prevBalance : (prevBalance + purchaseData.total);

    const pBranch: BranchId = purchaseData.branchId || 'MARG';
    const newPurchase: Purchase = { 
      ...purchaseData, 
      id,
      branchId: pBranch,
      pricingStatus: isPendingPrice ? 'PENDING_PRICE' : 'PRICED',
      previousBalance: prevBalance, 
      currentBalance: newBalance 
    };
    
    if (isOnline) {
      try {
        await setDoc(doc(db, 'purchases', newPurchase.id), newPurchase);
        
        for (const item of purchaseData.items) {
          const productRef = doc(db, 'products', item.itemCode);
          const productSnap = await getDoc(productRef);
          
          if (productSnap.exists()) {
            const product = productSnap.data() as Product;
            const totalOldValue = product.quantity * (product.avgCost || 0);
            const totalNewValue = item.price > 0 ? (item.quantity * item.price) : 0;
            const oldMarg = product.quantityMarg !== undefined ? Number(product.quantityMarg) : Number(product.quantity || 0);
            const oldNozha = product.quantityNozha !== undefined ? Number(product.quantityNozha) : 0;
            const newMarg = pBranch === 'MARG' ? oldMarg + item.quantity : oldMarg;
            const newNozha = pBranch === 'NOZHA' ? oldNozha + item.quantity : oldNozha;
            const newQty = newMarg + newNozha;
            // Only recompute avgCost if item has a known price > 0
            const newAvgCost = item.price > 0 && newQty > 0
              ? (totalOldValue + totalNewValue) / newQty 
              : (product.avgCost || 0);
            await updateDoc(productRef, { quantity: newQty, quantityMarg: newMarg, quantityNozha: newNozha, avgCost: newAvgCost });
          } else {
            const newMarg = pBranch === 'MARG' ? item.quantity : 0;
            const newNozha = pBranch === 'NOZHA' ? item.quantity : 0;
            await setDoc(productRef, { 
              code: item.itemCode, 
              name: item.itemName, 
              quantity: item.quantity, 
              quantityMarg: newMarg,
              quantityNozha: newNozha,
              avgCost: item.price || 0, 
              price: (item.price || 0) * 1.2 
            });
          }
        }

        const supplierRef = doc(db, 'suppliers', purchaseData.supplierCode);
        const supplierSnap = await getDoc(supplierRef);
        if (supplierSnap.exists()) {
          const s = supplierSnap.data() as Supplier;
          const desc = isPendingPrice 
            ? `استلام بضاعة (سعر معلّق) #${newPurchase.id}` 
            : `فاتورة مشتريات #${newPurchase.id}`;
          const newHistory = [...s.history, { date: purchaseData.date, description: desc, amount: isPendingPrice ? 0 : purchaseData.total }];
          await updateDoc(supplierRef, { balance: newBalance, history: newHistory });
        }
      } catch (e) { handleFirebaseError(e); }
    } else {
      setPurchases(prev => [newPurchase, ...prev]);
      
      setProducts(prev => {
        let tempProducts = [...prev];
        purchaseData.items.forEach(item => {
          const idx = tempProducts.findIndex(p => p.code === item.itemCode);
          if (idx >= 0) {
            const existing = tempProducts[idx];
            const oldMarg = existing.quantityMarg !== undefined ? Number(existing.quantityMarg) : Number(existing.quantity || 0);
            const oldNozha = existing.quantityNozha !== undefined ? Number(existing.quantityNozha) : 0;
            const newMarg = pBranch === 'MARG' ? oldMarg + item.quantity : oldMarg;
            const newNozha = pBranch === 'NOZHA' ? oldNozha + item.quantity : oldNozha;
            const newQty = newMarg + newNozha;
            const newAvg = item.price > 0 && newQty > 0
              ? ((existing.quantity * (existing.avgCost || 0)) + (item.quantity * item.price)) / newQty
              : (existing.avgCost || 0);
            tempProducts[idx] = { ...existing, quantity: newQty, quantityMarg: newMarg, quantityNozha: newNozha, avgCost: newAvg };
          } else {
             const newMarg = pBranch === 'MARG' ? item.quantity : 0;
             const newNozha = pBranch === 'NOZHA' ? item.quantity : 0;
             tempProducts.push({ 
               code: item.itemCode, 
               name: item.itemName, 
               quantity: item.quantity, 
               quantityMarg: newMarg,
               quantityNozha: newNozha,
               avgCost: item.price || 0, 
               price: (item.price || 0) * 1.2 
             });
          }
        });
        return tempProducts;
      });

      setSuppliers(prev => prev.map(s => {
         if (s.code === purchaseData.supplierCode) {
           const desc = isPendingPrice 
             ? `استلام بضاعة (سعر معلّق) #${newPurchase.id}` 
             : `فاتورة مشتريات #${newPurchase.id}`;
           return { 
             ...s, 
             balance: newBalance, 
             history: [...s.history, { date: purchaseData.date, description: desc, amount: isPendingPrice ? 0 : purchaseData.total }]
           };
         }
         return s;
      }));
    }
  };

  const finalizePurchasePrice = async (purchaseId: string, updatedItems: InvoiceItem[], newTotal: number): Promise<boolean> => {
    const cleanId = purchaseId.trim();
    const existingPurchase = purchases.find(p => p.id === cleanId);
    if (!existingPurchase) {
      alert("فاتورة المشتريات غير موجودة");
      return false;
    }

    const supplier = suppliers.find(s => s.code === existingPurchase.supplierCode);
    const prevBalance = supplier ? supplier.balance : 0;
    const newBalance = prevBalance + newTotal;

    const finalizedPurchase: Purchase = {
      ...existingPurchase,
      pricingStatus: 'PRICED',
      items: updatedItems,
      total: newTotal,
      previousBalance: prevBalance,
      currentBalance: newBalance
    };

    if (isOnline) {
      try {
        await setDoc(doc(db, 'purchases', cleanId), finalizedPurchase);

        // Update product avgCosts with agreed unit prices
        for (const item of updatedItems) {
          if (item.price > 0) {
            const productRef = doc(db, 'products', item.itemCode);
            const productSnap = await getDoc(productRef);
            if (productSnap.exists()) {
              const prod = productSnap.data() as Product;
              const currentQty = prod.quantity || 0;
              const oldVal = Math.max(0, currentQty - item.quantity) * (prod.avgCost || 0);
              const newVal = item.quantity * item.price;
              const newAvg = currentQty > 0 ? (oldVal + newVal) / currentQty : item.price;
              await updateDoc(productRef, { avgCost: Math.max(0, newAvg) });
            }
          }
        }

        // Update supplier balance & history
        const supplierRef = doc(db, 'suppliers', existingPurchase.supplierCode);
        const supplierSnap = await getDoc(supplierRef);
        if (supplierSnap.exists()) {
          const s = supplierSnap.data() as Supplier;
          const cleanHistory = (s.history || []).filter(h => !h.description.includes(`#${cleanId}`));
          const newHistory = [
            ...cleanHistory,
            { date: existingPurchase.date, description: `اعتماد وتسعير فاتورة مشتريات #${cleanId}`, amount: newTotal }
          ];
          await updateDoc(supplierRef, { balance: s.balance + newTotal, history: newHistory });
        }
      } catch (e) {
        handleFirebaseError(e);
        return false;
      }
    }

    // Local synchronous state updates
    setPurchases(prev => prev.map(p => p.id === cleanId ? finalizedPurchase : p));

    setSuppliers(prev => prev.map(s => {
      if (s.code === existingPurchase.supplierCode) {
        const cleanHistory = (s.history || []).filter(h => !h.description.includes(`#${cleanId}`));
        const newHistory = [
          ...cleanHistory,
          { date: existingPurchase.date, description: `اعتماد وتسعير فاتورة مشتريات #${cleanId}`, amount: newTotal }
        ];
        return { ...s, balance: s.balance + newTotal, history: newHistory };
      }
      return s;
    }));

    setProducts(prev => prev.map(prod => {
      const matchedItem = updatedItems.find(i => i.itemCode === prod.code);
      if (matchedItem && matchedItem.price > 0) {
        const currentQty = prod.quantity || 0;
        const oldVal = Math.max(0, currentQty - matchedItem.quantity) * (prod.avgCost || 0);
        const newVal = matchedItem.quantity * matchedItem.price;
        const newAvg = currentQty > 0 ? (oldVal + newVal) / currentQty : matchedItem.price;
        return { ...prod, avgCost: Math.max(0, newAvg) };
      }
      return prod;
    }));

    return true;
  };

  const updatePurchase = async (oldPurchase: Purchase, newPurchaseData: Purchase) => {
    const balanceChange = newPurchaseData.total - oldPurchase.total; 

    if (isOnline) {
      try {
        await setDoc(doc(db, 'purchases', oldPurchase.id), newPurchaseData);

        const supplierRef = doc(db, 'suppliers', oldPurchase.supplierCode);
        const supplierSnap = await getDoc(supplierRef);
        if (supplierSnap.exists()) {
          const s = supplierSnap.data() as Supplier;
          const newBalance = s.balance + balanceChange;
          
          const cleanHistory = (s.history || []).filter(h => 
            !h.description.includes(`تعديل فاتورة مشتريات #${oldPurchase.id}`) &&
            !h.description.includes(`تعديل فاتورة مشتريات #${newPurchaseData.id}`)
          );
          const pPattern = `#${oldPurchase.id}`;
          const hasExisting = cleanHistory.some(h => h.description.includes(pPattern) && h.description.includes('فاتورة مشتريات'));
          const newDesc = `فاتورة مشتريات #${newPurchaseData.id}`;

          let newHistory;
          if (hasExisting) {
            newHistory = cleanHistory.map(h => {
              if (h.description.includes(pPattern) && h.description.includes('فاتورة مشتريات')) {
                return {
                  ...h,
                  date: newPurchaseData.date,
                  description: newDesc,
                  amount: newPurchaseData.total
                };
              }
              return h;
            });
          } else {
            newHistory = [...cleanHistory, {
              date: newPurchaseData.date,
              description: newDesc,
              amount: newPurchaseData.total
            }];
          }

          await updateDoc(supplierRef, cleanDoc({ balance: newBalance, history: newHistory }));
        }

        // Revert Old Inventory
        for (const item of oldPurchase.items) {
          const pRef = doc(db, 'products', item.itemCode);
          const pSnap = await getDoc(pRef);
          if (pSnap.exists()) {
            const p = pSnap.data() as Product;
            const currentTotalValue = p.quantity * p.avgCost;
            const oldItemValue = item.quantity * item.price; 
            const revertedTotalValue = currentTotalValue - oldItemValue;
            const revertedQty = p.quantity - item.quantity;
            const revertedAvg = revertedQty > 0 ? revertedTotalValue / revertedQty : 0;
            
            await updateDoc(pRef, { quantity: revertedQty, avgCost: revertedAvg });
          }
        }

        // Apply New Inventory
        for (const item of newPurchaseData.items) {
          const pRef = doc(db, 'products', item.itemCode);
          const pSnap = await getDoc(pRef); 
          if (pSnap.exists()) {
            const p = pSnap.data() as Product;
            const currentTotalValue = p.quantity * p.avgCost;
            const newItemValue = item.quantity * item.price;
            const newTotalValue = currentTotalValue + newItemValue;
            const newQty = p.quantity + item.quantity;
            const newAvg = newQty > 0 ? newTotalValue / newQty : 0;
            await updateDoc(pRef, { quantity: newQty, avgCost: newAvg });
          }
        }

      } catch (e) { handleFirebaseError(e); }
    } else {
      setPurchases(prev => prev.map(p => p.id === oldPurchase.id ? newPurchaseData : p));
      
      setSuppliers(prev => prev.map(s => {
        if(s.code === oldPurchase.supplierCode) {
          const cleanHistory = (s.history || []).filter(h => 
            !h.description.includes(`تعديل فاتورة مشتريات #${oldPurchase.id}`) &&
            !h.description.includes(`تعديل فاتورة مشتريات #${newPurchaseData.id}`)
          );
          const pPattern = `#${oldPurchase.id}`;
          const hasExisting = cleanHistory.some(h => h.description.includes(pPattern) && h.description.includes('فاتورة مشتريات'));
          const newDesc = `فاتورة مشتريات #${newPurchaseData.id}`;

          let newHistory;
          if (hasExisting) {
            newHistory = cleanHistory.map(h => {
              if (h.description.includes(pPattern) && h.description.includes('فاتورة مشتريات')) {
                return {
                  ...h,
                  date: newPurchaseData.date,
                  description: newDesc,
                  amount: newPurchaseData.total
                };
              }
              return h;
            });
          } else {
            newHistory = [...cleanHistory, {
              date: newPurchaseData.date,
              description: newDesc,
              amount: newPurchaseData.total
            }];
          }

          return {
            ...s,
            balance: s.balance + balanceChange,
            history: newHistory
          };
        }
        return s;
      }));

      setProducts(prev => {
        let tempProducts = [...prev];
        oldPurchase.items.forEach(item => {
          const idx = tempProducts.findIndex(p => p.code === item.itemCode);
          if (idx >= 0) {
            const p = tempProducts[idx];
            const currentVal = p.quantity * p.avgCost;
            const oldVal = item.quantity * item.price;
            const revQty = p.quantity - item.quantity;
            const revAvg = revQty > 0 ? (currentVal - oldVal) / revQty : 0;
            tempProducts[idx] = { ...p, quantity: revQty, avgCost: revAvg };
          }
        });
        newPurchaseData.items.forEach(item => {
          const idx = tempProducts.findIndex(p => p.code === item.itemCode);
          if (idx >= 0) {
            const p = tempProducts[idx];
            const currentVal = p.quantity * p.avgCost;
            const newVal = item.quantity * item.price;
            const newQty = p.quantity + item.quantity;
            const newAvg = newQty > 0 ? (currentVal + newVal) / newQty : 0;
            tempProducts[idx] = { ...p, quantity: newQty, avgCost: newAvg };
          }
        });
        return tempProducts;
      });
    }
  };

  const deletePurchase = async (id: string) => {
    const now = new Date().toISOString();
    setPurchases(prev => prev.map(p => p.id === id ? { ...p, isDeleted: true, deletedAt: now } : p));
    if (isOnline) {
      try {
        await setDoc(doc(db, 'purchases', id), cleanDoc({ isDeleted: true, deletedAt: now }), { merge: true });
      } catch (e) { handleFirebaseError(e); }
    }
  };

  const getPaymentMethodArabicName = (method?: PaymentMethod): string => {
    if (method === 'BANK_AHLY') return 'البنك الأهلي';
    if (method === 'BANK_MISR') return 'بنك مصر';
    if (method === 'VF_CASH_AYMAN') return 'فودافون كاش أيمن';
    if (method === 'VF_CASH_KYRILLOS') return 'فودافون كاش كيرلس';
    return 'خزنة (كاش)';
  };

  const addInvoice = async (invoiceData: {
    id: string; 
    branchId?: BranchId;
    area?: string;
    date: string; 
    time: string; 
    customerCode: string; 
    customerName: string; 
    items: InvoiceItem[]; 
    total: number;
    paidAmount?: number;
    remainingAmount?: number;
    paymentMethod?: PaymentMethod;
  }) => {
    const { id, total } = invoiceData;
    const rawPaid = Number(invoiceData.paidAmount || 0);
    const paidAmount = Math.max(0, isNaN(rawPaid) ? 0 : rawPaid);
    const remainingAmount = Math.max(0, total - paidAmount);
    const paymentMethod: PaymentMethod = invoiceData.paymentMethod || 'CASH';

    const currentCustomer = customers.find(c => c.code === invoiceData.customerCode);
    const prevBalance = currentCustomer ? currentCustomer.balance : 0;
    const branchId: BranchId = invoiceData.branchId || currentCustomer?.branchId || 'MARG';
    const area = invoiceData.area || currentCustomer?.area || (branchId === 'NOZHA' ? 'النزهة الجديدة' : 'المرج القديمة');

    // Customer balance: debt is -total, payment is +paidAmount => net change is -total + paidAmount
    // إذا كان المدفوع أكبر من إجمالي الفاتورة، يُخصم الفائض تلقائياً من إجمالي مديونية العميل السابقة
    const newCustomerBalance = prevBalance - total + paidAmount;
    
    // Clean newInvoice without ANY undefined fields
    const newInvoice: SalesInvoice = {
      id: invoiceData.id,
      branchId,
      area,
      date: invoiceData.date,
      time: invoiceData.time,
      customerCode: invoiceData.customerCode,
      customerName: invoiceData.customerName,
      items: invoiceData.items.map(item => ({
        itemCode: item.itemCode,
        itemName: item.itemName,
        quantity: item.quantity,
        price: item.price,
        total: item.total
      })),
      total: invoiceData.total,
      paidAmount,
      remainingAmount,
      previousBalance: prevBalance,
      currentBalance: newCustomerBalance,
      ...(paidAmount > 0 && paymentMethod ? { paymentMethod } : {})
    };

    // Customer history entries
    const historyEntries: { date: string; description: string; amount: number }[] = [];
    if (paidAmount === 0) {
      historyEntries.push({ 
        date: invoiceData.date, 
        description: `فاتورة بيع #${id} (آجل بالكامل)`, 
        amount: -total 
      });
    } else {
      historyEntries.push({ 
        date: invoiceData.date, 
        description: `فاتورة بيع #${id} (إجمالي ${total.toLocaleString()})`, 
        amount: -total 
      });
      historyEntries.push({ 
        date: invoiceData.date, 
        description: paidAmount > total ? 'دفعة (شاملة سداد مديونية سابقة)' : 'دفعة', 
        amount: paidAmount 
      });
    }

    // Treasury Transaction if paidAmount > 0
    let treasuryTx: TreasuryTransaction | null = null;
    if (paidAmount > 0) {
      const tId = `T_INV_${id}_${Date.now()}`;
      const desc = paidAmount > total
        ? `تحصيل فاتورة بيع #${id} مع سداد مديونية سابقة - العميل (${invoiceData.customerName || invoiceData.customerCode}) [فائض مسدد: ${(paidAmount - total).toLocaleString()}]`
        : paidAmount === total 
          ? `تحصيل كلي فاتورة بيع #${id} - العميل (${invoiceData.customerName || invoiceData.customerCode})`
          : `تحصيل دفعة من فاتورة بيع #${id} - العميل (${invoiceData.customerName || invoiceData.customerCode}) [متبقي: ${remainingAmount.toLocaleString()}]`;

      treasuryTx = {
        id: tId,
        branchId,
        invoiceNumber: id,
        date: invoiceData.date,
        credit: paidAmount,
        debit: 0,
        balance: 0,
        paymentMethod: paymentMethod,
        description: desc
      };
    }

    // Immediate Optimistic State Update so invoice and customer ledger reflect instantly
    setInvoices(prev => [newInvoice, ...prev.filter(inv => inv.id !== newInvoice.id)]);
    setCustomers(prev => {
      const exists = prev.find(c => c.code === invoiceData.customerCode);
      if (exists) {
        return prev.map(c => c.code === invoiceData.customerCode ? { 
          ...c, 
          balance: newCustomerBalance, 
          history: [...(c.history || []), ...historyEntries] 
        } : c);
      } else {
        return [...prev, { 
          code: invoiceData.customerCode, 
          name: invoiceData.customerName, 
          branchId,
          area,
          balance: newCustomerBalance, 
          history: historyEntries 
        }];
      }
    });
    if (treasuryTx) {
      setTreasury(prev => [...prev.filter(t => t.id !== treasuryTx!.id), treasuryTx!]);
    }
    setProducts(prev => {
      let newP = [...prev];
      invoiceData.items.forEach(item => {
        const idx = newP.findIndex(p => p.code === item.itemCode);
        if (idx >= 0) {
          const prod = newP[idx];
          const oldMarg = prod.quantityMarg !== undefined ? prod.quantityMarg : prod.quantity;
          const oldNozha = prod.quantityNozha !== undefined ? prod.quantityNozha : 0;
          const newMarg = branchId === 'MARG' ? oldMarg - item.quantity : oldMarg;
          const newNozha = branchId === 'NOZHA' ? oldNozha - item.quantity : oldNozha;
          newP[idx] = { 
            ...prod, 
            quantityMarg: newMarg, 
            quantityNozha: newNozha, 
            quantity: newMarg + newNozha 
          };
        }
      });
      return newP;
    });

    if (isOnline) {
      try {
        await setDoc(doc(db, 'invoices', id), cleanDoc(newInvoice));
        
        const customerRef = doc(db, 'customers', invoiceData.customerCode);
        const customerSnap = await getDoc(customerRef);
        
        if (customerSnap.exists()) {
          const c = customerSnap.data() as Customer;
          const updatedHistory = [...(c.history || []), ...historyEntries];
          await updateDoc(customerRef, cleanDoc({ balance: newCustomerBalance, history: updatedHistory }));
        } else {
          await setDoc(customerRef, cleanDoc({
            code: invoiceData.customerCode, 
            name: invoiceData.customerName, 
            branchId,
            area,
            balance: newCustomerBalance, 
            history: historyEntries
          }));
        }

        // Write Treasury transaction if payment was made
        if (treasuryTx) {
          await setDoc(doc(db, 'treasury', treasuryTx.id), cleanDoc(treasuryTx));
        }

        for (const item of invoiceData.items) {
          const pRef = doc(db, 'products', item.itemCode);
          const pSnap = await getDoc(pRef);
          if (pSnap.exists()) {
            const p = pSnap.data() as Product;
            const oldMarg = p.quantityMarg !== undefined ? Number(p.quantityMarg) : Number(p.quantity || 0);
            const oldNozha = p.quantityNozha !== undefined ? Number(p.quantityNozha) : 0;
            const newMarg = branchId === 'MARG' ? oldMarg - item.quantity : oldMarg;
            const newNozha = branchId === 'NOZHA' ? oldNozha - item.quantity : oldNozha;
            await updateDoc(pRef, { 
              quantityMarg: newMarg, 
              quantityNozha: newNozha, 
              quantity: newMarg + newNozha 
            });
          }
        }
      } catch (e) { handleFirebaseError(e); }
    }
  };

  const updateInvoice = async (oldInvoice: SalesInvoice, newInvoiceData: SalesInvoice) => {
    const oldPaid = Number(oldInvoice.paidAmount || 0);
    const newPaid = Number(newInvoiceData.paidAmount || 0);
    const oldRemaining = oldInvoice.total - oldPaid;
    const newRemaining = newInvoiceData.total - newPaid;
    // If old remaining debt was 1000 and new remaining debt is 800, customer balance increases by +200.
    const debtDifference = oldRemaining - newRemaining; 

    // Calculate customer currentBalance snapshot for updated invoice
    const finalNewInvoice: SalesInvoice = {
      ...newInvoiceData,
      paidAmount: newPaid,
      remainingAmount: newRemaining,
      currentBalance: oldInvoice.previousBalance - newRemaining,
      ...(newPaid > 0 && newInvoiceData.paymentMethod ? { paymentMethod: newInvoiceData.paymentMethod } : {})
    };
    if (newPaid === 0) {
      delete (finalNewInvoice as any).paymentMethod;
    }

    // Immediate Optimistic State Update
    setInvoices(prev => prev.map(inv => inv.id === oldInvoice.id ? finalNewInvoice : inv));
    setCustomers(prev => prev.map(c => {
      if (c.code === oldInvoice.customerCode) {
        const cleanHistory = (c.history || []).filter(h => 
          !h.description.includes(`تعديل فاتورة #${oldInvoice.id}`) &&
          !h.description.includes(`تعديل فاتورة #${newInvoiceData.id}`)
        );
        const invPattern = `#${oldInvoice.id}`;
        const hasExisting = cleanHistory.some(h => h.description.includes(invPattern) && h.description.includes('فاتورة بيع'));
        const newDesc = newPaid === 0 
          ? `فاتورة بيع #${newInvoiceData.id} (آجل بالكامل)` 
          : `فاتورة بيع #${newInvoiceData.id} (إجمالي ${newInvoiceData.total.toLocaleString()})`;

        let updatedHistory;
        if (hasExisting) {
          updatedHistory = cleanHistory.map(h => {
            if (h.description.includes(invPattern) && h.description.includes('فاتورة بيع')) {
              return {
                ...h,
                date: newInvoiceData.date,
                description: newDesc,
                amount: -newInvoiceData.total
              };
            }
            return h;
          });
        } else {
          updatedHistory = [...cleanHistory, {
            date: newInvoiceData.date,
            description: newDesc,
            amount: -newInvoiceData.total
          }];
        }

        return {
          ...c,
          balance: c.balance + debtDifference,
          history: updatedHistory
        };
      }
      return c;
    }));

    const oldBranch: BranchId = oldInvoice.branchId || 'MARG';
    const newBranch: BranchId = newInvoiceData.branchId || 'MARG';

    setTreasury(prev => {
      const withoutOld = prev.filter(t => t.invoiceNumber !== oldInvoice.id);
      if (newPaid > 0) {
        const tId = `T_INV_${oldInvoice.id}_${Date.now()}`;
        const desc = newPaid >= newInvoiceData.total
          ? `تحصيل كلي فاتورة بيع #${oldInvoice.id} - العميل (${newInvoiceData.customerName}) [معدلة]`
          : `تحصيل دفعة من فاتورة بيع #${oldInvoice.id} - العميل (${newInvoiceData.customerName}) [معدلة - متبقي: ${newRemaining.toLocaleString()}]`;

        const newTx: TreasuryTransaction = {
          id: tId,
          branchId: newBranch,
          invoiceNumber: oldInvoice.id,
          date: newInvoiceData.date,
          credit: newPaid,
          debit: 0,
          balance: 0,
          paymentMethod: newInvoiceData.paymentMethod || 'CASH',
          description: desc
        };
        return [...withoutOld, newTx];
      }
      return withoutOld;
    });

    setProducts(prev => {
      let tempProducts = [...prev];
      oldInvoice.items.forEach(item => {
        const idx = tempProducts.findIndex(p => p.code === item.itemCode);
        if (idx >= 0) {
          const prod = tempProducts[idx];
          const oldMarg = prod.quantityMarg !== undefined ? prod.quantityMarg : prod.quantity;
          const oldNozha = prod.quantityNozha !== undefined ? prod.quantityNozha : 0;
          const newMarg = oldBranch === 'MARG' ? oldMarg + item.quantity : oldMarg;
          const newNozha = oldBranch === 'NOZHA' ? oldNozha + item.quantity : oldNozha;
          tempProducts[idx] = { ...prod, quantityMarg: newMarg, quantityNozha: newNozha, quantity: newMarg + newNozha };
        }
      });
      newInvoiceData.items.forEach(item => {
        const idx = tempProducts.findIndex(p => p.code === item.itemCode);
        if (idx >= 0) {
          const prod = tempProducts[idx];
          const oldMarg = prod.quantityMarg !== undefined ? prod.quantityMarg : prod.quantity;
          const oldNozha = prod.quantityNozha !== undefined ? prod.quantityNozha : 0;
          const newMarg = newBranch === 'MARG' ? oldMarg - item.quantity : oldMarg;
          const newNozha = newBranch === 'NOZHA' ? oldNozha - item.quantity : oldNozha;
          tempProducts[idx] = { ...prod, quantityMarg: newMarg, quantityNozha: newNozha, quantity: newMarg + newNozha };
        }
      });
      return tempProducts;
    });
    
    if (isOnline) {
      try {
        await setDoc(doc(db, 'invoices', oldInvoice.id), cleanDoc(finalNewInvoice));

        const customerRef = doc(db, 'customers', oldInvoice.customerCode);
        const customerSnap = await getDoc(customerRef);
        if (customerSnap.exists()) {
          const c = customerSnap.data() as Customer;
          const newBalance = c.balance + debtDifference;
          
          const cleanHistory = (c.history || []).filter(h => 
            !h.description.includes(`تعديل فاتورة #${oldInvoice.id}`) &&
            !h.description.includes(`تعديل فاتورة #${newInvoiceData.id}`)
          );
          const invPattern = `#${oldInvoice.id}`;
          const hasExisting = cleanHistory.some(h => h.description.includes(invPattern) && h.description.includes('فاتورة بيع'));
          const newDesc = newPaid === 0 
            ? `فاتورة بيع #${newInvoiceData.id} (آجل بالكامل)` 
            : `فاتورة بيع #${newInvoiceData.id} (إجمالي ${newInvoiceData.total.toLocaleString()})`;

          let updatedHistory;
          if (hasExisting) {
            updatedHistory = cleanHistory.map(h => {
              if (h.description.includes(invPattern) && h.description.includes('فاتورة بيع')) {
                return {
                  ...h,
                  date: newInvoiceData.date,
                  description: newDesc,
                  amount: -newInvoiceData.total
                };
              }
              return h;
            });
          } else {
            updatedHistory = [...cleanHistory, {
              date: newInvoiceData.date,
              description: newDesc,
              amount: -newInvoiceData.total
            }];
          }

          await updateDoc(customerRef, cleanDoc({ balance: newBalance, history: updatedHistory }));
        }

        // Handle Treasury Update/Reconciliation
        const qTreasury = query(collection(db, 'treasury'));
        const snap = await getDocs(qTreasury);
        const oldTxDocs = snap.docs.filter(d => (d.data() as TreasuryTransaction).invoiceNumber === oldInvoice.id);
        
        // Delete old treasury docs for this invoice
        for (const tDoc of oldTxDocs) {
          await deleteDoc(tDoc.ref);
        }

        // If new invoice has payment, add new treasury doc
        if (newPaid > 0) {
          const tId = `T_INV_${oldInvoice.id}_${Date.now()}`;
          const desc = newPaid >= newInvoiceData.total
            ? `تحصيل كلي فاتورة بيع #${oldInvoice.id} - العميل (${newInvoiceData.customerName}) [معدلة]`
            : `تحصيل دفعة من فاتورة بيع #${oldInvoice.id} - العميل (${newInvoiceData.customerName}) [معدلة - متبقي: ${newRemaining.toLocaleString()}]`;

          const newTx: TreasuryTransaction = {
            id: tId,
            branchId: newBranch,
            invoiceNumber: oldInvoice.id,
            date: newInvoiceData.date,
            credit: newPaid,
            debit: 0,
            balance: 0,
            paymentMethod: newInvoiceData.paymentMethod || 'CASH',
            description: desc
          };
          await setDoc(doc(db, 'treasury', tId), cleanDoc(newTx));
        }

        // Adjust Inventory
        for (const item of oldInvoice.items) {
          const pRef = doc(db, 'products', item.itemCode);
          const pSnap = await getDoc(pRef);
          if (pSnap.exists()) {
            const p = pSnap.data() as Product;
            const oldMarg = p.quantityMarg !== undefined ? Number(p.quantityMarg) : Number(p.quantity || 0);
            const oldNozha = p.quantityNozha !== undefined ? Number(p.quantityNozha) : 0;
            const newMarg = oldBranch === 'MARG' ? oldMarg + item.quantity : oldMarg;
            const newNozha = oldBranch === 'NOZHA' ? oldNozha + item.quantity : oldNozha;
            await updateDoc(pRef, { quantityMarg: newMarg, quantityNozha: newNozha, quantity: newMarg + newNozha });
          }
        }
        for (const item of newInvoiceData.items) {
          const pRef = doc(db, 'products', item.itemCode);
          const pSnap = await getDoc(pRef);
          if (pSnap.exists()) {
            const p = pSnap.data() as Product;
            const oldMarg = p.quantityMarg !== undefined ? Number(p.quantityMarg) : Number(p.quantity || 0);
            const oldNozha = p.quantityNozha !== undefined ? Number(p.quantityNozha) : 0;
            const newMarg = newBranch === 'MARG' ? oldMarg - item.quantity : oldMarg;
            const newNozha = newBranch === 'NOZHA' ? oldNozha - item.quantity : oldNozha;
            await updateDoc(pRef, { quantityMarg: newMarg, quantityNozha: newNozha, quantity: newMarg + newNozha });
          }
        }

      } catch (e) { handleFirebaseError(e); }
    }
  };

  const deleteInvoice = async (id: string) => {
    const inv = invoices.find(i => i.id === id);
    if (!inv) return;

    const remainingDebt = inv.total - (inv.paidAmount || 0);
    const invBranch: BranchId = inv.branchId || 'MARG';
    const now = new Date().toISOString();

    // Immediate Optimistic State Update
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, isDeleted: true, deletedAt: now } : i));
    setCustomers(prev => prev.map(c => {
      if (c.code === inv.customerCode) {
        return {
          ...c,
          balance: c.balance + remainingDebt,
          history: [
            ...(c.history || []),
            {
              date: new Date().toISOString().split('T')[0],
              description: `إلغاء فاتورة بيع #${id}`,
              amount: remainingDebt
            }
          ]
        };
      }
      return c;
    }));
    setTreasury(prev => prev.filter(t => t.invoiceNumber !== id));
    setProducts(prev => {
      let temp = [...prev];
      inv.items.forEach(item => {
        const idx = temp.findIndex(p => p.code === item.itemCode);
        if (idx >= 0) {
          const prod = temp[idx];
          const oldMarg = prod.quantityMarg !== undefined ? prod.quantityMarg : prod.quantity;
          const oldNozha = prod.quantityNozha !== undefined ? prod.quantityNozha : 0;
          const newMarg = invBranch === 'MARG' ? oldMarg + item.quantity : oldMarg;
          const newNozha = invBranch === 'NOZHA' ? oldNozha + item.quantity : oldNozha;
          temp[idx] = { ...prod, quantityMarg: newMarg, quantityNozha: newNozha, quantity: newMarg + newNozha };
        }
      });
      return temp;
    });

    if (isOnline) {
      try {
        await setDoc(doc(db, 'invoices', id), cleanDoc({ isDeleted: true, deletedAt: now }), { merge: true });

        // Revert Customer Balance for the remaining debt of this invoice
        const customerRef = doc(db, 'customers', inv.customerCode);
        const customerSnap = await getDoc(customerRef);
        if (customerSnap.exists()) {
          const c = customerSnap.data() as Customer;
          const newBalance = c.balance + remainingDebt;
          const newHistory = [
            ...(c.history || []),
            {
              date: new Date().toISOString().split('T')[0],
              description: `إلغاء فاتورة بيع #${id}`,
              amount: remainingDebt
            }
          ];
          await updateDoc(customerRef, cleanDoc({ balance: newBalance, history: newHistory }));
        }

        // Delete linked Treasury transactions
        const qTreasury = query(collection(db, 'treasury'));
        const snap = await getDocs(qTreasury);
        const linkedDocs = snap.docs.filter(d => (d.data() as TreasuryTransaction).invoiceNumber === id);
        for (const d of linkedDocs) {
          await deleteDoc(d.ref);
        }

        // Restore Inventory items
        for (const item of inv.items) {
          const pRef = doc(db, 'products', item.itemCode);
          const pSnap = await getDoc(pRef);
          if (pSnap.exists()) {
            const p = pSnap.data() as Product;
            const oldMarg = p.quantityMarg !== undefined ? Number(p.quantityMarg) : Number(p.quantity || 0);
            const oldNozha = p.quantityNozha !== undefined ? Number(p.quantityNozha) : 0;
            const newMarg = invBranch === 'MARG' ? oldMarg + item.quantity : oldMarg;
            const newNozha = invBranch === 'NOZHA' ? oldNozha + item.quantity : oldNozha;
            await updateDoc(pRef, { quantityMarg: newMarg, quantityNozha: newNozha, quantity: newMarg + newNozha });
          }
        }
      } catch (e) { handleFirebaseError(e); }
    }
  };

  const restoreEntity = async (type: 'customer' | 'supplier' | 'invoice' | 'purchase', id: string): Promise<{ success: boolean; message?: string }> => {
    const cleanId = (id || '').trim();
    if (!cleanId) return { success: false, message: 'المعرف غير صالح.' };

    try {
      if (type === 'customer') {
        setCustomers(prev => prev.map(c => (c.code || '').trim().toLowerCase() === cleanId.toLowerCase() ? { ...c, isDeleted: false, deletedAt: undefined } : c));
        if (isOnline) {
          await setDoc(doc(db, 'customers', cleanId), cleanDoc({ isDeleted: false, deletedAt: '' }), { merge: true });
        }
        return { success: true };
      } else if (type === 'supplier') {
        setSuppliers(prev => prev.map(s => (s.code || '').trim().toLowerCase() === cleanId.toLowerCase() ? { ...s, isDeleted: false, deletedAt: undefined } : s));
        if (isOnline) {
          await setDoc(doc(db, 'suppliers', cleanId), cleanDoc({ isDeleted: false, deletedAt: '' }), { merge: true });
        }
        return { success: true };
      } else if (type === 'purchase') {
        setPurchases(prev => prev.map(p => p.id === cleanId ? { ...p, isDeleted: false, deletedAt: undefined } : p));
        if (isOnline) {
          await setDoc(doc(db, 'purchases', cleanId), cleanDoc({ isDeleted: false, deletedAt: '' }), { merge: true });
        }
        return { success: true };
      } else if (type === 'invoice') {
        const inv = invoices.find(i => i.id === cleanId);
        if (!inv) return { success: false, message: 'الفاتورة غير موجودة.' };

        const remainingDebt = inv.remainingAmount !== undefined ? inv.remainingAmount : (inv.total - (inv.paidAmount || 0));
        const invBranch: BranchId = inv.branchId || 'MARG';

        // Restore invoice state
        setInvoices(prev => prev.map(i => i.id === cleanId ? { ...i, isDeleted: false, deletedAt: undefined } : i));

        // Re-apply Customer Balance (subtract debt from customer balance)
        setCustomers(prev => prev.map(c => {
          if (c.code === inv.customerCode) {
            return {
              ...c,
              balance: c.balance - remainingDebt,
              history: [
                ...(c.history || []),
                {
                  date: new Date().toISOString().split('T')[0],
                  description: `استرجاع فاتورة بيع #${cleanId}`,
                  amount: -remainingDebt
                }
              ]
            };
          }
          return c;
        }));

        // Deduct inventory items again
        setProducts(prev => {
          let temp = [...prev];
          inv.items.forEach(item => {
            const idx = temp.findIndex(p => p.code === item.itemCode);
            if (idx >= 0) {
              const prod = temp[idx];
              const oldMarg = prod.quantityMarg !== undefined ? prod.quantityMarg : prod.quantity;
              const oldNozha = prod.quantityNozha !== undefined ? prod.quantityNozha : 0;
              const newMarg = invBranch === 'MARG' ? Math.max(0, oldMarg - item.quantity) : oldMarg;
              const newNozha = invBranch === 'NOZHA' ? Math.max(0, oldNozha - item.quantity) : oldNozha;
              temp[idx] = { ...prod, quantityMarg: newMarg, quantityNozha: newNozha, quantity: newMarg + newNozha };
            }
          });
          return temp;
        });

        if (isOnline) {
          await setDoc(doc(db, 'invoices', cleanId), cleanDoc({ isDeleted: false, deletedAt: '' }), { merge: true });

          // Update Customer in Firestore
          const customerRef = doc(db, 'customers', inv.customerCode);
          const customerSnap = await getDoc(customerRef);
          if (customerSnap.exists()) {
            const c = customerSnap.data() as Customer;
            const newBalance = c.balance - remainingDebt;
            const newHistory = [
              ...(c.history || []),
              {
                date: new Date().toISOString().split('T')[0],
                description: `استرجاع فاتورة بيع #${cleanId}`,
                amount: -remainingDebt
              }
            ];
            await updateDoc(customerRef, cleanDoc({ balance: newBalance, history: newHistory }));
          }

          // Update product stocks in Firestore
          for (const item of inv.items) {
            const pRef = doc(db, 'products', item.itemCode);
            const pSnap = await getDoc(pRef);
            if (pSnap.exists()) {
              const p = pSnap.data() as Product;
              const oldMarg = p.quantityMarg !== undefined ? Number(p.quantityMarg) : Number(p.quantity || 0);
              const oldNozha = p.quantityNozha !== undefined ? Number(p.quantityNozha) : 0;
              const newMarg = invBranch === 'MARG' ? Math.max(0, oldMarg - item.quantity) : oldMarg;
              const newNozha = invBranch === 'NOZHA' ? Math.max(0, oldNozha - item.quantity) : oldNozha;
              await updateDoc(pRef, { quantityMarg: newMarg, quantityNozha: newNozha, quantity: newMarg + newNozha });
            }
          }
        }
        return { success: true };
      }
      return { success: false, message: 'نوع غير مدعوم' };
    } catch (e: any) {
      handleFirebaseError(e);
      return { success: false, message: e?.message || 'حدث خطأ أثناء الاسترجاع' };
    }
  };

  const permanentDeleteEntity = async (type: 'customer' | 'supplier' | 'invoice' | 'purchase', id: string): Promise<{ success: boolean; message?: string }> => {
    const cleanId = (id || '').trim();
    if (!cleanId) return { success: false, message: 'المعرف غير صالح.' };

    try {
      if (type === 'customer') {
        setCustomers(prev => prev.filter(c => (c.code || '').trim().toLowerCase() !== cleanId.toLowerCase()));
        if (isOnline) {
          await deleteDoc(doc(db, 'customers', cleanId));
        }
        return { success: true };
      } else if (type === 'supplier') {
        setSuppliers(prev => prev.filter(s => (s.code || '').trim().toLowerCase() !== cleanId.toLowerCase()));
        if (isOnline) {
          await deleteDoc(doc(db, 'suppliers', cleanId));
        }
        return { success: true };
      } else if (type === 'purchase') {
        setPurchases(prev => prev.filter(p => p.id !== cleanId));
        if (isOnline) {
          await deleteDoc(doc(db, 'purchases', cleanId));
        }
        return { success: true };
      } else if (type === 'invoice') {
        setInvoices(prev => prev.filter(i => i.id !== cleanId));
        if (isOnline) {
          await deleteDoc(doc(db, 'invoices', cleanId));
        }
        return { success: true };
      }
      return { success: false, message: 'نوع غير مدعوم' };
    } catch (e: any) {
      handleFirebaseError(e);
      return { success: false, message: e?.message || 'حدث خطأ أثناء الحذف النهائي' };
    }
  };

  const clearAllInvoices = async (): Promise<boolean> => {
    try {
      setInvoices([]); 
      if (isOnline) {
        const q = query(collection(db, 'invoices'));
        const snapshot = await getDocs(q);
        const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
        await Promise.all(deletePromises);
      }
      return true;
    } catch (e) {
      handleFirebaseError(e);
      return false;
    }
  };

  // --- Implemented Missing Functions ---

  const addUser = async (user: User) => {
    if (isOnline) {
      try { await setDoc(doc(db, 'users', user.id), user); } catch (e) { handleFirebaseError(e); }
    } else {
      setUsers(prev => [...prev, user]);
    }
  };

  const updateUser = async (id: string, updatedData: Partial<User>) => {
    const targetUser = users.find(u => u.id === id);
    if (id === '1' || targetUser?.username === 'admin') {
      alert('حساب الأدمن الأساسي محمي ولا يمكن تعديل بياناته أو كلمة مروره.');
      return;
    }
    if (isOnline) {
      try { await updateDoc(doc(db, 'users', id), updatedData); } catch (e) { handleFirebaseError(e); }
    } else {
      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updatedData } : u));
    }
  };

  const deleteUser = async (id: string) => {
    const targetUser = users.find(u => u.id === id);
    if (id === '1' || targetUser?.username === 'admin') {
      alert('لا يمكن حذف حساب الأدمن الأساسي (admin).');
      return false;
    }
    if (isOnline) {
      try { await deleteDoc(doc(db, 'users', id)); return true; } catch (e) { handleFirebaseError(e); return false; }
    } else {
      setUsers(prev => prev.filter(u => u.id !== id)); return true;
    }
  };

  const addCollection = async (data: { 
    customerCode: string; 
    customerName?: string;
    invoiceId?: string; 
    amount: number; 
    date: string; 
    paymentMethod: PaymentMethod;
    notes?: string;
  }) => {
    const { customerCode, invoiceId, amount, date, paymentMethod, notes } = data;
    const tId = `T_COL_${Date.now()}`;
    
    // Find customer for clear name display
    const customer = customers.find(c => c.code === customerCode);
    const displayName = customer?.name || data.customerName || customerCode;

    const descParts = [`تحصيل من عميل: ${displayName} (${customerCode})`];
    if (invoiceId && invoiceId.trim()) descParts.push(`فاتورة #${invoiceId.trim()}`);
    if (notes && notes.trim()) descParts.push(notes.trim());
    const description = descParts.join(' - ');
    
    // Update Customer Balance
    if (customer) {
        const newBalance = customer.balance + amount;
        const customerLedgerDesc = notes && notes.trim() ? `دفعة (${notes.trim()})` : 'دفعة';
        const newHistory = [...(customer.history || []), { 
          date, 
          description: customerLedgerDesc, 
          amount 
        }];
        await updateCustomer(customerCode, { balance: newBalance, history: newHistory });
    }

    // Add to Treasury (Ensure no field is undefined for Firestore compatibility)
    const transaction: TreasuryTransaction = {
        id: tId,
        date,
        credit: amount,
        debit: 0,
        balance: 0,
        paymentMethod: paymentMethod || 'CASH',
        description
    };
    if (invoiceId && invoiceId.trim()) {
        transaction.invoiceNumber = invoiceId.trim();
    }
    
    // Optimistic update so UI reflects immediately both online and offline
    setTreasury(prev => {
        const withoutThis = prev.filter(t => t.id !== tId);
        return [...withoutThis, transaction];
    });

    if (isOnline) {
        try { 
          await setDoc(doc(db, 'treasury', tId), transaction); 
        } catch (e) { 
          handleFirebaseError(e); 
        }
    }
  };

  const addTransfer = async (data: { branchId?: BranchId; entityType: 'CUSTOMER' | 'SUPPLIER' | 'EMPLOYEE'; entityCode: string; amount: number; type: 'IN' | 'OUT'; date: string; notes?: string; paymentMethod: PaymentMethod }) => {
      const { entityType, entityCode, amount, type, date, notes, paymentMethod } = data;
      const tId = `TR${Date.now()}`;
      let treasuryDesc = '';
      let branchId: BranchId = data.branchId || 'MARG';

      if (entityType === 'CUSTOMER') {
          const c = customers.find(x => x.code === entityCode);
          if (c?.branchId) branchId = c.branchId;
          const customerName = c?.name || entityCode;
          const change = type === 'IN' ? amount : -amount;
          const newBalance = (c ? c.balance : 0) + change;
          const customerHistDesc = type === 'IN' 
              ? (notes && notes.trim() ? `دفعة (${notes.trim()})` : 'دفعة') 
              : (notes && notes.trim() ? `صرف لعميل (${notes.trim()})` : 'صرف لعميل');

          if (c) {
              const newHistory = [...(c.history || []), { date, description: customerHistDesc, amount: change }];
              await updateCustomer(entityCode, { balance: newBalance, history: newHistory });
          }

          treasuryDesc = type === 'IN'
              ? `تحصيل من عميل: ${customerName} (${entityCode})${notes && notes.trim() ? ` - ${notes.trim()}` : ''}`
              : `صرف لعميل: ${customerName} (${entityCode})${notes && notes.trim() ? ` - ${notes.trim()}` : ''}`;

      } else if (entityType === 'SUPPLIER') {
          const s = suppliers.find(x => x.code === entityCode);
          const supplierName = s?.name || entityCode;
          // OUT: paying supplier reduces our debt to them (-amount)
          // IN: refund from supplier increases balance
          const change = type === 'OUT' ? -amount : amount;
          const newBalance = (s ? s.balance : 0) + change;
          const supplierHistDesc = type === 'OUT'
              ? (notes && notes.trim() ? `دفعة (${notes.trim()})` : 'دفعة')
              : (notes && notes.trim() ? `استلام من مورد (${notes.trim()})` : 'استلام من مورد');

          if (s) {
              const newHistory = [...(s.history || []), { date, description: supplierHistDesc, amount: change }];
              await updateSupplier(entityCode, { balance: newBalance, history: newHistory });
          }

          treasuryDesc = type === 'OUT'
              ? `دفع لمورد: ${supplierName} (${entityCode})${notes && notes.trim() ? ` - ${notes.trim()}` : ''}`
              : `استلام من مورد: ${supplierName} (${entityCode})${notes && notes.trim() ? ` - ${notes.trim()}` : ''}`;

      } else if (entityType === 'EMPLOYEE') {
          const e = employees.find(x => x.code === entityCode);
          const employeeName = e?.name || entityCode;
          // OUT: paying advance or salary to employee increases employee debt to us (+amount)
          // IN: employee returns advance (-amount)
          const change = type === 'OUT' ? amount : -amount;
          const newBalance = (e ? e.balance : 0) + change;
          const empHistDesc = type === 'OUT'
              ? (notes && notes.trim() ? `صرف (${notes.trim()})` : 'صرف راتب / سلفة')
              : (notes && notes.trim() ? `استرداد (${notes.trim()})` : 'استرداد سلفة');

          if (e) {
              const newHistory = [...(e.history || []), { date, description: empHistDesc, amount: change }];
              await updateEmployee(entityCode, { balance: newBalance, history: newHistory });
          }

          treasuryDesc = type === 'OUT'
              ? `صرف لموظف: ${employeeName} (${entityCode})${notes && notes.trim() ? ` - ${notes.trim()}` : ''}`
              : `استرداد من موظف: ${employeeName} (${entityCode})${notes && notes.trim() ? ` - ${notes.trim()}` : ''}`;
      }

      const transaction: TreasuryTransaction = {
          id: tId,
          branchId,
          date,
          credit: type === 'IN' ? amount : 0,
          debit: type === 'OUT' ? amount : 0,
          balance: 0,
          paymentMethod: paymentMethod || 'CASH',
          description: treasuryDesc
      };
      
      // Optimistic update
      setTreasury(prev => {
          const withoutThis = prev.filter(t => t.id !== tId);
          return [...withoutThis, transaction];
      });

      if (isOnline) {
          try { 
              await setDoc(doc(db, 'treasury', tId), cleanDoc(transaction)); 
          } catch (e) { 
              handleFirebaseError(e); 
          }
      }
  };

  const addExpense = async (data: { branchId?: BranchId; name: string; amount: number; date: string; notes?: string }) => {
     const tId = `EX${Date.now()}`;
     const description = `مصروفات: ${data.name} ${data.notes ? `(${data.notes})` : ''}`;
     const branchId: BranchId = data.branchId || 'MARG';
     
     const transaction: TreasuryTransaction = {
         id: tId,
         branchId,
         date: data.date,
         credit: 0,
         debit: data.amount,
         balance: 0,
         paymentMethod: 'CASH', 
         description
     };
     
     if(isOnline) {
        try { await setDoc(doc(db, 'treasury', tId), cleanDoc(transaction)); } catch (e) { handleFirebaseError(e); }
     } else {
        setTreasury(prev => [...prev, transaction]);
     }
  };

  const addOpeningBalance = async (data: { branchId?: BranchId; amount: number; date: string; paymentMethod: PaymentMethod; notes?: string }) => {
     const tId = `OP${Date.now()}`;
     const description = `رصيد افتتاحي ${data.notes ? `- ${data.notes}` : ''}`;
     const branchId: BranchId = data.branchId || 'MARG';
     
     const transaction: TreasuryTransaction = {
         id: tId,
         branchId,
         date: data.date,
         credit: data.amount,
         debit: 0,
         balance: 0,
         paymentMethod: data.paymentMethod,
         description
     };
     
     if (isOnline) {
        try { await setDoc(doc(db, 'treasury', tId), cleanDoc(transaction)); } catch (e) { handleFirebaseError(e); }
     } else {
        setTreasury(prev => [...prev, transaction]);
     }
  };

  const exportLedgerToExcel = (
    entityName: string, 
    entityCode: string, 
    history: any[], 
    currentBalance: number, 
    type: 'CUSTOMER' | 'SUPPLIER',
    isItemized: boolean = false
  ) => {
    let data: any[] = [];
    const isCustomer = type === 'CUSTOMER';
    const colDebit = 'مدين';
    const colCredit = 'دائن';

    if (isItemized) {
      data = history.map((r, idx) => ({
        'م': idx + 1,
        'التاريخ': r.date,
        'رقم الفاتورة': r.ref || '-',
        'الصنف / البيان': r.itemName || r.description,
        'الكمية (كرتونة)': (r.quantity !== undefined && r.quantity !== '-') ? r.quantity : '-',
        'السعر': (r.price !== undefined && r.price !== '-') ? r.price : '-',
        'الإجمالي': (r.lineTotal !== undefined && r.lineTotal !== '-') ? r.lineTotal : (r.debit > 0 ? r.debit : (r.credit > 0 ? r.credit : '-')),
        [colDebit]: r.debit > 0 ? r.debit : 0,
        [colCredit]: r.credit > 0 ? r.credit : 0,
        'الرصيد التراكمي': r.runningBalance !== undefined ? r.runningBalance : '-',
        'الحالة': typeof r.runningBalance === 'number' ? (r.runningBalance < 0 ? (isCustomer ? 'مدين (عليه)' : 'لنا') : r.runningBalance > 0 ? (isCustomer ? 'دائن (له)' : 'علينا') : 'متزن') : '-'
      }));
    } else {
      data = history.map((h, idx) => ({
        'م': idx + 1,
        'التاريخ': h.date,
        'البيان': h.description,
        [colDebit]: isCustomer ? (h.amount < 0 ? Math.abs(h.amount) : 0) : (h.amount < 0 ? Math.abs(h.amount) : 0),
        [colCredit]: isCustomer ? (h.amount > 0 ? h.amount : 0) : (h.amount > 0 ? h.amount : 0)
      }));
    }
    
    data.push({
      'م': '---',
      'التاريخ': '---',
      'رقم الفاتورة': '---',
      'الصنف / البيان': 'الرصيد الحالي النهائي',
      'الكمية (كرتونة)': '---',
      'السعر': '---',
      'الإجمالي': '---',
      [colDebit]: '---',
      [colCredit]: '---',
      'الرصيد التراكمي': currentBalance,
      'الحالة': currentBalance < 0 ? (isCustomer ? 'مدين (عليه)' : 'لنا') : currentBalance > 0 ? (isCustomer ? 'دائن (له)' : 'علينا') : 'متزن'
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "كشف الحساب");
    XLSX.writeFile(wb, `كشف_حساب_${isCustomer ? 'عميل' : 'مورد'}_${entityName}_${entityCode}.xlsx`);
  };

  const exportAllCustomersToExcel = () => {
     const data = customers.map(c => ({
         'الكود': c.code,
         'الاسم': c.name,
         'رقم الهاتف': c.phone,
         'الرصيد': c.balance
     }));
     const ws = XLSX.utils.json_to_sheet(data);
     const wb = XLSX.utils.book_new();
     XLSX.utils.book_append_sheet(wb, ws, "Customers");
     XLSX.writeFile(wb, "All_Customers.xlsx");
  };

  const exportAllSuppliersToExcel = () => {
     const data = suppliers.map(s => ({
         'الكود': s.code,
         'الاسم': s.name,
         'رقم الهاتف': s.phone,
         'الرصيد': s.balance
     }));
     const ws = XLSX.utils.json_to_sheet(data);
     const wb = XLSX.utils.book_new();
     XLSX.utils.book_append_sheet(wb, ws, "Suppliers");
     XLSX.writeFile(wb, "All_Suppliers.xlsx");
  };

  const clearLedger = async (entityType: 'CUSTOMER' | 'SUPPLIER' | 'EMPLOYEE', code: string) => {
      if(entityType === 'CUSTOMER') {
          await updateCustomer(code, { balance: 0, history: [] });
      } else if (entityType === 'SUPPLIER') {
          await updateSupplier(code, { balance: 0, history: [] });
      } else if (entityType === 'EMPLOYEE') {
          await updateEmployee(code, { balance: 0, history: [] });
      }
      return true;
  };

  const clearTreasury = async () => {
      if (isOnline) {
          const q = query(collection(db, 'treasury'));
          const snapshot = await getDocs(q);
          const promises = snapshot.docs.map(d => deleteDoc(d.ref));
          await Promise.all(promises);
      }
      setTreasury([]);
      return true;
  };

  const seedDatabase = async () => {
    // Disabled to protect real cloud database from being polluted with test/mock items
    console.warn("Seeding mock data is permanently disabled to protect real cloud Firestore data.");
    alert("تم تعطيل حقن البيانات التجريبية لحماية قاعدة البيانات الحقيقية للشركة على سحابة Firebase.");
  };

  const updateSystemLogo = async (base64: string) => {
      if(isOnline) {
          await setDoc(doc(db, 'settings', 'general'), { logo: base64 }, { merge: true });
      }
      setCompanyLogo(base64);
  };

  // --- Printing Helper (Shared CSS) ---
  const getPrintStyle = () => `
    :root { --primary-color: #000; --border-color: #000; }
    @page { 
      size: A4 portrait; 
      margin: 6mm 10mm 6mm 10mm; 
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body { 
      font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; 
      padding: 0;
      margin: 0;
      direction: rtl; 
      background-color: #fff;
      font-size: 17px; 
      color: #000;
      line-height: 1.3;
    }
    .invoice-container { 
      background: white; 
      width: 100%; 
      max-width: 100%;
      min-height: 275mm;
      height: 275mm;
      margin: 0 auto; 
      position: relative; 
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-sizing: border-box;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
    .invoice-main-content {
      width: 100%;
      display: flex;
      flex-direction: column;
    }
    .header { 
      display: grid; 
      grid-template-columns: 1fr auto 1fr; 
      align-items: center; 
      border-bottom: 3px solid #000; 
      padding-bottom: 8px; 
      margin-bottom: 10px; 
    }
    .company-info { text-align: right; }
    .company-info h1 { 
      margin: 0; 
      font-size: 38px; 
      font-weight: 900; 
      line-height: 1.1; 
      color: #000; 
      letter-spacing: -0.5px;
    }
    .company-info p { 
      margin: 3px 0 0 0; 
      color: #1f2937; 
      font-size: 20px; 
      font-weight: 800; 
    }
    .logo-box { display: flex; justify-content: center; align-items: center; text-align: center; }
    .invoice-title { text-align: left; }
    .invoice-title h2 { 
      margin: 0; 
      font-size: 24px; 
      color: #000; 
      text-transform: uppercase; 
      border: 3px solid #000; 
      padding: 6px 20px; 
      display: inline-block; 
      font-weight: 900; 
      border-radius: 8px; 
      background-color: #f8fafc;
    }
    .logo-box img { 
      max-height: 85px; 
      max-width: 260px; 
      border: 2.5px solid #0ea5e9; 
      border-radius: 8px; 
      box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
      padding: 3px; 
      background: white; 
      object-fit: contain; 
    }
    .info-bar { 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      margin-bottom: 10px; 
      border: 2.5px solid #000; 
      padding: 8px 16px; 
      border-radius: 8px; 
      font-size: 16px; 
      background-color: #f8fafc; 
    }
    .info-item { display: flex; flex-direction: column; align-items: center; }
    .info-label { font-weight: 800; color: #475569; margin-bottom: 2px; font-size: 14px; }
    .info-value { font-weight: 900; font-size: 18.5px; color: #000; }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin-bottom: 10px; 
      border: 2.5px solid #000; 
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    th { 
      background-color: #e2e8f0; 
      color: #000; 
      font-weight: 900; 
      padding: 8px 6px; 
      border: 2px solid #000; 
      font-size: 18px; 
      text-align: center;
    }
    td { 
      padding: 7px 8px; 
      border: 1.5px solid #000; 
      font-weight: 800; 
      font-size: 17px; 
      text-align: center; 
      color: #000; 
    }
    .totals-section { 
      display: flex; 
      justify-content: space-between; 
      align-items: flex-start; 
      margin-top: 8px;
      width: 100%;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .totals-box { 
      width: 400px; 
      border: 3px solid #000; 
      border-radius: 6px; 
      overflow: hidden; 
      background-color: #fff;
    }
    .total-row { 
      display: flex; 
      justify-content: space-between; 
      padding: 6px 12px; 
      border-bottom: 1.5px solid #cbd5e1; 
      font-size: 17px; 
      font-weight: 800; 
    }
    .total-row.main { 
      font-weight: 900; 
      font-size: 20px; 
      border-bottom: 2.5px solid #000; 
      background-color: #f1f5f9; 
    }
    .total-row.final { 
      background-color: #000; 
      color: #fff; 
      border-bottom: none; 
      font-size: 22px; 
      font-weight: 900; 
      padding: 8px 12px; 
    }
    .invoice-bottom-pinned {
      width: 100%;
      margin-top: auto;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .signatures { 
      margin-bottom: 14px; 
      display: flex; 
      justify-content: space-between; 
      padding: 0 45px; 
      font-size: 18px; 
      font-weight: 900; 
    }
    .sig-box { text-align: center; width: 170px; }
    .sig-line { border-top: 2.5px solid #000; margin-top: 30px; width: 100%; }
    .footer-bar { 
      padding-top: 8px; 
      border-top: 2.5px solid #000; 
      width: 100%; 
      display: flex; 
      justify-content: center; 
      align-items: center; 
      font-size: 16px; 
      font-weight: 900; 
      color: #000; 
    }
    .contact-info { display: flex; gap: 20px; flex-direction: row; align-items: center; }
    .contact-info a, .contact-info span { text-decoration: none !important; color: #000 !important; }
    @media print { 
      html, body { 
        height: 100% !important; 
        max-height: 100% !important; 
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important; 
      } 
      .invoice-container { 
        border: none; 
        padding: 0; 
        width: 100% !important; 
        max-width: 100% !important; 
        height: 275mm !important;
        min-height: 275mm !important;
        max-height: 275mm !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: space-between !important;
        page-break-after: avoid !important;
        break-after: avoid !important;
        page-break-before: avoid !important;
        break-before: avoid !important;
      } 
      .invoice-bottom-pinned {
        margin-top: auto !important;
      }
    }
  `;

  // ... (Print functions use the same logo image tag)
  const printInvoice = (invoice: SalesInvoice) => {
    const cust = customers.find(c => c.code === invoice.customerCode);
    const liveCustomerBalance = (invoice as any).liveCustomerBalance !== undefined
      ? (invoice as any).liveCustomerBalance
      : (cust ? cust.balance : (invoice.currentBalance !== undefined ? invoice.currentBalance : 0));
    const paidAmount = invoice.paidAmount !== undefined ? invoice.paidAmount : (invoice.paid || 0);
    const calculatedPreviousBalance = liveCustomerBalance - (invoice.total - paidAmount);

    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) {
      alert("يرجى السماح بالنوافذ المنبثقة (Popups) لطباعة الفاتورة");
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>فاتورة مبيعات - ${invoice.id}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&display=swap" rel="stylesheet">
        <style>${getPrintStyle()}</style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="invoice-main-content">
            <div class="header">
              <div class="company-info">
                <h1>بورصة النجار</h1>
                <p>لتجارة البيض</p>
              </div>
              <div class="logo-box">
                <img src="${companyLogo || '/logo.png'}" alt="Logo" onerror="this.style.display='none'"/>
              </div>
              <div class="invoice-title">
                <h2>فاتورة مبيعات</h2>
              </div>
            </div>
            
            <div class="info-bar">
               <div class="info-item"><span class="info-label">العميل</span><span class="info-value">${invoice.customerName}</span></div>
               <div class="info-item"><span class="info-label">كود العميل</span><span class="info-value" style="font-family: monospace;">${invoice.customerCode}</span></div>
               <div class="info-item"><span class="info-label">رقم الفاتورة</span><span class="info-value" style="font-family: monospace;">${invoice.id}</span></div>
               <div class="info-item"><span class="info-label">التاريخ</span><span class="info-value">${invoice.date}</span></div>
               <div class="info-item"><span class="info-label">الوقت</span><span class="info-value">${invoice.time}</span></div>
            </div>

            <table>
              <thead>
                <tr><th style="width: 50px;">م</th><th>الصنف</th><th style="width: 110px;">الكمية</th><th style="width: 130px;">السعر</th><th style="width: 160px;">الإجمالي</th></tr>
              </thead>
              <tbody>
                ${invoice.items.map((item, index) => `
                  <tr>
                    <td style="text-align: center;">${index + 1}</td>
                    <td style="text-align: center; padding-right: 10px;">${item.itemName}</td>
                    <td style="text-align: center;">${item.quantity}</td>
                    <td style="text-align: center;">${item.price.toLocaleString()}</td>
                    <td style="text-align: center;">${item.total.toLocaleString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <div class="totals-section">
              <div style="flex: 1;"></div>
              <div class="totals-box">
                <div class="total-row main"><span>الإجمالي:</span><strong>${invoice.total.toLocaleString()}</strong></div>
                ${(invoice.paidAmount !== undefined && invoice.paidAmount > 0) ? `
                  <div class="total-row" style="color: #047857; font-size: 17.5px;"><span>المدفوع (${getPaymentMethodArabicName(invoice.paymentMethod)}):</span><strong>${invoice.paidAmount.toLocaleString()}</strong></div>
                  <div class="total-row" style="color: #b91c1c; font-size: 17.5px;"><span>المتبقي من الفاتورة:</span><strong>${((invoice.remainingAmount !== undefined) ? invoice.remainingAmount : (invoice.total - invoice.paidAmount)).toLocaleString()}</strong></div>
                ` : `
                  <div class="total-row" style="color: #374151; font-size: 17px;"><span>حالة السداد:</span><span>آجل بالكامل</span></div>
                `}
                <div class="total-row" style="color: #1f2937;"><span>رصيد سابق:</span><span style="direction: ltr;">${calculatedPreviousBalance.toLocaleString()}</span></div>
                <div class="total-row final"><span>الرصيد الحالي:</span><span style="direction: ltr;">${liveCustomerBalance.toLocaleString()}</span></div>
              </div>
            </div>
          </div>

          <div class="invoice-bottom-pinned">
            <div class="signatures">
              <div class="sig-box"><strong>المستلم</strong><div class="sig-line"></div></div>
              <div class="sig-box"><strong>توقيع الإدارة</strong><div class="sig-line"></div></div>
            </div>

            <div class="footer-bar">
               <div class="contact-info">
                  <span>للمبيعات والاستفسارات:</span>
                  <span dir="ltr">01280808532</span>
                  <span>-</span>
                  <span dir="ltr">01274688088</span>
                  <span>-</span>
                  <span dir="ltr">01000285428</span>
               </div>
            </div>
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
            window.setTimeout(function(){ window.close(); }, 1000);
          }
        </script>
      </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const printPurchaseInvoice = (purchase: Purchase) => {
     const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) {
      alert("يرجى السماح بالنوافذ المنبثقة (Popups) لطباعة الفاتورة");
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>فاتورة مشتريات - ${purchase.id}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&display=swap" rel="stylesheet">
        <style>${getPrintStyle()}</style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="invoice-main-content">
            <div class="header">
              <div class="company-info">
                <h1>بورصة النجار</h1>
                <p>لتجارة البيض</p>
              </div>
              <div class="logo-box">
                <img src="${companyLogo || '/logo.png'}" alt="Logo" onerror="this.style.display='none'"/>
              </div>
              <div class="invoice-title">
                <h2>فاتورة مشتريات</h2>
              </div>
            </div>
            
            <div class="info-bar">
               <div class="info-item"><span class="info-label">المورد</span><span class="info-value">${purchase.supplierName}</span></div>
               <div class="info-item"><span class="info-label">كود المورد</span><span class="info-value" style="font-family: monospace;">${purchase.supplierCode}</span></div>
               <div class="info-item"><span class="info-label">رقم الفاتورة</span><span class="info-value" style="font-family: monospace;">${purchase.id}</span></div>
               <div class="info-item"><span class="info-label">التاريخ</span><span class="info-value">${purchase.date}</span></div>
            </div>

            <table>
              <thead>
                <tr><th style="width: 50px;">م</th><th>الصنف</th><th style="width: 110px;">الكمية</th><th style="width: 130px;">السعر</th><th style="width: 160px;">الإجمالي</th></tr>
              </thead>
              <tbody>
                ${(purchase.items || []).map((item, index) => `
                  <tr>
                    <td style="text-align: center;">${index + 1}</td>
                    <td style="text-align: center; padding-right: 10px;">${item.itemName}</td>
                    <td style="text-align: center;">${item.quantity}</td>
                    <td style="text-align: center;">${item.price.toLocaleString()}</td>
                    <td style="text-align: center;">${item.total.toLocaleString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <div class="totals-section">
              <div style="flex: 1;"></div>
              <div class="totals-box">
                <div class="total-row final"><span>الإجمالي:</span><strong>${purchase.total.toLocaleString()}</strong></div>
                ${purchase.previousBalance !== undefined ? `
                  <div class="total-row" style="color: #333;"><span>رصيد سابق:</span><span>${purchase.previousBalance.toLocaleString()}</span></div>
                  <div class="total-row main"><span>الرصيد الحالي:</span><span>${purchase.currentBalance?.toLocaleString()}</span></div>
                ` : ''}
              </div>
            </div>
          </div>

          <div class="invoice-bottom-pinned">
            <div class="signatures">
              <div class="sig-box"><strong>المستلم</strong><div class="sig-line"></div></div>
              <div class="sig-box"><strong>توقيع المورد</strong><div class="sig-line"></div></div>
            </div>

            <div class="footer-bar">
               <div class="contact-info">
                  <span>للمبيعات والاستفسارات:</span>
                  <span dir="ltr">01280808532</span>
                  <span>-</span>
                  <span dir="ltr">01274688088</span>
                  <span>-</span>
                  <span dir="ltr">01000285428</span>
               </div>
            </div>
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
            window.setTimeout(function(){ window.close(); }, 1000);
          }
        </script>
      </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const printLedger = (options: {
    title: string;
    entityName: string;
    entityCode: string;
    entityPhone?: string;
    type: 'CUSTOMER' | 'SUPPLIER';
    rows: Array<{
      num: number;
      date: string;
      ref?: string;
      itemName: string;
      quantity?: number | string;
      price?: number | string;
      lineTotal?: number | string;
      debit: number;
      credit: number;
      runningBalance: number;
    }>;
    totalDebit: number;
    totalCredit: number;
    finalBalance: number;
    dateRange?: { from?: string; to?: string };
  }) => {
    const printWindow = window.open('', '_blank', 'width=1100,height=850');
    if (!printWindow) {
      alert("يرجى السماح بالنوافذ المنبثقة (Popups) لطباعة كشف الحساب");
      return;
    }

    const { title, entityName, entityCode, entityPhone, type, rows, totalDebit, totalCredit, finalBalance, dateRange } = options;
    const isCustomer = type === 'CUSTOMER';
    const colDebitTitle = 'مدين';
    const colCreditTitle = 'دائن';

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>${title} - ${entityName}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&display=swap" rel="stylesheet">
        <style>
          @page { size: A4 portrait; margin: 8mm; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; direction: rtl; margin: 0; padding: 10px; color: #000; font-size: 13px; line-height: 1.25; }
          .header { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; border-bottom: 2.5px solid #000; padding-bottom: 8px; margin-bottom: 8px; }
          .company-info { text-align: right; }
          .company-info h1 { margin: 0; font-size: 26px; font-weight: 900; line-height: 1.1; }
          .company-info p { margin: 2px 0 0 0; font-size: 15px; font-weight: 800; color: #1f2937; }
          .logo-box { display: flex; justify-content: center; align-items: center; text-align: center; }
          .logo-box img { max-height: 70px; max-width: 200px; object-fit: contain; }
          .statement-title { text-align: left; }
          .statement-title h2 { margin: 0; font-size: 22px; border: 2.5px solid #000; padding: 6px 24px; font-weight: 900; border-radius: 8px; background-color: #f8fafc; display: inline-block; letter-spacing: 0.5px; }
          .info-bar { display: flex; justify-content: space-between; align-items: center; border: 2px solid #000; padding: 6px 12px; border-radius: 6px; background: #f8fafc; margin-bottom: 8px; font-size: 13px; flex-wrap: wrap; gap: 8px; }
          .info-item { display: flex; flex-direction: column; align-items: center; }
          .info-label { font-weight: 800; color: #475569; font-size: 11px; }
          .info-value { font-weight: 900; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin-top: 4px; margin-bottom: 10px; }
          th { border: 1.5px solid #000; padding: 4px 6px; background-color: #f1f5f9; font-weight: 900; font-size: 12px; text-align: center; }
          td { border: 1px solid #cbd5e1; padding: 4px 6px; font-size: 11.5px; font-weight: 700; text-align: center; }
          tr:nth-child(even) td { background-color: #fbfcfe; }
          .text-right { text-align: right !important; }
          .totals-summary { display: flex; justify-content: flex-end; margin-top: 8px; margin-bottom: 14px; }
          .totals-box { width: 340px; border: 2.5px solid #000; border-radius: 6px; overflow: hidden; }
          .total-row { display: flex; justify-content: space-between; padding: 4px 10px; border-bottom: 1px solid #cbd5e1; font-weight: 800; font-size: 13px; }
          .total-row.final { background: #000; color: #fff; font-size: 15px; font-weight: 900; border-bottom: none; }
          .signatures { display: flex; justify-content: space-between; padding: 0 40px; margin-top: 15px; margin-bottom: 10px; font-size: 14px; font-weight: 900; }
          .sig-box { text-align: center; width: 150px; }
          .sig-line { border-top: 2px solid #000; margin-top: 25px; width: 100%; }
          .footer-bar { border-top: 2px solid #000; padding-top: 6px; display: flex; justify-content: center; font-size: 12px; font-weight: 800; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-info">
            <h1>بورصة النجار</h1>
            <p>لتجارة البيض</p>
          </div>
          <div class="logo-box">
            <img src="${companyLogo || '/logo.png'}" alt="Logo" onerror="this.style.display='none'"/>
          </div>
          <div class="statement-title">
            <h2>كشف حساب</h2>
          </div>
        </div>

        <div class="info-bar">
          <div class="info-item"><span class="info-label">${isCustomer ? 'العميل' : 'المورد'}</span><span class="info-value">${entityName}</span></div>
          <div class="info-item"><span class="info-label">الكود</span><span class="info-value" style="font-family: monospace;">${entityCode}</span></div>
          ${entityPhone ? `<div class="info-item"><span class="info-label">الهاتف</span><span class="info-value" dir="ltr">${entityPhone}</span></div>` : ''}
          ${dateRange && (dateRange.from || dateRange.to) ? `
            <div class="info-item">
              <span class="info-label">الفترة المحددة</span>
              <span class="info-value" style="color: #0369a1;">
                ${dateRange.from ? `من: ${dateRange.from}` : ''} ${dateRange.to ? `إلى: ${dateRange.to}` : ''}
              </span>
            </div>
          ` : ''}
          <div class="info-item"><span class="info-label">تاريخ الطباعة</span><span class="info-value">${new Date().toISOString().split('T')[0]}</span></div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 32px;">م</th>
              <th style="width: 105px; white-space: nowrap;">التاريخ</th>
              <th style="width: 70px;">الفاتورة</th>
              <th style="min-width: 180px; text-align: right; padding-right: 8px;">الصنف / البيان</th>
              <th style="width: 60px;">الكمية</th>
              <th style="width: 60px;">السعر</th>
              <th style="width: 75px;">الإجمالي</th>
              <th style="width: 85px;">${colDebitTitle}</th>
              <th style="width: 85px;">${colCreditTitle}</th>
              <th style="width: 90px; white-space: nowrap;">الرصيد</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td style="width: 32px;">${r.num}</td>
                <td style="white-space: nowrap; font-family: monospace; font-size: 12px;">${r.date}</td>
                <td style="font-family: monospace;">${r.ref || '-'}</td>
                <td class="text-right" style="padding-right: 8px; font-weight: 800; font-size: 12.5px;">${r.itemName}</td>
                <td style="font-weight: 800;">${typeof r.quantity === 'number' ? r.quantity.toLocaleString() : r.quantity}</td>
                <td>${typeof r.price === 'number' ? r.price.toLocaleString() : r.price}</td>
                <td style="font-weight: 800;">${r.lineTotal !== undefined && r.lineTotal !== '-' ? (typeof r.lineTotal === 'number' ? r.lineTotal.toLocaleString() : r.lineTotal) : '-'}</td>
                <td style="color: #b91c1c; font-weight: 800;">${r.debit > 0 ? r.debit.toLocaleString() : '-'}</td>
                <td style="color: #15803d; font-weight: 800;">${r.credit > 0 ? r.credit.toLocaleString() : '-'}</td>
                <td style="font-weight: 900; white-space: nowrap;" dir="ltr">${r.runningBalance.toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals-summary">
          <div class="totals-box">
            <div class="total-row"><span>إجمالي ${colDebitTitle}:</span><span>${totalDebit.toLocaleString()} ج.م</span></div>
            <div class="total-row"><span>إجمالي ${colCreditTitle}:</span><span>${totalCredit.toLocaleString()} ج.م</span></div>
            <div class="total-row final"><span>الرصيد النهائي:</span><span dir="ltr">${finalBalance.toLocaleString()} ج.م</span></div>
          </div>
        </div>

        <div class="signatures">
          <div class="sig-box"><strong>المستلم / الطرف الآخر</strong><div class="sig-line"></div></div>
          <div class="sig-box"><strong>توقيع إدارة البورصة</strong><div class="sig-line"></div></div>
        </div>

        <div class="footer-bar">
          للمبيعات والاستفسارات: 01280808532 - 01274688088 - 01000285428
        </div>

        <script>
          window.onload = function() {
            window.print();
            window.setTimeout(function(){ window.close(); }, 1200);
          }
        </script>
      </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const printConsolidatedLedger = (options: {
    title: string;
    reportType: 'CUSTOMERS' | 'SUPPLIERS' | 'ALL';
    dateRange?: { from?: string; to?: string };
    mode: 'BALANCES' | 'MOVEMENTS';
    balanceRows?: Array<{
      num: number;
      code: string;
      name: string;
      phone?: string;
      entityType?: 'CUSTOMER' | 'SUPPLIER';
      priorBalance: number;
      debit: number;
      credit: number;
      finalBalance: number;
      status: 'مدين' | 'دائن' | 'متزن';
    }>;
    movementRows?: Array<{
      num: number;
      date: string;
      entityName: string;
      entityCode: string;
      ref?: string;
      itemName: string;
      quantity?: number | string;
      price?: number | string;
      lineTotal?: number | string;
      debit: number;
      credit: number;
    }>;
    totalDebit: number;
    totalCredit: number;
    finalBalance: number;
  }) => {
    const printWindow = window.open('', '_blank', 'width=1150,height=850');
    if (!printWindow) {
      alert("يرجى السماح بالنوافذ المنبثقة (Popups) لطباعة كشف الحساب المجمع");
      return;
    }

    const { title, reportType, dateRange, mode, balanceRows = [], movementRows = [], totalDebit, totalCredit, finalBalance } = options;
    const isCustomerReport = reportType === 'CUSTOMERS';
    const isSupplierReport = reportType === 'SUPPLIERS';

    const typeLabel = isCustomerReport ? 'كشف حساب مجمع للعملاء' : isSupplierReport ? 'كشف حساب مجمع للموردين' : 'كشف حساب مجمع شامل (عملاء وموردين)';

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&display=swap" rel="stylesheet">
        <style>
          @page { size: A4 ${mode === 'MOVEMENTS' ? 'landscape' : 'portrait'}; margin: 8mm; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; direction: rtl; margin: 0; padding: 10px; color: #000; font-size: 12px; line-height: 1.25; }
          .header { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; border-bottom: 2.5px solid #000; padding-bottom: 8px; margin-bottom: 8px; }
          .company-info { text-align: right; }
          .company-info h1 { margin: 0; font-size: 24px; font-weight: 900; line-height: 1.1; }
          .company-info p { margin: 2px 0 0 0; font-size: 14px; font-weight: 800; color: #1f2937; }
          .logo-box { display: flex; justify-content: center; align-items: center; text-align: center; }
          .logo-box img { max-height: 65px; max-width: 180px; object-fit: contain; }
          .statement-title { text-align: left; }
          .statement-title h2 { margin: 0; font-size: 20px; border: 2.5px solid #000; padding: 6px 18px; font-weight: 900; border-radius: 8px; background-color: #f8fafc; display: inline-block; letter-spacing: 0.5px; }
          .info-bar { display: flex; justify-content: space-between; align-items: center; border: 2px solid #000; padding: 6px 12px; border-radius: 6px; background: #f8fafc; margin-bottom: 8px; font-size: 12px; flex-wrap: wrap; gap: 8px; }
          .info-item { display: flex; flex-direction: column; align-items: center; }
          .info-label { font-weight: 800; color: #475569; font-size: 11px; }
          .info-value { font-weight: 900; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; margin-top: 4px; margin-bottom: 10px; }
          th { border: 1.5px solid #000; padding: 4px 6px; background-color: #f1f5f9; font-weight: 900; font-size: 11px; text-align: center; }
          td { border: 1px solid #cbd5e1; padding: 4px 6px; font-size: 11px; font-weight: 700; text-align: center; }
          tr:nth-child(even) td { background-color: #fbfcfe; }
          .text-right { text-align: right !important; }
          .totals-summary { display: flex; justify-content: flex-end; margin-top: 8px; margin-bottom: 14px; }
          .totals-box { width: 340px; border: 2.5px solid #000; border-radius: 6px; overflow: hidden; }
          .total-row { display: flex; justify-content: space-between; padding: 4px 10px; border-bottom: 1px solid #cbd5e1; font-weight: 800; font-size: 12px; }
          .total-row.final { background: #000; color: #fff; font-size: 14px; font-weight: 900; border-bottom: none; }
          .signatures { display: flex; justify-content: space-between; padding: 0 40px; margin-top: 15px; margin-bottom: 10px; font-size: 13px; font-weight: 900; }
          .sig-box { text-align: center; width: 150px; }
          .sig-line { border-top: 2px solid #000; margin-top: 25px; width: 100%; }
          .footer-bar { border-top: 2px solid #000; padding-top: 6px; display: flex; justify-content: center; font-size: 11px; font-weight: 800; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-info">
            <h1>بورصة النجار</h1>
            <p>لتجارة البيض</p>
          </div>
          <div class="logo-box">
            <img src="${companyLogo || '/logo.png'}" alt="Logo" onerror="this.style.display='none'"/>
          </div>
          <div class="statement-title">
            <h2>${title}</h2>
          </div>
        </div>

        <div class="info-bar">
          <div class="info-item"><span class="info-label">التقرير</span><span class="info-value">${typeLabel}</span></div>
          <div class="info-item"><span class="info-label">نوع العرض</span><span class="info-value">${mode === 'BALANCES' ? 'ملخص الأرصدة' : 'سجل الحركات التفصيلية'}</span></div>
          ${dateRange && (dateRange.from || dateRange.to) ? `
            <div class="info-item">
              <span class="info-label">الفترة المحددة</span>
              <span class="info-value" style="color: #0369a1;">
                ${dateRange.from ? `من: ${dateRange.from}` : ''} ${dateRange.to ? `إلى: ${dateRange.to}` : ''}
              </span>
            </div>
          ` : '<div class="info-item"><span class="info-label">الفترة</span><span class="info-value">جميع الحركات حتى تاريخه</span></div>'}
          <div class="info-item"><span class="info-label">العدد</span><span class="info-value">${mode === 'BALANCES' ? `${balanceRows.length} حساب` : `${movementRows.length} حركة`}</span></div>
          <div class="info-item"><span class="info-label">تاريخ الطباعة</span><span class="info-value">${new Date().toISOString().split('T')[0]}</span></div>
        </div>

        ${mode === 'BALANCES' ? `
          <table>
            <thead>
              <tr>
                <th style="width: 30px;">م</th>
                <th style="width: 65px;">الكود</th>
                <th style="text-align: right; padding-right: 8px;">الاسم</th>
                <th style="width: 95px;">الهاتف</th>
                ${reportType === 'ALL' ? '<th style="width: 60px;">النوع</th>' : ''}
                <th style="width: 80px;">رصيد سابق</th>
                <th style="width: 85px;">إجمالي مدين</th>
                <th style="width: 85px;">إجمالي دائن</th>
                <th style="width: 95px;">الرصيد النهائي</th>
                <th style="width: 65px;">الحالة</th>
              </tr>
            </thead>
            <tbody>
              ${balanceRows.map(r => `
                <tr>
                  <td>${r.num}</td>
                  <td style="font-family: monospace; font-weight: 800;">${r.code}</td>
                  <td class="text-right" style="padding-right: 8px; font-weight: 800;">${r.name}</td>
                  <td dir="ltr" style="font-family: monospace;">${r.phone || '-'}</td>
                  ${reportType === 'ALL' ? `<td>${r.entityType === 'CUSTOMER' ? 'عميل' : 'مورد'}</td>` : ''}
                  <td dir="ltr">${r.priorBalance.toLocaleString()}</td>
                  <td dir="ltr" style="color: #b91c1c; font-weight: 800;">${r.debit > 0 ? r.debit.toLocaleString() : '-'}</td>
                  <td dir="ltr" style="color: #15803d; font-weight: 800;">${r.credit > 0 ? r.credit.toLocaleString() : '-'}</td>
                  <td dir="ltr" style="font-weight: 900;">${r.finalBalance.toLocaleString()}</td>
                  <td><strong>${r.status}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : `
          <table>
            <thead>
              <tr>
                <th style="width: 30px;">م</th>
                <th style="width: 85px; white-space: nowrap;">التاريخ</th>
                <th style="width: 120px; text-align: right; padding-right: 6px;">الطرف</th>
                <th style="width: 65px;">الفاتورة</th>
                <th style="text-align: right; padding-right: 6px;">الصنف / البيان</th>
                <th style="width: 50px;">الكمية</th>
                <th style="width: 50px;">السعر</th>
                <th style="width: 70px;">الإجمالي</th>
                <th style="width: 75px;">مدين</th>
                <th style="width: 75px;">دائن</th>
              </tr>
            </thead>
            <tbody>
              ${movementRows.map(r => `
                <tr>
                  <td>${r.num}</td>
                  <td style="white-space: nowrap; font-family: monospace; font-size: 11px;">${r.date}</td>
                  <td class="text-right" style="padding-right: 6px; font-weight: 800;">${r.entityName} <span style="font-size: 10px; color: #64748b;">(${r.entityCode})</span></td>
                  <td style="font-family: monospace;">${r.ref || '-'}</td>
                  <td class="text-right" style="padding-right: 6px; font-weight: 800;">${r.itemName}</td>
                  <td>${typeof r.quantity === 'number' ? r.quantity.toLocaleString() : r.quantity}</td>
                  <td>${typeof r.price === 'number' ? r.price.toLocaleString() : r.price}</td>
                  <td style="font-weight: 800;">${r.lineTotal !== undefined && r.lineTotal !== '-' ? (typeof r.lineTotal === 'number' ? r.lineTotal.toLocaleString() : r.lineTotal) : '-'}</td>
                  <td style="color: #b91c1c; font-weight: 800;">${r.debit > 0 ? r.debit.toLocaleString() : '-'}</td>
                  <td style="color: #15803d; font-weight: 800;">${r.credit > 0 ? r.credit.toLocaleString() : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}

        <div class="totals-summary">
          <div class="totals-box">
            <div class="total-row"><span>إجمالي مدين:</span><span dir="ltr">${totalDebit.toLocaleString()} ج.م</span></div>
            <div class="total-row"><span>إجمالي دائن:</span><span dir="ltr">${totalCredit.toLocaleString()} ج.م</span></div>
            <div class="total-row final"><span>صافي الرصيد:</span><span dir="ltr">${finalBalance.toLocaleString()} ج.م</span></div>
          </div>
        </div>

        <div class="signatures">
          <div class="sig-box"><strong>المستلم / الطرف الآخر</strong><div class="sig-line"></div></div>
          <div class="sig-box"><strong>توقيع إدارة البورصة</strong><div class="sig-line"></div></div>
        </div>

        <div class="footer-bar">
          للمبيعات والاستفسارات: 01280808532 - 01274688088 - 01000285428
        </div>

        <script>
          window.onload = function() {
            window.print();
            window.setTimeout(function(){ window.close(); }, 1200);
          }
        </script>
      </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const exportBackupData = (): SystemBackup => {
    const isAuthorized = currentUser?.role === 'ADMIN' || currentUser?.username === 'admin' || Boolean(currentUser?.permissions?.canManageBackup);
    if (!isAuthorized) {
      alert('ليس لديك صلاحية تصدير النسخ الاحتياطي.');
      throw new Error('Unauthorized');
    }

    const backup: SystemBackup = {
      version: '1.0',
      systemName: 'بورصة النجار لتجارة البيض',
      exportedAt: new Date().toISOString(),
      exportedBy: currentUser?.fullName || 'مستخدم النظام',
      stats: {
        customersCount: customers.length,
        suppliersCount: suppliers.length,
        invoicesCount: invoices.length,
        purchasesCount: purchases.length,
        productsCount: products.length,
        treasuryCount: treasury.length,
        employeesCount: employees.length,
        usersCount: users.length
      },
      data: {
        customers,
        suppliers,
        products,
        employees,
        invoices,
        purchases,
        treasury,
        users,
        companyLogo
      }
    };

    const jsonStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    const today = new Date().toISOString().split('T')[0];
    const time = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
    downloadAnchor.href = url;
    downloadAnchor.download = `backup_naggar_${today}_${time}.json`;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    setTimeout(() => {
      if (document.body.contains(downloadAnchor)) {
        document.body.removeChild(downloadAnchor);
      }
      URL.revokeObjectURL(url);
    }, 200);

    return backup;
  };

  const restoreBackupData = async (backup: any): Promise<{ success: boolean; message: string }> => {
    const isAuthorized = currentUser?.role === 'ADMIN' || currentUser?.username === 'admin' || Boolean(currentUser?.permissions?.canManageBackup);
    if (!isAuthorized) {
      return { success: false, message: 'ليس لديك صلاحية استرجاع البيانات والنسخ الاحتياطي.' };
    }

    try {
      if (!backup) {
        throw new Error('ملف النسخة الاحتياطية فارغ أو غير موجود.');
      }

      // Handle both structured { version, data: { ... } } and direct { customers, suppliers, ... }
      const rawData = backup.data && typeof backup.data === 'object' ? backup.data : backup;

      const bCustomers: Customer[] = Array.isArray(rawData.customers) ? rawData.customers : [];
      const bSuppliers: Supplier[] = Array.isArray(rawData.suppliers) ? rawData.suppliers : [];
      const bProducts: Product[] = Array.isArray(rawData.products) ? rawData.products : [];
      const bEmployees: Employee[] = Array.isArray(rawData.employees) ? rawData.employees : [];
      const bInvoices: SalesInvoice[] = Array.isArray(rawData.invoices) ? rawData.invoices : [];
      const bPurchases: Purchase[] = Array.isArray(rawData.purchases) ? rawData.purchases : [];
      const bTreasury: TreasuryTransaction[] = Array.isArray(rawData.treasury) ? rawData.treasury : [];
      const bUsers: User[] = Array.isArray(rawData.users) ? rawData.users : [];
      const bLogo: string | null = rawData.companyLogo || null;

      // 1. Immediate local state update (works offline & online immediately)
      setCustomers(bCustomers);
      setSuppliers(bSuppliers);
      setProducts(bProducts);
      setEmployees(bEmployees);
      setInvoices(bInvoices);
      setPurchases(bPurchases);
      setTreasury(bTreasury);
      if (bUsers && bUsers.length > 0) setUsers(bUsers);
      if (bLogo) setCompanyLogo(bLogo);

      // Save to localStorage for instant persistence
      try {
        localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(bCustomers));
        localStorage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify(bSuppliers));
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(bProducts));
        localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(bEmployees));
        localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(bInvoices));
        localStorage.setItem(STORAGE_KEYS.PURCHASES, JSON.stringify(bPurchases));
        localStorage.setItem(STORAGE_KEYS.TREASURY, JSON.stringify(bTreasury));
        if (bUsers && bUsers.length > 0) localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(bUsers));
        if (bLogo) localStorage.setItem(STORAGE_KEYS.COMPANY_LOGO, bLogo);
      } catch (lsErr) {
        console.warn("LocalStorage save warning during restore:", lsErr);
      }

      // 2. If Online, synchronize with Firestore
      if (isOnline) {
        const syncCollection = async (collectionName: string, items: any[], getId: (item: any, index: number) => string) => {
          try {
            const colRef = collection(db, collectionName);
            const snap = await getDocs(colRef);
            
            // Delete existing docs in cloud
            const deletePromises = snap.docs.map((d: any) => 
              deleteDoc(d.ref).catch((e: any) => console.warn(`Delete doc ${collectionName}/${d.id} failed:`, e))
            );
            await Promise.all(deletePromises);

            // Write restored docs with guaranteed valid non-empty IDs
            const writePromises = items.map(async (item: any, idx: number) => {
              const rawId = getId(item, idx);
              const id = rawId && String(rawId).trim() 
                ? String(rawId).trim() 
                : `${collectionName}_${Date.now()}_${idx + 1}`;

              try {
                await setDoc(doc(db, collectionName, id), cleanDoc(item));
              } catch (setErr) {
                console.error(`Error saving ${collectionName}/${id}:`, setErr);
              }
            });
            await Promise.all(writePromises);
          } catch (colErr) {
            console.error(`Error syncing collection ${collectionName}:`, colErr);
          }
        };

        await syncCollection('customers', bCustomers, (c, idx) => c.code || c.id || `C_${idx + 1}`);
        await syncCollection('suppliers', bSuppliers, (s, idx) => s.code || s.id || `S_${idx + 1}`);
        await syncCollection('products', bProducts, (p, idx) => p.code || p.id || `P_${idx + 1}`);
        await syncCollection('employees', bEmployees, (e, idx) => e.code || e.id || `E_${idx + 1}`);
        await syncCollection('invoices', bInvoices, (inv, idx) => inv.id || inv.code || `INV_${idx + 1}`);
        await syncCollection('purchases', bPurchases, (pur, idx) => pur.id || pur.code || `PUR_${idx + 1}`);
        await syncCollection('treasury', bTreasury, (t, idx) => t.id || `TR_${idx + 1}`);
        if (bUsers && bUsers.length > 0) {
          await syncCollection('users', bUsers, (u, idx) => u.id || `U_${idx + 1}`);
        }
        if (bLogo) {
          try {
            await setDoc(doc(db, 'settings', 'general'), { logo: bLogo }, { merge: true });
          } catch (logoErr) {
            console.warn("Logo save failed:", logoErr);
          }
        }
      }

      return { 
        success: true, 
        message: `تم تثبيت واسترجاع النسخة الاحتياطية بنجاح! تم استعادة ${bCustomers.length} عميل، ${bSuppliers.length} مورد، ${bInvoices.length} فاتورة بيع، ${bPurchases.length} فاتورة شراء، و${bTreasury.length} حركة خزينة.` 
      };
    } catch (err: any) {
      console.error("Restore error:", err);
      return { 
        success: false, 
        message: `فشل استرجاع النسخة الاحتياطية: ${err.message || 'خطأ غير معروف'}` 
      };
    }
  };

  return (
    <ERPContext.Provider value={{
      products, customers, suppliers, employees, purchases, invoices, treasury, users, currentUser, isOnline, permissionError, companyLogo,
      login, logout, addUser, updateUser, deleteUser, addProduct, updateProduct, deleteProduct, clearAllProducts, deduplicateProducts, deletePurchase,
      transferStockBetweenBranches, transferCashBetweenBranches,
      addPurchase, updatePurchase, finalizePurchasePrice, addInvoice, updateInvoice, deleteInvoice, clearAllInvoices, addCollection, addTransfer, addExpense, addOpeningBalance, addCustomer, updateCustomer, deleteCustomer, addSupplier, updateSupplier, deleteSupplier, addEmployee, updateEmployee, deleteEmployee,
      restoreEntity, permanentDeleteEntity,
      seedDatabase, printInvoice, printPurchaseInvoice, printLedger, printConsolidatedLedger, exportLedgerToExcel, exportAllCustomersToExcel, exportAllSuppliersToExcel, clearLedger, clearTreasury, updateSystemLogo,
      exportBackupData, restoreBackupData,
      currentTreasuryBalance, currentTreasuryBalanceMarg, currentTreasuryBalanceNozha, balances
    }}>
      {children}
    </ERPContext.Provider>
  );
};

export const useERP = () => {
  const context = useContext(ERPContext);
  if (!context) throw new Error("useERP must be used within an ERPProvider");
  return context;
};
