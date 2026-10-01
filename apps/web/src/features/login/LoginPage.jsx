import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/Button.jsx';
import { Logo } from '../../components/Logo.jsx';
import { ResponsiveImage } from '../../components/ResponsiveImage.jsx';
import { TextField } from '../../components/TextField.jsx';
import { ThemeToggle } from '../../components/ThemeToggle.jsx';
import { fieldErrors } from '../../lib/api.js';
import { DEMO_ACCOUNTS, DEMO_PASSWORD, homePathFor } from '../auth/auth-api.js';
import { useCurrentUser, useLogIn } from '../auth/auth-hooks.js';

function DemoAccountButtons({ onPick }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted">Demo accounts, password {DEMO_PASSWORD}</p>
      <div className="grid grid-cols-2 gap-2">
        {DEMO_ACCOUNTS.map((account) => (
          <button
            key={account.email}
            type="button"
            onClick={() => onPick(account)}
            className="flex min-h-12 flex-col items-start justify-center rounded-control border border-line px-3 py-2 text-left transition-colors hover:bg-tile"
          >
            <span className="text-sm font-medium">{account.label}</span>
            <span className="text-xs text-muted">{account.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const presetEmail = searchParams.get('email') ?? '';
  const [email, setEmail] = useState(presetEmail);
  const [password, setPassword] = useState(presetEmail ? DEMO_PASSWORD : '');
  const location = useLocation();
  const navigate = useNavigate();
  const { data: currentUser } = useCurrentUser();
  const logIn = useLogIn();
  const errors = fieldErrors(logIn.error);

  if (currentUser && !logIn.isPending && !logIn.isSuccess) {
    return <Navigate to={homePathFor(currentUser.role)} replace />;
  }

  function submit(event) {
    event.preventDefault();
    logIn.mutate(
      { email, password },
      {
        onSuccess: (user) =>
          navigate(location.state?.from ?? homePathFor(user.role), { replace: true }),
      },
    );
  }

  function pickDemoAccount(account) {
    setEmail(account.email);
    setPassword(DEMO_PASSWORD);
    logIn.reset();
  }

  return (
    <div className="grid min-h-screen animate-fade-in lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <main className="flex flex-col bg-surface px-4 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Logo />
          <ThemeToggle />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 py-10">
          <div className="flex flex-col gap-2">
            <h1 className="text-[28px] font-semibold">Sign in to YardFlow</h1>
            <p className="text-sm text-muted">Use your work account, or pick a demo role below.</p>
          </div>
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <TextField
              label="Email"
              type="email"
              name="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={errors.email}
              required
            />
            <TextField
              label="Password"
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={errors.password}
              required
            />
            <Button type="submit" size="large" disabled={logIn.isPending}>
              {logIn.isPending ? 'Signing in…' : 'Sign in'}
            </Button>
            {logIn.error && Object.keys(errors).length === 0 && (
              <p
                role="alert"
                className="rounded-control bg-soft-danger px-3 py-2 text-sm text-danger"
              >
                {logIn.error.message}
              </p>
            )}
          </form>
          <DemoAccountButtons onPick={pickDemoAccount} />
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to the start page
          </Link>
        </div>
      </main>
      <aside className="relative hidden lg:block" aria-hidden="true">
        <ResponsiveImage
          name="ship-cranes"
          alt=""
          sizes="50vw"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <p className="absolute bottom-10 left-10 right-10 text-2xl font-semibold tracking-heading text-white">
          Every box in the yard. Every move, live.
        </p>
      </aside>
    </div>
  );
}
