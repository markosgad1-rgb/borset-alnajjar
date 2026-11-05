import { useEffect, useRef } from 'react';

/**
 * Mobile Hardware & Gesture Back Navigation Manager
 * 
 * Provides robust browser history integration (window.history.pushState / popstate):
 * 1. Modals & Overlays: closes topmost modal without leaving the page
 * 2. Master-Detail Subviews: returns from item details (e.g. statement) to list
 * 3. General Pages: returns back to Dashboard
 * 4. Dashboard (Home): allows natural browser exit without interception
 */

type BackHandler = () => void;

interface StackItem {
  id: string;
  handler: BackHandler;
}

// Global LIFO stack for modals and sub-views
const handlersStack: StackItem[] = [];
let isProgrammaticPop = false;
let isExecutingPopstate = false;

/**
 * Register a back handler for a modal, drawer, or sub-view.
 * Automatically pushes an entry into window.history.
 */
export function registerBackHandler(id: string, handler: BackHandler): () => void {
  // If already registered with this ID, update handler reference
  const existingIdx = handlersStack.findIndex(item => item.id === id);
  if (existingIdx !== -1) {
    handlersStack[existingIdx].handler = handler;
    return () => unregisterBackHandler(id);
  }

  // Push an overlay state to browser history
  try {
    window.history.pushState({ isBackHandler: true, id }, '');
  } catch (err) {
    console.warn('Could not pushState for backHandler:', err);
  }

  handlersStack.push({ id, handler });

  return () => unregisterBackHandler(id);
}

/**
 * Unregister a back handler.
 * If closed via UI (close button, backdrop, submit), unwinds the history entry.
 */
export function unregisterBackHandler(id: string) {
  const index = handlersStack.findIndex(item => item.id === id);
  if (index === -1) return;

  const isTop = index === handlersStack.length - 1;
  handlersStack.splice(index, 1);

  // If this was the top item and wasn't closed by popstate, rewind history
  if (isTop && !isExecutingPopstate) {
    isProgrammaticPop = true;
    try {
      window.history.back();
    } catch (err) {
      console.warn('Could not rewind history:', err);
    }
  }
}

/**
 * React hook to automatically bind a back handler to a component's open state.
 */
export function useBackHandler(handler: () => void, isActive: boolean, id?: string) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const idRef = useRef<string>(id || `back_${Math.random().toString(36).substring(2, 9)}`);

  useEffect(() => {
    if (!isActive) return;

    const currentId = idRef.current;
    registerBackHandler(currentId, () => {
      handlerRef.current();
    });

    return () => {
      unregisterBackHandler(currentId);
    };
  }, [isActive]);
}

/**
 * Clear all registered modal/subview handlers (e.g. on full page switch)
 */
export function clearAllBackHandlers() {
  handlersStack.length = 0;
  isProgrammaticPop = false;
  isExecutingPopstate = false;
}

/**
 * Initialize global popstate listener for the entire app.
 * Returns cleanup function.
 */
export function setupBackNavigation(onFallbackBack: () => void): () => void {
  const handlePopState = () => {
    // If triggered programmatically by unregisterBackHandler, ignore
    if (isProgrammaticPop) {
      isProgrammaticPop = false;
      return;
    }

    // 1. If an overlay/modal/sub-view is active, execute its close handler
    if (handlersStack.length > 0) {
      const top = handlersStack.pop();
      if (top) {
        isExecutingPopstate = true;
        try {
          top.handler();
        } catch (err) {
          console.error('Error executing back handler:', err);
        } finally {
          isExecutingPopstate = false;
        }
      }
      return;
    }

    // 2. Delegate to page-level fallback (e.g. return to Dashboard)
    onFallbackBack();
  };

  window.addEventListener('popstate', handlePopState);
  return () => {
    window.removeEventListener('popstate', handlePopState);
  };
}
