import { DemoSection } from './DemoSection.jsx';
import { HeroSection } from './HeroSection.jsx';
import { HowItWorksSection, PlatformSection } from './InfoSections.jsx';
import { LandingTopBar } from './LandingTopBar.jsx';
import { usePublicStats } from './usePublicStats.js';

export function LandingPage() {
  const { data: stats, isPending } = usePublicStats();
  return (
    <div className="animate-fade-in pb-16">
      <LandingTopBar />
      <main className="flex flex-col gap-16">
        <HeroSection stats={stats} isPending={isPending} />
        <DemoSection />
        <PlatformSection />
        <HowItWorksSection />
      </main>
      <footer className="mx-auto mt-16 flex max-w-7xl flex-col gap-1 px-4 text-xs text-muted md:px-8">
        <p>YardFlow is a portfolio project for one fictional container terminal.</p>
        <p>Photos from Unsplash, used under the Unsplash License.</p>
      </footer>
    </div>
  );
}
