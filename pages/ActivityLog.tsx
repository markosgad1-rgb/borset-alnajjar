import React, { useEffect, useMemo, useState } from 'react';
import { collection, query, orderBy, limit as qLimit, where, onSnapshot } from 'firebase/firestore';
import { Activity, Search, Download, ChevronDown, ChevronUp, WifiOff } from 'lucide-react';
import { db } from '../firebaseConfig';
import { AuditEntry, AUDIT_COLLECTION } from '../utils/auditLog';
import { useNetworkStatus } from '../utils/useNetworkStatus';

type Range = 'today' | '7d' | '30d' | 'all';

const ACTION_META: Record<string, { label: string; cls: string }> = {
  create: { label: 'إنشاء', cls: 'bg-green-100 text-green-800 border-green-200' },
  update: { label: 'تعديل', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  delete: { label: 'حذف', cls: 'bg-red-100 text-red-800 border-red-200' },
  login: { label: 'دخول', cls: 'bg-blue-100 text-blue-800 border-blue-200' },
  logout: { label: 'خروج', cls: 'bg-gray-100 text-gray-700 border-gray-200' }
};

const TYPE_LABELS: Record<string, string> = {
  invoices: 'فواتير البيع', purchases: 'فواتير المشتريات', treasury: 'الخزنة', customers: 'العملاء',
  suppliers: 'الموردين', products: 'الأصناف', employees: 'الموظفين', users: 'المستخدمين', settings: 'الإعدادات', devices: 'الأجهزة', auth: 'الدخول والخروج'
};

const FIELD_LABELS: Record<string, string> = {
  total: 'الإجمالي', paid: 'المدفوع', paidAmount: 'المدفوع', remaining: 'المتبقي', remainingAmount: 'المتبقي',
  price: 'سعر البيع', avgCost: 'متوسط التكلفة', cost: 'التكلفة', quantity: 'الكمية', quantityMarg: 'كمية المرج',
  quantityNozha: 'كمية النزهة', name: 'الاسم', phone: 'الهاتف', balance: 'الرصيد', currentBalance: 'الرصيد الحالي',
  previousBalance: 'الرصيد السابق', isDeleted: 'محذوف', customerName: 'اسم العميل', supplierName: 'اسم المورد',
  customerCode: 'كود العميل', supplierCode: 'كود المورد', date: 'التاريخ', description: 'البيان', amount: 'المبلغ',
  credit: 'وارد', debit: 'منصرف', paymentMethod: 'طريقة الدفع', area: 'المنطقة', branchId: 'الفرع', salary: 'المرتب',
  role: 'الوظيفة', fullName: 'الاسم الكامل', username: 'اسم المستخدم', password: 'كلمة المرور', items: 'الأصناف', history: 'السجل'
};

const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('en-GB');
const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
const showVal = (v: any) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'boolean' ? (v ? 'نعم' : 'لا') : String(v));

const startOf = (r: Range): number => {
  const now = new Date();
  if (r === 'today') { now.setHours(0, 0, 0, 0); return now.getTime(); }
  if (r === '7d') return Date.now() - 7 * 86400000;
  if (r === '30d') return Date.now() - 30 * 86400000;
  return 0;
};

export const ActivityLog: React.FC = () => {
  const netUp = useNetworkStatus();
  const [range, setRange] = useState<Range>('7d');
  const [max, setMax] = useState(500);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [userFilter, setUserFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [showDerived, setShowDerived] = useState(false);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setErrorMsg('');
    const since = startOf(range);
    const base = collection(db, AUDIT_COLLECTION);
    const q = since > 0
      ? query(base, where('ts', '>=', since), orderBy('ts', 'desc'), qLimit(max))
      : query(base, orderBy('ts', 'desc'), qLimit(max));
    const unsub = onSnapshot(q, (snap) => {
      setEntries(snap.docs.map(d => d.data() as AuditEntry));
      setLoading(false);
    }, (err) => {
      console.error('Activity log error:', err);
      setErrorMsg('تعذر تحميل سجل النشاط. تأكد من الاتصال بالإنترنت وحاول مرة أخرى.');
      setLoading(false);
    });
    return () => unsub();
  }, [range, max]);

  const users = useMemo(() => {
    const m = new Map<string, string>();
    entries.forEach(e => { const key = e.username || e.userName || '—'; if (!m.has(key)) m.set(key, e.userName || key); });
    return Array.from(m.entries());
  }, [entries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter(e => {
      if (!showDerived && e.derived) return false;
      if (userFilter !== 'ALL' && (e.username || e.userName || '—') !== userFilter) return false;
      if (typeFilter !== 'ALL' && e.collection !== typeFilter) return false;
      if (actionFilter !== 'ALL' && e.action !== actionFilter) return false;
      if (q) {
        const hay = `${e.summary} ${e.userName} ${e.username} ${e.docId} ${e.items || ''} ${e.device}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [entries, userFilter, typeFilter, actionFilter, showDerived, search]);

  const detailsText = (e: AuditEntry) => {
    const parts: string[] = [];
    if (e.changes) Object.entries(e.changes).forEach(([k, v]) => parts.push(`${FIELD_LABELS[k] || k}: ${showVal(v.from)} ← ${showVal(v.to)}`));
    if (e.items) parts.push(`الأصناف: ${e.items}`);
    if (e.itemsBefore) parts.push(`الأصناف قبل: ${e.itemsBefore}`);
    return parts.join(' ; ');
  };

  const exportCsv = () => {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['التاريخ', 'الوقت', 'المستخدم', 'العملية', 'النوع', 'الرقم', 'البيان', 'التفاصيل', 'الجهاز', 'أوفلاين'];
    const rows = filtered.map(e => [fmtDate(e.ts), fmtTime(e.ts), e.userName, ACTION_META[e.action]?.label || e.action,
      TYPE_LABELS[e.collection] || e.collection, e.docId, e.summary, detailsText(e), e.device, e.offline ? 'نعم' : '']);
    const csv = '\uFEFF' + [header, ...rows].map(r => r.map(esc).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const sel = 'border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200';

  return (
    <div className="space-y-4 animate-fade-in pb-24">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl"><Activity size={22} /></div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">سجل النشاط</h2>
              <p className="text-xs text-gray-500">من قام بكل عملية، ومتى، وعلى أي جهاز (للمدير فقط)</p>
            </div>
          </div>
          <button onClick={exportCsv} disabled={filtered.length === 0}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-40">
            <Download size={16} /> تصدير Excel (CSV)
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-2">
          <select className={sel} value={range} onChange={e => { setRange(e.target.value as Range); setMax(500); }}>
            <option value="today">اليوم</option>
            <option value="7d">آخر 7 أيام</option>
            <option value="30d">آخر 30 يوم</option>
            <option value="all">كل الفترات</option>
          </select>
          <select className={sel} value={userFilter} onChange={e => setUserFilter(e.target.value)}>
            <option value="ALL">كل المستخدمين</option>
            {users.map(([k, name]) => <option key={k} value={k}>{name}</option>)}
          </select>
          <select className={sel} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="ALL">كل الأنواع</option>
            {Object.entries(TYPE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <select className={sel} value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
            <option value="ALL">كل العمليات</option>
            {Object.entries(ACTION_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select>
          <div className="relative col-span-2 md:col-span-1">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className={`${sel} w-full pr-9`} placeholder="بحث (رقم فاتورة، عميل...)" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm text-gray-600 cursor-pointer w-fit">
          <input type="checkbox" checked={showDerived} onChange={e => setShowDerived(e.target.checked)} />
          إظهار التحديثات التلقائية (تغيّر الأرصدة والمخزون الناتج عن الفواتير)
        </label>
        {!netUp && (
          <div className="mt-3 flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <WifiOff size={14} /> أنت أوفلاين: السجل المعروض هو آخر نسخة محفوظة على الجهاز وقد لا يشمل أحدث العمليات من الأجهزة الأخرى.
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-100 flex justify-between">
          <span>عدد السجلات المعروضة: {filtered.length}</span>
          <span>المحمّل من القاعدة: {entries.length}</span>
        </div>

        {loading ? (
          <div className="p-10 text-center text-gray-400">جاري التحميل...</div>
        ) : errorMsg ? (
          <div className="p-10 text-center text-red-600">{errorMsg}</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-gray-400">لا توجد عمليات مطابقة. السجل يبدأ من وقت تفعيل هذه الميزة.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-3 text-right w-28">الوقت</th>
                  <th className="p-3 text-right">المستخدم</th>
                  <th className="p-3 text-right w-20">العملية</th>
                  <th className="p-3 text-right w-32">النوع</th>
                  <th className="p-3 text-right">البيان</th>
                  <th className="p-3 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => {
                  const meta = ACTION_META[e.action] || { label: e.action, cls: 'bg-gray-100 text-gray-700 border-gray-200' };
                  const isOpen = openId === e.id;
                  const hasDetails = Boolean(e.changes || e.items || e.itemsBefore);
                  return (
                    <React.Fragment key={e.id}>
                      <tr className={`border-t border-gray-100 hover:bg-gray-50 ${hasDetails ? 'cursor-pointer' : ''} ${e.derived ? 'text-gray-400' : ''}`}
                        onClick={() => hasDetails && setOpenId(isOpen ? null : e.id)}>
                        <td className="p-3 whitespace-nowrap"><div className="font-bold text-gray-700">{fmtDate(e.ts)}</div><div className="text-xs text-gray-500">{fmtTime(e.ts)}</div></td>
                        <td className="p-3"><div className="font-bold text-gray-800">{e.userName || '—'}</div><div className="text-[11px] text-gray-400">{e.device}{e.offline ? ' • أوفلاين' : ''}</div></td>
                        <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${meta.cls}`}>{meta.label}</span></td>
                        <td className="p-3 text-gray-600">{TYPE_LABELS[e.collection] || e.collection}</td>
                        <td className="p-3 text-gray-800">{e.summary}</td>
                        <td className="p-3 text-gray-400">{hasDetails ? (isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />) : null}</td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-gray-50 border-t border-gray-100">
                          <td colSpan={6} className="p-3 text-xs text-gray-700 space-y-1">
                            {e.changes && Object.entries(e.changes).map(([k, v]) => (
                              <div key={k}><b>{FIELD_LABELS[k] || k}:</b> <span className="text-red-600">{showVal(v.from)}</span> ← <span className="text-green-700">{showVal(v.to)}</span></div>
                            ))}
                            {e.itemsBefore && <div><b>الأصناف قبل التعديل:</b> {e.itemsBefore}</div>}
                            {e.items && <div><b>الأصناف:</b> {e.items}</div>}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && entries.length >= max && (
          <div className="p-3 text-center border-t border-gray-100">
            <button onClick={() => setMax(m => m + 500)} className="text-sm font-bold text-blue-600">عرض المزيد (500 سجل إضافي)</button>
          </div>
        )}
      </div>
    </div>
  );
};
