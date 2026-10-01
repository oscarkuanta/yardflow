import { Download, FileText, Receipt } from 'lucide-react';
import { useState } from 'react';
import { Button, ButtonLink } from '../../components/Button.jsx';
import { DataTable, Pagination } from '../../components/DataTable.jsx';
import { EmptyState } from '../../components/EmptyState.jsx';
import { PageHeader, Panel, SegmentedControl } from '../../components/Layout.jsx';
import { ConfirmDialog } from '../../components/Overlay.jsx';
import { StatusChip } from '../../components/StatusChip.jsx';
import { TextField } from '../../components/TextField.jsx';
import { API_BASE, queryString } from '../../lib/api.js';
import { formatDate, formatEuro, titleCase } from '../../lib/format.js';
import { INVOICE_STATUS_TONES, useInvoices, useMarkInvoicePaid } from './invoices-api.js';

const PAGE_SIZE = 25;

export function BillingPage() {
  const [status, setStatus] = useState('UNPAID');
  const [companyCode, setCompanyCode] = useState('');
  const [page, setPage] = useState(1);
  const [paying, setPaying] = useState(null);
  const filters = { status, companyCode: companyCode.length === 3 ? companyCode : '' };
  const { data, isPending } = useInvoices({ ...filters, page, pageSize: PAGE_SIZE });
  const markPaid = useMarkInvoicePaid({ onSuccess: () => setPaying(null) });

  const columns = [
    {
      key: 'number',
      header: 'Invoice',
      render: (invoice) => <span className="numeric">{invoice.number}</span>,
    },
    { key: 'company', header: 'Company', render: (invoice) => invoice.company.name },
    {
      key: 'container',
      header: 'Container',
      render: (invoice) => <span className="numeric">{invoice.displayNumber}</span>,
    },
    {
      key: 'period',
      header: 'Period',
      wrap: true,
      render: (invoice) => (
        <span className="text-muted">
          {formatDate(invoice.periodFrom)} – {formatDate(invoice.periodTo)} ·{' '}
          {invoice.chargeableDays} of {invoice.days} days
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      className: 'text-right',
      render: (invoice) => <span className="numeric">{formatEuro(invoice.amountCents)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (invoice) => (
        <StatusChip label={titleCase(invoice.status)} tone={INVOICE_STATUS_TONES[invoice.status]} />
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      render: (invoice) => (
        <span className="flex justify-end gap-2">
          <ButtonLink
            href={invoice.pdfUrl}
            target="_blank"
            rel="noreferrer"
            variant="secondary"
            className="min-h-10 px-3"
            aria-label={`PDF of ${invoice.number}`}
          >
            <FileText size={16} aria-hidden="true" />
          </ButtonLink>
          {invoice.status === 'UNPAID' && (
            <Button className="min-h-10 px-3" onClick={() => setPaying(invoice)}>
              Mark paid
            </Button>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Billing"
        description="Storage invoices. A pickup can only leave when its invoice is paid."
        actions={
          <ButtonLink
            variant="secondary"
            href={`${API_BASE}/exports/invoices.csv${queryString(filters)}`}
          >
            <Download size={16} aria-hidden="true" />
            Export CSV
          </ButtonLink>
        }
      />
      <Panel
        title={
          <SegmentedControl
            label="Status"
            options={[
              { value: 'UNPAID', label: 'Unpaid' },
              { value: 'PAID', label: 'Paid' },
              { value: 'VOID', label: 'Void' },
              { value: '', label: 'All' },
            ]}
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          />
        }
        actions={
          <TextField
            label="Company code"
            value={companyCode}
            onChange={(event) => {
              setCompanyCode(event.target.value.toUpperCase().slice(0, 3));
              setPage(1);
            }}
            inputClassName="numeric w-28"
            placeholder="HNF"
          />
        }
      >
        <DataTable
          label="Invoices"
          columns={columns}
          rows={data?.data ?? []}
          rowKey={(invoice) => invoice.id}
          isPending={isPending}
          empty={
            <EmptyState icon={Receipt} title="No invoices here">
              Invoices are created when a pickup is checked at the gate.
            </EmptyState>
          }
        />
        {data && (
          <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={setPage} />
        )}
      </Panel>
      {paying && (
        <ConfirmDialog
          title={`Mark ${paying.number} as paid?`}
          confirmLabel="Mark paid"
          isPending={markPaid.isPending}
          error={markPaid.error}
          onConfirm={() => markPaid.mutate(paying)}
          onClose={() => setPaying(null)}
        >
          {formatEuro(paying.amountCents)} from {paying.company.name}. The customer is notified.
        </ConfirmDialog>
      )}
    </div>
  );
}
