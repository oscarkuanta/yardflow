import { Logo } from '../../components/Logo.jsx';
import { ButtonLink } from '../../components/Button.jsx';
import { ThemeToggle } from '../../components/ThemeToggle.jsx';

const GITHUB_URL = import.meta.env.VITE_GITHUB_URL;

const LINKS = [
  { label: 'Platform', href: '#platform' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'API docs', href: '/api/docs' },
  ...(GITHUB_URL ? [{ label: 'GitHub', href: GITHUB_URL }] : []),
];

export function LandingTopBar() {
  return (
    <header data-theme="dark" className="sticky top-3 z-30 px-4 text-ink md:px-8">
      <nav
        aria-label="Main"
        className="glass mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-full py-1.5 pl-5 pr-1.5"
      >
        <Logo />
        <ul className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <li key={link.label}>
              <a
                href={link.href}
                className="rounded-full px-4 py-2 text-sm text-muted transition-colors hover:text-ink"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <ButtonLink to="/login" className="rounded-full">
            Sign in
          </ButtonLink>
        </div>
      </nav>
    </header>
  );
}
