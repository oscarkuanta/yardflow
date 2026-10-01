import { Skeleton } from '../../components/Skeleton.jsx';
import { formatDecimal, formatNumber } from '../../lib/format.js';

export function statCardsFrom(stats) {
  return [
    {
      label: 'Yard occupancy',
      value: formatDecimal(stats?.occupancyPercent),
      unit: '%',
      hint: 'of TEU capacity',
    },
    {
      label: 'Gate moves today',
      value: formatNumber(stats?.gateMovesToday),
      unit: '',
      hint: 'trucks in and out',
    },
    {
      label: 'Average dwell',
      value: formatDecimal(stats?.averageDwellDays),
      unit: 'days',
      hint: 'containers in the yard',
    },
    {
      label: 'Gate-in time',
      value: formatDecimal(stats?.averageGateInMinutes),
      unit: 'min',
      hint: 'from PIN check to slot, per truck',
    },
  ];
}

export function StatCards({ stats, isPending }) {
  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Yard numbers">
      {statCardsFrom(stats).map((card) => (
        <li key={card.label} className="glass flex flex-col gap-1 p-4 md:p-5">
          <span className="text-xs text-muted">{card.label}</span>
          {isPending ? (
            <Skeleton className="my-1 h-9 w-24" />
          ) : (
            <span className="flex items-baseline gap-1.5">
              <span className="numeric text-[28px] font-medium leading-tight md:text-4xl">
                {card.value}
              </span>
              {card.value !== '—' && card.unit && (
                <span className="text-sm text-muted">{card.unit}</span>
              )}
            </span>
          )}
          <span className="text-xs text-muted">{card.hint}</span>
        </li>
      ))}
    </ul>
  );
}
