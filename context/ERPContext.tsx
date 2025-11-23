
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
  
  // Auth
  login: (username: string, password: string) => boolean;
  logout: () => void;
  
  // CRUD
  addProduct: (product: Product) => void;
  updateProduct: (product: Product) => void;
  deleteProduct: (code: string) => void;
  addPurchase: (purchase: Omit<Purchase, 'id'>) => void;
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
  deleteInvoice: (id: string) => Promise<void>;
  clearAllInvoices: () => Promise<boolean>; // New function
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
  addCustomer: (customer: Customer) => void;
  updateCustomer: (code: string, updatedData: Partial<Customer>) => void;
  deleteCustomer: (code: string) => Promise<void>;
  addSupplier: (supplier: Supplier) => void;
  updateSupplier: (code: string, updatedData: Partial<Supplier>) => void;
  addEmployee: (employee: Employee) => void;
  updateEmployee: (code: string, updatedData: Partial<Employee>) => void;
  
  // User Management
  addUser: (user: User) => void;
  updateUser: (id: string, updatedData: Partial<User>) => void;
  deleteUser: (id: string) => Promise<boolean>;

  seedDatabase: () => Promise<void>;
  printInvoice: (invoice: SalesInvoice) => void;
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
  CURRENT_USER: 'erp_current_user' 
};

// Initial Mock Data (Used for first-time LocalStorage)
const INITIAL_USERS: User[] = [
  { id: '1', username: 'admin', password: '123', fullName: 'المدير العام', role: 'ADMIN', permissions: { dashboard: true, sales: true, warehouse: true, financial: true, admin: true, canDeleteLedgers: true } }
];

export const ERPProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Mode Flag
  const isOnline = !!db;
  const [permissionError, setPermissionError] = useState(false);

  // --- State ---
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      return saved ? JSON.parse(saved) : null;
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

  // Calculate Balances dynamically
  const currentTreasuryBalance = treasury.reduce((acc, t) => acc + (t.credit - t.debit), 0);
  
  const balances = {
    cash: treasury.filter(t => t.paymentMethod === 'CASH' || !t.paymentMethod).reduce((acc, t) => acc + (t.credit - t.debit), 0),
    bankMisr: treasury.filter(t => t.paymentMethod === 'BANK_MISR').reduce((acc, t) => acc + (t.credit - t.debit), 0),
    bankAhly: treasury.filter(t => t.paymentMethod === 'BANK_AHLY').reduce((acc, t) => acc + (t.credit - t.debit), 0),
  };

  // --- Data Sync Logic (Effect) ---
  useEffect(() => {
    if (isOnline) {
      // --- FIREBASE MODE: Real-time Listeners ---
      const unsubs: Function[] = [];
      
      const handleSnapshotError = (error: any) => {
        console.error("Snapshot listener error:", error);
        if (error.code === 'permission-denied' || error.message?.includes('permission-denied')) {
          setPermissionError(true);
        }
      };

      try {
        unsubs.push(onSnapshot(collection(db, 'users'), (snap: any) => {
           setPermissionError(false); // Reset if successful
           const loadedUsers = snap.docs.map((d: any) => d.data() as User);
           setUsers(loadedUsers);
           // Auto-seed admin if users list is empty (e.g. fresh DB)
           if (loadedUsers.length === 0) {
              const adminUser: User = { 
                id: '1', username: 'admin', password: '123', fullName: 'المدير العام', role: 'ADMIN', permissions: { dashboard: true, sales: true, warehouse: true, financial: true, admin: true, canDeleteLedgers: true } 
              };
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
      // --- LOCAL STORAGE MODE ---
      const load = (key: string, setter: Function, def: any) => {
        const saved = localStorage.getItem(key);
        if (saved) setter(JSON.parse(saved));
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
    }
  }, [isOnline]);

  // --- Persist to LocalStorage when data changes (Offline Backup) ---
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
    }
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
  }, [users, products, customers, suppliers, employees, purchases, invoices, treasury, currentUser, isOnline]);


  // --- Helper: Generic Save with Error Handling ---
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

  // --- Auth ---
  const login = (usernameInput: string, passwordInput: string) => {
    const username = usernameInput.trim();
    const password = passwordInput.trim();

    if (username === 'admin' && password === '123') {
       const adminUser: User = { 
         id: '1', 
         username: 'admin', 
         password: '123', 
         fullName: 'المدير العام', 
         role: 'ADMIN', 
         permissions: { dashboard: true, sales: true, warehouse: true, financial: true, admin: true, canDeleteLedgers: true } 
       };
       setCurrentUser(adminUser);
       if (isOnline) {
         setDoc(doc(db, 'users', '1'), adminUser).catch((e: any) => console.log("Admin seed check:", e));
       }
       return true;
    }

    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      setCurrentUser(user);
      return true;
    }
    
    return false;
  };

  const logout = () => setCurrentUser(null);

  // --- Business Actions ---
  
  const addProduct = async (product: Product) => {
    if (isOnline) {
       try {
         await setDoc(doc(db, 'products', product.code), product);
       } catch (e) { handleFirebaseError(e); }
    } else {
      setProducts(prev => {
        const exists = prev.find(p => p.code === product.code);
        if (exists) return prev;
        return [...prev, product];
      });
    }
  };

  const updateProduct = async (updatedProduct: Product) => {
    if (isOnline) {
      try {
        await setDoc(doc(db, 'products', updatedProduct.code), updatedProduct);
      } catch (e) { handleFirebaseError(e); }
    } else {
      setProducts(prev => prev.map(p => p.code === updatedProduct.code ? updatedProduct : p));
    }
  };

  const deleteProduct = async (code: string) => {
    if (isOnline) {
      try {
        await deleteDoc(doc(db, 'products', code));
      } catch (e) { handleFirebaseError(e); }
    } else {
      setProducts(prev => prev.filter(p => p.code !== code));
    }
  };

  const addCustomer = async (customer: Customer) => {
    if (isOnline) {
      try {
        await setDoc(doc(db, 'customers', customer.code), customer);
      } catch (e) { handleFirebaseError(e); }
    } else {
      setCustomers(prev => [...prev, customer]);
    }
  };

  const updateCustomer = async (code: string, updatedData: Partial<Customer>) => {
    const customer = customers.find(c => c.code === code);
    if (!customer) return;
    const newCustomer = { ...customer, ...updatedData };
    
    if (isOnline) {
      try {
        if (updatedData.code && updatedData.code !== code) {
          await deleteDoc(doc(db, 'customers', code));
          await setDoc(doc(db, 'customers', updatedData.code), newCustomer);
        } else {
          await setDoc(doc(db, 'customers', code), newCustomer);
        }
      } catch (e) { handleFirebaseError(e); }
    } else {
      setCustomers(prev => prev.map(c => c.code === code ? newCustomer : c));
    }
  };

  const deleteCustomer = async (code: string) => {
    if (isOnline) {
      try {
        await deleteDoc(doc(db, 'customers', code));
      } catch (e) { handleFirebaseError(e); }
    } else {
      setCustomers(prev => prev.filter(c => c.code !== code));
    }
  };

  const addSupplier = async (supplier: Supplier) => {
    if (isOnline) {
      try {
        await setDoc(doc(db, 'suppliers', supplier.code), supplier);
      } catch (e) { handleFirebaseError(e); }
    } else {
      setSuppliers(prev => [...prev, supplier]);
    }
  };

  const updateSupplier = async (code: string, updatedData: Partial<Supplier>) => {
    const supplier = suppliers.find(s => s.code === code);
    if (!supplier) return;
    const newSupplier = { ...supplier, ...updatedData };
    if (isOnline) {
      try {
        await setDoc(doc(db, 'suppliers', code), newSupplier);
      } catch (e) { handleFirebaseError(e); }
    } else {
      setSuppliers(prev => prev.map(s => s.code === code ? newSupplier : s));
    }
  };

  const addEmployee = async (employee: Employee) => {
    if (isOnline) {
      try {
        await setDoc(doc(db, 'employees', employee.code), employee);
      } catch (e) { handleFirebaseError(e); }
    } else {
      setEmployees(prev => [...prev, employee]);
    }
  };

  const updateEmployee = async (code: string, updatedData: Partial<Employee>) => {
    const employee = employees.find(e => e.code === code);
    if (!employee) return;
    const newEmployee = { ...employee, ...updatedData };
    if (isOnline) {
      try {
        await setDoc(doc(db, 'employees', code), newEmployee);
      } catch (e) { handleFirebaseError(e); }
    } else {
      setEmployees(prev => prev.map(e => e.code === code ? newEmployee : e));
    }
  };

  // --- Complex Transaction Actions ---

  const addPurchase = async (purchaseData: Omit<Purchase, 'id'>) => {
    const id = Date.now().toString();
    const newPurchase: Purchase = { ...purchaseData, id };
    
    if (isOnline) {
      try {
        await setDoc(doc(db, 'purchases', id), newPurchase);
        
        const productRef = doc(db, 'products', purchaseData.itemCode);
        const productSnap = await getDoc(productRef);
        
        if (productSnap.exists()) {
          const product = productSnap.data() as Product;
          const totalOldValue = product.quantity * product.avgCost;
          const totalNewValue = purchaseData.quantity * purchaseData.price;
          const newQty = product.quantity + purchaseData.quantity;
          const newAvgCost = (totalOldValue + totalNewValue) / newQty;
          await updateDoc(productRef, { quantity: newQty, avgCost: newAvgCost });
        } else {
          await setDoc(productRef, { 
            code: purchaseData.itemCode, 
            name: purchaseData.itemName, 
            quantity: purchaseData.quantity, 
            avgCost: purchaseData.price, 
            price: purchaseData.price * 1.2 
          });
        }

        const supplierRef = doc(db, 'suppliers', purchaseData.supplierCode);
        const supplierSnap = await getDoc(supplierRef);
        if (supplierSnap.exists()) {
          const s = supplierSnap.data() as Supplier;
          const amount = purchaseData.total;
          const newBalance = s.balance - amount;
          const newHistory = [...s.history, { date: purchaseData.date, description: `فاتورة مشتريات #${id}`, amount: -amount }];
          await updateDoc(supplierRef, { balance: newBalance, history: newHistory });
        }
      } catch (e) { handleFirebaseError(e); }
    } else {
      setPurchases(prev => [newPurchase, ...prev]);
      setProducts(prev => {
        const idx = prev.findIndex(p => p.code === purchaseData.itemCode);
        if (idx >= 0) {
          const existing = prev[idx];
          const newQty = existing.quantity + purchaseData.quantity;
          const newAvg = ((existing.quantity * existing.avgCost) + (purchaseData.quantity * purchaseData.price)) / newQty;
          const updated = [...prev];
          updated[idx] = { ...existing, quantity: newQty, avgCost: newAvg };
          return updated;
        } else {
          return [...prev, { code: purchaseData.itemCode, name: purchaseData.itemName, quantity: purchaseData.quantity, avgCost: purchaseData.price, price: purchaseData.price * 1.2 }];
        }
      });
      setSuppliers(prev => prev.map(s => {
         if (s.code === purchaseData.supplierCode) {
           return { ...s, balance: s.balance - purchaseData.total, history: [...s.history, { date: purchaseData.date, description: `فاتورة مشتريات #${id}`, amount: -purchaseData.total }]};
         }
         return s;
      }));
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
      setInvoices([]); // Optimistic clear
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

  const addTransfer = async (data: { 
    entityType: 'CUSTOMER' | 'SUPPLIER' | 'EMPLOYEE';
    entityCode: string; amount: number; type: 'IN' | 'OUT'; date: string; notes?: string;
    paymentMethod: PaymentMethod;
  }) => {
    const isIncome = data.type === 'IN';
    const newTreasuryBalance = currentTreasuryBalance + (isIncome ? data.amount : -data.amount);
    
    let entityLabel = '';
    let entityName = '';
    if (data.entityType === 'CUSTOMER') { entityLabel = 'عميل'; entityName = customers.find(c => c.code === data.entityCode)?.name || data.entityCode; }
    if (data.entityType === 'SUPPLIER') { entityLabel = 'مورد'; entityName = suppliers.find(s => s.code === data.entityCode)?.name || data.entityCode; }
    if (data.entityType === 'EMPLOYEE') { entityLabel = 'موظف'; entityName = employees.find(e => e.code === data.entityCode)?.name || data.entityCode; }

    let methodLabel = 'نقدي';
    if (data.paymentMethod === 'BANK_AHLY') methodLabel = 'بنك أهلي';
    if (data.paymentMethod === 'BANK_MISR') methodLabel = 'بنك مصر';

    const description = `${isIncome ? 'وارد من' : 'صادر إلى'} ${entityLabel} - ${entityName} (${methodLabel}) ${data.notes ? `- ${data.notes}` : ''}`;
    const transId = `TRF-${Date.now()}`;
    
    const newTransaction: TreasuryTransaction = {
      id: transId, date: data.date, credit: isIncome ? data.amount : 0, debit: isIncome ? 0 : data.amount,
      balance: newTreasuryBalance, paymentMethod: data.paymentMethod, description
    };

    if (isOnline) {
      try {
        await setDoc(doc(db, 'treasury', transId), newTransaction);
        
        if (data.entityType === 'CUSTOMER') {
          const ref = doc(db, 'customers', data.entityCode);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const c = snap.data() as Customer;
            const change = isIncome ? data.amount : -data.amount;
            await updateDoc(ref, {
              balance: c.balance + change,
              history: [...c.history, { date: data.date, description: `${isIncome ? 'تحصيل' : 'صرف'} (${methodLabel}) - ${data.notes || ''}`, amount: change }]
            });
          }
        } else if (data.entityType === 'SUPPLIER') {
          const ref = doc(db, 'suppliers', data.entityCode);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const s = snap.data() as Supplier;
            const change = isIncome ? -data.amount : data.amount;
            await updateDoc(ref, {
              balance: s.balance + change,
              history: [...s.history, { date: data.date, description: `${isIncome ? 'استلام' : 'دفع'} (${methodLabel}) - ${data.notes || ''}`, amount: change }]
            });
          }
        } else if (data.entityType === 'EMPLOYEE') {
          const ref = doc(db, 'employees', data.entityCode);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const e = snap.data() as Employee;
            const change = isIncome ? -data.amount : data.amount;
            await updateDoc(ref, {
              balance: e.balance + change,
              history: [...e.history, { date: data.date, description: `${isIncome ? 'تحصيل' : 'صرف'} (${methodLabel}) - ${data.notes || ''}`, amount: change }]
            });
          }
        }
      } catch (e) { handleFirebaseError(e); }

    } else {
      setTreasury(prev => [...prev, newTransaction]);
      const historyDesc = `${isIncome ? 'تحصيل' : 'صرف'} (${methodLabel})`;
      if (data.entityType === 'CUSTOMER') {
        setCustomers(prev => prev.map(c => c.code === data.entityCode ? { ...c, balance: c.balance + (isIncome ? data.amount : -data.amount), history: [...c.history, { date: data.date, description: historyDesc, amount: (isIncome ? data.amount : -data.amount) }] } : c));
      } else if (data.entityType === 'SUPPLIER') {
        setSuppliers(prev => prev.map(s => s.code === data.entityCode ? { ...s, balance: s.balance + (isIncome ? -data.amount : data.amount), history: [...s.history, { date: data.date, description: historyDesc, amount: (isIncome ? -data.amount : data.amount) }] } : s));
      } else if (data.entityType === 'EMPLOYEE') {
        setEmployees(prev => prev.map(e => e.code === data.entityCode ? { ...e, balance: e.balance + (isIncome ? -data.amount : data.amount), history: [...e.history, { date: data.date, description: historyDesc, amount: (isIncome ? -data.amount : data.amount) }] } : e));
      }
    }
  };

  const addCollection = (data: { customerCode: string; invoiceId?: string; amount: number; date: string; paymentMethod: PaymentMethod }) => {
    addTransfer({
      entityType: 'CUSTOMER', entityCode: data.customerCode, amount: data.amount, type: 'IN', date: data.date,
      paymentMethod: data.paymentMethod,
      notes: data.invoiceId ? `تحصيل فاتورة ${data.invoiceId}` : 'تحصيل دفعة'
    });
  };

  const addExpense = async (data: { name: string; amount: number; date: string; notes?: string }) => {
    const transId = `EXP-${Date.now()}`;
    const description = `مصروفات - ${data.name} ${data.notes ? `(${data.notes})` : ''}`;
    
    // Deduct directly from Treasury (Cash), No specific entity balance updated
    const newTreasuryBalance = currentTreasuryBalance - data.amount;

    const newTransaction: TreasuryTransaction = {
      id: transId, date: data.date, credit: 0, debit: data.amount,
      balance: newTreasuryBalance, paymentMethod: 'CASH', description
    };

    if (isOnline) {
      try {
        await setDoc(doc(db, 'treasury', transId), newTransaction);
      } catch (e) { handleFirebaseError(e); }
    } else {
      setTreasury(prev => [...prev, newTransaction]);
    }
  };

  const addUser = async (user: User) => {
    if (isOnline) {
       try { await setDoc(doc(db, 'users', user.id), user); } catch (e) { handleFirebaseError(e); }
    }
    else setUsers(prev => [...prev, user]);
  };
  
  const updateUser = async (id: string, updatedData: Partial<User>) => {
    if (isOnline) {
       try { await updateDoc(doc(db, 'users', id), updatedData); } catch (e) { handleFirebaseError(e); }
    }
    else setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updatedData } : u));
  };
  
  const deleteUser = async (id: string): Promise<boolean> => {
    if (isOnline) {
       try { 
         await deleteDoc(doc(db, 'users', id)); 
         return true;
       } catch (e) { 
         handleFirebaseError(e); 
         return false;
       }
    } else {
       setUsers(prev => prev.filter(u => u.id !== id));
       return true;
    }
  };

  const clearLedger = async (entityType: 'CUSTOMER' | 'SUPPLIER' | 'EMPLOYEE', code: string): Promise<boolean> => {
    try {
      // 1. Optimistic Update (Immediate UI Refresh)
      if (entityType === 'CUSTOMER') {
        setCustomers(prev => prev.map(c => c.code === code ? { ...c, history: [], balance: 0 } : c));
      } else if (entityType === 'SUPPLIER') {
        setSuppliers(prev => prev.map(s => s.code === code ? { ...s, history: [], balance: 0 } : s));
      } else if (entityType === 'EMPLOYEE') {
        setEmployees(prev => prev.map(e => e.code === code ? { ...e, history: [], balance: 0 } : e));
      }

      // 2. Firebase Update (Hard Reset)
      if (isOnline) {
        let collectionName = '';
        if (entityType === 'CUSTOMER') collectionName = 'customers';
        else if (entityType === 'SUPPLIER') collectionName = 'suppliers';
        else if (entityType === 'EMPLOYEE') collectionName = 'employees';

        const ref = doc(db, collectionName, code);
        // FORCE overwrite history and balance using setDoc with MERGE to be robust even if doc structure has minor issues
        await setDoc(ref, { history: [], balance: 0 }, { merge: true });
        console.log(`Hard reset ledger for ${entityType} ${code} successful`);
      }
      return true;
    } catch (e) { 
      handleFirebaseError(e);
      return false;
    }
  };

  const clearTreasury = async (): Promise<boolean> => {
    try {
      // Optimistic Update
      setTreasury([]);

      if (isOnline) {
        // Fetch all documents in treasury collection and delete them
        const q = query(collection(db, 'treasury'));
        const snapshot = await getDocs(q);
        const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
        await Promise.all(deletePromises);
        console.log("Treasury cleared successfully");
      }
      return true;
    } catch (e) {
      handleFirebaseError(e);
      return false;
    }
  };

  const seedDatabase = async () => {
    if (!isOnline) return alert("يجب أن تكون متصلاً بالإنترنت لزرع البيانات.");
    
    if(!confirm("هل أنت متأكد؟ سيتم إضافة بيانات تجريبية (منتجات، عملاء، موردين) لقاعدة البيانات.")) return;

    try {
      const dummyProducts: Product[] = [
         { code: 'P001', name: 'بيض أبيض (كرتونة)', quantity: 100, price: 150, avgCost: 130 },
         { code: 'P002', name: 'بيض أحمر (كرتونة)', quantity: 50, price: 160, avgCost: 140 },
         { code: 'P003', name: 'بيض بلدي (كرتونة)', quantity: 200, price: 170, avgCost: 150 }
      ];
      for(const p of dummyProducts) await setDoc(doc(db, 'products', p.code), p);

      const dummyCustomers: Customer[] = [
         { code: 'C001', name: 'سوبر ماركت الأصدقاء', phone: '01012345678', balance: -1500, history: [{date: new Date().toISOString().split('T')[0], description: 'رصيد افتتاحي', amount: -1500}] },
         { code: 'C002', name: 'مطعم البرنس', phone: '01298765432', balance: 0, history: [] }
      ];
      for(const c of dummyCustomers) await setDoc(doc(db, 'customers', c.code), c);

      const dummySuppliers: Supplier[] = [
         { code: 'S001', name: 'مزارع دينا', phone: '01155555555', balance: -50000, history: [{date: new Date().toISOString().split('T')[0], description: 'رصيد افتتاحي', amount: -50000}] },
         { code: 'S002', name: 'الوطنية للدواجن', phone: '01066666666', balance: 0, history: [] }
      ];
      for(const s of dummySuppliers) await setDoc(doc(db, 'suppliers', s.code), s);
      
      alert("تم إضافة البيانات التجريبية بنجاح! قم بتحديث الصفحة.");
    } catch (e) {
       handleFirebaseError(e);
    }
  };

  const exportLedgerToExcel = (entityName: string, entityCode: string, history: any[], currentBalance: number, type: 'CUSTOMER' | 'SUPPLIER') => {
    const data = history.map(h => {
      let debit = 0;
      let credit = 0;

      if (type === 'CUSTOMER') {
        if (h.amount < 0) debit = Math.abs(h.amount);
        else credit = h.amount;
      } else {
        if (h.amount < 0) debit = Math.abs(h.amount);
        else credit = h.amount;
      }

      return {
        'التاريخ': h.date,
        'البيان': h.description,
        [type === 'CUSTOMER' ? 'مدين (عليه)' : 'علينا (مدين)']: debit || '',
        [type === 'CUSTOMER' ? 'دائن (له)' : 'لنا (دائن)']: credit || ''
      };
    });

    data.push({
      'التاريخ': '',
      'البيان': 'الرصيد النهائي الحالي',
      [type === 'CUSTOMER' ? 'مدين (عليه)' : 'علينا (مدين)']: currentBalance < 0 ? Math.abs(currentBalance) : '',
      [type === 'CUSTOMER' ? 'دائن (له)' : 'لنا (دائن)']: currentBalance > 0 ? currentBalance : ''
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    
    // RTL Direction
    if(!worksheet['!views']) worksheet['!views'] = [];
    worksheet['!views'].push({ rightToLeft: true });

    // AutoFilter
    const ref = worksheet['!ref'];
    if (ref) {
      worksheet['!autofilter'] = { ref: ref };
    }

    // Column Widths
    const wscols = [
      { wch: 15 }, 
      { wch: 60 }, 
      { wch: 20 }, 
      { wch: 20 }
    ];
    worksheet['!cols'] = wscols;

    const workbook = XLSX.utils.book_new();
    // Force Workbook View to RTL
    workbook.Workbook = { Views: [{ RTL: true }] };

    XLSX.utils.book_append_sheet(workbook, worksheet, "كشف حساب");
    const fileName = `كشف_حساب_${type === 'CUSTOMER' ? 'عميل' : 'مورد'}_${entityName}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const exportAllCustomersToExcel = () => {
    const data = customers.map(c => ({
      'كود العميل': c.code,
      'الاسم': c.name,
      'رقم الهاتف': c.phone || 'غير مسجل',
      'الرصيد الحالي': c.balance,
      'الحالة': c.balance < 0 ? 'مدين (عليه)' : c.balance > 0 ? 'دائن (له)' : 'خالص'
    }));

    // Create sheet
    const worksheet = XLSX.utils.json_to_sheet(data);
    
    // RTL Direction
    if(!worksheet['!views']) worksheet['!views'] = [];
    worksheet['!views'].push({ rightToLeft: true });

    // AutoFilter
    const ref = worksheet['!ref'];
    if (ref) {
      worksheet['!autofilter'] = { ref: ref };
    }

    // Column Widths - Adjusted to match request (Code, Name, Phone, Balance, Status)
    const wscols = [
        { wch: 15 }, // A: Code
        { wch: 40 }, // B: Name
        { wch: 20 }, // C: Phone
        { wch: 15 }, // D: Balance
        { wch: 15 }  // E: Status
    ];
    worksheet['!cols'] = wscols;

    const workbook = XLSX.utils.book_new();
    workbook.Workbook = { Views: [{ RTL: true }] };

    XLSX.utils.book_append_sheet(workbook, worksheet, "العملاء");
    XLSX.writeFile(workbook, `قائمة_العملاء_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportAllSuppliersToExcel = () => {
    const data = suppliers.map(s => ({
      'كود المورد': s.code,
      'الاسم': s.name,
      'رقم الهاتف': s.phone || 'غير مسجل',
      'الرصيد الحالي': s.balance,
      'الحالة': s.balance < 0 ? 'مدين (علينا)' : s.balance > 0 ? 'دائن (لنا)' : 'خالص'
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    
    // RTL Direction
    if(!worksheet['!views']) worksheet['!views'] = [];
    worksheet['!views'].push({ rightToLeft: true });

    // AutoFilter
    const ref = worksheet['!ref'];
    if (ref) {
      worksheet['!autofilter'] = { ref: ref };
    }

    // Column Widths
    const wscols = [
        { wch: 15 }, // Code
        { wch: 40 }, // Name
        { wch: 20 }, // Phone
        { wch: 15 }, // Balance
        { wch: 15 }  // Status
    ];
    worksheet['!cols'] = wscols;

    const workbook = XLSX.utils.book_new();
    workbook.Workbook = { Views: [{ RTL: true }] };

    XLSX.utils.book_append_sheet(workbook, worksheet, "الموردين");
    XLSX.writeFile(workbook, `قائمة_الموردين_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

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
        <style>
          :root {
            --primary-color: #000;
            --border-color: #000;
          }
          body { 
            font-family: 'Cairo', sans-serif; 
            padding: 40px; 
            direction: rtl; 
            background-color: #f3f4f6;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .invoice-container {
            background: white;
            max-width: 900px;
            margin: 0 auto;
            padding: 40px;
            border: 2px solid var(--border-color);
            position: relative;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px solid var(--border-color);
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .company-info h1 { margin: 0; font-size: 32px; font-weight: 800; }
          .company-info p { margin: 5px 0 0; color: #555; font-size: 14px; }
          .invoice-title { text-align: left; }
          .invoice-title h2 { margin: 0; font-size: 28px; color: #333; text-transform: uppercase; border: 2px solid #000; padding: 5px 15px; display: inline-block; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
          .info-box { border: 1px solid #ddd; padding: 15px; border-radius: 4px; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
          .info-row:last-child { margin-bottom: 0; }
          .info-label { font-weight: bold; color: #666; }
          .info-value { font-weight: 700; font-size: 16px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th { background-color: #eee; color: #000; font-weight: 800; padding: 12px; border: 1px solid #000; font-size: 14px; }
          td { padding: 10px; border: 1px solid #000; text-align: center; font-weight: 600; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .footer-section { display: flex; justify-content: space-between; align-items: flex-start; }
          .notes { flex: 1; font-size: 12px; color: #666; padding-left: 40px; }
          .totals-box { width: 300px; border: 2px solid #000; }
          .total-row { display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #ddd; }
          .total-row.final { background-color: #000; color: white; border-bottom: none; font-size: 18px; }
          .signatures { margin-top: 60px; display: flex; justify-content: space-between; padding: 0 50px; }
          .sig-box { text-align: center; width: 200px; }
          .sig-line { border-top: 1px solid #000; margin-top: 40px; }
          @media print {
            body { background: none; padding: 0; }
            .invoice-container { border: none; padding: 0; margin: 0; width: 100%; max-width: 100%; }
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="header">
            <div class="company-info">
              <h1>بورصة النجار</h1>
              <p>لتجارة البيض</p>
            </div>
            <div class="invoice-title">
              <h2>فاتورة مبيعات</h2>
            </div>
          </div>
          <div class="info-grid">
            <div class="info-box">
              <div class="info-row"><span class="info-label">العميل:</span><span class="info-value">${invoice.customerName}</span></div>
              <div class="info-row"><span class="info-label">كود العميل:</span><span class="info-value" style="font-family: monospace;">${invoice.customerCode}</span></div>
            </div>
            <div class="info-box">
              <div class="info-row"><span class="info-label">رقم الفاتورة:</span><span class="info-value" style="font-family: monospace;">${invoice.id}</span></div>
              <div class="info-row"><span class="info-label">التاريخ:</span><span class="info-value">${invoice.date}</span></div>
              <div class="info-row"><span class="info-label">الوقت:</span><span class="info-value">${invoice.time}</span></div>
            </div>
          </div>
          <table>
            <thead>
              <tr><th style="width: 50px;">م</th><th>الصنف</th><th style="width: 100px;">الكمية</th><th style="width: 120px;">السعر</th><th style="width: 140px;">الإجمالي</th></tr>
            </thead>
            <tbody>
              ${invoice.items.map((item, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td style="text-align: right; padding-right: 15px;">${item.itemName} ${item.itemCode ? `<span style="font-size: 10px; color: #777;">(${item.itemCode})</span>` : ''}</td>
                  <td style="font-size: 15px;">${item.quantity}</td>
                  <td>${item.price.toLocaleString()}</td>
                  <td>${item.total.toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="footer-section">
            <div class="notes"></div>
            <div class="totals-box">
              <div class="total-row"><span>الإجمالي:</span><strong>${invoice.total.toLocaleString()}</strong></div>
              <div class="total-row" style="color: #666; font-size: 13px;"><span>رصيد سابق:</span><span>${invoice.previousBalance.toLocaleString()}</span></div>
              <div class="total-row final"><span>الرصيد الحالي:</span><span style="direction: ltr;">${invoice.currentBalance.toLocaleString()}</span></div>
            </div>
          </div>
          <div class="signatures">
            <div class="sig-box"><strong>المستلم</strong><div class="sig-line"></div></div>
            <div class="sig-box"><strong>توقيع الإدارة</strong><div class="sig-line"></div></div>
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
      products, customers, suppliers, employees, purchases, invoices, treasury, users, currentUser, isOnline, permissionError,
      login, logout, addUser, updateUser, deleteUser, addProduct, updateProduct, deleteProduct, deletePurchase,
      addPurchase, addInvoice, deleteInvoice, clearAllInvoices, addCollection, addTransfer, addExpense, addCustomer, updateCustomer, deleteCustomer, addSupplier, updateSupplier, addEmployee, updateEmployee,
      seedDatabase, printInvoice, exportLedgerToExcel, exportAllCustomersToExcel, exportAllSuppliersToExcel, clearLedger, clearTreasury,
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