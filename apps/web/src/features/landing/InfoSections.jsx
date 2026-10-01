import { ClipboardList, Map as MapIcon, ShieldCheck, Truck } from 'lucide-react';

const ROLES = [
  {
    icon: MapIcon,
    title: 'Planner',
    points: [
      'Live yard map with every stack',
      'Slot suggestions and relocation work orders',
      'Vessel discharge and load lists',
    ],
  },
  {
    icon: Truck,
    title: 'Gate operator',
    points: [
      'Truck plate and PIN check',
      'Damage inspection per side',
      'Four gate-out checks and an EIR ticket',
    ],
  },
  {
    icon: ClipboardList,
    title: 'Customer',
    points: [
      'Own containers and invoices',
      'Book a time slot and get a PIN',
      'Live alerts for holds and pickups',
    ],
  },
  {
    icon: ShieldCheck,
    title: 'Admin',
    points: ['Users, blocks, tariffs and slots', 'Customs holds and billing', 'Full audit log'],
  },
];

const STEPS = [
  {
    title: 'Discharge',
    text: 'The planner confirms each container off the vessel into one of the three best slots.',
  },
  {
    title: 'Book a slot',
    text: 'The customer books a pickup slot, pays storage and gets a six-digit PIN for the driver.',
  },
  {
    title: 'Gate check',
    text: 'At the gate, plate, PIN, driver, customs and invoice are checked in seconds.',
  },
  {
    title: 'Gate-out',
    text: 'Containers on top are relocated in order, then the truck leaves with its EIR ticket.',
  },
];

export function PlatformSection() {
  return (
    <section id="platform" className="mx-auto max-w-7xl scroll-mt-24 px-4 md:px-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-[28px] font-semibold md:text-[36px]">One yard, four roles</h2>
        <p className="max-w-2xl text-base text-muted">
          Everyone sees the same live yard, but only what their job needs.
        </p>
      </div>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ROLES.map(({ icon: Icon, title, points }) => (
          <li key={title} className="panel flex flex-col gap-3 p-5">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-tile bg-soft-accent text-accent-text">
              <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <h3 className="text-base font-semibold">{title}</h3>
            <ul className="flex flex-col gap-1.5 text-sm text-muted">
              {points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="mx-auto max-w-7xl scroll-mt-24 px-4 md:px-8">
      <h2 className="text-[28px] font-semibold md:text-[36px]">From vessel to truck</h2>
      <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, index) => (
          <li key={step.title} className="panel flex flex-col gap-2 p-5">
            <span className="numeric text-sm text-accent-text">0{index + 1}</span>
            <h3 className="text-base font-semibold">{step.title}</h3>
            <p className="text-sm text-muted">{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
