export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[26px] font-semibold tracking-heading">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, actions, children, className = '', bodyClassName = '' }) {
  return (
    <section
      className={`panel overflow-hidden ${className}`}
      aria-label={typeof title === 'string' ? title : undefined}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          {typeof title === 'string' ? <h2 className="text-base font-semibold">{title}</h2> : title}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function SegmentedControl({ label, options, value, onChange, className = '' }) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={`inline-flex rounded-full bg-tile p-1 ${className}`}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.value)}
            className={`min-h-9 rounded-full px-3.5 text-sm transition-colors ${
              isActive ? 'bg-accent font-semibold text-on-accent' : 'text-muted hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function KeyValue({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}
