import React, { useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';

/**
 * بديل لـ window.confirm / window.alert.
 * المتصفح بيحجب النوافذي دي جوه iframe (زي معاينة AI Studio) فالزرار كان "مش بيعمل حاجة".
 * الاستخدام:
 *   const { confirm, notify, dialog } = useDialog();
 *   if (!(await confirm('متأكد؟'))) return;
 *   notify('تم الحذف');
 *   ... وحط {dialog} مرة واحدة جوه الـ JSX
 */
export const useDialog = () => {
  const [state, setState] = useState<{ kind: 'confirm' | 'notify'; message: string } | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((message: string) => {
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setState({ kind: 'confirm', message });
    });
  }, []);

  const notify = useCallback((message: string) => {
    setState({ kind: 'notify', message });
  }, []);

  const close = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setState(null);
  };

  const dialog = state
    ? createPortal(
        <div
          dir="rtl"
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => { e.stopPropagation(); if (state.kind === 'notify') close(true); }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center gap-2 px-4 py-3 text-white font-bold ${state.kind === 'confirm' ? 'bg-red-600' : 'bg-brand-600'}`}>
              {state.kind === 'confirm' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
              <span className="flex-1">{state.kind === 'confirm' ? 'تأكيد الحذف' : 'تنبيه'}</span>
              <button type="button" onClick={() => close(false)} className="hover:bg-black/20 rounded-full p-1"><X size={16} /></button>
            </div>
            <div className="p-4 text-sm text-gray-800 whitespace-pre-line leading-relaxed">{state.message}</div>
            <div className="flex justify-end gap-2 px-4 pb-4">
              {state.kind === 'confirm' ? (
                <>
                  <button type="button" onClick={() => close(false)} className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 font-bold text-sm">إلغاء</button>
                  <button type="button" onClick={() => close(true)} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-sm">نعم، احذف</button>
                </>
              ) : (
                <button type="button" onClick={() => close(true)} className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm">حسناً</button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return { confirm, notify, dialog };
};
