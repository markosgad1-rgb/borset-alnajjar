
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
  }) => void;
  updateInvoice: (oldInvoice: SalesInvoice, newInvoiceData: SalesInvoice) => Promise<void>; 
  deleteInvoice: (id: string) => Promise<void>;
  clearAllInvoices: () => Promise<boolean>; 
  addCollection: (data: {
    customerCode: string;
    invoiceId?: string;
    amount: number;
    date: string;
    paymentMethod: PaymentMethod;
  }) => void;
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
  exportLedgerToExcel: (entityName: string, entityCode: string, history: any[], currentBalance: number, type: 'CUSTOMER' | 'SUPPLIER') => void;
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
           data.sort((a, b) => a.id.localeCompare(b.id));
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

  const addInvoice = async (invoiceData: {
    id: string; date: string; time: string; customerCode: string; customerName: string; items: InvoiceItem[]; total: number;
  }) => {
    const { id, total } = invoiceData;
    const debtAmount = total;
    const currentCustomer = customers.find(c => c.code === invoiceData.customerCode);
    
    const newInvoice: SalesInvoice = {
      ...invoiceData,
      previousBalance: currentCustomer ? currentCustomer.balance : 0,
      currentBalance: (currentCustomer ? currentCustomer.balance : 0) - debtAmount
    };

    if (isOnline) {
      try {
        await setDoc(doc(db, 'invoices', id), newInvoice);
        
        const customerRef = doc(db, 'customers', invoiceData.customerCode);
        const customerSnap = await getDoc(customerRef);
        
        if (customerSnap.exists()) {
          const c = customerSnap.data() as Customer;
          const newBalance = c.balance - debtAmount;
          const newHistory = [...c.history, { date: invoiceData.date, description: `فاتورة بيع #${id} (آجل)`, amount: -debtAmount }];
          await updateDoc(customerRef, { balance: newBalance, history: newHistory });
        } else {
          await setDoc(customerRef, {
              code: invoiceData.customerCode, name: invoiceData.customerName, balance: -debtAmount,
              history: [{ date: invoiceData.date, description: `فاتورة بيع #${id} (آجل)`, amount: -debtAmount }]
          });
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
    } else {
      setInvoices(prev => [newInvoice, ...prev]);
      setCustomers(prev => {
        const exists = prev.find(c => c.code === invoiceData.customerCode);
        if (exists) {
          return prev.map(c => c.code === invoiceData.customerCode ? { ...c, balance: c.balance - debtAmount, history: [...c.history, { date: invoiceData.date, description: `فاتورة بيع #${id} (آجل)`, amount: -debtAmount }] } : c);
        } else {
          return [...prev, { code: invoiceData.customerCode, name: invoiceData.customerName, balance: -debtAmount, history: [{ date: invoiceData.date, description: `فاتورة بيع #${id} (آجل)`, amount: -debtAmount }] }];
        }
      });
      setProducts(prev => {
        let newP = [...prev];
        invoiceData.items.forEach(item => {
          const idx = newP.findIndex(p => p.code === item.itemCode);
          if (idx >= 0) newP[idx] = { ...newP[idx], quantity: newP[idx].quantity - item.quantity };
        });
        return newP;
      });
    }
  };

  const updateInvoice = async (oldInvoice: SalesInvoice, newInvoiceData: SalesInvoice) => {
    const debtDifference = oldInvoice.total - newInvoiceData.total; 
    
    if (isOnline) {
      try {
        await setDoc(doc(db, 'invoices', oldInvoice.id), newInvoiceData);

        const customerRef = doc(db, 'customers', oldInvoice.customerCode);
        const customerSnap = await getDoc(customerRef);
        if (customerSnap.exists()) {
          const c = customerSnap.data() as Customer;
          const newBalance = c.balance + debtDifference;
          const newHistory = [
            ...c.history, 
            { 
              date: newInvoiceData.date, 
              description: `تعديل فاتورة #${oldInvoice.id}`, 
              amount: debtDifference 
            }
          ];
          await updateDoc(customerRef, { balance: newBalance, history: newHistory });
        }

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
    } else {
      setInvoices(prev => prev.map(inv => inv.id === oldInvoice.id ? newInvoiceData : inv));
      setCustomers(prev => prev.map(c => {
        if (c.code === oldInvoice.customerCode) {
          return {
            ...c,
            balance: c.balance + debtDifference,
            history: [...c.history, { date: newInvoiceData.date, description: `تعديل فاتورة #${oldInvoice.id}`, amount: debtDifference }]
          };
        }
        return c;
      }));
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
    }
  };

  const deleteInvoice = async (id: string) => {
    if (isOnline) {
      try {
        await deleteDoc(doc(db, 'invoices', id));
      } catch (e) { handleFirebaseError(e); }
    } else {
      setInvoices(prev => prev.filter(inv => inv.id !== id));
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

  const addCollection = async (data: { customerCode: string; invoiceId?: string; amount: number; date: string; paymentMethod: PaymentMethod }) => {
    const { customerCode, invoiceId, amount, date, paymentMethod } = data;
    const tId = `T${Date.now()}`;
    const description = `تحصيل من عميل (${customerCode})${invoiceId ? ` - فاتورة ${invoiceId}` : ''}`;
    
    // Update Customer Balance
    const customer = customers.find(c => c.code === customerCode);
    if(customer) {
        const newBalance = customer.balance + amount;
        const newHistory = [...customer.history, { date, description: `سداد/تحصيل نقدية`, amount }];
        await updateCustomer(customerCode, { balance: newBalance, history: newHistory });
    }

    // Add to Treasury
    const transaction: TreasuryTransaction = {
        id: tId,
        date,
        credit: amount,
        debit: 0,
        balance: 0,
        paymentMethod,
        description,
        invoiceNumber: invoiceId
    };
    
    if (isOnline) {
        try { await setDoc(doc(db, 'treasury', tId), transaction); } catch (e) { handleFirebaseError(e); }
    } else {
        setTreasury(prev => [...prev, transaction]);
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
      
      if (isOnline) {
          try { await setDoc(doc(db, 'treasury', tId), transaction); } catch (e) { handleFirebaseError(e); }
      } else {
          setTreasury(prev => [...prev, transaction]);
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

  const exportLedgerToExcel = (entityName: string, entityCode: string, history: any[], currentBalance: number, type: string) => {
    const data = history.map(h => ({
      'التاريخ': h.date,
      'البيان': h.description,
      'مدين': h.amount < 0 ? Math.abs(h.amount) : 0,
      'دائن': h.amount > 0 ? h.amount : 0
    }));
    
    data.push({
      'التاريخ': '---',
      'البيان': 'الرصيد الحالي النهائي',
      'مدين': currentBalance < 0 ? Math.abs(currentBalance) : 0,
      'دائن': currentBalance > 0 ? currentBalance : 0
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Statement");
    XLSX.writeFile(wb, `${type}_${entityName}_${entityCode}.xlsx`);
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
    @page { size: A4; margin: 0; }
    body { 
      font-family: 'Cairo', sans-serif; 
      padding: 20mm;
      margin: 0;
      direction: rtl; 
      background-color: #fff;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      font-size: 20px; 
    }
    .invoice-container { background: white; width: 100%; margin: 0 auto; position: relative; min-height: auto; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--border-color); padding-bottom: 5px; margin-bottom: 10px; }
    .company-info h1 { margin: 0; font-size: 34px; font-weight: 900; }
    .company-info p { margin: 0; color: #555; font-size: 20px; font-weight: bold; }
    .invoice-title h2 { margin: 0; font-size: 30px; color: #333; text-transform: uppercase; border: 2px solid #000; padding: 2px 10px; display: inline-block; font-weight: 800; }
    .logo-box img { max-height: 120px; max-width: 450px; border: 3px double #0ea5e9; border-radius: 10px; box-shadow: 0 3px 6px rgba(0,0,0,0.1); padding: 4px; background: white; object-fit: contain; }
    .info-bar { display: flex; justify-content: space-between; margin-bottom: 15px; border: 1px solid #ddd; padding: 8px; border-radius: 4px; font-size: 18px; }
    .info-item { display: flex; flex-direction: column; }
    .info-label { font-weight: bold; color: #666; margin-bottom: 0; font-size: 16px; }
    .info-value { font-weight: 800; font-size: 20px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    th { background-color: #eee; color: #000; font-weight: 900; padding: 8px; border: 1px solid #000; font-size: 20px; }
    td { padding: 8px; border: 1px solid #000; font-weight: 700; font-size: 20px; text-align: center; }
    tr { page-break-inside: avoid; }
    .summary-container { page-break-inside: avoid; margin-top: 20px; }
    .footer-section { display: flex; justify-content: space-between; align-items: flex-start; }
    .totals-box { width: 350px; border: 2px solid #000; }
    .total-row { display: flex; justify-content: space-between; padding: 8px 10px; border-bottom: 1px solid #ddd; font-size: 20px; font-weight: bold; }
    .total-row.main { font-weight: 900; font-size: 24px; border-bottom: 2px solid #000; background-color: #f9f9f9; }
    .total-row.final { background-color: #000; color: white; border-bottom: none; font-size: 28px; font-weight: 900; padding: 12px 10px; }
    .signatures { margin-top: 40px; display: flex; justify-content: space-between; padding: 0 50px; font-size: 18px; font-weight: bold; }
    .sig-box { text-align: center; width: 150px; }
    .sig-line { border-top: 2px solid #000; margin-top: 40px; }
    .footer-fixed { position: fixed; bottom: 0; left: 0; right: 0; width: 100%; height: 40px; background-color: white; display: flex; justify-content: center; align-items: center; font-size: 16px; font-weight: bold; z-index: 1000; }
    .contact-info { display: flex; gap: 20px; flex-direction: row; }
    .footer-fixed a, .footer-fixed span { text-decoration: none !important; color: #000 !important; }
    @media print { body { background: none; } .invoice-container { border: none; padding: 0; width: 100%; max-width: 100%; } }
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
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
        <style>${getPrintStyle()}</style>
      </head>
      <body>
        <div class="invoice-container">
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
              <tr><th style="width: 50px;">م</th><th>الصنف</th><th style="width: 100px;">الكمية</th><th style="width: 120px;">السعر</th><th style="width: 150px;">الإجمالي</th></tr>
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
          
          <div class="summary-container">
            <div class="footer-section">
              <div style="flex: 1;"></div>
              <div class="totals-box">
                <div class="total-row main"><span>الإجمالي:</span><strong>${invoice.total.toLocaleString()}</strong></div>
                <div class="total-row" style="color: #444;"><span>رصيد سابق:</span><span>${invoice.previousBalance.toLocaleString()}</span></div>
                <div class="total-row final"><span>الرصيد الحالي:</span><span style="direction: ltr;">${invoice.currentBalance.toLocaleString()}</span></div>
              </div>
            </div>
            <div class="signatures">
              <div class="sig-box"><strong>المستلم</strong><div class="sig-line"></div></div>
              <div class="sig-box"><strong>توقيع الإدارة</strong><div class="sig-line"></div></div>
            </div>
          </div>
        </div>

        <div class="footer-fixed">
           <div class="contact-info">
              <span>للمبيعات والاستفسارات:</span>
              <span dir="ltr">01280808532</span>
              <span>-</span>
              <span dir="ltr">01274688088</span>
              <span>-</span>
              <span dir="ltr">01000285428</span>
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
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
        <style>${getPrintStyle()}</style>
      </head>
      <body>
        <div class="invoice-container">
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
              <tr><th style="width: 50px;">م</th><th>الصنف</th><th style="width: 100px;">الكمية</th><th style="width: 120px;">السعر</th><th style="width: 150px;">الإجمالي</th></tr>
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
          
          <div class="summary-container">
            <div class="footer-section">
              <div style="flex: 1;"></div>
              <div class="totals-box">
                <div class="total-row final"><span>الإجمالي:</span><strong>${purchase.total.toLocaleString()}</strong></div>
                ${purchase.previousBalance !== undefined ? `
                  <div class="total-row" style="color: #444;"><span>رصيد سابق:</span><span>${purchase.previousBalance.toLocaleString()}</span></div>
                  <div class="total-row main"><span>الرصيد الحالي:</span><span>${purchase.currentBalance?.toLocaleString()}</span></div>
                ` : ''}
              </div>
            </div>
            <div class="signatures">
              <div class="sig-box"><strong>المستلم</strong><div class="sig-line"></div></div>
              <div class="sig-box"><strong>توقيع المورد</strong><div class="sig-line"></div></div>
            </div>
          </div>
        </div>

        <div class="footer-fixed">
           <div class="contact-info">
              <span>للمبيعات والاستفسارات:</span>
              <span dir="ltr">01280808532</span>
              <span>-</span>
              <span dir="ltr">01274688088</span>
              <span>-</span>
              <span dir="ltr">01000285428</span>
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

  return (
    <ERPContext.Provider value={{
      products, customers, suppliers, employees, purchases, invoices, treasury, users, currentUser, isOnline, permissionError, companyLogo,
      login, logout, addUser, updateUser, deleteUser, addProduct, updateProduct, deleteProduct, deletePurchase,
      addPurchase, updatePurchase, addInvoice, updateInvoice, deleteInvoice, clearAllInvoices, addCollection, addTransfer, addExpense, addOpeningBalance, addCustomer, updateCustomer, deleteCustomer, addSupplier, updateSupplier, addEmployee, updateEmployee, deleteEmployee,
      seedDatabase, printInvoice, printPurchaseInvoice, exportLedgerToExcel, exportAllCustomersToExcel, exportAllSuppliersToExcel, clearLedger, clearTreasury, updateSystemLogo,
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
