import { Compass } from 'lucide-react';
import { ButtonLink } from '../components/Button.jsx';
import { EmptyState } from '../components/EmptyState.jsx';

export function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="panel flex flex-col items-center pb-8">
        <EmptyState icon={Compass} title="This page does not exist">
          The link may be old, or the page moved. Go back to the start page and try again.
        </EmptyState>
        <ButtonLink to="/">Back to the start page</ButtonLink>
      </div>
    </main>
  );
}
