import { Check, Copy, KeyRound } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/Button.jsx';
import { formatDate, formatEuro } from '../../lib/format.js';
import { slotLabel } from '../gate/gate-flow.js';

export function PinReveal({ preAdvice, onDone }) {
  const [copied, setCopied] = useState(false);

  async function copyPin() {
    try {
      await navigator.clipboard.writeText(preAdvice.pin);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-5 text-center" role="status">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-tile bg-soft-accent text-accent-text">
        <KeyRound size={22} aria-hidden="true" />
      </span>
      <div>
        <p className="text-sm text-muted">PIN for {preAdvice.reference}</p>
        <p
          className="numeric mt-2 text-[44px] font-medium tracking-[0.25em]"
          aria-label={`PIN ${preAdvice.pin.split('').join(' ')}`}
        >
          {preAdvice.pin}
        </p>
      </div>
      <Button variant="secondary" onClick={copyPin} className="w-full">
        {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
        {copied ? 'Copied' : 'Copy PIN'}
      </Button>
      <p className="rounded-tile bg-soft-warn px-4 py-3 text-sm text-warn">
        This PIN is shown only once. Give it to the driver now. If it gets lost, create a new PIN
        from your slots.
      </p>
      <dl className="grid w-full grid-cols-2 gap-3 rounded-tile bg-tile p-4 text-left text-sm">
        <div>
          <dt className="text-xs text-muted">Slot</dt>
          <dd className="numeric">
            {formatDate(preAdvice.timeSlot.startsAt)} · {slotLabel(preAdvice.timeSlot)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Truck</dt>
          <dd className="numeric">{preAdvice.truckPlate}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Container</dt>
          <dd className="numeric">{preAdvice.displayNumber}</dd>
        </div>
        {preAdvice.invoice && (
          <div>
            <dt className="text-xs text-muted">Storage invoice</dt>
            <dd className="numeric">
              {formatEuro(preAdvice.invoice.amountCents)} ·{' '}
              {preAdvice.invoice.status === 'PAID' ? 'paid' : 'to pay'}
            </dd>
          </div>
        )}
      </dl>
      <Button size="large" className="w-full" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}
