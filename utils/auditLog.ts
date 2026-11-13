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
  derived?: boolean;   // automatic side effect of another action (balance / stock updates)
  offline?: boolean;   // the user was offline when it happened
  device: string;
}

const AUDITED = new Set(['invoices', 'purchases', 'treasury', 'customers', 'suppliers', 'products', 'employees', 'users']);
// fields that change automatically as a consequence of invoices / payments / purchases
const DERIVED_KEYS = new Set(['balance', 'history', 'quantity', 'quantityMarg', 'quantityNozha', 'avgCost', 'currentBalance', 'branchQuantities', 'cost']);
const MASKED_KEYS = new Set(['password']);
const SKIP_VALUE_KEYS = new Set(['permissions', 'items', 'history', 'manualTransactions', 'branchQuantities']);

const isPrim = (v: any) => v === null || v === undefined || ['string', 'number', 'boolean'].includes(typeof v);
const clip = (v: any, n = 120) => (typeof v === 'string' && v.length > n ? v.slice(0, n) + '…' : v);
const norm = (v: any) => (v === undefined ? null : v);
const fmt = (n: any) => (isFinite(Number(n)) && n !== '' && n !== null ? Number(n).toLocaleString('en-US') : '');

const LABELS: Record<string, string> = {
  invoices: 'فاتورة بيع', purchases: 'فاتورة مشتريات', treasury: 'حركة خزنة', customers: 'عميل',
  suppliers: 'مورد', products: 'صنف', employees: 'موظف', users: 'مستخدم'
};

const getUser = (override?: any) => {
  try {
    const u = override || JSON.parse(localStorage.getItem('erp_current_user') || 'null');
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

const describe = (coll: string, id: string, d: any): string => {
  const base = LABELS[coll] || coll;
  if (!d) return `${base} ${id}`;
  switch (coll) {
    case 'invoices': return `${base} ${id} - ${d.customerName || ''} - إجمالي ${fmt(d.total)}${d.paidAmount ?? d.paid ? ` - مدفوع ${fmt(d.paidAmount ?? d.paid)}` : ''}`;
    case 'purchases': return `${base} ${id} - ${d.supplierName || ''} - إجمالي ${fmt(d.total)}`;
    case 'treasury': return `${base}: ${d.description || ''} - ${fmt(d.amount ?? (d.credit || d.debit))}${d.paymentMethod ? ` (${d.paymentMethod})` : ''}`;
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
      if (action === 'update' && (changes as any)?.isDeleted?.to === true) summary = `حذف (نقل لسلة المهملات): ${summary}`;
      else if (action === 'update' && (changes as any)?.isDeleted?.to === false) summary = `استرجاع من سلة المهملات: ${summary}`;

      const u = getUser();
      send({
        ts, at: new Date(ts).toISOString(), ...u, action, collection: coll, docId, summary,
        changes: changes && Object.keys(changes).length ? changes : undefined,
        items: itemsNow, itemsBefore: itemsPrev,
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
