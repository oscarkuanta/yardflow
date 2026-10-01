import { Skeleton } from '../../components/Skeleton.jsx';
import { StackIndicator } from '../../components/StackIndicator.jsx';

export function SlotSuggestionCards({
  suggestions,
  isPending,
  selected,
  onSelect,
  compact = false,
}) {
  const gridClasses = compact ? 'grid gap-2' : 'grid gap-3 md:grid-cols-3';
  if (isPending) {
    return (
      <div className={gridClasses}>
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className={`${compact ? 'h-24' : 'h-40'} rounded-tile`} />
        ))}
      </div>
    );
  }
  if (!suggestions?.length) {
    return (
      <p className="rounded-tile bg-soft-danger p-4 text-sm text-danger">
        No free slot fits this container. Free a stack in a matching block or call the planner.
      </p>
    );
  }
  return (
    <div className={gridClasses} role="radiogroup" aria-label="Slot suggestions">
      {suggestions.map((suggestion, index) => {
        const isSelected = suggestion.positionCode === selected;
        return (
          <button
            key={suggestion.positionCode}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(suggestion.positionCode)}
            className={`flex min-h-12 flex-col gap-3 rounded-tile border-2 p-4 text-left transition-colors ${
              isSelected ? 'border-accent bg-soft-accent' : 'border-line bg-tile hover:border-muted'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="numeric text-lg font-medium">{suggestion.positionCode}</p>
                <p className="numeric text-xs text-muted">
                  Score {suggestion.score}
                  {index === 0 ? ' · best match' : ''}
                </p>
              </div>
              <StackIndicator height={suggestion.tier - 1} maxTier={suggestion.maxTier} />
            </div>
            <ul className="flex flex-col gap-0.5 text-xs text-muted">
              {suggestion.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </button>
        );
      })}
    </div>
  );
}
