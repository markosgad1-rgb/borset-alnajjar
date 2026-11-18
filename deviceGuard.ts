// Device control: every account must log in from a device the admin has approved (when protection is ON).
// A "device" is one browser profile / installed app on one machine. It is identified by a random id
// stored in that browser (browsers cannot read a MAC address). Clearing browser data = a new device.
// Documents live in the Firestore collection "devices", one per (user, device) pair.
// Also keeps a heartbeat so the admin can see which devices are open right now.
import { doc, updateDoc as fsUpdateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { getDoc, setDoc } from './firestoreOffline';
import { isConnected } from './connectionStatus';

export const DEVICES_COLLECTION = 'devices';
export const SECURITY_DOC = ['settings', 'security'] as const;
export const HEARTBEAT_MS = 90 * 1000;
export const ONLINE_WINDOW_MS = 4 * 60 * 1000;

export type DeviceStatus = 'approved' | 'pending' | 'blocked';

export interface DeviceDoc {
  id: string;
  uid: string;
  userId: string;
  username: string;
  userName: string;
  role: string;
  deviceName: string;
  platform: string;
  status: DeviceStatus;
  firstSeen: number;
  lastSeen: number;
  lastLogin: number;
  online?: boolean;
}

export const isExemptUser = (u: any) => !!u && (u.username === 'admin' || u.role === 'ADMIN');

export const getDeviceUid = (): string => {
  try {
    let id = localStorage.getItem('erp_device_uid');
    if (!id) {
      id = (typeof crypto !== 'undefined' && (crypto as any).randomUUID)
        ? (crypto as any).randomUUID()
        : 'd' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('erp_device_uid', id as string);
    }
    return id as string;
  } catch { return 'unknown-device'; }
};

export const describeDevice = (): { platform: string; browser: string } => {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  const platform = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iPhone/iPad'
    : /Windows/i.test(ua) ? 'Windows' : /Mac/i.test(ua) ? 'Mac' : /Linux/i.test(ua) ? 'Linux' : 'جهاز';
  const browser = /Edg\//i.test(ua) ? 'Edge' : /OPR\//i.test(ua) ? 'Opera' : /Chrome\//i.test(ua) ? 'Chrome'
    : /Firefox\//i.test(ua) ? 'Firefox' : /Safari\//i.test(ua) ? 'Safari' : '';
  return { platform, browser };
};

const safe = (s: string) => String(s).replace(/[\/\s]/g, '_');
export const deviceDocId = (userId: string, uid = getDeviceUid()) => `${safe(userId)}__${safe(uid)}`;
const okFlag = (id: string) => `erp_dev_ok_${id}`;

const readEnforce = async (): Promise<boolean | undefined> => {
  try {
    const s: any = await getDoc(doc(db, SECURITY_DOC[0], SECURITY_DOC[1]));
    return s.exists() ? !!s.data().enforce : false;
  } catch { return undefined; }
};

export interface CheckResult { allowed: boolean; message?: string; status?: DeviceStatus }

const verified = new Set<string>();

export const checkDevice = async (user: any, opts: { strict: boolean }): Promise<CheckResult> => {
  try {
    if (!user) return { allowed: false };
    const id = deviceDocId(String(user.id ?? user.username));
    const exempt = isExemptUser(user);
    const ref = doc(db, DEVICES_COLLECTION, id);

    let existing: any = undefined;   // undefined = could not read, null = does not exist
    try { const s: any = await getDoc(ref); existing = s.exists() ? s.data() : null; } catch { existing = undefined; }
    const enforce = await readEnforce();

    if (existing === undefined || enforce === undefined) {
      // cannot reach the server and nothing in the local cache
      let known = false;
      try { known = localStorage.getItem(okFlag(id)) === '1'; } catch { /* ignore */ }
      if (known || exempt || !opts.strict) return { allowed: true };
      return { allowed: false, message: 'تعذّر التحقق من الجهاز بدون اتصال بالإنترنت. اتصل بالإنترنت ثم حاول مرة أخرى.' };
    }

    const now = Date.now();
    const { platform, browser } = describeDevice();

    if (existing && existing.status === 'blocked' && !exempt) {
      return { allowed: false, status: 'blocked', message: 'هذا الجهاز محظور من قِبل المدير. تواصل مع المدير.' };
    }

    if (!existing) {
      const status: DeviceStatus = (exempt || !enforce) ? 'approved' : 'pending';
      const d: DeviceDoc = {
        id, uid: getDeviceUid(), userId: String(user.id ?? ''), username: String(user.username ?? ''),
        userName: String(user.fullName || user.name || user.username || ''), role: String(user.role ?? ''),
        deviceName: `${platform}${browser ? ' - ' + browser : ''}`, platform, status,
        firstSeen: now, lastSeen: now, lastLogin: now
      };
      await setDoc(ref, d as any);
      if (status === 'pending') {
        return { allowed: false, status, message: 'هذا جهاز جديد. تم إرسال طلب للمدير، وبعد موافقته يمكنك الدخول.' };
      }
      try { localStorage.setItem(okFlag(id), '1'); } catch { /* ignore */ }
      verified.add(id);
      return { allowed: true, status };
    }

    if (existing.status === 'pending' && enforce && !exempt) {
      return { allowed: false, status: 'pending', message: 'هذا الجهاز في انتظار موافقة المدير.' };
    }

    // allowed: approved (or pending while protection is OFF)
    if (!verified.has(id)) {
      fsUpdateDoc(ref, { lastLogin: now, lastSeen: now, userName: String(user.fullName || user.name || user.username || ''), role: String(user.role ?? '') }).catch(() => {});
      verified.add(id);
    }
    try { localStorage.setItem(okFlag(id), '1'); } catch { /* ignore */ }
    return { allowed: true, status: existing.status };
  } catch {
    // never lock people out because of an unexpected error while restoring a session
    return opts.strict ? { allowed: false, message: 'تعذّر التحقق من الجهاز. حاول مرة أخرى.' } : { allowed: true };
  }
};

// Called while someone is signed in: if the admin blocks or removes this device, sign out at once.
export const watchDevice = (user: any, onRevoked: (msg: string) => void): (() => void) => {
  if (!user || isExemptUser(user)) return () => {};
  try {
    const ref = doc(db, DEVICES_COLLECTION, deviceDocId(String(user.id ?? user.username)));
    return onSnapshot(ref, (snap: any) => {
      if (snap.exists()) {
        if (snap.data().status === 'blocked') onRevoked('تم حظر هذا الجهاز من قِبل المدير.');
      } else if (!snap.metadata.fromCache) {
        onRevoked('تم حذف تصريح هذا الجهاز من قِبل المدير.');
      }
    }, () => {});
  } catch { return () => {}; }
};

export const startHeartbeat = (user: any): (() => void) => {
  if (!user) return () => {};
  const ref = doc(db, DEVICES_COLLECTION, deviceDocId(String(user.id ?? user.username)));
  const beat = (online = true) => {
    try {
      if (online && (document.visibilityState === 'hidden' || !isConnected())) return;
      fsUpdateDoc(ref, { lastSeen: Date.now(), online }).catch(() => {});
    } catch { /* ignore */ }
  };
  beat();
  const t = setInterval(() => beat(), HEARTBEAT_MS);
  const vis = () => { if (document.visibilityState === 'visible') beat(); };
  document.addEventListener('visibilitychange', vis);
  return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); beat(false); };
};

export const isOnlineNow = (d: Partial<DeviceDoc>, now = Date.now()) =>
  !!d.online && !!d.lastSeen && now - Number(d.lastSeen) < ONLINE_WINDOW_MS;
