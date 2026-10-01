import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  bookingBody,
  dateChipLabel,
  slotStartLabel,
} from '../src/features/portal/BookingSheet.jsx';
import { containerLine } from '../src/features/portal/PortalBoxesPage.jsx';
import { openAmountCents } from '../src/features/portal/PortalInvoicesPage.jsx';
import {
  activePreAdviceByContainer,
  bookingDates,
  containerStatus,
  latestInvoiceByContainer,
  slotAvailability,
} from '../src/features/portal/portal-api.js';
import { fakeSocket } from './fake-socket.js';
import { apiError, jsonResponse, ok, page, renderApp, stubApi } from './render-app.jsx';

const COMPANY = { id: 1, code: 'HNF', name: 'Hanse North Freight' };
const CUSTOMER = {
  id: 4,
  name: 'Lea Hansen',
  email: 'ops@hansenorth.example',
  role: 'CUSTOMER',
  company: COMPANY,
};
const HOUR_MS = 3_600_000;

function container(number, overrides = {}) {
  return {
    id: Number(number.slice(4, 10)),
    number,
    displayNumber: `${number.slice(0, 4)} ${number.slice(4, 10)} ${number.slice(10)}`,
    size: 'FT40',
    isHighCube: false,
    loadStatus: 'FULL',
    isDangerous: false,
    state: 'IN_YARD',
    dwellDays: 4,
    positionCode: 'B-02-03-1',
    hasHold: false,
    owner: COMPANY,
    ...overrides,
  };
}

const IN_YARD = [
  container('HNFU2045711'),
  container('HNFU4158194', { hasHold: true, positionCode: 'D-06-04-3' }),
];

const INVOICE = {
  id: 423,
  number: 'INV-2026-00462',
  containerNumber: 'HNFU2045711',
  displayNumber: 'HNFU 204571 1',
  company: COMPANY,
  periodFrom: '2026-09-22T12:20:00Z',
  periodTo: '2026-09-30T07:00:00Z',
  days: 8,
  freeDays: 5,
  chargeableDays: 3,
  dailyRateCents: 1500,
  amountCents: 4500,
  status: 'UNPAID',
  createdAt: '2026-09-30T00:39:46Z',
  pdfUrl: '/api/v1/invoices/423/pdf',
};

function slot(id, startsInHours, overrides = {}) {
  const startsAt = new Date(Date.now() + startsInHours * HOUR_MS);
  return {
    id,
    date: startsAt.toISOString().slice(0, 10),
    startHour: 8 + id,
    startsAt: startsAt.toISOString(),
    endsAt: new Date(startsAt.getTime() + HOUR_MS).toISOString(),
    capacity: 10,
    booked: 2,
    remaining: 8,
    isFull: false,
    ...overrides,
  };
}

const PRE_ADVICE = {
  id: 900,
  reference: 'PA-20261002-0001',
  type: 'PICKUP',
  status: 'ACTIVE',
  containerNumber: 'HNFU2045711',
  displayNumber: 'HNFU 204571 1',
  truckPlate: 'HH-QA 101',
  driverName: 'Test Driver',
  company: COMPANY,
  timeSlot: {
    id: 2,
    date: '2026-10-02',
    startHour: 10,
    startsAt: '2026-10-02T08:00:00Z',
    endsAt: '2026-10-02T09:00:00Z',
  },
};

function containersHandler(_body, url) {
  const params = url.searchParams;
  if (params.get('pageSize') === '1') {
    const totals = { IN_YARD: params.get('hasHold') ? 1 : 2, EXPECTED: 7 };
    return page([], totals[params.get('state')] ?? 0);
  }
  if (params.get('state') === 'EXPECTED') {
    return page([]);
  }
  return page(IN_YARD);
}

function portalApi(extra = {}) {
  return stubApi({
    'GET /auth/me': () => ok(CUSTOMER),
    'GET /containers': containersHandler,
    'GET /invoices': () => page([INVOICE]),
    'GET /pre-advices': () => page([]),
    'GET /notifications': () => ok([]),
    'GET /time-slots': () =>
      ok([slot(1, 0.5), slot(2, 3), slot(3, 4, { isFull: true, remaining: 0, booked: 10 })]),
    ...extra,
  });
}

function bodyOf(fetchMock, method, path, index = 0) {
  const calls = fetchMock.mock.calls.filter(
    ([url, options = {}]) =>
      (options.method ?? 'GET') === method && url.split('?')[0] === `/api/v1${path}`,
  );
  return JSON.parse(calls[index][1].body);
}

describe('portal helpers', () => {
  it('lists the next seven days for booking', () => {
    const dates = bookingDates('2026-09-29');
    expect(dates).toHaveLength(7);
    expect(dates[0]).toBe('2026-09-29');
    expect(dates[6]).toBe('2026-10-05');
    expect(dateChipLabel('2026-10-01')).toEqual({ weekday: 'Thu', day: '01.10.' });
    expect(slotStartLabel({ startHour: 9 })).toBe('09:00');
  });

  it('only offers slots that are open, not full and at least an hour away', () => {
    const now = new Date('2026-10-01T08:00:00Z');
    const base = { capacity: 10, remaining: 4, isFull: false };
    expect(slotAvailability({ ...base, startsAt: '2026-10-01T10:00:00Z' }, now)).toEqual({
      bookable: true,
      reason: '4 left',
    });
    expect(slotAvailability({ ...base, startsAt: '2026-10-01T08:30:00Z' }, now).reason).toBe(
      'Too late',
    );
    expect(
      slotAvailability({ ...base, startsAt: '2026-10-01T10:00:00Z', isFull: true }, now).reason,
    ).toBe('Full');
    expect(
      slotAvailability({ ...base, capacity: 0, startsAt: '2026-10-01T10:00:00Z' }, now).reason,
    ).toBe('Closed');
  });

  it('keeps the newest invoice and the active booking per container', () => {
    const latest = latestInvoiceByContainer([
      { containerNumber: 'A', createdAt: '2026-09-01T00:00:00Z', number: 'old' },
      { containerNumber: 'A', createdAt: '2026-09-20T00:00:00Z', number: 'new' },
    ]);
    expect(latest.get('A').number).toBe('new');
    const active = activePreAdviceByContainer([
      { containerNumber: 'A', status: 'EXPIRED' },
      { containerNumber: 'B', status: 'ACTIVE' },
    ]);
    expect([...active.keys()]).toEqual(['B']);
  });

  it('shows hold before any other container status', () => {
    expect(containerStatus({ state: 'IN_YARD', hasHold: true }).label).toBe('Hold');
    expect(containerStatus({ state: 'IN_YARD', hasHold: false }).label).toBe('In yard');
    expect(containerStatus({ state: 'EXPECTED', hasHold: false }).label).toBe('Expected');
    expect(containerStatus({ state: 'DEPARTED', hasHold: false }).label).toBe('Departed');
  });

  it('describes a container with its day, invoice and booking', () => {
    expect(containerLine(container('HNFU2045711'), { status: 'UNPAID' }, { type: 'PICKUP' })).toBe(
      "40' · Full · day 5 · Invoice to pay · Pickup booked",
    );
    expect(containerLine(container('HNFU2045711', { state: 'EXPECTED', dwellDays: null }))).toBe(
      "40' · Full",
    );
  });

  it('builds pickup and delivery bookings', () => {
    const shared = {
      containerNumber: 'HNFU2045711',
      slotId: 3,
      truckPlate: 'HH-AB 1',
      driverName: 'Jan',
    };
    expect(bookingBody({ type: 'PICKUP', ...shared, cargo: {} })).toEqual({
      type: 'PICKUP',
      timeSlotId: 3,
      containerNumber: 'HNFU2045711',
      truckPlate: 'HH-AB 1',
      driverName: 'Jan',
    });
    const cargo = {
      size: 'FT20',
      isHighCube: false,
      loadStatus: 'FULL',
      isDangerous: true,
      imoClass: '3',
      grossWeightKg: '18000',
    };
    expect(bookingBody({ type: 'DELIVERY', ...shared, cargo })).toMatchObject({
      imoClass: '3',
      grossWeightKg: 18000,
    });
    expect(
      bookingBody({
        type: 'DELIVERY',
        ...shared,
        cargo: { ...cargo, isDangerous: false, grossWeightKg: '' },
      }),
    ).toMatchObject({
      imoClass: null,
      grossWeightKg: undefined,
    });
  });

  it('adds up the unpaid invoices', () => {
    expect(
      openAmountCents([
        { status: 'UNPAID', amountCents: 4500 },
        { status: 'PAID', amountCents: 900 },
        { status: 'UNPAID', amountCents: 100 },
      ]),
    ).toBe(4600);
  });
});

describe('customer portal', () => {
  it('shows counts, the hold alert and container cards', async () => {
    portalApi({ 'GET /pre-advices': () => page([PRE_ADVICE]) });
    renderApp('/portal');
    const counts = await screen.findByRole('region', { name: 'Container counts' });
    await waitFor(() => expect(within(counts).getByText('On hold 1')).toBeInTheDocument());
    expect(within(counts).getByText('Expected 7')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('1 container is on customs hold');
    const list = screen.getByRole('list', { name: 'Containers' });
    expect(await within(list).findByText(/Invoice to pay · Pickup booked/)).toBeInTheDocument();
    expect(within(list).getByText('Hold')).toBeInTheDocument();
  });

  it('books a pickup slot and reveals the PIN once', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const fetchMock = portalApi({
      'POST /pre-advices': () =>
        ok(
          {
            ...PRE_ADVICE,
            pin: '013116',
            invoice: { number: 'INV-1', amountCents: 4500, status: 'UNPAID' },
          },
          201,
        ),
    });
    renderApp('/portal');
    await userEvent.click(await screen.findByRole('button', { name: 'Book a pickup slot' }));
    const sheet = screen.getByRole('dialog', { name: 'Book a pickup slot' });
    await userEvent.type(within(sheet).getByLabelText('Container to pick up'), 'HNFU2045711');
    expect(within(sheet).getByText('ISO 6346 check digit valid')).toBeInTheDocument();
    const slots = await within(sheet).findAllByRole('radio', { name: /left|Too late|Full/ });
    expect(slots[0]).toBeDisabled();
    expect(slots[2]).toBeDisabled();
    await userEvent.click(slots[1]);
    await userEvent.type(within(sheet).getByLabelText('Truck plate'), 'hh-qa 101');
    await userEvent.type(within(sheet).getByLabelText('Driver name'), 'Test Driver');
    await userEvent.click(within(sheet).getByRole('button', { name: /^Confirm/ }));
    const reveal = await screen.findByRole('dialog', { name: 'Slot booked' });
    expect(within(reveal).getByText('013116')).toBeInTheDocument();
    expect(within(reveal).getByText(/shown only once/)).toBeInTheDocument();
    expect(within(reveal).getByText(/€45.00 · to pay/)).toBeInTheDocument();
    await userEvent.click(within(reveal).getByRole('button', { name: 'Copy PIN' }));
    expect(writeText).toHaveBeenCalledWith('013116');
    expect(await within(reveal).findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(bodyOf(fetchMock, 'POST', '/pre-advices')).toEqual({
      type: 'PICKUP',
      timeSlotId: 2,
      containerNumber: 'HNFU2045711',
      truckPlate: 'HH-QA 101',
      driverName: 'Test Driver',
    });
    await userEvent.click(within(reveal).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens a container page and starts a pickup booking from it', async () => {
    portalApi({
      'GET /containers/HNFU2045711': () =>
        ok({
          ...IN_YARD[0],
          gateInAt: '2026-09-27T08:00:00Z',
          departedAt: null,
          holds: [],
          invoices: [],
          history: [],
        }),
    });
    const { router } = renderApp('/portal');
    await userEvent.click(await screen.findByText('HNFU 204571 1'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/portal/containers/HNFU2045711'),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Book a pickup for this container' }),
    );
    const sheet = screen.getByRole('dialog', { name: 'Book a pickup slot' });
    expect(within(sheet).getByLabelText('Container to pick up')).toHaveValue('HNFU2045711');
  });

  it("says not found for another company's container", async () => {
    portalApi({
      'GET /containers/NRTU2836393': () => apiError(404, 'NOT_FOUND', 'Container not found'),
    });
    renderApp('/portal/containers/NRTU2836393');
    expect(await screen.findByRole('heading', { name: 'Container not found' })).toBeInTheDocument();
  });

  it('shows delivery validation errors next to the fields', async () => {
    portalApi({
      'POST /pre-advices': () =>
        apiError(422, 'VALIDATION_FAILED', 'Validation failed', [
          {
            field: 'body.grossWeightKg',
            message: 'Gross weight must be a whole number of kilograms',
          },
        ]),
    });
    renderApp('/portal/slots');
    await userEvent.click(await screen.findByRole('button', { name: 'Book a slot' }));
    const sheet = screen.getByRole('dialog');
    await userEvent.click(within(sheet).getByRole('tab', { name: 'Delivery' }));
    expect(
      within(sheet).getByRole('heading', { name: 'Book a delivery slot' }),
    ).toBeInTheDocument();
    await userEvent.type(within(sheet).getByLabelText('Container number'), 'HNFU2045711');
    await userEvent.click((await within(sheet).findAllByRole('radio', { name: /left/ }))[0]);
    await userEvent.click(within(sheet).getByRole('button', { name: /^Confirm/ }));
    expect(
      await within(sheet).findByText('Gross weight must be a whole number of kilograms'),
    ).toBeInTheDocument();
  });

  it('creates a new PIN and cancels a booking', async () => {
    const fetchMock = portalApi({
      'GET /pre-advices': () => page([PRE_ADVICE]),
      'POST /pre-advices/900/regenerate-pin': () => ok({ ...PRE_ADVICE, pin: '777111' }),
      'POST /pre-advices/900/cancel': () => ok({ ...PRE_ADVICE, status: 'CANCELLED' }),
    });
    renderApp('/portal/slots');
    await userEvent.click(await screen.findByRole('button', { name: 'New PIN' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create new PIN' }));
    expect(await screen.findByText('777111')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel booking' }));
    expect(await screen.findByText('PA-20261002-0001 cancelled')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/pre-advices/900/cancel'))).toBe(
      true,
    );
  });

  it('marks alerts read and shows new ones live', async () => {
    const alert = {
      id: 227,
      type: 'CUSTOMS_HOLD_PLACED',
      message: 'HNFU 415819 4 is on customs hold.',
      isRead: false,
      createdAt: '2026-10-01T01:55:21Z',
    };
    const fetchMock = portalApi({
      'GET /notifications': () =>
        jsonResponse(200, { data: [alert], page: 1, pageSize: 50, total: 1, unreadCount: 1 }),
      'POST /notifications/227/read': () => ok({ ...alert, isRead: true }),
      'POST /notifications/read-all': () => ok({ updated: 1 }),
    });
    renderApp('/portal/alerts');
    expect(await screen.findByRole('link', { name: 'Alerts, 1 unread' })).toBeInTheDocument();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Unread: HNFU 415819 4 is on customs hold.' }),
    );
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/notifications/227/read'))).toBe(
        true,
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Mark all read' }));
    expect(await screen.findByText('All alerts marked as read')).toBeInTheDocument();
    act(() => {
      fakeSocket.emit('notification:new', {
        id: 300,
        message: 'HNFU 204571 1 is ready for pickup.',
      });
    });
    expect(await screen.findByText('HNFU 204571 1 is ready for pickup.')).toBeInTheDocument();
  });

  it('shows the open amount and invoice PDFs', async () => {
    portalApi();
    renderApp('/portal/invoices');
    const open = await screen.findByRole('region', { name: 'Open amount' });
    await waitFor(() => expect(within(open).getByText('€45.00')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Download PDF' })).toHaveAttribute(
      'href',
      '/api/v1/invoices/423/pdf',
    );
  });
});
