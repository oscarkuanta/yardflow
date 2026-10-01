import { ArrowRight } from 'lucide-react';
import { ButtonLink } from '../../components/Button.jsx';
import { LiveDot } from '../../components/LiveDot.jsx';
import { ResponsiveImage } from '../../components/ResponsiveImage.jsx';
import { formatNumber } from '../../lib/format.js';
import { GateFeedCard } from './GateFeedCard.jsx';
import { StatCards } from './StatCards.jsx';

function LivePill({ stats }) {
  return (
    <p className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm">
      <LiveDot />
      <span>
        Live yard
        {stats && (
          <>
            {' · '}
            <span className="numeric">{formatNumber(stats.containersInYard)}</span> containers
            tracked right now
          </>
        )}
      </span>
    </p>
  );
}

export function HeroSection({ stats, isPending }) {
  return (
    <section className="relative -mt-[68px] overflow-hidden lg:min-h-[810px]">
      <div aria-hidden="true" className="absolute inset-0">
        <ResponsiveImage name="night-harbor" alt="" eager className="h-full w-full object-cover" />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, var(--hero-veil) 0%, var(--hero-veil-middle) 45%, var(--bg) 100%)',
          }}
        />
      </div>
      <div className="relative mx-auto flex h-full max-w-7xl flex-col gap-10 px-4 pb-8 pt-32 md:px-8 lg:pt-40">
        <div className="grid flex-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex flex-col items-start gap-6">
            <LivePill stats={stats} />
            <h1 className="text-[44px] font-semibold leading-[0.98] tracking-display sm:text-[60px] lg:text-[68px] xl:text-[76px]">
              Every box in the yard.
              <span className="block font-light text-muted">Every move, live.</span>
            </h1>
            <p className="max-w-xl text-base text-muted md:text-[19px] md:leading-relaxed">
              YardFlow tracks every container from vessel to truck: where it sits, when it moves,
              who may take it out and what storage it costs. Planners, gate operators and customers
              work on the same yard, updated live.
            </p>
            <div className="flex flex-wrap gap-3">
              <ButtonLink to="/login" size="large">
                Open live demo
                <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
              </ButtonLink>
              <ButtonLink href="/api/docs" variant="secondary" size="large">
                Explore the API
              </ButtonLink>
            </div>
          </div>
          <GateFeedCard stats={stats} isPending={isPending} />
        </div>
        <StatCards stats={stats} isPending={isPending} />
      </div>
    </section>
  );
}
