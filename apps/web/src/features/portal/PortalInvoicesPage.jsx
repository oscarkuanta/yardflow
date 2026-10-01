import { FileText, Receipt } from 'lucide-react';
import { useState } from 'react';
import { ButtonLink } from '../../components/Button.jsx';
import { EmptyState } from '../../components/EmptyState.jsx';
import { SegmentedControl } from '../../components/Layout.jsx';
import { Skeleton } from '../../components/Skeleton.jsx';
import { StatusChip } from '../../components/StatusChip.jsx';
import { formatDate, formatEuro, titleCase } from '../../lib/format.js';
import { INVOICE_STATUS_TONES } from '../billing/invoices-api.js';
import { useMyInvoices } from './portal-api.js';

export function openAmountCents(invoices) {
  return invoices
    .filter((invoice) => invoice.status === 'UNPAID')
    .reduce((sum, invoice) => sum + invoice.amountCents, 0);
}

function InvoiceCard({ invoice }) {
  return (
    <li className="panel flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="numeric text-sm font-semibold">{invoice.number}</p>
          <p className="numeric text-xs text-muted">{invoice.displayNumber}</p>
        </div>
        <StatusChip label={titleCase(invoice.status)} tone={INVOICE_STATUS_TONES[invoice.status]} />
      </div>
      <div className="flex items-end justify-between gap-3">
        <p className="text-xs text-muted">
          {formatDate(invoice.periodFrom)} – {formatDate(invoice.periodTo)}
          <br />
          {invoice.chargeableDays} of {invoice.days} days charged · {invoice.freeDays} free
        </p>
        <p className="numeric text-xl">{formatEuro(invoice.amountCents)}</p>
      </div>
      <ButtonLink href={invoice.pdfUrl} target="_blank" rel="noreferrer" variant="secondary">
        <FileText size={16} aria-hidden="true" />
        Download PDF
      </ButtonLink>
    </li>
  );
}

export function PortalInvoicesPage() {
  const [status, setStatus] = useState('UNPAID');
  const { data, isPending } = useMyInvoices({ status });
  const unpaid = useMyInvoices({ status: 'UNPAID' }).data?.data ?? [];
  const invoices = data?.data ?? [];
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Invoices</h2>
      <section className="panel flex flex-col gap-1 p-4" aria-label="Open amount">
        <p className="text-xs text-muted">Open amount</p>
        <p className="numeric text-4xl font-medium">{formatEuro(openAmountCents(unpaid))}</p>
        <p className="text-xs text-muted">
          Pay by bank transfer with the invoice number. The terminal marks the invoice paid, and you
          get an alert.
        </p>
      </section>
      <SegmentedControl
        label="Invoice status"
        options={[
          { value: 'UNPAID', label: 'To pay' },
          { value: 'PAID', label: 'Paid' },
          { value: '', label: 'All' },
        ]}
        value={status}
        onChange={setStatus}
        className="self-start"
      />
      {isPending && [0, 1].map((index) => <Skeleton key={index} className="h-36 rounded-panel" />)}
      {!isPending && invoices.length === 0 && (
        <div className="panel">
          <EmptyState icon={Receipt} title="No invoices here">
            A storage invoice is issued when you book a pickup.
          </EmptyState>
        </div>
      )}
      <ul className="flex flex-col gap-2" aria-label="Invoices">
        {invoices.map((invoice) => (
          <InvoiceCard key={invoice.id} invoice={invoice} />
        ))}
      </ul>
    </div>
  );
}
