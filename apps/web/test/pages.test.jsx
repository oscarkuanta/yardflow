import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { UNAUTHENTICATED, jsonResponse, renderApp, stubApi } from './render-app.jsx';

const PLANNER = { id: 2, name: 'Mira Pohl', email: 'planner@yardflow.dev', role: 'PLANNER' };
const CUSTOMER = {
  id: 9,
  name: 'Lea Hansen',
  email: 'ops@hansenorth.example',
  role: 'CUSTOMER',
  company: { id: 1, code: 'HNS', name: 'Hansen North Logistics' },
};

const STATS = {
  containersInYard: 900,
  occupancyPercent: 65,
  gateMovesToday: 41,
  averageDwellDays: 6.7,
  averageGateInMinutes: null,
  recentGateEvents: [
    {
      kind: 'IN',
      containerNumber: 'HNFU •••571 1',
      size: 'FT40',
      lane: 2,
      plate: 'HH-•• ••2',
      at: '2026-07-01T10:05:00Z',
    },
  ],
  generatedAt: '2026-07-01T10:06:00Z',
};

const signedIn = (user) => () => jsonResponse(200, { data: user });

describe('landing page', () => {
  it('shows the live numbers and the masked gate feed', async () => {
    stubApi({ 'GET /public/stats': () => jsonResponse(200, { data: STATS }) });
    renderApp('/');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Every box in the yard.');
    const numbers = await screen.findByRole('list', { name: 'Yard numbers' });
    await waitFor(() => expect(within(numbers).getByText('65.0')).toBeInTheDocument());
    expect(within(numbers).getByText('41')).toBeInTheDocument();
    expect(within(numbers).getByText('—')).toBeInTheDocument();
    const feed = screen.getByRole('list', { name: 'Latest gate events' });
    expect(within(feed).getByText('HNFU •••571 1')).toBeInTheDocument();
    expect(within(feed).getByText('12:05')).toBeInTheDocument();
    expect(screen.getByText(/containers tracked right now/)).toHaveTextContent('900');
  });

  it('shows an empty gate feed before the first truck', async () => {
    stubApi({
      'GET /public/stats': () => jsonResponse(200, { data: { ...STATS, recentGateEvents: [] } }),
    });
    renderApp('/');
    expect(
      await screen.findByText('Gate events appear here as soon as trucks pass the gate.'),
    ).toBeInTheDocument();
  });

  it('links every demo account to a prefilled login', async () => {
    stubApi({ 'GET /public/stats': () => jsonResponse(200, { data: STATS }) });
    renderApp('/');
    const adminLink = screen.getByRole('link', { name: /admin@yardflow\.dev/ });
    expect(adminLink).toHaveAttribute('href', '/login?email=admin%40yardflow.dev');
  });

  it('switches between dark and light theme and remembers the choice', async () => {
    stubApi({ 'GET /public/stats': () => jsonResponse(200, { data: STATS }) });
    renderApp('/');
    expect(document.documentElement.dataset.theme).toBe('dark');
    await userEvent.click(screen.getByRole('button', { name: 'Switch to light theme' }));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(window.localStorage.getItem('yardflow.theme')).toBe('light');
  });
});

describe('login page', () => {
  it('fills both fields from a demo account button', async () => {
    stubApi({ 'GET /auth/me': UNAUTHENTICATED });
    renderApp('/login');
    await userEvent.click(screen.getByRole('button', { name: /Gate operator/ }));
    expect(screen.getByLabelText('Email')).toHaveValue('gate@yardflow.dev');
    expect(screen.getByLabelText('Password')).toHaveValue('demo1234');
  });

  it('prefills the email and demo password from the link', async () => {
    stubApi({ 'GET /auth/me': UNAUTHENTICATED });
    renderApp('/login?email=planner%40yardflow.dev');
    expect(screen.getByLabelText('Email')).toHaveValue('planner@yardflow.dev');
    expect(screen.getByLabelText('Password')).toHaveValue('demo1234');
  });

  it('shows the API message when the sign-in fails', async () => {
    stubApi({
      'GET /auth/me': UNAUTHENTICATED,
      'POST /auth/login': () =>
        jsonResponse(401, {
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Email or password is wrong',
            details: [],
          },
        }),
    });
    renderApp('/login');
    await userEvent.type(screen.getByLabelText('Email'), 'admin@yardflow.dev');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is wrong');
  });

  it('shows validation errors next to the fields', async () => {
    stubApi({
      'GET /auth/me': UNAUTHENTICATED,
      'POST /auth/login': () =>
        jsonResponse(400, {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: [{ field: 'body.email', message: 'Enter a valid email' }],
          },
        }),
    });
    renderApp('/login');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('opens the staff app after a successful staff sign-in', async () => {
    const fetchMock = stubApi({
      'GET /auth/me': UNAUTHENTICATED,
      'POST /auth/login': signedIn(PLANNER),
    });
    const { router } = renderApp('/login');
    await userEvent.click(screen.getByRole('button', { name: /Planner/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/app'));
    const loginCall = fetchMock.mock.calls.find(([url]) => url.endsWith('/auth/login'));
    expect(JSON.parse(loginCall[1].body)).toEqual({
      email: 'planner@yardflow.dev',
      password: 'demo1234',
    });
  });

  it('sends a signed-in user straight to their home', async () => {
    stubApi({ 'GET /auth/me': signedIn(CUSTOMER) });
    const { router } = renderApp('/login');
    await waitFor(() => expect(router.state.location.pathname).toBe('/portal'));
  });
});

describe('protected areas', () => {
  it('sends guests to the login page', async () => {
    stubApi({ 'GET /auth/me': UNAUTHENTICATED });
    const { router } = renderApp('/app/vessels');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.state).toEqual({ from: '/app/vessels' });
  });

  it('keeps customers out of the staff app', async () => {
    stubApi({ 'GET /auth/me': signedIn(CUSTOMER) });
    const { router } = renderApp('/app');
    await waitFor(() => expect(router.state.location.pathname).toBe('/portal'));
    expect(await screen.findByText('Hansen North Logistics')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Portal' })).toBeInTheDocument();
  });

  it('keeps staff out of the customer portal', async () => {
    stubApi({ 'GET /auth/me': signedIn(PLANNER) });
    const { router } = renderApp('/portal');
    await waitFor(() => expect(router.state.location.pathname).toBe('/app'));
  });

  it('sends a planner away from a screen for other roles', async () => {
    stubApi({ 'GET /auth/me': signedIn(PLANNER) });
    const { router } = renderApp('/app/gate');
    await waitFor(() => expect(router.state.location.pathname).toBe('/app'));
  });

  it('shows staff only the navigation for their role', async () => {
    stubApi({ 'GET /auth/me': signedIn(PLANNER) });
    renderApp('/app/vessels');
    const navigation = await screen.findByRole('navigation', { name: 'Staff' });
    expect(within(navigation).getByRole('link', { name: /Vessels/ })).toBeInTheDocument();
    expect(within(navigation).queryByRole('link', { name: /Gate/ })).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Vessels' })).toBeInTheDocument();
  });

  it('signs out and returns to the login page', async () => {
    stubApi({
      'GET /auth/me': signedIn(PLANNER),
      'POST /auth/logout': () => new Response(null, { status: 204 }),
    });
    const { router } = renderApp('/app');
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });

  it('shows a not found page for unknown addresses', async () => {
    stubApi({});
    renderApp('/nowhere');
    expect(screen.getByText('This page does not exist')).toBeInTheDocument();
  });
});
