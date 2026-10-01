import { CircleAlert, CircleCheck } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

export const TOAST_DURATION_MS = 5000;

const ToastContext = createContext({ showToast: () => {} });

const TONE_STYLES = {
  success: { icon: CircleCheck, className: 'text-accent-text' },
  error: { icon: CircleAlert, className: 'text-danger' },
};

function Toast({ toast }) {
  const { icon: Icon, className } = TONE_STYLES[toast.tone];
  return (
    <li className="glass flex items-start gap-3 px-4 py-3 text-sm shadow-float animate-fade-in">
      <Icon size={18} className={`mt-0.5 shrink-0 ${className}`} aria-hidden="true" />
      <span>{toast.message}</span>
    </li>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const showToast = useCallback((message, tone = 'success') => {
    const id = nextId.current;
    nextId.current += 1;
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, TOAST_DURATION_MS);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ul
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(380px,calc(100%-2rem))] flex-col gap-2"
      >
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} />
        ))}
      </ul>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
