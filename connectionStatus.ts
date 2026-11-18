// Real connection state for the ERP (used by the online/offline indicator, invoice numbering and the
// offline write helpers). "Connected" means: the browser has a network AND Firestore can reach the server.
import { onSnapshot, doc, waitForPendingWrites } from 'firebase/firestore';
import { db } from '../firebaseConfig';

type Listener = () => void;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach(l => l());

let navOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
let serverOk = true;            // optimistic until Firestore says otherwise
let pendingWrites = 0;          // writes sent in this session and not yet acknowledged by the server
let startupPending = false;     // writes left over from a previous session, still waiting to upload
let persistenceOk = true;       // false => this browser cannot keep unsynced data across restarts
let started = false;
let serverTimer: any = null;

export const subscribeConnection = (l: Listener) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const isConnected = () => navOnline && serverOk;
export const getPendingCount = () => pendingWrites + (startupPending ? 1 : 0);
export const isPersistenceOk = () => persistenceOk;

export const trackWrite = (p: Promise<unknown>) => {
  pendingWrites++; emit();
  const done = () => { pendingWrites = Math.max(0, pendingWrites - 1); emit(); };
  p.then(done, done);
};

// ---- "saved offline" notifications -------------------------------------------------------------
const offlineSaveListeners = new Set<(collectionName: string) => void>();
export const onOfflineSave = (l: (collectionName: string) => void) => { offlineSaveListeners.add(l); return () => { offlineSaveListeners.delete(l); }; };
export const emitOfflineSave = (collectionName: string) => offlineSaveListeners.forEach(l => l(collectionName));

const setServer = (ok: boolean) => { if (serverOk !== ok) { serverOk = ok; emit(); } };

export const ensureConnectionMonitor = () => {
  if (started || typeof window === 'undefined') return;
  started = true;

  window.addEventListener('online', () => { navOnline = true; emit(); });
  window.addEventListener('offline', () => { navOnline = false; emit(); });

  // Firestore tells us (via metadata.fromCache) whether it is really talking to the server.
  try {
    onSnapshot(doc(db, 'users', '1'), { includeMetadataChanges: true }, (snap) => {
      if (!snap.metadata.fromCache) {
        if (serverTimer) { clearTimeout(serverTimer); serverTimer = null; }
        setServer(true);
      } else if (!serverTimer) {
        // grace period: the first snapshot after page load is always served from cache
        serverTimer = setTimeout(() => { serverTimer = null; setServer(false); }, 4000);
      }
    }, () => { /* ignore listener errors: permission problems are handled elsewhere */ });
  } catch { /* ignore */ }

  // Writes left over from a previous session (saved offline, not uploaded yet)
  try {
    let resolved = false;
    waitForPendingWrites(db).then(() => { resolved = true; if (startupPending) { startupPending = false; emit(); } }).catch(() => {});
    setTimeout(() => { if (!resolved) { startupPending = true; emit(); } }, 1500);
  } catch { /* ignore */ }

  // Ask the browser not to evict our local data, and check that local storage really exists.
  try { (navigator as any).storage?.persist?.(); } catch { /* ignore */ }
  try {
    const idb: any = typeof indexedDB !== 'undefined' ? indexedDB : null;
    if (idb && typeof idb.databases === 'function') {
      setTimeout(async () => {
        try {
          const dbs: { name?: string }[] = await idb.databases();
          const has = dbs.some(d => (d.name || '').startsWith('firestore/'));
          if (!has) { persistenceOk = false; emit(); }
        } catch { /* ignore */ }
      }, 5000);
    }
  } catch { /* ignore */ }
};
