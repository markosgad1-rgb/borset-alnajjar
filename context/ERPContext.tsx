
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Product, Customer, Supplier, Employee, Purchase, SalesInvoice, TreasuryTransaction, InvoiceItem, User, PaymentMethod } from '../types';
import { firebaseConfig, isFirebaseConfigured } from '../firebaseConfig';
import { initializeApp } from 'firebase/app';
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

// --- Firebase Init ---
let db: any = null;

if (isFirebaseConfigured()) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log("Firebase initialized successfully");
  } catch (e) {
    console.error("Firebase initialization error:", e);
  }
}

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
  addProduct: (product: Product) => void;
  updateProduct: (product: Product) => void;
  deleteProduct: (code: string) => void;
  addPurchase: (purchase: Omit<Purchase, 'previousBalance' | 'currentBalance'>) => void; // Updated type
  updatePurchase: (oldPurchase: Purchase, newPurchaseData: Purchase) => Promise<void>;
  deletePurchase: (id: string) => Promise<void>;
  addInvoice: (invoiceData: {
    id: string;
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
    entityType: 'CUSTOMER' | 'SUPPLIER' | 'EMPLOYEE';
    entityCode: string;
    amount: number;
    type: 'IN' | 'OUT'; // IN = Deposit/Collection, OUT = Withdrawal/Payment
    date: string;
    notes?: string;
    paymentMethod: PaymentMethod;
  }) => void;
  addExpense: (data: {
    name: string;
    amount: number;
    date: string;
    notes?: string;
  }) => Promise<void>;
  addOpeningBalance: (data: {
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
  addEmployee: (employee: Employee) => void;
  updateEmployee: (code: string, updatedData: Partial<Employee>) => void;
  deleteEmployee: (code: string) => Promise<void>;
  
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
      debit: number;
      credit: number;
      runningBalance: number;
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

  currentTreasuryBalance: number;
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

// Helper to patch old user objects with new permissions
const sanitizeUser = (user: any): User => {
  if (!user) return user;
  
  const defaults = {
    dashboard: false,
    sales: false,
    warehouse: false,
    financial: false,
    admin: false,
    canDeleteLedgers: false,
    canEditWarehouse: false,
    canManageTreasury: false,
    canEditPurchases: false
  };

  // If admin, ensure they have full access by default if keys are missing
  if (user.role === 'ADMIN') {
    return {
      ...user,
      permissions: {
        dashboard: true, sales: true, warehouse: true, financial: true, admin: true, canDeleteLedgers: true,
        canEditWarehouse: true, canManageTreasury: true, canEditPurchases: true,
        ...(user.permissions || {}) 
      }
    };
  }

  return {
    ...user,
    permissions: {
      ...defaults,
      ...(user.permissions || {})
    }
  };
};

// Initial Mock Data
const INITIAL_USERS: User[] = [
  sanitizeUser({ 
    id: '1', 
    username: 'admin', 
    password: '123', 
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
        console.error("Snapshot listener error:", error);
        if (error.code === 'permission-denied' || error.message?.includes('permission-denied')) {
          setPermissionError(true);
        }
      };

      try {
        unsubs.push(onSnapshot(doc(db, 'settings', 'general'), (doc: any) => {
           if(doc.exists()) {
             const data = doc.data();
             if(data.logo) setCompanyLogo(data.logo);
           }
        }));

        unsubs.push(onSnapshot(collection(db, 'users'), (snap: any) => {
           setPermissionError(false);
           const loadedUsers = snap.docs.map((d: any) => sanitizeUser(d.data()));
           setUsers(loadedUsers);
           
           if (loadedUsers.length === 0) {
              const adminUser = sanitizeUser({ 
                id: '1', username: 'admin', password: '123', fullName: 'المدير العام', role: 'ADMIN', permissions: {} 
              });
              setDoc(doc(db, 'users', '1'), adminUser).catch(console.error);
           }
        }, handleSnapshotError));

        unsubs.push(onSnapshot(collection(db, 'products'), (snap: any) => setProducts(snap.docs.map((d: any) => d.data() as Product)), handleSnapshotError));
        unsubs.push(onSnapshot(collection(db, 'customers'), (snap: any) => setCustomers(snap.docs.map((d: any) => d.data() as Customer)), handleSnapshotError));
        unsubs.push(onSnapshot(collection(db, 'suppliers'), (snap: any) => setSuppliers(snap.docs.map((d: any) => d.data() as Supplier)), handleSnapshotError));
        unsubs.push(onSnapshot(collection(db, 'employees'), (snap: any) => setEmployees(snap.docs.map((d: any) => d.data() as Employee)), handleSnapshotError));
        
        const qPurchases = query(collection(db, 'purchases'), orderBy('date', 'desc'));
        unsubs.push(onSnapshot(qPurchases, (snap: any) => setPurchases(snap.docs.map((d: any) => d.data() as Purchase)), handleSnapshotError));
        
        const qInvoices = query(collection(db, 'invoices'), orderBy('date', 'desc'));
        unsubs.push(onSnapshot(qInvoices, (snap: any) => setInvoices(snap.docs.map((d: any) => d.data() as SalesInvoice)), handleSnapshotError));
        
        const qTreasury = query(collection(db, 'treasury')); 
        unsubs.push(onSnapshot(qTreasury, (snap: any) => {
           const data = snap.docs.map((d: any) => d.data() as TreasuryTransaction);
           data.sort((a, b) => {
             const dateA = a.date || '';
             const dateB = b.date || '';
             if (dateA !== dateB) return dateA.localeCompare(dateB);
             return a.id.localeCompare(b.id);
           });
           setTreasury(data);
        }, handleSnapshotError));
      } catch (err) {
        console.error("Error setting up listeners:", err);
      }

      return () => unsubs.forEach(u => u && u());

    } else {
      const load = (key: string, setter: Function, def: any) => {
        const saved = localStorage.getItem(key);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (key === STORAGE_KEYS.USERS) {
            setter(parsed.map((u: any) => sanitizeUser(u)));
          } else {
            setter(parsed);
          }
        }
        else setter(def);
      };

      load(STORAGE_KEYS.USERS, setUsers, INITIAL_USERS);
      load(STORAGE_KEYS.PRODUCTS, setProducts, []);
      load(STORAGE_KEYS.CUSTOMERS, setCustomers, []);
      load(STORAGE_KEYS.SUPPLIERS, setSuppliers, []);
      load(STORAGE_KEYS.EMPLOYEES, setEmployees, []);
      load(STORAGE_KEYS.PURCHASES, setPurchases, []);
      load(STORAGE_KEYS.INVOICES, setInvoices, []);
      load(STORAGE_KEYS.TREASURY, setTreasury, []);
      const savedLogo = localStorage.getItem(STORAGE_KEYS.COMPANY_LOGO);
      if(savedLogo) setCompanyLogo(savedLogo);
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

    if (username === 'admin' && password === '123') {
       const adminUser = sanitizeUser({ 
         id: '1', 
         username: 'admin', 
         password: '123', 
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

  const addProduct = async (product: Product) => {
    if (isOnline) { try { await setDoc(doc(db, 'products', product.code), product); } catch (e) { handleFirebaseError(e); } } else { setProducts(prev => { const exists = prev.find(p => p.code === product.code); if (exists) return prev; return [...prev, product]; }); }
  };
  const updateProduct = async (updatedProduct: Product) => { if (isOnline) { try { await setDoc(doc(db, 'products', updatedProduct.code), updatedProduct); } catch (e) { handleFirebaseError(e); } } else { setProducts(prev => prev.map(p => p.code === updatedProduct.code ? updatedProduct : p)); } };
  const deleteProduct = async (code: string) => { if (isOnline) { try { await deleteDoc(doc(db, 'products', code)); } catch (e) { handleFirebaseError(e); } } else { setProducts(prev => prev.filter(p => p.code !== code)); } };
  
  const addCustomer = async (customer: Customer) => { if (isOnline) { try { await setDoc(doc(db, 'customers', customer.code), customer); } catch (e) { handleFirebaseError(e); } } else { setCustomers(prev => [...prev, customer]); } };
  const updateCustomer = async (code: string, updatedData: Partial<Customer>) => { const customer = customers.find(c => c.code === code); if (!customer) return; const newCustomer = { ...customer, ...updatedData }; if (isOnline) { try { if (updatedData.code && updatedData.code !== code) { await deleteDoc(doc(db, 'customers', code)); await setDoc(doc(db, 'customers', updatedData.code), newCustomer); } else { await setDoc(doc(db, 'customers', code), newCustomer); } } catch (e) { handleFirebaseError(e); } } else { setCustomers(prev => prev.map(c => c.code === code ? newCustomer : c)); } };
  const deleteCustomer = async (code: string) => { if (isOnline) { try { await deleteDoc(doc(db, 'customers', code)); } catch (e) { handleFirebaseError(e); } } else { setCustomers(prev => prev.filter(c => c.code !== code)); } };

  const addSupplier = async (supplier: Supplier) => { if (isOnline) { try { await setDoc(doc(db, 'suppliers', supplier.code), supplier); } catch (e) { handleFirebaseError(e); } } else { setSuppliers(prev => [...prev, supplier]); } };
  const updateSupplier = async (code: string, updatedData: Partial<Supplier>) => { const supplier = suppliers.find(s => s.code === code); if (!supplier) return; const newSupplier = { ...supplier, ...updatedData }; if (isOnline) { try { await setDoc(doc(db, 'suppliers', code), newSupplier); } catch (e) { handleFirebaseError(e); } } else { setSuppliers(prev => prev.map(s => s.code === code ? newSupplier : s)); } };
  const addEmployee = async (employee: Employee) => { if (isOnline) { try { await setDoc(doc(db, 'employees', employee.code), employee); } catch (e) { handleFirebaseError(e); } } else { setEmployees(prev => [...prev, employee]); } };
  const updateEmployee = async (code: string, updatedData: Partial<Employee>) => { const employee = employees.find(e => e.code === code); if (!employee) return; const newEmployee = { ...employee, ...updatedData }; if (isOnline) { try { await setDoc(doc(db, 'employees', code), newEmployee); } catch (e) { handleFirebaseError(e); } } else { setEmployees(prev => prev.map(e => e.code === code ? newEmployee : e)); } };
  const deleteEmployee = async (code: string) => { if (isOnline) { try { await deleteDoc(doc(db, 'employees', code)); } catch (e) { handleFirebaseError(e); } } else { setEmployees(prev => prev.filter(e => e.code !== code)); } };

  // --- Purchase Logic ---

  const addPurchase = async (purchaseData: Omit<Purchase, 'previousBalance' | 'currentBalance'>) => {
    // Determine ID if not provided (fallback, but page should provide)
    const id = purchaseData.id || `R${Date.now()}`;
    
    // Calculate balances snapshot
    const supplier = suppliers.find(s => s.code === purchaseData.supplierCode);
    const prevBalance = supplier ? supplier.balance : 0;
    const newBalance = prevBalance + purchaseData.total;

    const newPurchase: Purchase = { 
      ...purchaseData, 
      id,
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
            const totalOldValue = product.quantity * product.avgCost;
            const totalNewValue = item.quantity * item.price;
            const newQty = product.quantity + item.quantity;
            const newAvgCost = (totalOldValue + totalNewValue) / newQty;
            await updateDoc(productRef, { quantity: newQty, avgCost: newAvgCost });
          } else {
            await setDoc(productRef, { 
              code: item.itemCode, 
              name: item.itemName, 
              quantity: item.quantity, 
              avgCost: item.price, 
              price: item.price * 1.2 
            });
          }
        }

        const supplierRef = doc(db, 'suppliers', purchaseData.supplierCode);
        const supplierSnap = await getDoc(supplierRef);
        if (supplierSnap.exists()) {
          const s = supplierSnap.data() as Supplier;
          const newHistory = [...s.history, { date: purchaseData.date, description: `فاتورة مشتريات #${newPurchase.id}`, amount: purchaseData.total }];
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
            const newQty = existing.quantity + item.quantity;
            const newAvg = ((existing.quantity * existing.avgCost) + (item.quantity * item.price)) / newQty;
            tempProducts[idx] = { ...existing, quantity: newQty, avgCost: newAvg };
          } else {
             tempProducts.push({ 
               code: item.itemCode, 
               name: item.itemName, 
               quantity: item.quantity, 
               avgCost: item.price, 
               price: item.price * 1.2 
             });
          }
        });
        return tempProducts;
      });

      setSuppliers(prev => prev.map(s => {
         if (s.code === purchaseData.supplierCode) {
           return { 
             ...s, 
             balance: newBalance, 
             history: [...s.history, { date: purchaseData.date, description: `فاتورة مشتريات #${newPurchase.id}`, amount: purchaseData.total }]
           };
         }
         return s;
      }));
    }
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
          const newHistory = [...s.history, { 
            date: newPurchaseData.date, 
            description: `تعديل فاتورة مشتريات #${oldPurchase.id}`, 
            amount: balanceChange 
          }];
          await updateDoc(supplierRef, { balance: newBalance, history: newHistory });
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
          return {
            ...s,
            balance: s.balance + balanceChange,
            history: [...s.history, { date: newPurchaseData.date, description: `تعديل فاتورة مشتريات #${oldPurchase.id}`, amount: balanceChange }]
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
    if (isOnline) {
      try {
        await deleteDoc(doc(db, 'purchases', id));
      } catch (e) { handleFirebaseError(e); }
    } else {
      setPurchases(prev => prev.filter(p => p.id !== id));
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
    // Customer balance: debt is -total, payment is +paidAmount => net change is -(total - paidAmount) = -remainingAmount
    const netDebtIncrease = remainingAmount;
    const newCustomerBalance = prevBalance - netDebtIncrease;
    
    // Clean newInvoice without ANY undefined fields
    const newInvoice: SalesInvoice = {
      id: invoiceData.id,
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
    } else if (paidAmount >= total) {
      historyEntries.push({ 
        date: invoiceData.date, 
        description: `فاتورة بيع #${id} (إجمالي ${total.toLocaleString()})`, 
        amount: -total 
      });
      historyEntries.push({ 
        date: invoiceData.date, 
        description: `سداد نقدي كامل فاتورة #${id} (${getPaymentMethodArabicName(paymentMethod)})`, 
        amount: paidAmount 
      });
    } else {
      historyEntries.push({ 
        date: invoiceData.date, 
        description: `فاتورة بيع #${id} (إجمالي ${total.toLocaleString()})`, 
        amount: -total 
      });
      historyEntries.push({ 
        date: invoiceData.date, 
        description: `دفعة نقدية مسددة من فاتورة #${id} (${getPaymentMethodArabicName(paymentMethod)})`, 
        amount: paidAmount 
      });
    }

    // Treasury Transaction if paidAmount > 0
    let treasuryTx: TreasuryTransaction | null = null;
    if (paidAmount > 0) {
      const tId = `T_INV_${id}_${Date.now()}`;
      const desc = paidAmount >= total 
        ? `تحصيل كلي فاتورة بيع #${id} - العميل (${invoiceData.customerName || invoiceData.customerCode})`
        : `تحصيل دفعة من فاتورة بيع #${id} - العميل (${invoiceData.customerName || invoiceData.customerCode}) [متبقي: ${remainingAmount.toLocaleString()}]`;

      treasuryTx = {
        id: tId,
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
        if (idx >= 0) newP[idx] = { ...newP[idx], quantity: newP[idx].quantity - item.quantity };
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
            await updateDoc(pRef, { quantity: p.quantity - item.quantity });
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
        return {
          ...c,
          balance: c.balance + debtDifference,
          history: [...(c.history || []), { 
            date: newInvoiceData.date, 
            description: `تعديل فاتورة #${oldInvoice.id} (الإجمالي: ${newInvoiceData.total.toLocaleString()}، مدفوع: ${newPaid.toLocaleString()})`, 
            amount: debtDifference 
          }]
        };
      }
      return c;
    }));

    setTreasury(prev => {
      const withoutOld = prev.filter(t => t.invoiceNumber !== oldInvoice.id);
      if (newPaid > 0) {
        const tId = `T_INV_${oldInvoice.id}_${Date.now()}`;
        const desc = newPaid >= newInvoiceData.total
          ? `تحصيل كلي فاتورة بيع #${oldInvoice.id} - العميل (${newInvoiceData.customerName}) [معدلة]`
          : `تحصيل دفعة من فاتورة بيع #${oldInvoice.id} - العميل (${newInvoiceData.customerName}) [معدلة - متبقي: ${newRemaining.toLocaleString()}]`;

        const newTx: TreasuryTransaction = {
          id: tId,
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
        if(idx >= 0) tempProducts[idx] = {...tempProducts[idx], quantity: tempProducts[idx].quantity + item.quantity};
      });
      newInvoiceData.items.forEach(item => {
        const idx = tempProducts.findIndex(p => p.code === item.itemCode);
        if(idx >= 0) tempProducts[idx] = {...tempProducts[idx], quantity: tempProducts[idx].quantity - item.quantity};
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
          const newHistory = [
            ...(c.history || []), 
            { 
              date: newInvoiceData.date, 
              description: `تعديل فاتورة #${oldInvoice.id} (الإجمالي: ${newInvoiceData.total.toLocaleString()}، مدفوع: ${newPaid.toLocaleString()})`, 
              amount: debtDifference 
            }
          ];
          await updateDoc(customerRef, cleanDoc({ balance: newBalance, history: newHistory }));
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
            await updateDoc(pRef, { quantity: p.quantity + item.quantity });
          }
        }
        for (const item of newInvoiceData.items) {
          const pRef = doc(db, 'products', item.itemCode);
          const pSnap = await getDoc(pRef);
          if (pSnap.exists()) {
            const p = pSnap.data() as Product;
            await updateDoc(pRef, { quantity: p.quantity - item.quantity });
          }
        }

      } catch (e) { handleFirebaseError(e); }
    }
  };

  const deleteInvoice = async (id: string) => {
    const inv = invoices.find(i => i.id === id);
    if (!inv) return;

    const remainingDebt = inv.remainingAmount !== undefined ? inv.remainingAmount : (inv.total - (inv.paidAmount || 0));

    // Immediate Optimistic State Update
    setInvoices(prev => prev.filter(i => i.id !== id));
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
        if (idx >= 0) temp[idx] = { ...temp[idx], quantity: temp[idx].quantity + item.quantity };
      });
      return temp;
    });

    if (isOnline) {
      try {
        await deleteDoc(doc(db, 'invoices', id));

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
            await updateDoc(pRef, { quantity: p.quantity + item.quantity });
          }
        }
      } catch (e) { handleFirebaseError(e); }
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
    if (isOnline) {
      try { await updateDoc(doc(db, 'users', id), updatedData); } catch (e) { handleFirebaseError(e); }
    } else {
      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updatedData } : u));
    }
  };

  const deleteUser = async (id: string) => {
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
        const newHistory = [...(customer.history || []), { 
          date, 
          description: `سداد/تحصيل نقدية: ${description}`, 
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

  const addTransfer = async (data: { entityType: 'CUSTOMER' | 'SUPPLIER' | 'EMPLOYEE'; entityCode: string; amount: number; type: 'IN' | 'OUT'; date: string; notes?: string; paymentMethod: PaymentMethod }) => {
      const { entityType, entityCode, amount, type, date, notes, paymentMethod } = data;
      const tId = `TR${Date.now()}`;
      const description = `${type === 'IN' ? 'استلام من' : 'دفع لـ'} ${entityType === 'CUSTOMER' ? 'عميل' : entityType === 'SUPPLIER' ? 'مورد' : 'موظف'} (${entityCode}) ${notes ? `- ${notes}` : ''}`;
      
      if (entityType === 'CUSTOMER') {
          const c = customers.find(x => x.code === entityCode);
          if (c) {
              const change = type === 'IN' ? amount : -amount;
              const newBalance = c.balance + change;
              const newHistory = [...c.history, { date, description: description, amount: change }];
              await updateCustomer(entityCode, { balance: newBalance, history: newHistory });
          }
      } else if (entityType === 'SUPPLIER') {
          const s = suppliers.find(x => x.code === entityCode);
          if (s) {
               const change = type === 'IN' ? amount : -amount; 
               const newBalance = s.balance + change;
               const newHistory = [...s.history, { date, description, amount: change }];
               await updateSupplier(entityCode, { balance: newBalance, history: newHistory });
          }
      } else if (entityType === 'EMPLOYEE') {
          const e = employees.find(x => x.code === entityCode);
          if (e) {
              const change = type === 'OUT' ? amount : -amount;
              const newBalance = e.balance + change;
              const newHistory = [...e.history, { date, description, amount: change }];
              await updateEmployee(entityCode, { balance: newBalance, history: newHistory });
          }
      }

      const transaction: TreasuryTransaction = {
          id: tId,
          date,
          credit: type === 'IN' ? amount : 0,
          debit: type === 'OUT' ? amount : 0,
          balance: 0,
          paymentMethod,
          description
      };
      
      // Optimistic update
      setTreasury(prev => {
          const withoutThis = prev.filter(t => t.id !== tId);
          return [...withoutThis, transaction];
      });

      if (isOnline) {
          try { await setDoc(doc(db, 'treasury', tId), transaction); } catch (e) { handleFirebaseError(e); }
      }
  };

  const addExpense = async (data: { name: string; amount: number; date: string; notes?: string }) => {
     const tId = `EX${Date.now()}`;
     const description = `مصروفات: ${data.name} ${data.notes ? `(${data.notes})` : ''}`;
     
     const transaction: TreasuryTransaction = {
         id: tId,
         date: data.date,
         credit: 0,
         debit: data.amount,
         balance: 0,
         paymentMethod: 'CASH', 
         description
     };
     
     if(isOnline) {
        try { await setDoc(doc(db, 'treasury', tId), transaction); } catch (e) { handleFirebaseError(e); }
     } else {
        setTreasury(prev => [...prev, transaction]);
     }
  };

  const addOpeningBalance = async (data: { amount: number; date: string; paymentMethod: PaymentMethod; notes?: string }) => {
     const tId = `OP${Date.now()}`;
     const description = `رصيد افتتاحي ${data.notes ? `- ${data.notes}` : ''}`;
     
     const transaction: TreasuryTransaction = {
         id: tId,
         date: data.date,
         credit: data.amount,
         debit: 0,
         balance: 0,
         paymentMethod: data.paymentMethod,
         description
     };
     
     if (isOnline) {
        try { await setDoc(doc(db, 'treasury', tId), transaction); } catch (e) { handleFirebaseError(e); }
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
    const colDebit = isCustomer ? 'مدين (عليه)' : 'لنا (سداد)';
    const colCredit = isCustomer ? 'دائن (له/سداد)' : 'علينا (له)';

    if (isItemized) {
      data = history.map((r, idx) => ({
        'م': idx + 1,
        'التاريخ': r.date,
        'رقم الفاتورة': r.ref || '-',
        'الصنف / البيان': r.itemName || r.description,
        'الكمية (كرتونة)': (r.quantity !== undefined && r.quantity !== '-') ? r.quantity : '-',
        'السعر': (r.price !== undefined && r.price !== '-') ? r.price : '-',
        [colDebit]: r.debit > 0 ? r.debit : 0,
        [colCredit]: r.credit > 0 ? r.credit : 0,
        'الرصيد التراكمي': r.runningBalance !== undefined ? r.runningBalance : '-'
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
      [colDebit]: '---',
      [colCredit]: '---',
      'الرصيد التراكمي': currentBalance
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
    if(!isOnline) return;
    try {
      await setDoc(doc(db, 'products', 'P001'), { code: 'P001', name: 'كرتونة بيض أبيض', quantity: 100, avgCost: 120, price: 135 });
      await setDoc(doc(db, 'products', 'P002'), { code: 'P002', name: 'كرتونة بيض أحمر', quantity: 50, avgCost: 125, price: 140 });
      await setDoc(doc(db, 'customers', 'C001'), { code: 'C001', name: 'سوبر ماركت الحمد', phone: '01012345678', balance: -500, history: [{date: '2023-10-01', description: 'رصيد افتتاحي', amount: -500}] });
      alert("Database Seeded!");
    } catch(e) { console.error(e); }
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
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      border-bottom: 3px solid #000; 
      padding-bottom: 8px; 
      margin-bottom: 10px; 
    }
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
                <div class="total-row" style="color: #1f2937;"><span>رصيد سابق:</span><span>${invoice.previousBalance.toLocaleString()}</span></div>
                <div class="total-row final"><span>الرصيد الحالي:</span><span style="direction: ltr;">${invoice.currentBalance.toLocaleString()}</span></div>
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
      debit: number;
      credit: number;
      runningBalance: number;
    }>;
    totalDebit: number;
    totalCredit: number;
    finalBalance: number;
  }) => {
    const printWindow = window.open('', '_blank', 'width=1100,height=850');
    if (!printWindow) {
      alert("يرجى السماح بالنوافذ المنبثقة (Popups) لطباعة كشف الحساب");
      return;
    }

    const { title, entityName, entityCode, entityPhone, type, rows, totalDebit, totalCredit, finalBalance } = options;
    const isCustomer = type === 'CUSTOMER';
    const colDebitTitle = isCustomer ? 'مدين (عليه)' : 'لنا (سداد)';
    const colCreditTitle = isCustomer ? 'دائن (له/سداد)' : 'علينا (له)';

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
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #000; padding-bottom: 6px; margin-bottom: 8px; }
          .company-info h1 { margin: 0; font-size: 26px; font-weight: 900; line-height: 1.1; }
          .company-info p { margin: 2px 0 0 0; font-size: 15px; font-weight: 800; color: #1f2937; }
          .logo-box img { max-height: 65px; max-width: 200px; object-fit: contain; }
          .statement-title h2 { margin: 0; font-size: 18px; border: 2.5px solid #000; padding: 4px 14px; font-weight: 900; border-radius: 6px; background-color: #f8fafc; }
          .info-bar { display: flex; justify-content: space-between; align-items: center; border: 2px solid #000; padding: 6px 12px; border-radius: 6px; background: #f8fafc; margin-bottom: 8px; font-size: 13px; }
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
            <h2>${title}</h2>
          </div>
        </div>

        <div class="info-bar">
          <div class="info-item"><span class="info-label">${isCustomer ? 'العميل' : 'المورد'}</span><span class="info-value">${entityName}</span></div>
          <div class="info-item"><span class="info-label">الكود</span><span class="info-value" style="font-family: monospace;">${entityCode}</span></div>
          ${entityPhone ? `<div class="info-item"><span class="info-label">الهاتف</span><span class="info-value" dir="ltr">${entityPhone}</span></div>` : ''}
          <div class="info-item"><span class="info-label">تاريخ الطباعة</span><span class="info-value">${new Date().toISOString().split('T')[0]}</span></div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 35px;">م</th>
              <th style="width: 80px;">التاريخ</th>
              <th style="width: 85px;">الفاتورة</th>
              <th>الصنف / البيان</th>
              <th style="width: 75px;">الكمية</th>
              <th style="width: 75px;">السعر</th>
              <th style="width: 85px;">${colDebitTitle}</th>
              <th style="width: 85px;">${colCreditTitle}</th>
              <th style="width: 95px;">الرصيد</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>${r.num}</td>
                <td>${r.date}</td>
                <td style="font-family: monospace;">${r.ref || '-'}</td>
                <td class="text-right" style="padding-right: 8px;">${r.itemName}</td>
                <td>${typeof r.quantity === 'number' ? r.quantity.toLocaleString() : r.quantity}</td>
                <td>${typeof r.price === 'number' ? r.price.toLocaleString() : r.price}</td>
                <td style="color: #b91c1c; font-weight: 800;">${r.debit > 0 ? r.debit.toLocaleString() : '-'}</td>
                <td style="color: #15803d; font-weight: 800;">${r.credit > 0 ? r.credit.toLocaleString() : '-'}</td>
                <td style="font-weight: 900;" dir="ltr">${r.runningBalance.toLocaleString()}</td>
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

  return (
    <ERPContext.Provider value={{
      products, customers, suppliers, employees, purchases, invoices, treasury, users, currentUser, isOnline, permissionError, companyLogo,
      login, logout, addUser, updateUser, deleteUser, addProduct, updateProduct, deleteProduct, deletePurchase,
      addPurchase, updatePurchase, addInvoice, updateInvoice, deleteInvoice, clearAllInvoices, addCollection, addTransfer, addExpense, addOpeningBalance, addCustomer, updateCustomer, deleteCustomer, addSupplier, updateSupplier, addEmployee, updateEmployee, deleteEmployee,
      seedDatabase, printInvoice, printPurchaseInvoice, printLedger, exportLedgerToExcel, exportAllCustomersToExcel, exportAllSuppliersToExcel, clearLedger, clearTreasury, updateSystemLogo,
      currentTreasuryBalance, balances
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
