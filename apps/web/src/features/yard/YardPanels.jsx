import { ClipboardCheck, Ship } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Skeleton } from '../../components/Skeleton.jsx';
import { StatusChip } from '../../components/StatusChip.jsx';
import {
  formatDateTime,
  formatDecimal,
  formatNumber,
  terminalCalendarDate,
  addDaysToCalendarDate,
} from '../../lib/format.js';
import { dayBalance, hourlyMoves } from '../gate/gate-feed.js';
import { useGateTransactions } from '../gate/gate-api.js';
import { VESSEL_STATUS_TONES, useVesselVisits, visitAtBerth } from '../vessels/vessels-api.js';
import { WorkOrderGroupList } from '../work-orders/WorkOrderGroups.jsx';
import { groupWorkOrders, useWorkOrders } from '../work-orders/work-orders-api.js';
import { SHADE_OPACITY } from './yard-geometry.js';

const DAY_PAGE_SIZE = 100;

function useLastTwoDaysOfMoves() {
  const today = terminalCalendarDate(new Date());
  const yesterday = addDaysToCalendarDate(today, -1);
  const todayMoves = useGateTransactions({ date: today, pageSize: DAY_PAGE_SIZE });
  const yesterdayMoves = useGateTransactions({ date: yesterday, pageSize: DAY_PAGE_SIZE });
  return {
    today: todayMoves.data?.data ?? [],
    all: [...(todayMoves.data?.data ?? []), ...(yesterdayMoves.data?.data ?? [])],
    isPending: todayMoves.isPending,
  };
}

function Sparkline({ values }) {
  const highest = Math.max(1, ...values);
  return (
    <div
      className="flex h-12 items-end gap-[3px]"
      role="img"
      aria-label="Gate moves per hour, last 24 hours"
    >
      {values.map((value, index) => (
        <span
          key={index}
          className="flex-1 rounded-sm bg-accent"
          style={{
            height: `${Math.max(6, (value / highest) * 100)}%`,
            opacity: value === 0 ? 0.25 : 0.85,
          }}
        />
      ))}
    </div>
  );
}

function MiniTile({ label, value }) {
  return (
    <div className="rounded-tile bg-tile px-3 py-2.5">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="numeric text-lg">{value}</p>
    </div>
  );
}

export function OccupancyPanel({ totals, kpis }) {
  const moves = useLastTwoDaysOfMoves();
  const balance = dayBalance(moves.today);
  const sign = balance.net > 0 ? '+' : '';
  return (
    <section className="glass flex flex-col gap-4 p-5" aria-labelledby="occupancy-title">
      <div className="flex items-baseline justify-between">
        <h2 id="occupancy-title" className="text-base font-semibold">
          Yard occupancy
        </h2>
        <span className="numeric text-xs text-muted">
          {formatNumber(totals.teuUsed)} / {formatNumber(totals.teuCapacity)} TEU
        </span>
      </div>
      <div className="flex items-baseline gap-3">
        <span className="numeric text-5xl font-medium leading-none">
          {formatDecimal(totals.percent)}
        </span>
        <span className="text-lg text-muted">%</span>
        <span className="numeric ml-auto text-sm text-muted">
          {sign}
          {balance.net} boxes today
        </span>
      </div>
      {moves.isPending ? (
        <Skeleton className="h-12" />
      ) : (
        <Sparkline values={hourlyMoves(moves.all, new Date())} />
      )}
      <p className="-mt-2 text-[11px] text-muted">Gate moves per hour, last 24 hours</p>
      <div className="grid grid-cols-3 gap-2">
        <MiniTile label="Gate moves" value={formatNumber(balance.in + balance.out)} />
        <MiniTile
          label={kpis ? 'Holds' : 'Stacks on hold'}
          value={formatNumber(kpis ? kpis.activeHolds : totals.stacksOnHold)}
        />
        <MiniTile label="Dwell days" value={kpis ? formatDecimal(kpis.averageDwellDays) : '—'} />
      </div>
    </section>
  );
}

export function WorkOrdersPanel() {
  const { data, isPending } = useWorkOrders({ status: 'OPEN' });
  const groups = groupWorkOrders(data?.data ?? []);
  return (
    <section className="glass flex flex-col gap-3 p-5" aria-labelledby="work-orders-title">
      <div className="flex items-center justify-between">
        <h2 id="work-orders-title" className="text-base font-semibold">
          Work orders
        </h2>
        <Link to="/app/work-orders" className="text-xs text-muted hover:text-ink">
          All work orders
        </Link>
      </div>
      {isPending && <Skeleton className="h-24" />}
      {!isPending && groups.length === 0 && (
        <p className="flex items-center gap-2 rounded-tile bg-tile p-4 text-sm text-muted">
          <ClipboardCheck size={16} aria-hidden="true" />
          No open relocations. They appear here when a pickup or load needs boxes moved.
        </p>
      )}
      {groups.length > 0 && <WorkOrderGroupList groups={groups} />}
    </section>
  );
}

export function VesselPanel() {
  const { data, isPending } = useVesselVisits({ sort: 'eta:asc' });
  const visit = visitAtBerth(data?.data ?? []);
  return (
    <section className="glass flex flex-col gap-3 p-5" aria-labelledby="vessel-title">
      <h2 id="vessel-title" className="text-base font-semibold">
        Vessel at berth
      </h2>
      {isPending && <Skeleton className="h-20" />}
      {!isPending && !visit && (
        <p className="flex items-center gap-2 rounded-tile bg-tile p-4 text-sm text-muted">
          <Ship size={16} aria-hidden="true" />
          No vessel at the berth right now.
        </p>
      )}
      {visit && (
        <Link
          to={`/app/vessels/${visit.id}`}
          className="flex flex-col gap-2 rounded-tile bg-tile p-3 hover:brightness-110"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold">{visit.vesselName}</p>
            <StatusChip
              label={visit.status === 'WORKING' ? 'Working' : 'Arrived'}
              tone={VESSEL_STATUS_TONES[visit.status]}
            />
          </div>
          <p className="numeric text-xs text-muted">
            Voyage {visit.voyage} · ETD {formatDateTime(visit.etd)}
          </p>
          <div
            className="h-2 overflow-hidden rounded-full bg-surface"
            role="progressbar"
            aria-valuenow={visit.progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Cargo progress"
          >
            <span
              className="block h-full rounded-full bg-accent"
              style={{ width: `${visit.progressPercent}%` }}
            />
          </div>
          <p className="numeric text-xs text-muted">
            Discharge {visit.discharge.done}/{visit.discharge.total} · Load {visit.load.done}/
            {visit.load.total} · {visit.progressPercent}%
          </p>
        </Link>
      )}
    </section>
  );
}

export function YardLegend({ totals }) {
  return (
    <div className="glass flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-xs text-muted">
      <span className="flex items-center gap-2">
        Stack height
        {SHADE_OPACITY.map((opacity) => (
          <span key={opacity} className="h-3.5 w-5 rounded-sm bg-accent" style={{ opacity }} />
        ))}
      </span>
      <span className="flex items-center gap-2">
        <span className="h-3.5 w-5 rounded-sm bg-danger" /> Customs hold
      </span>
      <span className="flex items-center gap-2">
        <span className="h-3.5 w-5 rounded-sm border-2 border-warn" /> DG block
      </span>
      <span className="numeric ml-auto">
        {formatNumber(totals.teuUsed)} / {formatNumber(totals.teuCapacity)} TEU
      </span>
    </div>
  );
}
