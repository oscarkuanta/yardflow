export function LiveDot() {
  return (
    <span aria-hidden="true" className="relative inline-flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-60 animate-pulse-dot" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
    </span>
  );
}
