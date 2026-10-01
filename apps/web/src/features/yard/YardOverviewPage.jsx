import { useEffect, useRef, useState } from 'react';
import { SegmentedControl } from '../../components/Layout.jsx';
import { Skeleton } from '../../components/Skeleton.jsx';
import { useRealtimeEvent } from '../../lib/realtime.jsx';
import { useCurrentUser } from '../auth/auth-hooks.js';
import { GateFeed } from '../gate/GateFeed.jsx';
import { useKpis } from '../reports/reports-api.js';
import { StackDrawer } from './StackDrawer.jsx';
import { YardMap } from './YardMap.jsx';
import { OccupancyPanel, VesselPanel, WorkOrdersPanel, YardLegend } from './YardPanels.jsx';
import { YardTable } from './YardTable.jsx';
import { useYardMap } from './yard-api.js';
import { stackCodeOfPosition, yardTotals } from './yard-geometry.js';

export const CALLOUT_MS = 6000;
export const PULSE_MS = 700;
const PLANNING_ROLES = ['ADMIN', 'PLANNER'];

const ACTION_LABELS = {
  PLACED: 'placed at',
  REMOVED: 'left',
  HOLD_PLACED: 'put on hold at',
  HOLD_RELEASED: 'released from hold at',
};

export function calloutText(change) {
  const verb = ACTION_LABELS[change.action] ?? 'changed at';
  return `${change.containerNumber} ${verb} ${change.positionCode}`;
}

function useYardChanges() {
  const [pulsingStacks, setPulsingStacks] = useState(() => new Set());
  const [callout, setCallout] = useState(null);
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useRealtimeEvent('yard:changed', ({ changes = [] }) => {
    const stackCodes = changes
      .map((change) => stackCodeOfPosition(change.positionCode))
      .filter(Boolean);
    setPulsingStacks(new Set(stackCodes));
    const latest = changes.findLast((change) => change.positionCode);
    if (latest) {
      setCallout({ id: Date.now(), text: calloutText(latest) });
    }
    timers.current.push(
      setTimeout(() => setPulsingStacks(new Set()), PULSE_MS),
      setTimeout(() => setCallout(null), CALLOUT_MS),
    );
  });

  return { pulsingStacks, callout };
}

function SidePanelTabs({ isPlanner }) {
  const tabs = [
    ...(isPlanner ? [{ value: 'work-orders', label: 'Work orders' }] : []),
    { value: 'gate', label: 'Gate feed' },
    ...(isPlanner ? [{ value: 'vessel', label: 'Vessel' }] : []),
  ];
  const [tab, setTab] = useState(tabs[0].value);
  return (
    <div className="flex flex-col gap-3 xl:hidden">
      <SegmentedControl label="Yard panels" options={tabs} value={tab} onChange={setTab} />
      {tab === 'work-orders' && <WorkOrdersPanel />}
      {tab === 'gate' && <GateFeed className="glass p-5" />}
      {tab === 'vessel' && <VesselPanel />}
    </div>
  );
}

export function YardOverviewPage() {
  const { data: user } = useCurrentUser();
  const isPlanner = PLANNING_ROLES.includes(user.role);
  const { data: blocks, isPending } = useYardMap();
  const { data: kpis } = useKpis(isPlanner);
  const [view, setView] = useState('map');
  const [selectedStack, setSelectedStack] = useState(null);
  const { pulsingStacks, callout } = useYardChanges();
  const totals = yardTotals(blocks ?? []);

  return (
    <div className="relative -mx-3 -mt-4 min-h-[calc(100vh-76px)] overflow-hidden md:-mx-4">
      <div className="yard-texture absolute inset-0" aria-hidden="true" />
      <div className="yard-vignette absolute inset-0" aria-hidden="true" />
      <h1 className="sr-only">Yard overview</h1>
      <div className="relative grid gap-3 p-3 md:p-4 xl:grid-cols-[330px_minmax(0,1fr)_320px] xl:items-start">
        <div className="flex flex-col gap-3 xl:order-1">
          <OccupancyPanel totals={totals} kpis={kpis} />
          {isPlanner && (
            <div className="hidden xl:block">
              <WorkOrdersPanel />
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-3 xl:order-2">
          <div className="flex items-center justify-between gap-3">
            <SegmentedControl
              label="Yard view"
              options={[
                { value: 'map', label: 'Map' },
                { value: 'table', label: 'Table' },
              ]}
              value={view}
              onChange={setView}
            />
            {callout && (
              <p
                key={callout.id}
                role="status"
                className="numeric glass animate-slide-in rounded-full px-4 py-2 text-xs"
              >
                {callout.text}
              </p>
            )}
          </div>
          {isPending && <Skeleton className="h-[420px] rounded-panel" />}
          {blocks && view === 'map' && (
            <YardMap
              blocks={blocks}
              pulsingStacks={pulsingStacks}
              onSelectStack={setSelectedStack}
            />
          )}
          {blocks && view === 'table' && (
            <YardTable blocks={blocks} onSelectStack={setSelectedStack} />
          )}
          {blocks && <YardLegend totals={totals} />}
          <SidePanelTabs isPlanner={isPlanner} />
        </div>
        <div className="hidden flex-col gap-3 xl:order-3 xl:flex">
          <GateFeed className="glass p-5" />
          {isPlanner && <VesselPanel />}
        </div>
      </div>
      {selectedStack && (
        <StackDrawer
          stackCode={selectedStack}
          canMove={isPlanner}
          onClose={() => setSelectedStack(null)}
        />
      )}
    </div>
  );
}
