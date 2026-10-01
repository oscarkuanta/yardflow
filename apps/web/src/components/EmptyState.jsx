export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      {Icon && (
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-tile bg-tile text-muted">
          <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
        </span>
      )}
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="max-w-md text-sm text-muted">{children}</p>
    </div>
  );
}
