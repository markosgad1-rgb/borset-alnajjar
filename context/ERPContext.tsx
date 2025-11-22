
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Product, Customer, Supplier, Employee, Purchase, SalesInvoice, TreasuryTransaction, InvoiceItem, User } from '../types';
import { firebaseConfig, isFirebaseConfigured } from '../firebaseConfig';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
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
  deleteInvoice: (id: string) => Promise<void>; // NEW
  addCollection: (data: {
    customerCode: string;
    invoiceId?: string;
    amount: number;
    date: string;
  }) => void;
  addTransfer: (data: {
    entityType: 'CUSTOMER' | 'SUPPLIER' | 'EMPLOYEE';
    entityCode: string;
    amount: number;
    type: 'IN' | 'OUT'; // IN = Deposit/Collection, OUT = Withdrawal/Payment
    date: string;
    notes?: string;
  }) => void;
  addCustomer: (customer: Customer) => void;
  updateCustomer: (code: string, updatedData: Partial<Customer>) => void;
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

  currentTreasuryBalance: number;
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
  { id: '1', username: 'admin', password: '123', fullName: 'المدير العام', role: 'ADMIN', permissions: { sales: true, warehouse: true, financial: true, admin: true } }
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

  const currentTreasuryBalance = treasury.length > 0 ? treasury[treasury.length - 1].balance : 0;

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
                id: '1', username: 'admin', password: '123', fullName: 'المدير العام', role: 'ADMIN', permissions: { sales: true, warehouse: true, financial: true, admin: true } 
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
         permissions: { sales: true, warehouse: true, financial: true, admin: true } 
       };
       setCurrentUser(adminUser);
       if (isOnline) {
         // Try to sync admin to cloud, but don't block login if it fails
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
        
        // Update Product using getDoc to avoid race conditions
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
          // New Product creation from purchase
          await setDoc(productRef, { 
            code: purchaseData.itemCode, 
            name: purchaseData.itemName, 
            quantity: purchaseData.quantity, 
            avgCost: purchaseData.price, 
            price: purchaseData.price * 1.2 
          });
        }

        // Update Supplier using getDoc
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
      // Offline Logic
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
        
        // Update Customer with getDoc
        const customerRef = doc(db, 'customers', invoiceData.customerCode);
        const customerSnap = await getDoc(customerRef);
        
        if (customerSnap.exists()) {
          const c = customerSnap.data() as Customer;
          const newBalance = c.balance - debtAmount;
          const newHistory = [...c.history, { date: invoiceData.date, description: `فاتورة بيع #${id} (آجل)`, amount: -debtAmount }];
          await updateDoc(customerRef, { balance: newBalance, history: newHistory });
        } else {
          // Create customer if not exists (rare case in this UI)
          await setDoc(customerRef, {
              code: invoiceData.customerCode, name: invoiceData.customerName, balance: -debtAmount,
              history: [{ date: invoiceData.date, description: `فاتورة بيع #${id} (آجل)`, amount: -debtAmount }]
          });
        }

        // Update Products with getDoc
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
      // Offline Logic
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

  const addTransfer = async (data: { 
    entityType: 'CUSTOMER' | 'SUPPLIER' | 'EMPLOYEE';
    entityCode: string; amount: number; type: 'IN' | 'OUT'; date: string; notes?: string;
  }) => {
    const isIncome = data.type === 'IN';
    const newTreasuryBalance = currentTreasuryBalance + (isIncome ? data.amount : -data.amount);
    
    let entityName = '';
    let entityLabel = '';
    if (data.entityType === 'CUSTOMER') { entityLabel = 'عميل'; entityName = customers.find(c => c.code === data.entityCode)?.name || data.entityCode; }
    if (data.entityType === 'SUPPLIER') { entityLabel = 'مورد'; entityName = suppliers.find(s => s.code === data.entityCode)?.name || data.entityCode; }
    if (data.entityType === 'EMPLOYEE') { entityLabel = 'موظف'; entityName = employees.find(e => e.code === data.entityCode)?.name || data.entityCode; }

    const description = `${isIncome ? 'وارد من' : 'صادر إلى'} ${entityLabel} - ${entityName} ${data.notes ? `(${data.notes})` : ''}`;
    const transId = `TRF-${Date.now()}`;
    
    const newTransaction: TreasuryTransaction = {
      id: transId, date: data.date, credit: isIncome ? data.amount : 0, debit: isIncome ? 0 : data.amount,
      balance: newTreasuryBalance, description
    };

    if (isOnline) {
      try {
        // Save Treasury
        await setDoc(doc(db, 'treasury', transId), newTransaction);
        
        // Update Entity with getDoc for safe balance update
        if (data.entityType === 'CUSTOMER') {
          const ref = doc(db, 'customers', data.entityCode);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const c = snap.data() as Customer;
            const change = isIncome ? data.amount : -data.amount;
            await updateDoc(ref, {
              balance: c.balance + change,
              history: [...c.history, { date: data.date, description: `${isIncome ? 'تحصيل نقدية' : 'صرف نقدية'} - ${data.notes || ''}`, amount: change }]
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
              history: [...s.history, { date: data.date, description: `${isIncome ? 'استلام نقدية (مورد)' : 'دفع نقدية (مورد)'} - ${data.notes || ''}`, amount: change }]
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
              history: [...e.history, { date: data.date, description: `${isIncome ? 'تحصيل سلفة/نقدية' : 'صرف راتب/سلفة'} - ${data.notes || ''}`, amount: change }]
            });
          }
        }
      } catch (e) { handleFirebaseError(e); }

    } else {
      // Offline Logic
      setTreasury(prev => [...prev, newTransaction]);
      if (data.entityType === 'CUSTOMER') {
        setCustomers(prev => prev.map(c => c.code === data.entityCode ? { ...c, balance: c.balance + (isIncome ? data.amount : -data.amount), history: [...c.history, { date: data.date, description: `${isIncome ? 'تحصيل نقدية' : 'صرف نقدية'}`, amount: (isIncome ? data.amount : -data.amount) }] } : c));
      } else if (data.entityType === 'SUPPLIER') {
        setSuppliers(prev => prev.map(s => s.code === data.entityCode ? { ...s, balance: s.balance + (isIncome ? -data.amount : data.amount), history: [...s.history, { date: data.date, description: `${isIncome ? 'استلام نقدية' : 'دفع نقدية'}`, amount: (isIncome ? -data.amount : data.amount) }] } : s));
      } else if (data.entityType === 'EMPLOYEE') {
        setEmployees(prev => prev.map(e => e.code === data.entityCode ? { ...e, balance: e.balance + (isIncome ? -data.amount : data.amount), history: [...e.history, { date: data.date, description: `${isIncome ? 'تحصيل' : 'صرف'}`, amount: (isIncome ? -data.amount : data.amount) }] } : e));
      }
    }
  };

  const addCollection = (data: { customerCode: string; invoiceId?: string; amount: number; date: string }) => {
    addTransfer({
      entityType: 'CUSTOMER', entityCode: data.customerCode, amount: data.amount, type: 'IN', date: data.date,
      notes: data.invoiceId ? `تحصيل فاتورة ${data.invoiceId}` : 'تحصيل نقدية'
    });
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

  const seedDatabase = async () => {
    if (!isOnline) return alert("يجب أن تكون متصلاً بالإنترنت لزرع البيانات.");
    
    if(!confirm("هل أنت متأكد؟ سيتم إضافة بيانات تجريبية (منتجات، عملاء، موردين) لقاعدة البيانات.")) return;

    try {
      // Add Products
      const dummyProducts: Product[] = [
         { code: 'P001', name: 'بيض أبيض (كرتونة)', quantity: 100, price: 150, avgCost: 130 },
         { code: 'P002', name: 'بيض أحمر (كرتونة)', quantity: 50, price: 160, avgCost: 140 },
         { code: 'P003', name: 'بيض بلدي (كرتونة)', quantity: 200, price: 170, avgCost: 150 }
      ];
      for(const p of dummyProducts) await setDoc(doc(db, 'products', p.code), p);

      // Add Customers
      const dummyCustomers: Customer[] = [
         { code: 'C001', name: 'سوبر ماركت الأصدقاء', balance: -1500, history: [{date: new Date().toISOString().split('T')[0], description: 'رصيد افتتاحي', amount: -1500}] },
         { code: 'C002', name: 'مطعم البرنس', balance: 0, history: [] }
      ];
      for(const c of dummyCustomers) await setDoc(doc(db, 'customers', c.code), c);

      // Add Suppliers
      const dummySuppliers: Supplier[] = [
         { code: 'S001', name: 'مزارع دينا', balance: -50000, history: [{date: new Date().toISOString().split('T')[0], description: 'رصيد افتتاحي', amount: -50000}] },
         { code: 'S002', name: 'الوطنية للدواجن', balance: 0, history: [] }
      ];
      for(const s of dummySuppliers) await setDoc(doc(db, 'suppliers', s.code), s);
      
      alert("تم إضافة البيانات التجريبية بنجاح! قم بتحديث الصفحة.");
    } catch (e) {
       handleFirebaseError(e);
    }
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
          
          /* Header */
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px solid var(--border-color);
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .company-info h1 {
            margin: 0;
            font-size: 32px;
            font-weight: 800;
          }
          .company-info p {
            margin: 5px 0 0;
            color: #555;
            font-size: 14px;
          }
          .invoice-title {
            text-align: left;
          }
          .invoice-title h2 {
            margin: 0;
            font-size: 28px;
            color: #333;
            text-transform: uppercase;
            border: 2px solid #000;
            padding: 5px 15px;
            display: inline-block;
          }

          /* Info Grid */
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 30px;
          }
          .info-box {
            border: 1px solid #ddd;
            padding: 15px;
            border-radius: 4px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 14px;
          }
          .info-row:last-child { margin-bottom: 0; }
          .info-label { font-weight: bold; color: #666; }
          .info-value { font-weight: 700; font-size: 16px; }

          /* Table */
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 30px; 
          }
          th { 
            background-color: #eee; 
            color: #000; 
            font-weight: 800; 
            padding: 12px; 
            border: 1px solid #000;
            font-size: 14px;
          }
          td { 
            padding: 10px; 
            border: 1px solid #000; 
            text-align: center; 
            font-weight: 600;
          }
          tr:nth-child(even) { background-color: #f9f9f9; }

          /* Totals Section */
          .footer-section {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }
          .notes {
            flex: 1;
            font-size: 12px;
            color: #666;
            padding-left: 40px;
          }
          .totals-box {
            width: 300px;
            border: 2px solid #000;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            padding: 10px;
            border-bottom: 1px solid #ddd;
          }
          .total-row.final {
            background-color: #000;
            color: white;
            border-bottom: none;
            font-size: 18px;
          }

          /* Signatures */
          .signatures {
            margin-top: 60px;
            display: flex;
            justify-content: space-between;
            padding: 0 50px;
          }
          .sig-box {
            text-align: center;
            width: 200px;
          }
          .sig-line {
            border-top: 1px solid #000;
            margin-top: 40px;
          }

          @media print {
            body { background: none; padding: 0; }
            .invoice-container { border: none; padding: 0; margin: 0; width: 100%; max-width: 100%; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          
          <!-- Header -->
          <div class="header">
            <div class="company-info">
              <h1>بورصة النجار</h1>
              <p>لتجارة البيض</p>
            </div>
            <div class="invoice-title">
              <h2>فاتورة مبيعات</h2>
            </div>
          </div>

          <!-- Info -->
          <div class="info-grid">
            <div class="info-box">
              <div class="info-row">
                <span class="info-label">العميل:</span>
                <span class="info-value">${invoice.customerName}</span>
              </div>
              <div class="info-row">
                <span class="info-label">كود العميل:</span>
                <span class="info-value" style="font-family: monospace;">${invoice.customerCode}</span>
              </div>
            </div>
            <div class="info-box">
              <div class="info-row">
                <span class="info-label">رقم الفاتورة:</span>
                <span class="info-value" style="font-family: monospace;">${invoice.id}</span>
              </div>
              <div class="info-row">
                <span class="info-label">التاريخ:</span>
                <span class="info-value">${invoice.date}</span>
              </div>
              <div class="info-row">
                <span class="info-label">الوقت:</span>
                <span class="info-value">${invoice.time}</span>
              </div>
            </div>
          </div>

          <!-- Items -->
          <table>
            <thead>
              <tr>
                <th style="width: 50px;">م</th>
                <th>الصنف</th>
                <th style="width: 100px;">الكمية</th>
                <th style="width: 120px;">السعر</th>
                <th style="width: 140px;">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              ${invoice.items.map((item, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td style="text-align: right; padding-right: 15px;">
                    ${item.itemName} 
                    ${item.itemCode ? `<span style="font-size: 10px; color: #777;">(${item.itemCode})</span>` : ''}
                  </td>
                  <td style="font-size: 15px;">${item.quantity}</td>
                  <td>${item.price.toLocaleString()}</td>
                  <td>${item.total.toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <!-- Footer Section -->
          <div class="footer-section">
            <div class="notes">
            </div>

            <div class="totals-box">
              <div class="total-row">
                <span>الإجمالي:</span>
                <strong>${invoice.total.toLocaleString()}</strong>
              </div>
              <div class="total-row" style="color: #666; font-size: 13px;">
                <span>رصيد سابق:</span>
                <span>${invoice.previousBalance.toLocaleString()}</span>
              </div>
              <div class="total-row final">
                <span>الرصيد الحالي:</span>
                <span style="direction: ltr;">${invoice.currentBalance.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <!-- Signatures -->
          <div class="signatures">
            <div class="sig-box">
              <strong>المستلم</strong>
              <div class="sig-line"></div>
            </div>
            <div class="sig-box">
              <strong>توقيع الإدارة</strong>
              <div class="sig-line"></div>
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

  return (
    <ERPContext.Provider value={{
      products, customers, suppliers, employees, purchases, invoices, treasury, users, currentUser, isOnline, permissionError,
      login, logout, addUser, updateUser, deleteUser, addProduct, updateProduct, deleteProduct, deletePurchase,
      addPurchase, addInvoice, deleteInvoice, addCollection, addTransfer, addCustomer, updateCustomer, addSupplier, updateSupplier, addEmployee, updateEmployee,
      seedDatabase, printInvoice,
      currentTreasuryBalance
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
