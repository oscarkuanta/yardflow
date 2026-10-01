import { Download } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ButtonLink } from '../../components/Button.jsx';
import { PageHeader, Panel } from '../../components/Layout.jsx';
import { Skeleton } from '../../components/Skeleton.jsx';
import { API_BASE } from '../../lib/api.js';
import { formatAge, formatClock, formatDecimal, formatNumber } from '../../lib/format.js';
import { useCurrentUser } from '../auth/auth-hooks.js';
import {
  GATE_MOVE_DAYS,
  useDwellReport,
  useGateMovesReport,
  useKpis,
  useOccupancyReport,
} from './reports-api.js';

const CHART_HEIGHT = 260;
const AXIS_PROPS = {
  stroke: 'var(--text-muted)',
  tick: { fill: 'var(--text-muted)', fontSize: 12 },
  tickLine: false,
  axisLine: false,
};
const TOOLTIP_PROPS = {
  contentStyle: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    color: 'var(--text)',
  },
  cursor: { fill: 'var(--surface-2)' },
};

export function kpiTiles(kpis) {
  const slot = kpis.currentSlot;
  return [
    {
      label: 'Yard occupancy',
      value: `${formatDecimal(kpis.occupancy.percent)} %`,
      hint: `${formatNumber(kpis.occupancy.teuUsed)} of ${formatNumber(kpis.occupancy.teuCapacity)} TEU`,
    },
    {
      label: 'Gate moves today',
      value: formatNumber(kpis.gateMovesToday.total),
      hint: `${kpis.gateMovesToday.in} in · ${kpis.gateMovesToday.out} out`,
    },
    {
      label: 'Trucks this slot',
      value: slot ? formatNumber(slot.expectedTrucks) : '—',
      hint: slot ? `${formatClock(slot.startsAt)}–${formatClock(slot.endsAt)}` : 'Gate closed',
    },
    {
      label: 'Open work orders',
      value: formatNumber(kpis.openWorkOrders.count),
      hint:
        kpis.openWorkOrders.oldestAgeMinutes === null
          ? 'None waiting'
          : `Oldest ${formatAge(kpis.openWorkOrders.oldestAgeMinutes)}`,
    },
    { label: 'Active holds', value: formatNumber(kpis.activeHolds), hint: 'Customs holds' },
    {
      label: 'Average dwell',
      value: `${formatDecimal(kpis.averageDwellDays)} d`,
      hint: 'Containers in the yard',
    },
  ];
}

export function shortDate(calendarDate) {
  const [, month, day] = calendarDate.split('-');
  return `${day}.${month}.`;
}

function KpiTiles() {
  const { data: kpis, isPending } = useKpis();
  if (isPending || !kpis) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-28 rounded-tile" />
        ))}
      </div>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="Key figures">
      {kpiTiles(kpis).map((tile) => (
        <li key={tile.label} className="panel flex flex-col gap-1 p-4">
          <span className="text-xs text-muted">{tile.label}</span>
          <span className="numeric text-[28px] font-medium leading-tight">{tile.value}</span>
          <span className="text-xs text-muted">{tile.hint}</span>
        </li>
      ))}
    </ul>
  );
}

function ChartPanel({ title, query, children, className = '' }) {
  return (
    <Panel title={title} className={className} bodyClassName="p-4">
      {query.isPending ? <Skeleton className="h-[260px]" /> : children(query.data ?? [])}
    </Panel>
  );
}

export function ReportsPage() {
  const { data: user } = useCurrentUser();
  const occupancy = useOccupancyReport();
  const gateMoves = useGateMovesReport();
  const dwell = useDwellReport();
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <PageHeader
        title="Reports"
        description="Live key figures, charts and CSV exports."
        actions={
          <>
            <ButtonLink variant="secondary" href={`${API_BASE}/exports/containers.csv`}>
              <Download size={16} aria-hidden="true" />
              Containers CSV
            </ButtonLink>
            <ButtonLink variant="secondary" href={`${API_BASE}/exports/movements.csv`}>
              <Download size={16} aria-hidden="true" />
              Movements CSV
            </ButtonLink>
            {user.role === 'ADMIN' && (
              <ButtonLink variant="secondary" href={`${API_BASE}/exports/invoices.csv`}>
                <Download size={16} aria-hidden="true" />
                Invoices CSV
              </ButtonLink>
            )}
          </>
        }
      />
      <KpiTiles />
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartPanel title="Occupancy per block" query={occupancy}>
          {(rows) => (
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              <BarChart data={rows}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="code" {...AXIS_PROPS} />
                <YAxis unit="%" domain={[0, 100]} {...AXIS_PROPS} />
                <Tooltip {...TOOLTIP_PROPS} formatter={(value) => [`${value} %`, 'Occupancy']} />
                <Bar
                  dataKey="occupancyPercent"
                  name="Occupancy"
                  fill="var(--accent)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartPanel>
        <ChartPanel title="Average dwell per week" query={dwell}>
          {(rows) => (
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              <LineChart data={rows}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="weekStart" tickFormatter={shortDate} {...AXIS_PROPS} />
                <YAxis unit=" d" {...AXIS_PROPS} />
                <Tooltip
                  {...TOOLTIP_PROPS}
                  labelFormatter={(weekStart) => `Week of ${shortDate(weekStart)}`}
                  formatter={(value) => [`${value} days`, 'Average dwell']}
                />
                <Line
                  type="monotone"
                  dataKey="averageDwellDays"
                  name="Average dwell"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'var(--accent)' }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartPanel>
        <ChartPanel
          title={`Gate moves, last ${GATE_MOVE_DAYS} days`}
          query={gateMoves}
          className="xl:col-span-2"
        >
          {(rows) => (
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              <BarChart data={rows}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="date" tickFormatter={shortDate} {...AXIS_PROPS} />
                <YAxis allowDecimals={false} {...AXIS_PROPS} />
                <Tooltip {...TOOLTIP_PROPS} labelFormatter={shortDate} />
                <Legend wrapperStyle={{ color: 'var(--text-muted)', fontSize: 12 }} />
                <Bar dataKey="in" name="Gate-in" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="out" name="Gate-out" fill="var(--info)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartPanel>
      </div>
    </div>
  );
}
