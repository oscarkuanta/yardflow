import { useState } from 'react';
import { Button } from '../../components/Button.jsx';
import { Drawer, ErrorNote } from '../../components/Overlay.jsx';
import { Skeleton } from '../../components/Skeleton.jsx';
import { StackIndicator } from '../../components/StackIndicator.jsx';
import { StatusChip } from '../../components/StatusChip.jsx';
import { TextField } from '../../components/TextField.jsx';
import { fieldErrors } from '../../lib/api.js';
import { describeCargo, formatDate } from '../../lib/format.js';
import {
  suggestionRequestFor,
  useMoveContainer,
  useSlotSuggestions,
  useStack,
} from './yard-api.js';

export function sideViewTiers(stack) {
  const containersByTier = new Map(stack.tiers.map((tier) => [tier.tier, tier]));
  return Array.from({ length: stack.maxTier }, (_, index) => {
    const tier = stack.maxTier - index;
    return containersByTier.get(tier) ?? { tier, positionCode: null, container: null };
  });
}

function TierRow({ tier }) {
  if (!tier.container) {
    return (
      <li className="flex min-h-14 items-center gap-3 rounded-tile border border-dashed border-line px-3 text-xs text-muted">
        <span className="numeric w-6">T{tier.tier}</span>
        Free
      </li>
    );
  }
  const { container } = tier;
  return (
    <li className="flex min-h-14 items-center gap-3 rounded-tile bg-tile px-3 py-2">
      <span className="numeric w-6 text-xs text-muted">T{tier.tier}</span>
      <div className="min-w-0 flex-1">
        <p className="numeric text-sm">{container.number}</p>
        <p className="truncate text-xs text-muted">
          {container.owner.name} · {describeCargo(container)} · in since{' '}
          {formatDate(container.gateInAt)}
        </p>
      </div>
      {container.hasHold && <StatusChip label="Hold" />}
      {container.isDangerous && <StatusChip label={`DG ${container.imoClass ?? ''}`} tone="warn" />}
    </li>
  );
}

function SuggestionChoices({ container, onPick }) {
  const request = suggestionRequestFor(container, container.owner.id);
  const { data: suggestions, isPending } = useSlotSuggestions(request);
  if (isPending) {
    return <Skeleton className="h-10" />;
  }
  if (!suggestions?.length) {
    return <p className="text-xs text-muted">No suggestion fits this container right now.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.positionCode}
          type="button"
          onClick={() => onPick(suggestion.positionCode)}
          className="numeric min-h-10 rounded-full border border-line px-3 text-xs hover:bg-tile"
        >
          {suggestion.positionCode}
        </button>
      ))}
    </div>
  );
}

function MoveTopContainer({ topTier, onMoved }) {
  const [target, setTarget] = useState('');
  const move = useMoveContainer({ onSuccess: onMoved });
  const errors = fieldErrors(move.error);
  function submit(event) {
    event.preventDefault();
    move.mutate({ containerNumber: topTier.container.number, to: target });
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-3 border-t border-line pt-4">
      <h3 className="text-sm font-semibold">Move top container</h3>
      <p className="text-xs text-muted">
        Pick a suggestion or type a stack like B-02-05. Only the top container can move.
      </p>
      <SuggestionChoices container={topTier.container} onPick={setTarget} />
      <TextField
        label="Target stack or position"
        value={target}
        onChange={(event) => setTarget(event.target.value.toUpperCase())}
        error={errors.to}
        inputClassName="numeric"
        placeholder="B-02-05"
      />
      {!errors.to && <ErrorNote error={move.error} />}
      <Button type="submit" disabled={!target || move.isPending}>
        {move.isPending ? 'Moving…' : `Move ${topTier.container.number}`}
      </Button>
    </form>
  );
}

export function StackDrawer({ stackCode, canMove, onClose }) {
  const { data: stack, isPending, error } = useStack(stackCode);
  const tiers = stack ? sideViewTiers(stack) : [];
  const topTier = stack?.tiers.at(-1);
  return (
    <Drawer
      title={stackCode}
      subtitle={stack ? `${stack.height} of ${stack.maxTier} tiers used` : 'Loading stack…'}
      onClose={onClose}
    >
      {isPending && <Skeleton className="h-64" />}
      <ErrorNote error={error} />
      {stack && (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-4">
            <StackIndicator height={stack.height} maxTier={stack.maxTier} />
            <ol className="flex flex-1 flex-col gap-2" aria-label="Tiers from top to bottom">
              {tiers.map((tier) => (
                <TierRow key={tier.tier} tier={tier} />
              ))}
            </ol>
          </div>
          {canMove && topTier && <MoveTopContainer topTier={topTier} onMoved={onClose} />}
        </div>
      )}
    </Drawer>
  );
}
