import { useId } from 'react';

export function TextField({ label, error, hint, className = '', inputClassName = '', ...props }) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-xs font-medium text-muted">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={message ? messageId : undefined}
        className={`min-h-11 rounded-control border bg-surface px-3.5 text-sm text-ink placeholder:text-muted ${
          error ? 'border-danger' : 'border-line'
        } ${inputClassName}`}
        {...props}
      />
      {message && (
        <p id={messageId} className={`text-xs ${error ? 'text-danger' : 'text-muted'}`}>
          {message}
        </p>
      )}
    </div>
  );
}
