import { Check, Clock, IdCard, KeyRound, Truck } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/Button.jsx';
import { ErrorNote } from '../../components/Overlay.jsx';
import { ResponsiveImage } from '../../components/ResponsiveImage.jsx';
import { TextField } from '../../components/TextField.jsx';
import { fieldErrors } from '../../lib/api.js';
import { describeCargo } from '../../lib/format.js';
import { formatContainerParts, slotLabel } from './gate-flow.js';
import { useVerifyTruck } from './gate-api.js';

export const GATE_INPUT_CLASSES = 'min-h-14 text-base';

export function TruckVerifyForm({ direction, onVerified }) {
  const [truckPlate, setTruckPlate] = useState('');
  const [pin, setPin] = useState('');
  const verify = useVerifyTruck();
  const errors = fieldErrors(verify.error);

  function submit(event) {
    event.preventDefault();
    verify.mutate(
      { truckPlate, pin, direction },
      { onSuccess: (result) => onVerified({ ...result, truckPlate }) },
    );
  }

  return (
    <form
      onSubmit={submit}
      className="panel mx-auto flex w-full max-w-md flex-col gap-4 p-6"
      noValidate
    >
      <div>
        <h2 className="text-lg font-semibold">Check the truck</h2>
        <p className="mt-1 text-sm text-muted">
          Type the plate on the truck and the 6-digit PIN the driver shows.
        </p>
      </div>
      <TextField
        label="Truck plate"
        value={truckPlate}
        onChange={(event) => setTruckPlate(event.target.value.toUpperCase())}
        error={errors.truckPlate}
        autoComplete="off"
        inputClassName={`numeric ${GATE_INPUT_CLASSES}`}
        placeholder="HH-YF 482"
      />
      <TextField
        label="PIN"
        value={pin}
        onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
        error={errors.pin}
        inputMode="numeric"
        autoComplete="off"
        inputClassName={`numeric tracking-[0.3em] ${GATE_INPUT_CLASSES}`}
        placeholder="••••••"
      />
      {Object.keys(errors).length === 0 && <ErrorNote error={verify.error} />}
      <Button type="submit" size="large" className="min-h-14" disabled={verify.isPending}>
        {verify.isPending ? 'Checking…' : 'Verify truck'}
      </Button>
    </form>
  );
}

function CheckTile({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2 rounded-tile bg-tile p-3">
      <Icon size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-muted">{label}</p>
        <p className="truncate text-sm">{value}</p>
      </div>
      <Check size={16} className="shrink-0 text-accent-text" aria-label="Checked" />
    </div>
  );
}

export function GateTruckPanel({ lane, verified }) {
  const { preAdvice, truckPlate } = verified;
  const { owner, serial, checkDigit } = formatContainerParts(preAdvice.containerNumber);
  return (
    <aside
      className="panel flex flex-col overflow-hidden lg:w-[380px] lg:shrink-0"
      aria-label="Truck and container"
    >
      <div className="relative h-40">
        <ResponsiveImage
          name="crane-truck"
          alt=""
          sizes="380px"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <span className="glass absolute left-3 top-3 rounded-full px-3 py-1 text-xs">
          Lane {lane} camera
        </span>
      </div>
      <div className="flex flex-col gap-4 p-5">
        <div>
          <p className="numeric text-[30px] font-medium leading-tight">
            {owner} {serial}{' '}
            <span className="rounded-md bg-soft-accent px-1 text-accent-text">{checkDigit}</span>
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-accent-text">
            <Check size={14} aria-hidden="true" />
            ISO 6346 check digit valid
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <CheckTile icon={KeyRound} label="PIN" value="Matches" />
          <CheckTile icon={Truck} label="Truck plate" value={truckPlate} />
          <CheckTile icon={IdCard} label="Driver" value={preAdvice.driverName} />
          <CheckTile icon={Clock} label="Time slot" value={slotLabel(preAdvice.timeSlot)} />
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted">Type</dt>
            <dd>{describeCargo(preAdvice)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Owner</dt>
            <dd>{preAdvice.company.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Pre-advice</dt>
            <dd className="numeric">{preAdvice.reference}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">
              {preAdvice.isDangerous ? 'Dangerous goods' : 'Weight'}
            </dt>
            <dd className="numeric">
              {preAdvice.isDangerous
                ? `IMO class ${preAdvice.imoClass}`
                : preAdvice.grossWeightKg
                  ? `${preAdvice.grossWeightKg.toLocaleString('en-GB')} kg`
                  : '—'}
            </dd>
          </div>
        </dl>
      </div>
    </aside>
  );
}
