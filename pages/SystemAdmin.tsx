import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { MonitorSmartphone, ShieldCheck, ShieldAlert, Check, X, Trash2, Pencil, Wifi, Clock, Users as UsersIcon } from 'lucide-react';
import { db } from '../firebaseConfig';
import { useERP } from '../context/ERPContext';
import { setDoc, deleteDoc, updateDoc } from '../utils/firestoreOffline';
import { DEVICES_COLLECTION, SECURITY_DOC, DeviceDoc, DeviceStatus, isOnlineNow, getDeviceUid, deviceDocId } from '../utils/deviceGuard';

const fmtDT = (ts?: number) => {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${d.toLocaleDateString('en-GB')} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
};

const STATUS_META: Record<DeviceStatus, { label: string; cls: string }> = {
  approved: { label: 'معتمد', cls: 'bg-green-100 text-green-800 border-green-200' },
  pending: { label: 'بانتظار الموافقة', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  blocked: { label: 'محظور', cls: 'bg-red-100 text-red-800 border-red-200' }
};

export const SystemAdmin: React.FC = () => {
  const { users, currentUser } = useERP();
  const [devices, setDevices] = useState<DeviceDoc[]>([]);
  const [enforce, setEnforce] = useState(false);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [confirmEnforce, setConfirmEnforce] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; text: string } | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    const u1 = onSnapshot(collection(db, DEVICES_COLLECTION), (snap: any) => {
      setDevices(snap.docs.map((d: any) => ({ ...(d.data() as DeviceDoc), id: d.id })).filter((d: DeviceDoc) => d.userId !== undefined && d.status));
      setLoading(false);
    }, () => { setErr('تعذر تحميل الأجهزة. تأكد من الاتصال بالإنترنت.'); setLoading(false); });
    const u2 = onSnapshot(doc(db, SECURITY_DOC[0], SECURITY_DOC[1]), (s: any) => setEnforce(s.exists() ? !!s.data().enforce : false), () => {});
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => { u1(); u2(); clearInterval(t); };
  }, []);

  const myId = useMemo(() => (currentUser ? deviceDocId(String(currentUser.id ?? currentUser.username)) : ''), [currentUser]);

  const online = useMemo(() => devices.filter(d => isOnlineNow(d, now)).sort((a, b) => b.lastSeen - a.lastSeen), [devices, now]);
  const onlineUsers = useMemo(() => new Set(online.map(d => d.username)).size, [online]);
  const pending = useMemo(() => devices.filter(d => d.status === 'pending').sort((a, b) => b.firstSeen - a.firstSeen), [devices]);
  const approvedCount = devices.filter(d => d.status === 'approved').length;

  const byUser = useMemo(() => {
    const m = new Map<string, { key: string; name: string; list: DeviceDoc[] }>();
    users.forEach((u: any) => { const k = String(u.username); m.set(k, { key: k, name: u.fullName || u.username, list: [] }); });
    devices.forEach(d => {
      const k = d.username;
      if (!m.has(k)) m.set(k, { key: k, name: d.userName || k, list: [] });
      m.get(k)!.list.push(d);
    });
    return Array.from(m.values()).sort((a, b) => b.list.length - a.list.length || a.name.localeCompare(b.name, 'ar'));
  }, [users, devices]);

  const neverSeen = byUser.filter(u => u.list.length === 0 && u.key !== 'admin');

  const run = async (fn: () => Promise<any>) => {
    setErr('');
    try { await fn(); } catch (e: any) { setErr('تعذر تنفيذ العملية: ' + (e?.message || '')); }
  };
  const setStatus = (d: DeviceDoc, status: DeviceStatus) => run(() => updateDoc(doc(db, DEVICES_COLLECTION, d.id), { status, online: status === 'blocked' ? false : d.online }));
  const removeDevice = (d: DeviceDoc) => run(async () => { await deleteDoc(doc(db, DEVICES_COLLECTION, d.id)); setConfirmDeleteId(null); });
  const saveName = () => { if (!renaming) return; const r = renaming; setRenaming(null); const text = r.text.trim(); if (text) run(() => updateDoc(doc(db, DEVICES_COLLECTION, r.id), { deviceName: text })); };
  const toggleEnforce = (value: boolean) => run(async () => { await setDoc(doc(db, SECURITY_DOC[0], SECURITY_DOC[1]), { enforce: value }, { merge: true }); setConfirmEnforce(false); });

  const card = 'bg-white rounded-2xl shadow-sm border border-gray-100 p-4';

  const DeviceRow: React.FC<{ d: DeviceDoc }> = ({ d }) => {
    const on = isOnlineNow(d, now);
    const mine = d.id === myId;
    return (
      <div className="flex flex-wrap items-center gap-2 py-2 border-t border-gray-100 first:border-t-0">
        <span className={`w-2.5 h-2.5 rounded-full ${on ? 'bg-green-500' : 'bg-gray-300'}`} title={on ? 'مفتوح الآن' : 'غير متصل'} />
        <div className="flex-1 min-w-[160px]">
          {renaming?.id === d.id ? (
            <input autoFocus value={renaming.text} onChange={e => setRenaming({ id: d.id, text: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setRenaming(null); }}
              onBlur={saveName} className="border border-gray-300 rounded px-2 py-1 text-sm w-full" />
          ) : (
            <div className="font-bold text-sm text-gray-800">{d.deviceName || d.platform}{mine && <span className="mr-2 text-[10px] text-brand-600 font-normal">(هذا الجهاز)</span>}</div>
          )}
          <div className="text-[11px] text-gray-500">أول ظهور: {fmtDT(d.firstSeen)} • آخر ظهور: {fmtDT(d.lastSeen)}</div>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${STATUS_META[d.status].cls}`}>{STATUS_META[d.status].label}</span>
        <div className="flex items-center gap-1">
          {d.status !== 'approved' && <button onClick={() => setStatus(d, 'approved')} className="p-1.5 rounded bg-green-50 text-green-700 hover:bg-green-100" title="اعتماد"><Check size={16} /></button>}
          {d.status !== 'blocked' && <button onClick={() => setStatus(d, 'blocked')} className="p-1.5 rounded bg-red-50 text-red-700 hover:bg-red-100" title="حظر"><X size={16} /></button>}
          <button onClick={() => setRenaming({ id: d.id, text: d.deviceName || '' })} className="p-1.5 rounded bg-gray-50 text-gray-600 hover:bg-gray-100" title="تغيير الاسم"><Pencil size={16} /></button>
          {confirmDeleteId === d.id ? (
            <button onClick={() => removeDevice(d)} className="px-2 py-1 rounded bg-red-600 text-white text-xs font-bold">تأكيد الحذف</button>
          ) : (
            <button onClick={() => setConfirmDeleteId(d.id)} className="p-1.5 rounded bg-gray-50 text-gray-600 hover:bg-gray-100" title="حذف الجهاز (يُسجَّل خروجه ويحتاج موافقة من جديد)"><Trash2 size={16} /></button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 animate-fade-in pb-24">
      <div className={card}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl"><MonitorSmartphone size={22} /></div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">إدارة السيستم</h2>
            <p className="text-xs text-gray-500">التحكم في الأجهزة المسموح لها بفتح الحسابات، ومتابعة المتصل الآن (للمدير فقط)</p>
          </div>
        </div>
        {err && <div className="mt-3 text-sm text-red-600 bg-red-50 p-2 rounded">{err}</div>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className={card}><div className="text-xs text-gray-500 flex items-center gap-1"><Wifi size={14} /> أجهزة مفتوحة الآن</div><div className="text-2xl font-bold text-green-700 mt-1">{online.length}</div></div>
        <div className={card}><div className="text-xs text-gray-500 flex items-center gap-1"><UsersIcon size={14} /> حسابات متصلة الآن</div><div className="text-2xl font-bold text-blue-700 mt-1">{onlineUsers}</div></div>
        <div className={card}><div className="text-xs text-gray-500 flex items-center gap-1"><Clock size={14} /> طلبات بانتظار الموافقة</div><div className={`text-2xl font-bold mt-1 ${pending.length ? 'text-amber-600' : 'text-gray-700'}`}>{pending.length}</div></div>
        <div className={card}><div className="text-xs text-gray-500 flex items-center gap-1"><ShieldCheck size={14} /> أجهزة معتمدة</div><div className="text-2xl font-bold text-gray-800 mt-1">{approvedCount}</div></div>
      </div>

      <div className={`${card} ${enforce ? 'border-green-300' : 'border-amber-300'}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            {enforce ? <ShieldCheck className="text-green-600 mt-1" /> : <ShieldAlert className="text-amber-600 mt-1" />}
            <div>
              <div className="font-bold text-gray-800">حماية الأجهزة: {enforce ? 'مفعّلة' : 'غير مفعّلة (وضع التعلّم)'}</div>
              <p className="text-xs text-gray-600 mt-0.5 max-w-xl">
                {enforce
                  ? 'أي جهاز جديد يدخل منه موظف يظهر هنا كطلب، ولا يدخل إلا بعد موافقتك. المدير غير مقيّد بالأجهزة.'
                  : 'الأجهزة التي يدخل منها الموظفون الآن تُسجَّل وتُعتمد تلقائياً. بعد أن يدخل كل موظف مرة من كل جهاز يستخدمه، فعّل الحماية.'}
              </p>
              {!enforce && neverSeen.length > 0 && (
                <p className="text-xs text-amber-700 mt-1">لم يدخل بعد: {neverSeen.map(u => u.name).join('، ')}</p>
              )}
            </div>
          </div>
          {confirmEnforce ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">{enforce ? 'إيقاف الحماية؟' : 'الأجهزة غير المسجلة ستُرفض. متأكد؟'}</span>
              <button onClick={() => toggleEnforce(!enforce)} className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-sm font-bold">تأكيد</button>
              <button onClick={() => setConfirmEnforce(false)} className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-sm">إلغاء</button>
            </div>
          ) : (
            <button onClick={() => setConfirmEnforce(true)} className={`px-4 py-2 rounded-lg text-sm font-bold ${enforce ? 'bg-gray-100 text-gray-700' : 'bg-green-600 text-white'}`}>
              {enforce ? 'إيقاف الحماية' : 'تفعيل الحماية'}
            </button>
          )}
        </div>
      </div>

      {pending.length > 0 && (
        <div className={`${card} border-amber-300`}>
          <h3 className="font-bold text-amber-800 mb-1">طلبات بانتظار موافقتك ({pending.length})</h3>
          {pending.map(d => (
            <div key={d.id} className="flex flex-wrap items-center gap-2 py-2 border-t border-amber-100 first:border-t-0">
              <div className="flex-1 min-w-[180px]">
                <div className="font-bold text-sm">{d.userName || d.username} <span className="text-xs text-gray-500 font-normal">({d.username})</span></div>
                <div className="text-[11px] text-gray-500">{d.deviceName} • طُلب في {fmtDT(d.firstSeen)}</div>
              </div>
              <button onClick={() => setStatus(d, 'approved')} className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-bold flex items-center gap-1"><Check size={14} /> موافقة</button>
              <button onClick={() => setStatus(d, 'blocked')} className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-sm font-bold flex items-center gap-1"><X size={14} /> رفض</button>
            </div>
          ))}
        </div>
      )}

      <div className={card}>
        <h3 className="font-bold text-gray-800 mb-1">المفتوح الآن ({online.length})</h3>
        <p className="text-[11px] text-gray-500 mb-2">يُحدَّث كل دقيقة ونصف تقريباً، والجهاز يُحسب مفتوحاً لو كانت شاشته ظاهرة خلال آخر 4 دقائق.</p>
        {online.length === 0 ? <div className="text-sm text-gray-400 py-3">لا توجد أجهزة مفتوحة حالياً.</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="text-gray-500 text-xs"><tr><th className="p-2">الحساب</th><th className="p-2">الجهاز</th><th className="p-2">آخر نشاط</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {online.map(d => (
                  <tr key={d.id}><td className="p-2 font-bold">{d.userName || d.username}</td><td className="p-2">{d.deviceName}</td><td className="p-2 text-gray-500">{fmtDT(d.lastSeen)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={card}>
        <h3 className="font-bold text-gray-800 mb-2">الأجهزة حسب الحساب</h3>
        {loading ? <div className="text-sm text-gray-400">جاري التحميل...</div> : byUser.map(u => (
          <div key={u.key} className="mb-3 last:mb-0 border border-gray-100 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <div className="font-bold text-gray-800">{u.name} <span className="text-xs text-gray-500 font-normal">({u.key})</span></div>
              <span className="text-xs text-gray-500">{u.list.filter(d => d.status === 'approved').length} معتمد / {u.list.length} جهاز</span>
            </div>
            {u.list.length === 0
              ? <div className="text-xs text-gray-400 mt-1">لم يدخل من أي جهاز بعد.</div>
              : u.list.sort((a, b) => b.lastSeen - a.lastSeen).map(d => <DeviceRow key={d.id} d={d} />)}
          </div>
        ))}
      </div>
    </div>
  );
};
