// Offline-safe wrappers around Firestore writes/reads.
// Behaviour while ONLINE is unchanged (we still wait for the server reply, up to ACK_WAIT_MS).
// While OFFLINE (or on a very slow link) the write is already applied to the local cache and queued,
// so we stop waiting and let the app continue; Firestore uploads it automatically when the net returns.
import {
  setDoc as fsSetDoc,
  updateDoc as fsUpdateDoc,
  deleteDoc as fsDeleteDoc,
  getDoc as fsGetDoc,
  getDocFromCache
} from 'firebase/firestore';

const ACK_WAIT_MS = 2500;

const settle = <T,>(p: Promise<T>, onTimeout: () => T | Promise<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      Promise.resolve(onTimeout()).then(resolve, reject);
    }, ACK_WAIT_MS);
    p.then(
      v => { if (!done) { done = true; clearTimeout(timer); resolve(v); } },
      err => {
        if (!done) { done = true; clearTimeout(timer); reject(err); }
        else console.warn('Background sync error:', err);
      }
    );
  });

export const setDoc = ((ref: any, data: any, options?: any) =>
  settle<void>(options ? fsSetDoc(ref, data, options) : fsSetDoc(ref, data), () => undefined)) as typeof fsSetDoc;

export const updateDoc = ((...args: any[]) =>
  settle<void>((fsUpdateDoc as any)(...args), () => undefined)) as typeof fsUpdateDoc;

export const deleteDoc = ((ref: any) =>
  settle<void>(fsDeleteDoc(ref), () => undefined)) as typeof fsDeleteDoc;

// Reads: if the server does not answer quickly, serve the local cache (which already contains pending local writes).
export const getDoc = ((ref: any) =>
  settle<any>(fsGetDoc(ref), () => getDocFromCache(ref))) as typeof fsGetDoc;
