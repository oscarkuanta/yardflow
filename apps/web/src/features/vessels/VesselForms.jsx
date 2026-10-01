import { useState } from 'react';
import { Button } from '../../components/Button.jsx';
import { CheckboxField, ContainerNumberField, SelectField } from '../../components/Fields.jsx';
import { Dialog, ErrorNote } from '../../components/Overlay.jsx';
import { TextField } from '../../components/TextField.jsx';
import { fieldErrors } from '../../lib/api.js';
import { useAddVisitItem, useCreateVisit, useImportVisitItems } from './vessels-api.js';

export function localInputToIso(value) {
  return value ? new Date(value).toISOString() : '';
}

export const CSV_TEMPLATE =
  'containerNumber,size,isHighCube,loadStatus,isDangerous,imoClass,grossWeightKg,ownerCode,direction';

const SIZE_OPTIONS = [
  { value: 'FT20', label: "20'" },
  { value: 'FT40', label: "40'" },
  { value: 'FT45', label: "45'" },
];

function DialogActions({ onClose, isPending, label, formId }) {
  return (
    <>
      <Button variant="secondary" onClick={onClose}>
        Cancel
      </Button>
      <Button type="submit" form={formId} disabled={isPending}>
        {isPending ? 'Saving…' : label}
      </Button>
    </>
  );
}

function generalError(error, errors) {
  return Object.keys(errors).length === 0 ? error : null;
}

export function NewVisitDialog({ onClose }) {
  const [form, setForm] = useState({ vesselName: '', imoNumber: '', voyage: '', eta: '', etd: '' });
  const create = useCreateVisit({ onSuccess: onClose });
  const errors = fieldErrors(create.error);
  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  function submit(event) {
    event.preventDefault();
    create.mutate({ ...form, eta: localInputToIso(form.eta), etd: localInputToIso(form.etd) });
  }

  return (
    <Dialog
      title="New vessel visit"
      onClose={onClose}
      footer={
        <DialogActions
          onClose={onClose}
          isPending={create.isPending}
          label="Create visit"
          formId="new-visit"
        />
      }
    >
      <form id="new-visit" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <TextField
          label="Vessel name"
          value={form.vesselName}
          onChange={update('vesselName')}
          error={errors.vesselName}
          className="sm:col-span-2"
        />
        <TextField
          label="IMO number"
          value={form.imoNumber}
          onChange={update('imoNumber')}
          error={errors.imoNumber}
          inputMode="numeric"
          inputClassName="numeric"
        />
        <TextField
          label="Voyage"
          value={form.voyage}
          onChange={update('voyage')}
          error={errors.voyage}
          inputClassName="numeric"
        />
        <TextField
          label="ETA"
          type="datetime-local"
          value={form.eta}
          onChange={update('eta')}
          error={errors.eta}
        />
        <TextField
          label="ETD"
          type="datetime-local"
          value={form.etd}
          onChange={update('etd')}
          error={errors.etd}
        />
        <div className="sm:col-span-2">
          <ErrorNote error={generalError(create.error, errors)} />
        </div>
      </form>
    </Dialog>
  );
}

const EMPTY_ITEM = {
  containerNumber: '',
  size: 'FT40',
  isHighCube: false,
  loadStatus: 'FULL',
  isDangerous: false,
  imoClass: '',
  grossWeightKg: '',
  ownerCode: '',
};

export function itemBody(form, direction) {
  return {
    containerNumber: form.containerNumber,
    size: form.size,
    isHighCube: form.isHighCube,
    loadStatus: form.loadStatus,
    isDangerous: form.isDangerous,
    imoClass: form.isDangerous && form.imoClass ? form.imoClass : null,
    grossWeightKg: form.grossWeightKg === '' ? null : Number(form.grossWeightKg),
    ownerCode: form.ownerCode,
    direction,
  };
}

export function AddItemDialog({ visitId, direction, onClose }) {
  const [form, setForm] = useState(EMPTY_ITEM);
  const add = useAddVisitItem(visitId, { onSuccess: onClose });
  const errors = fieldErrors(add.error);
  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  function submit(event) {
    event.preventDefault();
    add.mutate(itemBody(form, direction));
  }

  return (
    <Dialog
      title={direction === 'DISCHARGE' ? 'Add to the discharge list' : 'Add to the load list'}
      onClose={onClose}
      footer={
        <DialogActions
          onClose={onClose}
          isPending={add.isPending}
          label="Add container"
          formId="add-item"
        />
      }
    >
      <form id="add-item" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <ContainerNumberField
          value={form.containerNumber}
          onChange={(containerNumber) => setForm({ ...form, containerNumber })}
          error={errors.containerNumber}
          className="sm:col-span-2"
        />
        <SelectField
          label="Size"
          value={form.size}
          onChange={update('size')}
          options={SIZE_OPTIONS}
          error={errors.size}
        />
        <SelectField
          label="Load"
          value={form.loadStatus}
          onChange={update('loadStatus')}
          options={[
            { value: 'FULL', label: 'Full' },
            { value: 'EMPTY', label: 'Empty' },
          ]}
          error={errors.loadStatus}
        />
        <TextField
          label="Owner code"
          value={form.ownerCode}
          onChange={(event) => setForm({ ...form, ownerCode: event.target.value.toUpperCase() })}
          error={errors.ownerCode}
          maxLength={3}
          inputClassName="numeric"
          placeholder="HNF"
        />
        <TextField
          label="Gross weight (kg)"
          type="number"
          value={form.grossWeightKg}
          onChange={update('grossWeightKg')}
          error={errors.grossWeightKg}
          inputClassName="numeric"
        />
        <CheckboxField
          label="High cube"
          checked={form.isHighCube}
          onChange={(isHighCube) => setForm({ ...form, isHighCube })}
        />
        <CheckboxField
          label="Dangerous goods"
          checked={form.isDangerous}
          onChange={(isDangerous) => setForm({ ...form, isDangerous })}
        />
        {form.isDangerous && (
          <TextField
            label="IMO class"
            value={form.imoClass}
            onChange={update('imoClass')}
            error={errors.imoClass}
            inputClassName="numeric"
            placeholder="3"
          />
        )}
        <div className="sm:col-span-2">
          <ErrorNote error={generalError(add.error, errors)} />
        </div>
      </form>
    </Dialog>
  );
}

function ImportProblems({ error }) {
  if (!error?.details?.length) {
    return <ErrorNote error={error} />;
  }
  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-control bg-soft-danger p-3 text-sm text-danger"
    >
      <p className="font-semibold">{error.message}</p>
      <ul className="max-h-48 list-disc overflow-y-auto pl-5">
        {error.details.map((problem, index) => (
          <li key={index}>
            {problem.line ? `Line ${problem.line}: ` : ''}
            {problem.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ImportItemsDialog({ visitId, onClose }) {
  const [fileName, setFileName] = useState('');
  const [csvText, setCsvText] = useState('');
  const importItems = useImportVisitItems(visitId, { onSuccess: onClose });

  async function readFile(event) {
    const file = event.target.files[0];
    if (!file) {
      return;
    }
    setFileName(file.name);
    setCsvText(await file.text());
    importItems.reset();
  }

  return (
    <Dialog
      title="Import a discharge or load list"
      description="A CSV file with one container per line. All lines are checked first; if one line is wrong, nothing is imported."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!csvText || importItems.isPending}
            onClick={() => importItems.mutate(csvText)}
          >
            {importItems.isPending ? 'Importing…' : 'Import list'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-tile border-2 border-dashed border-line p-4 text-center text-sm hover:bg-tile">
          <span className="font-medium">{fileName || 'Choose a CSV file'}</span>
          <span className="text-xs text-muted">Up to 1 MB</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={readFile}
            aria-label="CSV file"
          />
        </label>
        <div>
          <p className="text-xs text-muted">The first line must be:</p>
          <code className="numeric mt-1 block overflow-x-auto rounded-control bg-tile p-2 text-[11px]">
            {CSV_TEMPLATE}
          </code>
        </div>
        <ImportProblems error={importItems.error} />
      </div>
    </Dialog>
  );
}
