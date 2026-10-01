import { useSearchParams } from 'react-router-dom';
import { PageHeader, SegmentedControl } from '../../components/Layout.jsx';
import { AuditLogTab } from './AuditLogTab.jsx';
import { CompaniesTab, UsersTab } from './PeopleTabs.jsx';
import { BlocksTab, TariffsTab, TimeSlotsTab } from './YardDataTabs.jsx';

export const ADMIN_TABS = [
  { value: 'users', label: 'Users', component: UsersTab },
  { value: 'companies', label: 'Companies', component: CompaniesTab },
  { value: 'blocks', label: 'Blocks', component: BlocksTab },
  { value: 'tariffs', label: 'Tariffs', component: TariffsTab },
  { value: 'time-slots', label: 'Time slots', component: TimeSlotsTab },
  { value: 'audit-log', label: 'Audit log', component: AuditLogTab },
];

export function AdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const active = ADMIN_TABS.find((tab) => tab.value === searchParams.get('tab')) ?? ADMIN_TABS[0];
  const Tab = active.component;
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Admin" description="Master data and the audit log." />
      <div className="mb-4 overflow-x-auto">
        <SegmentedControl
          label="Admin sections"
          options={ADMIN_TABS}
          value={active.value}
          onChange={(value) => setSearchParams({ tab: value })}
        />
      </div>
      <Tab />
    </div>
  );
}
