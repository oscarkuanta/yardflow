export function Skeleton({ className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse rounded-control bg-tile ${className}`}
    />
  );
}
