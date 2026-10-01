import { normalizeContainerNumber } from '@yardflow/shared';
import { Search, Ship } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVesselVisits } from '../vessels/vessels-api.js';
import { ContainerDrawer } from './ContainerDrawer.jsx';
import { CONTAINER_STATE_LABELS, useContainerSearch } from './containers-api.js';

export const SEARCH_DELAY_MS = 250;
const VESSEL_ROLES = ['ADMIN', 'PLANNER'];

function useDebouncedValue(value) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [value]);
  return debounced;
}

function VesselResults({ search, onPick }) {
  const { data } = useVesselVisits({ search });
  const visits = data?.data ?? [];
  if (visits.length === 0) {
    return null;
  }
  return (
    <>
      <li role="presentation" className="px-3 pt-2 text-[11px] uppercase tracking-wide text-muted">
        Vessels
      </li>
      {visits.slice(0, 3).map((visit) => (
        <li key={visit.id} role="option" aria-selected="false">
          <button
            type="button"
            onClick={() => onPick({ vesselId: visit.id })}
            className="flex w-full items-center gap-2 rounded-control px-3 py-2 text-left hover:bg-tile"
          >
            <Ship size={16} className="text-muted" aria-hidden="true" />
            <span>{visit.vesselName}</span>
            <span className="numeric ml-auto text-xs text-muted">{visit.voyage}</span>
          </button>
        </li>
      ))}
    </>
  );
}

function ContainerResults({ search, onPick }) {
  const { data, isPending } = useContainerSearch(normalizeContainerNumber(search));
  const containers = data?.data ?? [];
  if (isPending) {
    return <li className="px-3 py-2 text-xs text-muted">Searching…</li>;
  }
  if (containers.length === 0) {
    return <li className="px-3 py-2 text-xs text-muted">No container matches.</li>;
  }
  return (
    <>
      <li role="presentation" className="px-3 pt-2 text-[11px] uppercase tracking-wide text-muted">
        Containers
      </li>
      {containers.map((container) => (
        <li key={container.id} role="option" aria-selected="false">
          <button
            type="button"
            onClick={() => onPick({ containerNumber: container.number })}
            className="flex w-full items-center gap-2 rounded-control px-3 py-2 text-left hover:bg-tile"
          >
            <span className="numeric">{container.displayNumber}</span>
            <span className="ml-auto text-xs text-muted">
              {container.positionCode ?? CONTAINER_STATE_LABELS[container.state]}
            </span>
          </button>
        </li>
      ))}
    </>
  );
}

export function SearchPill({ role }) {
  const listId = useId();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [openNumber, setOpenNumber] = useState(null);
  const search = useDebouncedValue(text.trim());
  const showResults = search.length >= 3;

  function pick({ containerNumber, vesselId }) {
    setText('');
    if (vesselId) {
      navigate(`/app/vessels/${vesselId}`);
      return;
    }
    setOpenNumber(containerNumber);
  }

  return (
    <div className="relative hidden min-w-0 flex-1 md:block">
      <label className="glass flex h-12 items-center gap-2 rounded-full px-4 text-muted">
        <Search size={16} aria-hidden="true" />
        <span className="sr-only">Search containers and vessels</span>
        <input
          type="search"
          role="combobox"
          aria-expanded={showResults}
          aria-controls={listId}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => event.key === 'Escape' && setText('')}
          placeholder="Container or vessel"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
        />
      </label>
      {showResults && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Search results"
          className="panel absolute left-0 right-0 top-14 z-40 flex max-h-96 flex-col gap-0.5 overflow-y-auto p-2"
        >
          <ContainerResults search={search} onPick={pick} />
          {VESSEL_ROLES.includes(role) && <VesselResults search={search} onPick={pick} />}
        </ul>
      )}
      {openNumber && <ContainerDrawer number={openNumber} onClose={() => setOpenNumber(null)} />}
    </div>
  );
}
