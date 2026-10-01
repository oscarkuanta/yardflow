import { Plus, Users } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/Button.jsx';
import { DataTable, Pagination } from '../../components/DataTable.jsx';
import { EmptyState } from '../../components/EmptyState.jsx';
import { CheckboxField, SelectField } from '../../components/Fields.jsx';
import { Panel } from '../../components/Layout.jsx';
import { TextField } from '../../components/TextField.jsx';
import { ROLE_LABELS, formatDateTime } from '../../lib/format.js';
import { ROLE_OPTIONS, changedFields, userBody } from './admin-forms.js';
import { ActiveChip, FormDialog } from './AdminParts.jsx';
import { useListQuery, useSaveResource } from './admin-api.js';

const PAGE_SIZE = 25;

function UserDialog({ user, companies, onClose }) {
  const [form, setForm] = useState({
    email: user?.email ?? '',
    name: user?.name ?? '',
    role: user?.role ?? 'PLANNER',
    companyId: user?.companyId ? String(user.companyId) : '',
    isActive: user?.isActive ?? true,
    password: '',
  });
  const save = useSaveResource('users', {
    successMessage: user ? 'User saved' : 'User created',
    onSuccess: onClose,
  });
  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value });
  return (
    <FormDialog
      title={user ? `Edit ${user.name}` : 'New user'}
      formId="user-form"
      mutation={save}
      onClose={onClose}
      onSubmit={() => save.mutate({ id: user?.id, body: userBody(form, user) })}
    >
      {(errors) => (
        <>
          <TextField label="Name" value={form.name} onChange={set('name')} error={errors.name} />
          <TextField
            label="Email"
            type="email"
            value={form.email}
            onChange={set('email')}
            error={errors.email}
          />
          <SelectField
            label="Role"
            value={form.role}
            onChange={set('role')}
            options={ROLE_OPTIONS}
            error={errors.role}
          />
          {form.role === 'CUSTOMER' && (
            <SelectField
              label="Company"
              value={form.companyId}
              onChange={set('companyId')}
              error={errors.companyId}
              options={[
                { value: '', label: 'Choose a company' },
                ...companies.map((company) => ({
                  value: String(company.id),
                  label: `${company.code} · ${company.name}`,
                })),
              ]}
            />
          )}
          <TextField
            label={user ? 'New password (optional)' : 'Password'}
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
            error={errors.password}
            hint="At least 8 characters"
          />
          {user && (
            <CheckboxField
              label="Active (inactive users cannot log in)"
              checked={form.isActive}
              onChange={(isActive) => setForm({ ...form, isActive })}
              className="sm:col-span-2"
            />
          )}
        </>
      )}
    </FormDialog>
  );
}

export function UsersTab() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const { data, isPending } = useListQuery('users', {
    search: search.trim(),
    page,
    pageSize: PAGE_SIZE,
  });
  const companies = useListQuery('companies', { pageSize: 100 }).data?.data ?? [];
  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (user) => <span className="font-medium">{user.name}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      render: (user) => <span className="text-muted">{user.email}</span>,
    },
    { key: 'role', header: 'Role', render: (user) => ROLE_LABELS[user.role] },
    { key: 'company', header: 'Company', render: (user) => user.company?.name ?? '—' },
    { key: 'active', header: 'Status', render: (user) => <ActiveChip isActive={user.isActive} /> },
    {
      key: 'login',
      header: 'Last login',
      render: (user) => <span className="text-muted">{formatDateTime(user.lastLoginAt)}</span>,
    },
  ];
  return (
    <Panel
      title="Users"
      actions={
        <>
          <TextField
            label="Search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Name or email"
          />
          <Button onClick={() => setEditing('new')} className="self-end">
            <Plus size={16} aria-hidden="true" />
            New user
          </Button>
        </>
      }
    >
      <DataTable
        label="Users"
        columns={columns}
        rows={data?.data ?? []}
        rowKey={(user) => user.id}
        isPending={isPending}
        onRowClick={setEditing}
        empty={
          <EmptyState icon={Users} title="No users found">
            Try another search or create a user.
          </EmptyState>
        }
      />
      {data && (
        <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={setPage} />
      )}
      {editing && (
        <UserDialog
          user={editing === 'new' ? null : editing}
          companies={companies}
          onClose={() => setEditing(null)}
        />
      )}
    </Panel>
  );
}

function CompanyDialog({ company, onClose }) {
  const original = company ?? { code: '', name: '', contactEmail: '', isActive: true };
  const [form, setForm] = useState(original);
  const save = useSaveResource('companies', {
    successMessage: company ? 'Company saved' : 'Company created',
    onSuccess: onClose,
    invalidate: [['users']],
  });
  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value });
  function submit() {
    const fields = { name: form.name, contactEmail: form.contactEmail, isActive: form.isActive };
    const body = company
      ? changedFields(original, fields)
      : { code: form.code, name: form.name, contactEmail: form.contactEmail };
    save.mutate({ id: company?.id, body });
  }
  return (
    <FormDialog
      title={company ? `Edit ${company.name}` : 'New company'}
      formId="company-form"
      mutation={save}
      onClose={onClose}
      onSubmit={submit}
    >
      {(errors) => (
        <>
          <TextField
            label="Code"
            value={form.code}
            onChange={(event) =>
              setForm({ ...form, code: event.target.value.toUpperCase().slice(0, 3) })
            }
            error={errors.code}
            disabled={Boolean(company)}
            hint={company ? 'The code cannot change' : 'Three letters, for example HNF'}
            inputClassName="numeric"
          />
          <TextField label="Name" value={form.name} onChange={set('name')} error={errors.name} />
          <TextField
            label="Contact email"
            type="email"
            value={form.contactEmail}
            onChange={set('contactEmail')}
            error={errors.contactEmail}
            className="sm:col-span-2"
          />
          {company && (
            <CheckboxField
              label="Active (users of inactive companies cannot log in)"
              checked={form.isActive}
              onChange={(isActive) => setForm({ ...form, isActive })}
              className="sm:col-span-2"
            />
          )}
        </>
      )}
    </FormDialog>
  );
}

export function CompaniesTab() {
  const [editing, setEditing] = useState(null);
  const { data, isPending } = useListQuery('companies', { pageSize: 100 });
  const columns = [
    {
      key: 'code',
      header: 'Code',
      render: (company) => <span className="numeric">{company.code}</span>,
    },
    {
      key: 'name',
      header: 'Name',
      render: (company) => <span className="font-medium">{company.name}</span>,
    },
    {
      key: 'email',
      header: 'Contact',
      render: (company) => <span className="text-muted">{company.contactEmail}</span>,
    },
    {
      key: 'users',
      header: 'Users',
      render: (company) => <span className="numeric">{company.userCount}</span>,
    },
    {
      key: 'active',
      header: 'Status',
      render: (company) => <ActiveChip isActive={company.isActive} />,
    },
  ];
  return (
    <Panel
      title="Companies"
      actions={
        <Button onClick={() => setEditing('new')}>
          <Plus size={16} aria-hidden="true" />
          New company
        </Button>
      }
    >
      <DataTable
        label="Companies"
        columns={columns}
        rows={data?.data ?? []}
        rowKey={(company) => company.id}
        isPending={isPending}
        onRowClick={setEditing}
      />
      {editing && (
        <CompanyDialog
          company={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </Panel>
  );
}
