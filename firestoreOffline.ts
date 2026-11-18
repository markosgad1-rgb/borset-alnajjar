// Offline-safe wrappers around Firestore writes/reads.
// While ONLINE the behaviour is unchanged: we still wait for the server reply (up to ACK_WAIT_MS).
// While OFFLINE (or on a very slow link) the write is already stored in the local persistent cache and
// queued, so we stop waiting and let the app continue; Firestore uploads it automatically when the
// connection returns. Every write is counted until the server acknowledges it.
import {
  setDoc as fsSetDoc,
  updateDoc as fsUpdateDoc,
  deleteDoc as fsDeleteDoc,
  getDoc as fsGetDoc,
  getDocFromCache
} from 'firebase/firestore';
import { ensureConnectionMonitor, isConnected, trackWrite, emitOfflineSave } from './connectionStatus';
import { captureBefore, recordWrite } from './auditLog';

ensureConnectionMonitor();

const ACK_WAIT_MS = 2500;
const WATCHED_COLLECTIONS = ['invoices', 'purchases', 'treasury'];

const settle = <T,>(p: Promise<T>, onTimeout: () => T | Promise<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    let done = false;
    // When we already know there is no connection, do not wait at all.
    const wait = isConnected() ? ACK_WAIT_MS : 0;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      Promise.resolve(onTimeout()).then(resolve, reject);
    }, wait);
    p.then(
      v => { if (!done) { done = true; clearTimeout(timer); resolve(v); } },
      err => {
        if (!done) { done = true; clearTimeout(timer); reject(err); }
        else console.warn('Background sync error:', err);
      }
    );
  });

const notifyIfSavedOffline = (ref: any) => {
  try {
    if (isConnected()) return;
    const name = String(ref?.path || '').split('/')[0];
    if (WATCHED_COLLECTIONS.includes(name)) emitOfflineSave(name);
  } catch { /* never block a save because of a notification */ }
};

const write = (p: Promise<void>, ref: any): Promise<void> => {
  trackWrite(p);
  notifyIfSavedOffline(ref);
  return settle<void>(p, () => undefined);
};

export const setDoc = ((ref: any, data: any, options?: any) => {
  const before = captureBefore(ref);   // reads the local cache BEFORE the write is queued
  const p = options ? fsSetDoc(ref, data, options) : fsSetDoc(ref, data);
  recordWrite('set', ref, data, before);
  return write(p, ref);
}) as typeof fsSetDoc;

export const updateDoc = ((ref: any, ...rest: any[]) => {
  const before = captureBefore(ref);
  const p = (fsUpdateDoc as any)(ref, ...rest);
  recordWrite('update', ref, rest, before);
  return write(p, ref);
}) as typeof fsUpdateDoc;

export const deleteDoc = ((ref: any) => {
  const before = captureBefore(ref);
  const p = fsDeleteDoc(ref);
  recordWrite('delete', ref, undefined, before);
  return write(p, ref);
}) as typeof fsDeleteDoc;

// Reads: if the server does not answer quickly, serve the local cache (which already contains pending local writes).
export const getDoc = ((ref: any) =>
  settle<any>(fsGetDoc(ref), () => getDocFromCache(ref))) as typeof fsGetDoc;
