import { useSyncExternalStore } from 'react';
import { subscribeConnection, isConnected, getPendingCount, isPersistenceOk } from './connectionStatus';

// true  = browser has internet AND Firestore reaches the server
// false = offline (writes are kept on this device and uploaded later)
export const useNetworkStatus = (): boolean =>
  useSyncExternalStore(subscribeConnection, isConnected, () => true);

export const usePendingWrites = (): number =>
  useSyncExternalStore(subscribeConnection, getPendingCount, () => 0);

export const usePersistenceOk = (): boolean =>
  useSyncExternalStore(subscribeConnection, isPersistenceOk, () => true);
