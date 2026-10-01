import { Download, History } from 'lucide-react';
import { useState } from 'react';
import { ButtonLink } from '../../components/Button.jsx';
import { DataTable, Pagination } from '../../components/DataTable.jsx';
import { EmptyState } from '../../components/EmptyState.jsx';
import { Panel } from '../../components/Layout.jsx';
import { Drawer } from '../../components/Overlay.jsx';
import { TextField } from '../../components/TextField.jsx';
import { API_BASE, fieldErrors, queryString } from '../../lib/api.js';
import { formatDateTime } from '../../lib/format.js';
import { useListQuery } from './admin-api.js';

const PAGE_SIZE = 50;
const EMPTY_FILTERS = { action: '', entity: '', entityId: '', from: '', to: '' };

export function auditFilters(filters) {
  return Object.fromEntries(
    Object.entries(filters)
      .map(([field, value]) => [field, value.trim()])
      .filter(([, value]) => value !== ''),
  );
}

function JsonBlock({ label, value }) {
  return (
    <div>
      <p className="mb-1 text-xs text-muted">{label}</p>
      <pre className="numeric max-h-64 overflow-auto rounded-control bg-tile p-3 text-xs">
        {value ? JSON.stringify(value, null, 2) : '—'}
      </pre>
    </div>
  );
}

function AuditEntryDrawer({ entry, onClose }) {
  return (
    <Drawer
      title={entry.action}
      subtitle={`${entry.entity} #${entry.entityId ?? '—'} · ${formatDateTime(entry.createdAt)}`}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4 text-sm">
        <p>
          By {entry.user ? `${entry.user.name} (${entry.user.email})` : 'the system'}
          {entry.ip ? ` from ${entry.ip}` : ''}
        </p>
        <JsonBlock label="Before" value={entry.before} />
        <JsonBlock label="After" value={entry.after} />
      </div>
    </Drawer>
  );
}

export function AuditLogTab() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [opened, setOpened] = useState(null);
  const activeFilters = auditFilters(filters);
  const query = useListQuery('audit-logs', { ...activeFilters, page, pageSize: PAGE_SIZE });
  const errors = fieldErrors(query.error);
  const set = (field) => (event) => {
    setFilters({ ...filters, [field]: event.target.value });
    setPage(1);
  };
  const columns = [
    {
      key: 'time',
      header: 'Time',
      render: (entry) => (
        <span className="numeric text-muted">{formatDateTime(entry.createdAt)}</span>
      ),
    },
    { key: 'user', header: 'User', render: (entry) => entry.user?.name ?? 'System' },
    {
      key: 'action',
      header: 'Action',
      render: (entry) => <span className="numeric text-xs">{entry.action}</span>,
    },
    {
      key: 'entity',
      header: 'Entity',
      render: (entry) => `${entry.entity} #${entry.entityId ?? '—'}`,
    },
    {
      key: 'ip',
      header: 'IP',
      render: (entry) => <span className="numeric text-muted">{entry.ip ?? '—'}</span>,
    },
  ];
  return (
    <Panel
      title="Audit log"
      actions={
        <ButtonLink
          variant="secondary"
          href={`${API_BASE}/audit-logs.csv${queryString(activeFilters)}`}
        >
          <Download size={16} aria-hidden="true" />
          Export CSV
        </ButtonLink>
      }
    >
      <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-3 xl:grid-cols-5">
        <TextField
          label="Action"
          value={filters.action}
          onChange={set('action')}
          placeholder="GATE_IN"
        />
        <TextField
          label="Entity"
          value={filters.entity}
          onChange={set('entity')}
          placeholder="Container"
        />
        <TextField label="Entity id" value={filters.entityId} onChange={set('entityId')} />
        <TextField
          label="From"
          type="date"
          value={filters.from}
          onChange={set('from')}
          error={errors.from}
        />
        <TextField
          label="To"
          type="date"
          value={filters.to}
          onChange={set('to')}
          error={errors.to}
        />
      </div>
      <DataTable
        label="Audit log entries"
        columns={columns}
        rows={query.data?.data ?? []}
        rowKey={(entry) => entry.id}
        isPending={query.isPending && !query.error}
        onRowClick={setOpened}
        empty={
          <EmptyState icon={History} title="No entries match">
            Every change and login is recorded here. Try a wider date range.
          </EmptyState>
        }
      />
      {query.data && (
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={query.data.total}
          onPageChange={setPage}
        />
      )}
      {opened && <AuditEntryDrawer entry={opened} onClose={() => setOpened(null)} />}
    </Panel>
  );
}
