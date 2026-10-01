import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button.jsx';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function useOverlayBehaviour(onClose) {
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previousFocus = document.activeElement;
    const firstField = panelRef.current?.querySelector(
      'input:not([type="hidden"]), select, textarea',
    );
    (firstField ?? panelRef.current?.querySelector(FOCUSABLE))?.focus();
    function closeOnEscape(event) {
      if (event.key === 'Escape') {
        closeRef.current();
      }
    }
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      previousFocus?.focus?.();
    };
  }, []);

  return panelRef;
}

function CloseButton({ onClose }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close"
      className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-tile hover:text-ink"
    >
      <X size={18} aria-hidden="true" />
    </button>
  );
}

export function Dialog({ title, description, onClose, children, footer, wide = false }) {
  const titleId = useId();
  const panelRef = useOverlayBehaviour(onClose);
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative flex max-h-[90vh] w-full animate-fade-in flex-col rounded-panel border border-line bg-surface shadow-float ${
          wide ? 'max-w-3xl' : 'max-w-lg'
        }`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          <CloseButton onClose={onClose} />
        </header>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4">
            {footer}
          </footer>
        )}
      </section>
    </div>,
    document.body,
  );
}

export function Drawer({ title, subtitle, onClose, children }) {
  const titleId = useId();
  const panelRef = useOverlayBehaviour(onClose);
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-full w-full max-w-md animate-fade-in flex-col border-l border-line bg-surface"
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 id={titleId} className="numeric text-lg font-semibold">
              {title}
            </h2>
            {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          </div>
          <CloseButton onClose={onClose} />
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </aside>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  destructive = false,
  isPending = false,
  error,
  onConfirm,
  onClose,
}) {
  return (
    <Dialog
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className={destructive ? 'bg-danger text-white hover:brightness-95' : ''}
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? 'Working…' : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm text-muted">
        {children}
        <ErrorNote error={error} />
      </div>
    </Dialog>
  );
}

export function ErrorNote({ error }) {
  if (!error) {
    return null;
  }
  return (
    <p role="alert" className="rounded-control bg-soft-danger px-3 py-2 text-sm text-danger">
      {error.message}
    </p>
  );
}
