import { ArrowLeft, CircleCheck, CircleX, FileText } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, ButtonLink } from '../../components/Button.jsx';
import { ContainerNumberField } from '../../components/Fields.jsx';
import { SegmentedControl } from '../../components/Layout.jsx';
import { ErrorNote } from '../../components/Overlay.jsx';
import { TextField } from '../../components/TextField.jsx';
import { fieldErrors } from '../../lib/api.js';
import { formatEuro } from '../../lib/format.js';
import { useRealtimeEvent } from '../../lib/realtime.jsx';
import { suggestionRequestFor, useSlotSuggestions } from '../yard/yard-api.js';
import { DamageInspection } from './DamageInspection.jsx';
import { GATE_INPUT_CLASSES, GateTruckPanel, TruckVerifyForm } from './GatePanels.jsx';
import { SlotSuggestionCards } from './SlotSuggestionCards.jsx';
import { useGateIn, useGateOut, useGateOutCheck } from './gate-api.js';
import {
  GATE_IN_STEPS,
  GATE_OUT_STEPS,
  containerMatches,
  gateInBody,
  gateInDoneCount,
  gateOutDoneCount,
  relocationsPending,
  stepStatuses,
  withLatestStatus,
} from './gate-flow.js';

const EMPTY_INSPECTION = { noDamage: false, damages: [], note: '' };
const STEP_STYLES = {
  done: 'bg-tile text-muted',
  active: 'bg-accent font-semibold text-on-accent',
  todo: 'border border-line text-muted',
};

function StepPills({ steps }) {
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label="Steps">
      {steps.map((step, index) => (
        <li
          key={step.label}
          aria-current={step.status === 'active' ? 'step' : undefined}
          className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-xs ${STEP_STYLES[step.status]}`}
        >
          <span className="numeric">{index + 1}</span>
          {step.label}
        </li>
      ))}
    </ol>
  );
}

function GateDone({ title, result, onNext }) {
  return (
    <section
      className="panel mx-auto flex w-full max-w-md flex-col items-center gap-4 p-8 text-center"
      role="status"
    >
      <CircleCheck size={40} className="text-accent-text" aria-hidden="true" />
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="numeric mt-1 text-sm text-muted">
          {result.containerNumber} · {result.positionCode ?? result.fromPosition}
        </p>
      </div>
      <div className="flex w-full flex-col gap-2">
        <ButtonLink
          href={result.eirUrl}
          target="_blank"
          rel="noreferrer"
          size="large"
          className="min-h-14"
        >
          <FileText size={18} aria-hidden="true" />
          Print EIR ticket
        </ButtonLink>
        <Button variant="secondary" size="large" className="min-h-14" onClick={onNext}>
          Next truck
        </Button>
      </div>
    </section>
  );
}

function GateInFlow({ lane, verified, onStepsChange, onFinished }) {
  const { preAdvice } = verified;
  const [typedNumber, setTypedNumber] = useState('');
  const [inspection, setInspection] = useState(EMPTY_INSPECTION);
  const [selectedSide, setSelectedSide] = useState(null);
  const suggestionRequest = suggestionRequestFor(preAdvice, preAdvice.company.id);
  const suggestions = useSlotSuggestions(suggestionRequest);
  const [chosenSlot, setChosenSlot] = useState(null);
  const selectedSlot = chosenSlot ?? suggestions.data?.[0]?.positionCode ?? null;
  const gateIn = useGateIn({ onSuccess: onFinished });
  const errors = fieldErrors(gateIn.error);
  const flowState = { preAdvice, typedNumber, inspection, selectedSlot };
  const doneCount = gateInDoneCount(flowState);
  const numberMismatch = typedNumber.length >= 11 && !containerMatches(typedNumber, preAdvice);

  useEffect(
    () => onStepsChange(stepStatuses(GATE_IN_STEPS, doneCount)),
    [doneCount, onStepsChange],
  );

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <section className="panel flex flex-col gap-3 p-5" aria-label="Container check">
        <ContainerNumberField
          label="Container number on the box"
          value={typedNumber}
          onChange={setTypedNumber}
          error={
            numberMismatch
              ? `This is not the container on the pre-advice (${preAdvice.displayNumber})`
              : errors.containerNumber
          }
          inputClassName={`numeric uppercase ${GATE_INPUT_CLASSES}`}
        />
      </section>
      <DamageInspection
        inspection={inspection}
        onChange={setInspection}
        selectedSide={selectedSide}
        onSelectSide={setSelectedSide}
      />
      {errors.damages && <p className="text-sm text-danger">{errors.damages}</p>}
      <section className="flex flex-col gap-3" aria-labelledby="slot-title">
        <h2 id="slot-title" className="text-base font-semibold">
          Slot
        </h2>
        <SlotSuggestionCards
          suggestions={suggestions.data}
          isPending={suggestions.isPending}
          selected={selectedSlot}
          onSelect={setChosenSlot}
        />
      </section>
      {Object.keys(errors).length === 0 && <ErrorNote error={gateIn.error} />}
      <Button
        size="large"
        className="min-h-[58px] w-full text-base"
        disabled={doneCount < GATE_IN_STEPS.length - 1 || gateIn.isPending}
        onClick={() => gateIn.mutate(gateInBody({ ...flowState, lane }))}
      >
        {gateIn.isPending
          ? 'Saving gate-in…'
          : selectedSlot
            ? `Confirm gate-in to ${selectedSlot} and print EIR`
            : 'Confirm gate-in'}
      </Button>
    </div>
  );
}

function CheckRow({ check }) {
  const Icon = check.passed ? CircleCheck : CircleX;
  return (
    <li
      className={`flex min-h-16 items-center gap-3 rounded-tile px-4 py-3 ${check.passed ? 'bg-tile' : 'bg-soft-danger'}`}
    >
      <Icon
        size={24}
        className={check.passed ? 'text-accent-text' : 'text-danger'}
        aria-hidden="true"
      />
      <div>
        <p className="text-sm font-semibold">{check.passed ? 'Passed' : 'Failed'}</p>
        <p className="text-sm text-muted">{check.message}</p>
      </div>
    </li>
  );
}

function RelocationWait({ relocations, updates }) {
  const current = withLatestStatus(relocations, updates);
  const pending = relocationsPending(relocations, updates);
  return (
    <section className="rounded-tile bg-soft-warn p-4" aria-live="polite">
      <p className="font-semibold text-warn">
        {pending > 0
          ? `Waiting for ${pending} relocation${pending === 1 ? '' : 's'}`
          : 'All relocations done'}
      </p>
      <ol className="mt-2 flex flex-col gap-1 text-sm">
        {current.map((order) => (
          <li key={order.id} className="numeric flex justify-between gap-3">
            <span>
              {order.sequence}. {order.containerNumber} {order.fromPosition} → {order.toPosition}
            </span>
            <span className={order.status === 'DONE' ? 'text-accent-text' : 'text-warn'}>
              {order.status === 'DONE' ? 'Done' : 'Open'}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function GateOutFlow({ lane, verified, onStepsChange, onFinished }) {
  const { preAdvice, truckPlate } = verified;
  const [driverName, setDriverName] = useState('');
  const check = useGateOutCheck();
  const gateOut = useGateOut({ onSuccess: onFinished });
  const result = check.data;
  const body = { preAdviceId: preAdvice.id, truckPlate, driverName, lane };
  const errors = fieldErrors(check.error);
  const [orderUpdates, setOrderUpdates] = useState([]);
  useRealtimeEvent('workorder:changed', (update) => {
    setOrderUpdates((current) => [...current.filter((order) => order.id !== update.id), update]);
  });
  const pending = relocationsPending(result?.relocations, orderUpdates);
  const doneCount = gateOutDoneCount({ preAdvice, checkResult: result });

  useEffect(
    () => onStepsChange(stepStatuses(GATE_OUT_STEPS, doneCount)),
    [doneCount, onStepsChange],
  );

  const runCheckAgain = useRef(null);
  runCheckAgain.current = () => check.mutate(body);
  const shouldRecheck = Boolean(result?.relocations.length) && pending === 0 && !check.isPending;
  useEffect(() => {
    if (shouldRecheck) {
      runCheckAgain.current();
    }
  }, [shouldRecheck]);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <section className="panel flex flex-col gap-4 p-5" aria-label="Pickup checks">
        <TextField
          label="Driver name as on the ID"
          value={driverName}
          onChange={(event) => setDriverName(event.target.value)}
          error={errors.driverName}
          inputClassName={GATE_INPUT_CLASSES}
        />
        <Button
          variant="secondary"
          size="large"
          className="min-h-14"
          disabled={!driverName.trim() || check.isPending}
          onClick={() => check.mutate(body)}
        >
          {check.isPending
            ? 'Running checks…'
            : result
              ? 'Run the checks again'
              : 'Run the 4 checks'}
        </Button>
        {Object.keys(errors).length === 0 && <ErrorNote error={check.error} />}
        {result && (
          <ul className="flex flex-col gap-2" aria-label="Check results">
            {result.checks.map((item) => (
              <CheckRow key={item.key} check={item} />
            ))}
          </ul>
        )}
        {result?.invoice && (
          <p className="text-sm text-muted">
            Invoice <span className="numeric">{result.invoice.number}</span> ·{' '}
            {formatEuro(result.invoice.amountCents)} · {result.invoice.status.toLowerCase()}
          </p>
        )}
        {result?.relocations.length > 0 && (
          <RelocationWait relocations={result.relocations} updates={orderUpdates} />
        )}
      </section>
      <ErrorNote error={gateOut.error} />
      <Button
        size="large"
        className="min-h-[58px] w-full text-base"
        disabled={!result?.canComplete || gateOut.isPending}
        onClick={() => gateOut.mutate(body)}
      >
        {gateOut.isPending ? 'Saving gate-out…' : 'Complete gate-out and print EIR'}
      </Button>
    </div>
  );
}

export function GatePage() {
  const [direction, setDirection] = useState('IN');
  const [lane, setLane] = useState(1);
  const [verified, setVerified] = useState(null);
  const [finished, setFinished] = useState(null);
  const [steps, setSteps] = useState(() => stepStatuses(GATE_IN_STEPS, 0));
  const stepNames = direction === 'IN' ? GATE_IN_STEPS : GATE_OUT_STEPS;
  const visibleSteps = verified ? steps : stepStatuses(stepNames, 0);

  function startOver(nextDirection = direction) {
    setDirection(nextDirection);
    setVerified(null);
    setFinished(null);
  }

  function openEir(result) {
    setFinished(result);
    window.open(result.eirUrl, '_blank', 'noopener');
  }

  const Flow = direction === 'IN' ? GateInFlow : GateOutFlow;

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-4">
      <div className="glass flex flex-wrap items-center gap-3 p-2 pr-4">
        <Link
          to="/app"
          aria-label="Back to the yard"
          className="inline-flex h-12 w-12 items-center justify-center rounded-full hover:bg-tile"
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </Link>
        <h1 className="text-lg font-semibold">
          {direction === 'IN' ? 'Gate-in' : 'Gate-out'} · Lane {lane}
        </h1>
        <SegmentedControl
          label="Direction"
          options={[
            { value: 'IN', label: 'Gate-in' },
            { value: 'OUT', label: 'Gate-out' },
          ]}
          value={direction}
          onChange={(value) => startOver(value)}
        />
        <SegmentedControl
          label="Lane"
          options={[
            { value: 1, label: 'Lane 1' },
            { value: 2, label: 'Lane 2' },
          ]}
          value={lane}
          onChange={setLane}
        />
        <div className="ml-auto">
          <StepPills steps={finished ? stepStatuses(stepNames, stepNames.length) : visibleSteps} />
        </div>
      </div>
      {finished && (
        <GateDone
          title={direction === 'IN' ? 'Gate-in complete' : 'Gate-out complete'}
          result={finished}
          onNext={() => startOver()}
        />
      )}
      {!finished && !verified && (
        <TruckVerifyForm key={direction} direction={direction} onVerified={setVerified} />
      )}
      {!finished && verified && (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <GateTruckPanel lane={lane} verified={verified} />
          <Flow lane={lane} verified={verified} onStepsChange={setSteps} onFinished={openEir} />
        </div>
      )}
      {!finished && verified && (
        <button
          type="button"
          onClick={() => startOver()}
          className="self-start text-sm text-muted hover:text-ink"
        >
          Cancel and check another truck
        </button>
      )}
    </div>
  );
}
