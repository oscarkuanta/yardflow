import { CheckboxField, TextAreaField } from '../../components/Fields.jsx';
import { titleCase } from '../../lib/format.js';
import { DAMAGE_CODES, damagedSides, toggleDamage } from './gate-flow.js';

function SideButton({ side, isSelected, isDamaged, onSelect, className = '' }) {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={() => onSelect(side)}
      className={`min-h-12 rounded-control border px-3 text-sm transition-colors ${
        isSelected ? 'border-accent bg-soft-accent text-accent-text' : 'border-line hover:bg-tile'
      } ${isDamaged ? 'font-semibold text-danger' : ''} ${className}`}
    >
      {titleCase(side)}
      {isDamaged ? ' •' : ''}
    </button>
  );
}

export function DamageInspection({ inspection, onChange, selectedSide, onSelectSide }) {
  const sides = damagedSides(inspection.damages);
  const sideProps = (side) => ({
    side,
    isSelected: selectedSide === side,
    isDamaged: sides.has(side),
    onSelect: onSelectSide,
  });
  const codesOnSide = new Set(
    inspection.damages
      .filter((damage) => damage.side === selectedSide)
      .map((damage) => damage.code),
  );

  return (
    <section className="panel flex flex-col gap-4 p-5" aria-labelledby="inspection-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="inspection-title" className="text-base font-semibold">
          Damage inspection
        </h2>
        <CheckboxField
          label="No damage"
          checked={inspection.noDamage}
          onChange={(noDamage) =>
            onChange({ ...inspection, noDamage, damages: noDamage ? [] : inspection.damages })
          }
        />
      </div>
      <fieldset disabled={inspection.noDamage} className="flex flex-col gap-4 disabled:opacity-50">
        <legend className="sr-only">Damaged sides</legend>
        <div className="grid grid-cols-[1fr_2fr_1fr] items-center gap-2">
          <span />
          <SideButton {...sideProps('FRONT')} />
          <span />
          <SideButton {...sideProps('LEFT')} />
          <div
            aria-hidden="true"
            className={`flex h-24 items-center justify-center rounded-tile border-2 ${
              sides.size > 0 ? 'border-danger bg-soft-danger' : 'border-line bg-tile'
            } text-xs text-muted`}
          >
            Top view
          </div>
          <SideButton {...sideProps('RIGHT')} />
          <span />
          <SideButton {...sideProps('BACK')} />
          <span />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <SideButton {...sideProps('TOP')} />
          <SideButton {...sideProps('FLOOR')} />
        </div>
        {selectedSide && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted">
              Damage on the {titleCase(selectedSide).toLowerCase()} side
            </p>
            <div className="flex flex-wrap gap-2">
              {DAMAGE_CODES.map((code) => (
                <button
                  key={code}
                  type="button"
                  aria-pressed={codesOnSide.has(code)}
                  onClick={() =>
                    onChange({
                      ...inspection,
                      damages: toggleDamage(inspection.damages, selectedSide, code),
                    })
                  }
                  className={`min-h-12 rounded-full px-4 text-sm ${
                    codesOnSide.has(code)
                      ? 'bg-danger font-semibold text-white'
                      : 'bg-tile hover:brightness-110'
                  }`}
                >
                  {titleCase(code)}
                </button>
              ))}
            </div>
          </div>
        )}
        <TextAreaField
          label="Note (optional)"
          value={inspection.note}
          onChange={(event) => onChange({ ...inspection, note: event.target.value })}
          maxLength={200}
          rows={2}
        />
      </fieldset>
      {inspection.damages.length > 0 && (
        <p className="text-xs text-muted">
          Reported:{' '}
          {inspection.damages
            .map((damage) => `${titleCase(damage.side)} ${titleCase(damage.code).toLowerCase()}`)
            .join(', ')}
        </p>
      )}
    </section>
  );
}
