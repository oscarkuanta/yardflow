import { ArrowLeft, CalendarPlus, SearchX } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../../components/Button.jsx';
import { EmptyState } from '../../components/EmptyState.jsx';
import { ErrorNote } from '../../components/Overlay.jsx';
import { Skeleton } from '../../components/Skeleton.jsx';
import { ContainerDetails } from '../containers/ContainerDrawer.jsx';
import { useContainer } from '../containers/containers-api.js';
import { BookingSheet } from './BookingSheet.jsx';
import { activePreAdviceByContainer, usePreAdvices } from './portal-api.js';

function BackLink() {
  return (
    <Link
      to="/portal"
      className="inline-flex items-center gap-2 self-start text-sm text-muted hover:text-ink"
    >
      <ArrowLeft size={16} aria-hidden="true" />
      All containers
    </Link>
  );
}

export function PortalContainerPage() {
  const { number } = useParams();
  const { data: container, isPending, error } = useContainer(number);
  const preAdvices = activePreAdviceByContainer(
    usePreAdvices({ status: 'ACTIVE' }).data?.data ?? [],
  );
  const [isBooking, setIsBooking] = useState(false);

  if (isPending) {
    return <Skeleton className="h-64 rounded-panel" />;
  }
  if (error?.status === 404 || error?.status === 422) {
    return (
      <div className="flex flex-col gap-3">
        <BackLink />
        <div className="panel">
          <EmptyState icon={SearchX} title="Container not found">
            There is no container {number} for your company. Check the number on your documents.
          </EmptyState>
        </div>
      </div>
    );
  }
  if (error) {
    return <ErrorNote error={error} />;
  }

  const canBookPickup = container.state === 'IN_YARD' && !preAdvices.has(container.number);
  return (
    <div className="flex flex-col gap-3">
      <BackLink />
      <section className="panel flex flex-col gap-4 p-4" aria-labelledby="container-title">
        <h2 id="container-title" className="numeric text-2xl">
          {container.displayNumber}
        </h2>
        <ContainerDetails container={container} />
      </section>
      {canBookPickup && (
        <Button size="large" onClick={() => setIsBooking(true)}>
          <CalendarPlus size={18} aria-hidden="true" />
          Book a pickup for this container
        </Button>
      )}
      {isBooking && (
        <BookingSheet initialContainer={container.number} onClose={() => setIsBooking(false)} />
      )}
    </div>
  );
}
