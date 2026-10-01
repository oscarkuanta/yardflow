import { Skeleton } from './Skeleton.jsx';

export function FullPageLoader() {
  return (
    <div role="status" aria-live="polite" className="min-h-screen bg-bg p-4">
      <span className="sr-only">Loading YardFlow</span>
      <div className="mx-auto flex max-w-6xl flex-col gap-4 pt-4">
        <Skeleton className="h-14 w-full rounded-full" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    </div>
  );
}
