// Activity (audit) log: records WHO did WHAT and WHEN for every important change in the system.
// Entries are stored in the Firestore collection "auditLog" (one small document per action).
// Nothing here can break a save: every function swallows its own errors.
import { doc, setDoc as fsSetDoc, getDocFromCache } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { trackWrite, isConnected } from './connectionStatus';

export const AUDIT_COLLECTION = 'auditLog';

export type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'logout';

export interface AuditEntry {
  id: string;
  ts: number;
  at: string;
  userId: string;
  username: string;
  userName: string;
  role: string;
  action: AuditAction;
  collection: string;
  docId: string;
  summary: string;
  changes?: Record<string, { from: any; to: any }>;
  items?: string;
  itemsBefore?: string;
  details?: string[];  // تفاصيل العملية (الحساب، الفرع، المدفوع، المتبقي...)
  system?: boolean;    // written automatically by the app itself (not by a person)
  derived?: boolean;   // automatic side effect of another action (balance / stock updates)
  offline?: boolean;   // the user was offline when it happened
  device: string;
}

const AUDITED = new Set(['devices', 'settings', 'invoices', 'purchases', 'treasury', 'customers', 'suppliers', 'products', 'employees', 'users']);
// fields that change automatically as a consequence of invoices / payments / purchases
const DERIVED_KEYS = new Set(['balance', 'history', 'quantity', 'quantityMarg', 'quantityNozha', 'avgCost', 'currentBalance', 'branchQuantities', 'cost']);
const MASKED_KEYS = new Set(['password']);
const SKIP_VALUE_KEYS = new Set(['permissions', 'items', 'history', 'manualTransactions', 'branchQuantities']);

const isPrim = (v: any) => v === null || v === undefined || ['string', 'number', 'boolean'].includes(typeof v);
const clip = (v: any, n = 120) => (typeof v === 'string' && v.length > n ? v.slice(0, n) + '…' : v);
const norm = (v: any) => (v === undefined ? null : v);
const fmt = (n: any) => (isFinite(Number(n)) && n !== '' && n !== null ? Number(n).toLocaleString('en-US') : '');

const LABELS: Record<string, string> = {
  devices: 'جهاز', settings: 'إعدادات البرنامج', invoices: 'فاتورة بيع', purchases: 'فاتورة مشتريات', treasury: 'حركة خزنة', customers: 'عميل',
  suppliers: 'مورد', products: 'صنف', employees: 'موظف', users: 'مستخدم'
};

// The signed-in user is kept IN MEMORY for this window (set by the context on login/logout/reload).
// localStorage is shared by every window/tab of the same browser, so reading it here could
// attribute an action to whoever logged in last in another window. It is only a fallback now.
let memUser: any = undefined;   // undefined = not set yet, null = signed out
export const setAuditUser = (u: any) => { memUser = u ?? null; };

// Automatic writes (self-healing, migrations) are marked "(تلقائي)". When the automatic write belongs to a record
// created by a known person, it is attributed to that person instead of whoever's device happened to run it.
let systemDepth = 0;
let asUserOverride: any = undefined;
export const runAsSystem = <T,>(fn: () => T, asUser?: any): T => {
  systemDepth++;
  const prev = asUserOverride;
  if (asUser) asUserOverride = asUser;
  try { return fn(); } finally { systemDepth--; asUserOverride = prev; }
};

const getUser = (override?: any) => {
  try {
    const u = override || (memUser !== undefined ? memUser : JSON.parse(localStorage.getItem('erp_current_user') || 'null'));
    if (!u) return { userId: '', username: '', userName: 'غير معروف', role: '' };
    return { userId: String(u.id ?? ''), username: String(u.username ?? ''), userName: String(u.fullName || u.name || u.username || ''), role: String(u.role ?? '') };
  } catch { return { userId: '', username: '', userName: 'غير معروف', role: '' }; }
};

const getDevice = () => {
  try {
    let id = localStorage.getItem('erp_device_id');
    if (!id) { id = Math.random().toString(36).slice(2, 6).toUpperCase(); localStorage.setItem('erp_device_id', id); }
    const ua = navigator.userAgent || '';
    const plat = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac/i.test(ua) ? 'Mac' : 'Device';
    return `${plat}-${id}`;
  } catch { return 'Device'; }
};

const itemsText = (items: any): string | undefined => {
  if (!Array.isArray(items) || items.length === 0) return undefined;
  const t = items.map((i: any) => `${i?.itemName ?? i?.name ?? ''} ×${i?.quantity ?? ''} @${i?.price ?? ''}`).join(' | ');
  return t.length > 600 ? t.slice(0, 600) + '…' : t;
};


const PM_LABELS: Record<string, string> = { CASH: 'خزنة (كاش)', BANK_MISR: 'بنك مصر', BANK_AHLY: 'البنك الأهلي', VF_CASH_AYMAN: 'فودافون كاش أيمن', VF_CASH_KYRILLOS: 'فودافون كاش كيرلس' };
const BRANCH_LABELS: Record<string, string> = { MARG: 'المرج', NOZHA: 'النزهة' };

// تفاصيل مقروءة عن العملية (من بيانات المستند نفسه)
const detailLines = (coll: string, d: any): string[] | undefined => {
  if (!d) return undefined;
  const out: string[] = [];
  const add = (label: string, v: any) => { if (v !== undefined && v !== null && v !== '') out.push(`${label}: ${v}`); };
  const num = (v: any) => (v === undefined || v === null || v === '' || !isFinite(Number(v)) ? undefined : Number(v).toLocaleString('en-US'));
  try {
    if (coll === 'treasury') {
      add('الاتجاه', Number(d.credit || 0) > 0 || d.type === 'INCOME' ? 'وارد (دائن)' : 'صادر (مدين)');
      add('المبلغ', num(d.amount ?? (d.credit || d.debit)));
      add('الحساب', PM_LABELS[d.paymentMethod] || d.paymentMethod);
      add('الفرع', BRANCH_LABELS[d.branchId] || d.branchId);
      add('رقم الفاتورة', d.invoiceNumber);
      add('تاريخ الحركة', d.date);
      add('البيان', d.description);
      add('مصدر الحركة', d.source);
    } else if (coll === 'invoices' || coll === 'purchases') {
      add(coll === 'invoices' ? 'العميل' : 'المورد', d.customerName || d.supplierName);
      add('الكود', d.customerCode || d.supplierCode);
      add('تاريخ الفاتورة', d.date);
      add('الإجمالي', num(d.total));
      add('المدفوع', num(d.paidAmount ?? d.paid));
      add('المتبقي', num(d.remainingAmount ?? d.remaining));
      add('حساب الدفع', PM_LABELS[d.paymentMethod] || d.paymentMethod);
      add('الفرع', BRANCH_LABELS[d.branchId] || d.branchId);
      add('عدد الأصناف', Array.isArray(d.items) ? d.items.length : undefined);
      add('سجّلها', d.createdByName);
      add('رصيد قبل', num(d.previousBalance));
      add('رصيد بعد', num(d.currentBalance));
    } else if (coll === 'customers' || coll === 'suppliers' || coll === 'employees') {
      add('الاسم', d.name);
      add('الكود', d.code);
      add('الفرع', BRANCH_LABELS[d.branchId] || d.branchId);
      add('الرصيد', num(d.balance));
    }
  } catch { /* ignore */ }
  return out.length ? out : undefined;
};

const describe = (coll: string, id: string, d: any): string => {
  const base = LABELS[coll] || coll;
  if (!d) return `${base} ${id}`;
  switch (coll) {
    case 'invoices': return `${base} ${id} - ${d.customerName || ''} - إجمالي ${fmt(d.total)}${d.paidAmount ?? d.paid ? ` - مدفوع ${fmt(d.paidAmount ?? d.paid)}` : ''}`;
    case 'purchases': return `${base} ${id} - ${d.supplierName || ''} - إجمالي ${fmt(d.total)}`;
    case 'treasury': return `${base}: ${d.description || ''} - ${fmt(d.amount ?? (d.credit || d.debit))}${d.paymentMethod ? ` (${d.paymentMethod})` : ''}`;
    case 'devices': return `${base}: ${d.deviceName || ''} - ${d.userName || d.username || ''} (${d.status === 'approved' ? 'معتمد' : d.status === 'blocked' ? 'محظور' : 'بانتظار الموافقة'})`;
    case 'users': return `${base} ${d.fullName || d.username || id}`;
    default: return `${base} ${d.name || ''} (${id})`;
  }
};

const diffPrimitives = (before: any, after: any, keys: string[]) => {
  const out: Record<string, { from: any; to: any }> = {};
  for (const k of keys) {
    if (Object.keys(out).length >= 14) break;
    const a = after?.[k]; const b = before?.[k];
    if (SKIP_VALUE_KEYS.has(k)) {
      if (Array.isArray(a) && (!Array.isArray(b) || a.length !== b.length)) out[k] = { from: Array.isArray(b) ? `[${b.length}]` : null, to: `[${a.length}]` };
      continue;
    }
    if (k === 'logo') { if (norm(a) !== norm(b)) out[k] = { from: null, to: '(تغيير الشعار)' }; continue; }
    if (isPrim(a) && isPrim(b)) {
      if (norm(a) !== norm(b)) out[k] = MASKED_KEYS.has(k) ? { from: '***', to: '***' } : { from: clip(norm(b)), to: clip(norm(a)) };
    } else if (!isPrim(a) && JSON.stringify(a) !== JSON.stringify(b)) {
      out[k] = { from: null, to: '(تغيّر)' };
    }
  }
  return out;
};

const strip = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(strip);
  if (obj && typeof obj === 'object') {
    const o: any = {};
    for (const k of Object.keys(obj)) { const v = obj[k]; if (v !== undefined) o[k] = strip(v); }
    return o;
  }
  return obj;
};

const send = (entry: Omit<AuditEntry, 'id'>) => {
  try {
    const id = `${entry.ts}_${Math.random().toString(36).slice(2, 6)}`;
    const p = fsSetDoc(doc(db, AUDIT_COLLECTION, id), strip({ ...entry, id }));
    trackWrite(p);
    p.catch(() => { /* an audit failure must never affect the user */ });
  } catch { /* ignore */ }
};

export const isAuditedRef = (ref: any) => {
  try { return AUDITED.has(String(ref?.path || '').split('/')[0]); } catch { return false; }
};

// Reads the document from the LOCAL cache. Called right before a write so we know what it looked like before.
// resolves to: object (existing), null (does not exist), undefined (unknown)
export const captureBefore = (ref: any): Promise<any> => {
  if (!isAuditedRef(ref)) return Promise.resolve(undefined);
  try {
    return getDocFromCache(ref).then((s: any) => (s.exists() ? s.data() : null)).catch(() => undefined);
  } catch { return Promise.resolve(undefined); }
};

const normalizeUpdateArgs = (args: any[]): Record<string, any> => {
  if (args.length && typeof args[0] === 'string') {
    const o: Record<string, any> = {};
    for (let i = 0; i + 1 < args.length; i += 2) o[String(args[i])] = args[i + 1];
    return o;
  }
  return args[0] && typeof args[0] === 'object' ? args[0] : {};
};

export const recordWrite = (op: 'set' | 'update' | 'delete', ref: any, payload: any, beforeP: Promise<any>) => {
  if (!isAuditedRef(ref)) return;
  const ts = Date.now();
  const offline = !isConnected();
  const sys = systemDepth > 0;
  const who = getUser(asUserOverride);   // captured NOW (synchronously), not after the async cache read
  beforeP.then((before) => {
    try {
      const parts = String(ref.path).split('/');
      const coll = parts[0]; const docId = parts[1] || '';
      let action: AuditAction;
      let after: any = null;
      let changes: Record<string, { from: any; to: any }> | undefined;
      let derived = false;
      let itemsNow: string | undefined; let itemsPrev: string | undefined;

      if (op === 'delete') {
        action = 'delete';
        after = null;
      } else if (op === 'set') {
        after = payload || {};
        action = before ? 'update' : 'create';
        if (before) {
          changes = diffPrimitives(before, after, Object.keys(after));
          const itemsA = itemsText(after.items); const itemsB = itemsText(before.items);
          if (itemsA !== itemsB) { itemsNow = itemsA; itemsPrev = itemsB; }
          if (Object.keys(changes).length === 0 && itemsA === itemsB) return; // nothing really changed
        } else {
          itemsNow = itemsText(after.items);
        }
      } else {
        const upd = normalizeUpdateArgs(Array.isArray(payload) ? payload : [payload]);
        action = 'update';
        after = { ...(before || {}), ...upd };
        changes = diffPrimitives(before || {}, upd, Object.keys(upd));
        if (Object.keys(changes).length === 0) return; // nothing really changed
        const keys = Object.keys(upd);
        derived = ['customers', 'suppliers', 'products'].includes(coll) && keys.every(k => DERIVED_KEYS.has(k));
        if (upd.items) { const a = itemsText(upd.items); const b = itemsText(before?.items); if (a !== b) { itemsNow = a; itemsPrev = b; } }
      }

      const shown = op === 'delete' ? before : after;
      let summary = describe(coll, docId, shown);
      if (sys) summary = `(تلقائي) ${summary}`;
      if (action === 'update' && (changes as any)?.isDeleted?.to === true) summary = `حذف (نقل لسلة المهملات): ${summary}`;
      else if (action === 'update' && (changes as any)?.isDeleted?.to === false) summary = `استرجاع من سلة المهملات: ${summary}`;

      const u = who; // دايماً باسم المستخدم المسجّل دخوله على الجهاز؛ العمليات التلقائية بتتعلّم بكلمة (تلقائي)
      send({
        ts, at: new Date(ts).toISOString(), ...u, system: sys || undefined, action, collection: coll, docId, summary,
        changes: changes && Object.keys(changes).length ? changes : undefined,
        items: itemsNow, itemsBefore: itemsPrev,
        details: (['treasury', 'invoices', 'purchases'].includes(coll) || action === 'create') ? detailLines(coll, shown) : undefined,
        derived: derived || undefined, offline: offline || undefined, device: getDevice()
      });
    } catch { /* ignore */ }
  }).catch(() => {});
};

export const logEvent = (action: 'login' | 'logout', summary: string, userOverride?: any) => {
  try {
    const ts = Date.now();
    send({ ts, at: new Date(ts).toISOString(), ...getUser(userOverride), action, collection: 'auth', docId: '', summary, offline: !isConnected() || undefined, device: getDevice() });
  } catch { /* ignore */ }
};

// ===== سجل العمليات الرئيسية بلغة واضحة (إنشاء/تعديل/حذف/تصفير...) =====
export const opMoney = (n: any) => `${fmt(Math.round((Number(n) || 0) * 100) / 100) || '0'} ج.م`;
export const opPm = (m: any) => (m ? (PM_LABELS[m] || String(m)) : '');
export const opBranch = (b: any) => (b ? (BRANCH_LABELS[b] || String(b)) : '');
// سطر "قبل ← بعد" لو القيمة اتغيرت، وإلا لا شيء
export const opChange = (label: string, a: any, b: any, asMoney = false): string[] => {
  const f = (v: any) => (v === undefined || v === null || v === '' ? '—' : asMoney ? opMoney(v) : String(v));
  return String(a ?? '') === String(b ?? '') ? [] : [`${label}: ${f(a)} ← ${f(b)}`];
};
export const opItemLines = (items: any[] | undefined): string[] =>
  (items || []).map((i: any) => `صنف: ${i?.itemName ?? i?.name ?? ''} - كمية ${i?.quantity ?? ''} × سعر ${fmt(i?.price)} = ${fmt(i?.total)}`);
export const opItemDiff = (oldItems: any[] | undefined, newItems: any[] | undefined): string[] => {
  const out: string[] = [];
  const key = (i: any) => String(i?.itemCode ?? i?.itemName ?? '');
  const o = new Map((oldItems || []).map((i: any) => [key(i), i]));
  const n = new Map((newItems || []).map((i: any) => [key(i), i]));
  n.forEach((ni: any, k) => {
    const oi: any = o.get(k);
    const nm = ni?.itemName ?? k;
    if (!oi) out.push(`إضافة صنف: ${nm} - كمية ${ni.quantity} × سعر ${fmt(ni.price)}`);
    else {
      if (Number(oi.quantity) !== Number(ni.quantity)) out.push(`الصنف ${nm}: الكمية ${oi.quantity} ← ${ni.quantity}`);
      if (Number(oi.price) !== Number(ni.price)) out.push(`الصنف ${nm}: السعر ${fmt(oi.price)} ← ${fmt(ni.price)}`);
    }
  });
  o.forEach((oi: any, k) => { if (!n.has(k)) out.push(`حذف صنف: ${oi?.itemName ?? k} - كمية ${oi.quantity}`); });
  return out;
};

let quietDepth = 0;
/** ينفّذ عملية مركّبة بدون ما العمليات الداخلية تتسجل كل واحدة لوحدها (العملية الأم بتتسجل مرة واحدة). */
export const quietOps = async <T,>(fn: () => Promise<T>): Promise<T> => {
  quietDepth++;
  try { return await fn(); } finally { quietDepth--; }
};

export const logOp = (action: 'create' | 'update' | 'delete', summary: string, details?: string[], docId = '') => {
  try {
    if (quietDepth > 0) return;
    const ts = Date.now();
    send({
      ts, at: new Date(ts).toISOString(), ...getUser(asUserOverride), system: systemDepth > 0 || undefined,
      action, collection: 'ops', docId, summary: systemDepth > 0 ? `(تلقائي) ${summary}` : summary,
      details: details && details.length ? details : undefined, offline: !isConnected() || undefined, device: getDevice()
    });
  } catch { /* never affect the app */ }
};
