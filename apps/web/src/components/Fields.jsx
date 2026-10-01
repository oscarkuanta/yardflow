import { getContainerNumberError, normalizeContainerNumber } from '@yardflow/shared';
import { useId } from 'react';
import { TextField } from './TextField.jsx';

function FieldFrame({ id, label, message, error, className = '', children }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-xs font-medium text-muted">
        {label}
      </label>
      {children}
      {message && (
        <p id={`${id}-message`} className={`text-xs ${error ? 'text-danger' : 'text-muted'}`}>
          {message}
        </p>
      )}
    </div>
  );
}

const CONTROL_CLASSES =
  'min-h-11 rounded-control border bg-surface px-3.5 text-sm text-ink placeholder:text-muted';

export function SelectField({ label, error, hint, options, className, ...props }) {
  const id = useId();
  const message = error ?? hint;
  return (
    <FieldFrame id={id} label={label} message={message} error={error} className={className}>
      <select
        id={id}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={message ? `${id}-message` : undefined}
        className={`${CONTROL_CLASSES} ${error ? 'border-danger' : 'border-line'}`}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldFrame>
  );
}

export function TextAreaField({ label, error, hint, className, ...props }) {
  const id = useId();
  const message = error ?? hint;
  return (
    <FieldFrame id={id} label={label} message={message} error={error} className={className}>
      <textarea
        id={id}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={message ? `${id}-message` : undefined}
        className={`${CONTROL_CLASSES} min-h-20 py-2.5 ${error ? 'border-danger' : 'border-line'}`}
        {...props}
      />
    </FieldFrame>
  );
}

export function CheckboxField({ label, checked, onChange, className = '' }) {
  return (
    <label className={`flex min-h-11 items-center gap-2.5 text-sm ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 accent-[var(--accent)]"
      />
      {label}
    </label>
  );
}

export const CHECK_DIGIT_VALID = 'ISO 6346 check digit valid';

export function containerNumberFeedback(value) {
  const normalized = normalizeContainerNumber(value ?? '');
  if (normalized.length < 11) {
    return { error: null, hint: 'Four letters, six digits and the check digit' };
  }
  const error = getContainerNumberError(normalized);
  return error ? { error, hint: null } : { error: null, hint: CHECK_DIGIT_VALID };
}

export function ContainerNumberField({
  value,
  onChange,
  error,
  label = 'Container number',
  ...props
}) {
  const feedback = containerNumberFeedback(value);
  return (
    <TextField
      label={label}
      value={value}
      onChange={(event) => onChange(normalizeContainerNumber(event.target.value))}
      error={error ?? feedback.error ?? undefined}
      hint={feedback.hint ?? undefined}
      maxLength={14}
      autoComplete="off"
      spellCheck="false"
      inputClassName="numeric uppercase"
      {...props}
    />
  );
}
