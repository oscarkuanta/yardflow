import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { fakeSocket } from './fake-socket.js';
import { apiError, jsonResponse, ok, page, renderApp, stubApi } from './render-app.jsx';

const ADMIN = {
  id: 1,
  name: 'Anna Keller',
  email: 'admin@yardflow.dev',
  role: 'ADMIN',
  company: null,
};
const PLANNER = {
  id: 2,
  name: 'Mira Pohl',
  email: 'planner@yardflow.dev',
  role: 'PLANNER',
  company: null,
};
const GATE = {
  id: 3,
  name: 'Jonas Reuter',
  email: 'gate@yardflow.dev',
  role: 'GATE_OPERATOR',
  company: null,
};
const OWNER = { id: 1, code: 'HNF', name: 'Hanse North Freight' };

const BLOCKS = [
  {
    id: 1,
    code: 'A',
    type: 'STANDARD',
    sizeClass: 'SMALL',
    rows: 1,
    bays: 2,
    maxTier: 3,
    mapX: 60,
    mapY: 20,
    gateDistanceM: 60,
    occupancy: {
      capacitySlots: 6,
      usedSlots: 3,
      freeSlots: 3,
      occupancyPercent: 50,
      teuCapacity: 6,
      teuUsed: 3,
    },
    stacks: [
      {
        row: 1,
        bay: 1,
        stackCode: 'A-01-01',
        height: 2,
        topSize: 'FT20',
        hasHold: false,
        hasDangerous: false,
      },
      {
        row: 1,
        bay: 2,
        stackCode: 'A-01-02',
        height: 1,
        topSize: 'FT20',
        hasHold: true,
        hasDangerous: false,
      },
    ],
  },
];

const STACK = {
  blockCode: 'A',
  row: 1,
  bay: 1,
  stackCode: 'A-01-01',
  maxTier: 3,
  height: 2,
  tiers: [1, 2].map((tier) => ({
    tier,
    positionCode: `A-01-01-${tier}`,
    container: {
      number: tier === 2 ? 'HNFU2045711' : 'HNFU1000014',
      size: 'FT20',
      isHighCube: false,
      loadStatus: 'FULL',
      isDangerous: false,
      imoClass: null,
      grossWeightKg: 20000,
      gateInAt: '2026-09-20T08:00:00Z',
      owner: OWNER,
      hasHold: false,
    },
  })),
};

const SUGGESTIONS = [
  {
    positionCode: 'A-01-02-2',
    blockCode: 'A',
    row: 1,
    bay: 2,
    tier: 2,
    score: 107,
    maxTier: 3,
    reasons: ['Same owner below'],
  },
  {
    positionCode: 'A-01-03-1',
    blockCode: 'A',
    row: 1,
    bay: 3,
    tier: 1,
    score: 90,
    maxTier: 3,
    reasons: ['Empty stack'],
  },
];

const PRE_ADVICE = {
  id: 41,
  reference: 'PA-2026-00041',
  type: 'DELIVERY',
  status: 'ACTIVE',
  containerNumber: 'HNFU2045711',
  displayNumber: 'HNFU 204571 1',
  size: 'FT20',
  isHighCube: false,
  loadStatus: 'FULL',
  isDangerous: false,
  imoClass: null,
  grossWeightKg: 21000,
  truckPlate: 'HH-YF 175',
  driverName: 'Mats Olsen',
  company: OWNER,
  timeSlot: { id: 1, date: '2026-10-01', startHour: 9 },
};

const KPIS = {
  occupancy: { containersInYard: 3, teuUsed: 3, teuCapacity: 6, percent: 50 },
  gateMovesToday: { in: 1, out: 1, total: 2 },
  currentSlot: null,
  openWorkOrders: { count: 0, oldestAgeMinutes: null },
  activeHolds: 1,
  averageDwellDays: 4.2,
};

function staffApi(user, extra = {}) {
  return stubApi({
    'GET /auth/me': () => ok(user),
    'GET /yard/map': () => ok(BLOCKS),
    'GET /gate/transactions': () => page([]),
    'GET /work-orders': () => page([]),
    'GET /vessel-visits': () => page([]),
    'GET /reports/kpis': () => ok(KPIS),
    'POST /yard/suggestions': () => ok(SUGGESTIONS),
    ...extra,
  });
}

function callsTo(fetchMock, method, path) {
  return fetchMock.mock.calls.filter(
    ([url, options = {}]) =>
      (options.method ?? 'GET') === method && url.split('?')[0] === `/api/v1${path}`,
  );
}

function bodyOf(call) {
  return JSON.parse(call[1].body);
}

describe('yard overview', () => {
  it('draws the yard and opens a stack to move its top container', async () => {
    const fetchMock = staffApi(PLANNER, {
      'GET /yard/stacks/A/1/1': () => ok(STACK),
      'POST /yard/moves': () =>
        ok({ containerNumber: 'HNFU2045711', fromPosition: 'A-01-01-2', toPosition: 'A-01-02-2' }),
    });
    const { container } = renderApp('/app');
    await waitFor(() =>
      expect(container.querySelector('[data-stack="A-01-01"]')).toBeInTheDocument(),
    );
    expect(screen.getAllByText('3 / 6 TEU').length).toBeGreaterThan(0);
    await userEvent.click(container.querySelector('[data-stack="A-01-01"]'));
    const drawer = await screen.findByRole('dialog', { name: 'A-01-01' });
    expect(await within(drawer).findByText('HNFU2045711')).toBeInTheDocument();
    await userEvent.click(await within(drawer).findByRole('button', { name: 'A-01-02-2' }));
    await userEvent.click(within(drawer).getByRole('button', { name: 'Move HNFU2045711' }));
    expect(await screen.findByText('Moved to A-01-02-2')).toBeInTheDocument();
    expect(bodyOf(callsTo(fetchMock, 'POST', '/yard/moves')[0])).toEqual({
      containerNumber: 'HNFU2045711',
      to: 'A-01-02-2',
    });
  });

  it('shows a callout when the yard changes live', async () => {
    staffApi(PLANNER);
    const { container } = renderApp('/app');
    await waitFor(() =>
      expect(container.querySelector('[data-stack="A-01-01"]')).toBeInTheDocument(),
    );
    act(() => {
      fakeSocket.emit('yard:changed', {
        changes: [{ positionCode: 'A-01-01-3', containerNumber: 'HNFU2045711', action: 'PLACED' }],
      });
    });
    expect(screen.getByRole('status')).toHaveTextContent('HNFU2045711 placed at A-01-01-3');
  });

  it('lists the stacks in a table for keyboard users', async () => {
    staffApi(PLANNER);
    renderApp('/app');
    await userEvent.click(await screen.findByRole('tab', { name: 'Table' }));
    const blockTable = await screen.findByRole('region', { name: 'Block A' });
    expect(within(blockTable).getByRole('button', { name: 'A-01-01' })).toBeInTheDocument();
    expect(within(blockTable).getByText('customs hold')).toBeInTheDocument();
  });

  it('does not ask a gate operator for planner data', async () => {
    const fetchMock = staffApi(GATE);
    const { container } = renderApp('/app');
    await waitFor(() =>
      expect(container.querySelector('[data-stack="A-01-01"]')).toBeInTheDocument(),
    );
    expect(screen.getByText('Stacks on hold')).toBeInTheDocument();
    expect(callsTo(fetchMock, 'GET', '/reports/kpis')).toHaveLength(0);
    expect(callsTo(fetchMock, 'GET', '/work-orders')).toHaveLength(0);
    expect(callsTo(fetchMock, 'GET', '/vessel-visits')).toHaveLength(0);
  });

  it('shows live gate denials in the feed', async () => {
    staffApi(PLANNER);
    renderApp('/app');
    const feeds = await screen.findAllByRole('region', { name: 'Gate feed' });
    act(() => {
      fakeSocket.emit('gate:event', {
        id: 'check-1',
        kind: 'DENIED',
        containerNumber: 'HNFU2045711',
        lane: 1,
        plate: 'HH-YF 482',
        message: 'Active customs hold: X-ray',
        at: '2026-10-01T09:00:00Z',
      });
    });
    expect(within(feeds[0]).getByText('DENY')).toBeInTheDocument();
  });
});

async function verifyTruck(direction = 'IN') {
  await userEvent.type(await screen.findByLabelText('Truck plate'), 'hh-yf 175');
  await userEvent.type(screen.getByLabelText('PIN'), '175824');
  await userEvent.click(screen.getByRole('button', { name: 'Verify truck' }));
  if (direction === 'IN') {
    await screen.findByText('Lane 1 camera');
  }
}

describe('gate screens', () => {
  it('runs a full gate-in and opens the EIR ticket', async () => {
    const fetchMock = staffApi(GATE, {
      'POST /gate/verify-truck': () => ok({ preAdvice: PRE_ADVICE, container: null }),
      'POST /gate/in': () =>
        ok(
          {
            gateTransactionId: 9,
            containerNumber: 'HNFU2045711',
            positionCode: 'A-01-02-2',
            eirUrl: '/api/v1/gate/transactions/9/eir.pdf',
          },
          201,
        ),
    });
    renderApp('/app/gate');
    await verifyTruck();
    expect(bodyOf(callsTo(fetchMock, 'POST', '/gate/verify-truck')[0])).toEqual({
      truckPlate: 'HH-YF 175',
      pin: '175824',
      direction: 'IN',
    });
    const confirm = screen.getByRole('button', { name: /Confirm gate-in/ });
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Container number on the box'), 'HNFU2045712');
    expect(screen.getByText(/not the container on the pre-advice/)).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('Container number on the box'));
    await userEvent.type(screen.getByLabelText('Container number on the box'), 'HNFU2045711');
    expect(
      screen.getByText('ISO 6346 check digit valid', { selector: 'p[id]' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Left' }));
    await userEvent.click(screen.getByRole('button', { name: 'Dent' }));
    await userEvent.click(await screen.findByRole('radio', { name: /A-01-03-1/ }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Confirm gate-in to A-01-03-1 and print EIR' }),
    );
    expect(await screen.findByRole('heading', { name: 'Gate-in complete' })).toBeInTheDocument();
    expect(bodyOf(callsTo(fetchMock, 'POST', '/gate/in')[0])).toEqual({
      preAdviceId: 41,
      containerNumber: 'HNFU2045711',
      lane: 1,
      noDamage: false,
      damages: [{ side: 'LEFT', code: 'DENT' }],
      to: 'A-01-03-1',
    });
    expect(window.open).toHaveBeenCalledWith(
      '/api/v1/gate/transactions/9/eir.pdf',
      '_blank',
      'noopener',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Next truck' }));
    expect(screen.getByRole('button', { name: 'Verify truck' })).toBeInTheDocument();
  });

  it('shows why a truck could not be verified', async () => {
    staffApi(GATE, {
      'POST /gate/verify-truck': () =>
        apiError(401, 'TRUCK_NOT_VERIFIED', 'Plate and PIN do not match an active pre-advice'),
    });
    renderApp('/app/gate');
    await verifyTruck('FAIL');
    expect(await screen.findByRole('alert')).toHaveTextContent('Plate and PIN do not match');
  });

  it('waits for relocations before a gate-out can complete', async () => {
    const relocation = {
      id: 5,
      groupKey: 'g1',
      sequence: 1,
      status: 'OPEN',
      containerNumber: 'NRTU2869720',
      fromPosition: 'A-01-01-2',
      toPosition: 'A-01-03-1',
    };
    let checks = 0;
    const fetchMock = staffApi(GATE, {
      'POST /gate/verify-truck': () =>
        ok({
          preAdvice: { ...PRE_ADVICE, type: 'PICKUP' },
          container: { positionCode: 'A-01-01-1' },
        }),
      'POST /gate/out/check': () => {
        checks += 1;
        const waiting = checks === 1;
        return ok({
          passed: true,
          checks: [
            {
              key: 'PRE_ADVICE',
              passed: true,
              message: 'Pre-advice PA-2026-00041 is valid for this slot',
            },
            {
              key: 'TRUCK_DRIVER',
              passed: true,
              message: 'Truck plate and driver match the pre-advice',
            },
            { key: 'CUSTOMS', passed: true, message: 'No active customs hold' },
            { key: 'INVOICE', passed: true, message: 'Storage invoice INV-1 is paid' },
          ],
          invoice: { number: 'INV-1', amountCents: 4500, status: 'PAID' },
          relocations: waiting ? [relocation] : [],
          canComplete: !waiting,
        });
      },
      'POST /gate/out': () =>
        ok(
          {
            gateTransactionId: 10,
            containerNumber: 'HNFU2045711',
            fromPosition: 'A-01-01-1',
            eirUrl: '/eir/10',
          },
          201,
        ),
    });
    renderApp('/app/gate');
    await userEvent.click(await screen.findByRole('tab', { name: 'Gate-out' }));
    await verifyTruck('OUT');
    await userEvent.type(await screen.findByLabelText('Driver name as on the ID'), 'Mats Olsen');
    await userEvent.click(screen.getByRole('button', { name: 'Run the 4 checks' }));
    expect(await screen.findByText('Waiting for 1 relocation')).toBeInTheDocument();
    expect(screen.getAllByText('Passed')).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'Complete gate-out and print EIR' })).toBeDisabled();
    act(() => {
      fakeSocket.emit('workorder:changed', { id: 5, groupKey: 'g1', status: 'DONE' });
    });
    await waitFor(() => expect(checks).toBe(2));
    const complete = screen.getByRole('button', { name: 'Complete gate-out and print EIR' });
    await waitFor(() => expect(complete).toBeEnabled());
    await userEvent.click(complete);
    expect(await screen.findByRole('heading', { name: 'Gate-out complete' })).toBeInTheDocument();
    expect(bodyOf(callsTo(fetchMock, 'POST', '/gate/out')[0])).toEqual({
      preAdviceId: 41,
      truckPlate: 'HH-YF 175',
      driverName: 'Mats Olsen',
      lane: 1,
    });
  });

  it('lists failed gate-out checks with the reason', async () => {
    staffApi(GATE, {
      'POST /gate/verify-truck': () =>
        ok({ preAdvice: { ...PRE_ADVICE, type: 'PICKUP' }, container: null }),
      'POST /gate/out/check': () =>
        ok({
          passed: false,
          checks: [
            { key: 'PRE_ADVICE', passed: true, message: 'Pre-advice is valid' },
            { key: 'TRUCK_DRIVER', passed: true, message: 'Truck plate and driver match' },
            { key: 'CUSTOMS', passed: false, message: 'Active customs hold: X-ray inspection' },
            { key: 'INVOICE', passed: true, message: 'Invoice is paid' },
          ],
          invoice: null,
          relocations: [],
          canComplete: false,
        }),
    });
    renderApp('/app/gate');
    await userEvent.click(await screen.findByRole('tab', { name: 'Gate-out' }));
    await verifyTruck('OUT');
    await userEvent.type(await screen.findByLabelText('Driver name as on the ID'), 'Mats Olsen');
    await userEvent.click(screen.getByRole('button', { name: 'Run the 4 checks' }));
    expect(await screen.findByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Active customs hold: X-ray inspection')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Complete gate-out and print EIR' })).toBeDisabled();
  });
});

const WORK_ORDERS = [1, 2].map((sequence) => ({
  id: 10 + sequence,
  groupKey: 'g1',
  sequence,
  status: 'OPEN',
  reason: 'Clear the way for pickup PA-1',
  containerNumber: sequence === 1 ? 'NRTU2869720' : 'HNFU4146681',
  targetContainerNumber: 'HNFU4159122',
  fromPosition: `A-01-02-${5 - sequence}`,
  toPosition: `B-01-01-${sequence}`,
  createdAt: '2026-10-01T08:00:00Z',
}));

describe('work orders', () => {
  it('only lets the next relocation in a group be completed', async () => {
    const fetchMock = staffApi(PLANNER, {
      'GET /work-orders': () => page(WORK_ORDERS),
      'POST /work-orders/11/complete': () => ok({ ...WORK_ORDERS[0], status: 'DONE' }),
    });
    renderApp('/app/work-orders');
    const first = await screen.findByRole('button', {
      name: 'Mark relocation of NRTU2869720 done',
    });
    const second = screen.getByRole('button', { name: 'Mark relocation of HNFU4146681 done' });
    expect(first).toBeEnabled();
    expect(second).toBeDisabled();
    await userEvent.click(first);
    expect(
      await screen.findByText(/Relocation done · NRTU2869720 to B-01-01-1/),
    ).toBeInTheDocument();
    expect(callsTo(fetchMock, 'POST', '/work-orders/11/complete')).toHaveLength(1);
  });

  it('explains when there is nothing to relocate', async () => {
    staffApi(PLANNER);
    renderApp('/app/work-orders');
    expect(await screen.findByText(/Nothing to relocate/)).toBeInTheDocument();
  });
});

const HOLD = {
  id: 4,
  reason: 'X-ray inspection requested',
  isActive: true,
  containerNumber: 'NRTU2836393',
  displayNumber: 'NRTU 283639 3',
  containerState: 'IN_YARD',
  positionCode: 'B-03-09-1',
  owner: OWNER,
  placedBy: { id: 1, name: 'Anna Keller' },
  placedAt: '2026-09-29T11:45:00Z',
  releasedBy: null,
  releasedAt: null,
};

describe('customs', () => {
  it('places a hold and shows field errors from the API', async () => {
    let attempts = 0;
    const fetchMock = staffApi(ADMIN, {
      'GET /customs-holds': () => page([HOLD]),
      'POST /customs-holds': () => {
        attempts += 1;
        return attempts === 1
          ? apiError(422, 'VALIDATION_FAILED', 'Validation failed', [
              { field: 'body.reason', message: 'Enter the reason for the hold' },
            ])
          : ok({ ...HOLD, id: 5 }, 201);
      },
    });
    renderApp('/app/customs');
    expect(await screen.findByText('NRTU 283639 3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Place hold' }));
    const dialog = screen.getByRole('dialog', { name: 'Place a customs hold' });
    await userEvent.type(within(dialog).getByLabelText('Container number'), 'NRTU2836393');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Place hold' }));
    expect(await within(dialog).findByText('Enter the reason for the hold')).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText('Reason'), 'X-ray');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Place hold' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(bodyOf(callsTo(fetchMock, 'POST', '/customs-holds')[1])).toEqual({
      containerNumber: 'NRTU2836393',
      reason: 'X-ray',
    });
  });

  it('releases a hold after confirming', async () => {
    const fetchMock = staffApi(ADMIN, {
      'GET /customs-holds': () => page([HOLD]),
      'POST /customs-holds/4/release': () => ok({ ...HOLD, isActive: false }),
    });
    renderApp('/app/customs');
    await userEvent.click(await screen.findByRole('button', { name: 'Release' }));
    await userEvent.click(screen.getByRole('button', { name: 'Release hold' }));
    expect(await screen.findByText('Hold released on NRTU 283639 3')).toBeInTheDocument();
    expect(callsTo(fetchMock, 'POST', '/customs-holds/4/release')).toHaveLength(1);
  });
});

const INVOICE = {
  id: 433,
  number: 'INV-2026-00466',
  containerNumber: 'SEAU1397431',
  displayNumber: 'SEAU 139743 1',
  company: { id: 4, code: 'SEA', name: 'Seaway Forwarding' },
  periodFrom: '2026-09-24T06:45:00Z',
  periodTo: '2026-09-30T10:00:00Z',
  days: 7,
  freeDays: 5,
  chargeableDays: 2,
  dailyRateCents: 1500,
  amountCents: 3000,
  status: 'UNPAID',
  pdfUrl: '/api/v1/invoices/433/pdf',
};

describe('billing', () => {
  it('marks an invoice as paid and filters by company', async () => {
    const fetchMock = staffApi(ADMIN, {
      'GET /invoices': () => page([INVOICE]),
      'POST /invoices/433/mark-paid': () => ok({ ...INVOICE, status: 'PAID' }),
    });
    renderApp('/app/billing');
    expect(await screen.findByText('€30.00')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'PDF of INV-2026-00466' })).toHaveAttribute(
      'href',
      INVOICE.pdfUrl,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Mark paid' }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Mark paid' }),
    );
    expect(await screen.findByText('INV-2026-00466 marked paid')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Company code'), 'sea');
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => url.includes('companyCode=SEA'))).toBe(true),
    );
    expect(screen.getByRole('link', { name: /Export CSV/ })).toHaveAttribute(
      'href',
      '/api/v1/exports/invoices.csv?status=UNPAID&companyCode=SEA',
    );
  });
});

const VISIT = {
  id: 1,
  vesselName: 'Nordic Tern',
  imoNumber: '9814272',
  voyage: '042N',
  eta: '2026-09-30T04:00:00Z',
  etd: '2026-09-30T19:00:00Z',
  ata: '2026-09-30T04:40:00Z',
  atd: null,
  status: 'WORKING',
  discharge: { total: 1, done: 0 },
  load: { total: 1, done: 0 },
  progressPercent: 0,
};

const ITEMS = [
  {
    id: 64,
    containerNumber: 'BLXU3582107',
    displayNumber: 'BLXU 358210 7',
    direction: 'DISCHARGE',
    size: 'FT20',
    isHighCube: false,
    loadStatus: 'FULL',
    isDangerous: false,
    owner: OWNER,
    status: 'PENDING',
    positionCode: null,
    hasHold: false,
  },
  {
    id: 65,
    containerNumber: 'BLXU3468440',
    displayNumber: 'BLXU 346844 0',
    direction: 'LOAD',
    size: 'FT40',
    isHighCube: true,
    loadStatus: 'FULL',
    isDangerous: false,
    owner: OWNER,
    status: 'PENDING',
    positionCode: 'C-01-01-3',
    hasHold: false,
  },
];

describe('vessels', () => {
  it('lists visits and validates a new visit', async () => {
    staffApi(PLANNER, {
      'GET /vessel-visits': () => page([VISIT]),
      'POST /vessel-visits': () =>
        apiError(422, 'VALIDATION_FAILED', 'Validation failed', [
          { field: 'body.imoNumber', message: 'IMO number must be 7 digits' },
        ]),
    });
    renderApp('/app/vessels');
    expect(await screen.findByRole('heading', { name: 'Nordic Tern' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'New visit' }));
    await userEvent.type(screen.getByLabelText('IMO number'), '12');
    await userEvent.click(screen.getByRole('button', { name: 'Create visit' }));
    expect(await screen.findByText('IMO number must be 7 digits')).toBeInTheDocument();
  });

  it('discharges to a suggested slot and explains pending relocations on load', async () => {
    const fetchMock = staffApi(PLANNER, {
      'GET /vessel-visits/1': () => ok({ ...VISIT, items: ITEMS }),
      'POST /vessel-visits/1/items/64/discharge': () =>
        ok({ itemId: 64, containerNumber: 'BLXU3582107', positionCode: 'A-01-02-2', visit: {} }),
      'POST /vessel-visits/1/items/65/load': () =>
        apiError(409, 'RELOCATION_PENDING', 'Waiting for 1 relocation', [
          {
            id: 7,
            sequence: 1,
            containerNumber: 'SEAU1360849',
            fromPosition: 'C-01-01-4',
            toPosition: 'C-03-01-2',
          },
        ]),
    });
    renderApp('/app/vessels/1');
    await userEvent.click(await screen.findByText('BLXU 358210 7'));
    await userEvent.click(await screen.findByRole('button', { name: 'Discharge to A-01-02-2' }));
    expect(await screen.findByText('Discharged BLXU3582107 to A-01-02-2')).toBeInTheDocument();
    expect(bodyOf(callsTo(fetchMock, 'POST', '/vessel-visits/1/items/64/discharge')[0])).toEqual({
      to: 'A-01-02-2',
    });
    await userEvent.click(screen.getByRole('tab', { name: 'Load 0/1' }));
    await userEvent.click(screen.getByText('BLXU 346844 0'));
    await userEvent.click(screen.getByRole('button', { name: 'Load BLXU 346844 0' }));
    const notice = await screen.findByRole('alert');
    expect(notice).toHaveTextContent('Waiting for 1 relocation');
    expect(notice).toHaveTextContent('SEAU1360849 C-01-01-4 → C-03-01-2');
  });

  it('asks before departing with open items', async () => {
    const fetchMock = staffApi(PLANNER, {
      'GET /vessel-visits/1': () => ok({ ...VISIT, items: ITEMS }),
      'PATCH /vessel-visits/1': () => ok({ ...VISIT, status: 'DEPARTED' }),
    });
    renderApp('/app/vessels/1');
    await userEvent.click(await screen.findByRole('button', { name: 'Mark departed' }));
    expect(screen.getByText(/2 containers on this visit are still pending/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Depart with open items' }));
    await waitFor(() => expect(callsTo(fetchMock, 'PATCH', '/vessel-visits/1')).toHaveLength(1));
    expect(bodyOf(callsTo(fetchMock, 'PATCH', '/vessel-visits/1')[0])).toEqual({
      status: 'DEPARTED',
      departWithOpenItems: true,
    });
  });
});

describe('reports', () => {
  it('shows the key figures and export links', async () => {
    staffApi(PLANNER, {
      'GET /reports/occupancy': () => ok([]),
      'GET /reports/gate-moves': () => ok([]),
      'GET /reports/dwell': () => ok([]),
    });
    renderApp('/app/reports');
    const figures = await screen.findByRole('list', { name: 'Key figures' });
    expect(within(figures).getByText('50.0 %')).toBeInTheDocument();
    expect(within(figures).getByText('1 in · 1 out')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Movements CSV/ })).toHaveAttribute(
      'href',
      '/api/v1/exports/movements.csv',
    );
    expect(screen.queryByRole('link', { name: /Invoices CSV/ })).not.toBeInTheDocument();
  });
});

describe('admin', () => {
  it('creates a customer user for a company', async () => {
    const fetchMock = staffApi(ADMIN, {
      'GET /users': () =>
        page([{ ...PLANNER, isActive: true, companyId: null, lastLoginAt: null }]),
      'GET /companies': () =>
        page([{ ...OWNER, contactEmail: 'ops@hnf.example', isActive: true, userCount: 1 }]),
      'POST /users': () => ok({ id: 9 }, 201),
    });
    renderApp('/app/admin');
    expect(await screen.findByText('Mira Pohl')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'New user' }));
    const dialog = screen.getByRole('dialog', { name: 'New user' });
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Ola Berg');
    await userEvent.type(within(dialog).getByLabelText('Email'), 'ola@hnf.example');
    await userEvent.selectOptions(within(dialog).getByLabelText('Role'), 'CUSTOMER');
    await userEvent.selectOptions(within(dialog).getByLabelText('Company'), '1');
    await userEvent.type(within(dialog).getByLabelText('Password'), 'harbour42');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('User created')).toBeInTheDocument();
    expect(bodyOf(callsTo(fetchMock, 'POST', '/users')[0])).toEqual({
      email: 'ola@hnf.example',
      name: 'Ola Berg',
      role: 'CUSTOMER',
      companyId: 1,
      password: 'harbour42',
    });
  });

  it('changes the capacity of one time slot', async () => {
    const fetchMock = staffApi(ADMIN, {
      'GET /time-slots': (_body, url) =>
        ok(
          url.searchParams.get('date').endsWith('04')
            ? []
            : [
                {
                  id: 7,
                  date: url.searchParams.get('date'),
                  startHour: 8,
                  capacity: 10,
                  booked: 3,
                  remaining: 7,
                  isFull: false,
                },
              ],
        ),
      'PATCH /time-slots': () => ok({}),
    });
    renderApp('/app/admin?tab=time-slots');
    const grid = await screen.findByRole('table', { name: 'Booked and capacity per hour' });
    expect(within(grid).getAllByText('Closed').length).toBeGreaterThan(0);
    await userEvent.click(within(grid).getAllByRole('button')[0]);
    const capacity = screen.getByLabelText('Trucks per hour');
    await userEvent.clear(capacity);
    await userEvent.type(capacity, '12');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(callsTo(fetchMock, 'PATCH', '/time-slots')).toHaveLength(1));
    expect(bodyOf(callsTo(fetchMock, 'PATCH', '/time-slots')[0])).toEqual({
      slotId: 7,
      capacity: 12,
    });
  });

  it('filters the audit log and exports the same filter', async () => {
    const fetchMock = staffApi(ADMIN, {
      'GET /audit-logs': () =>
        page([
          {
            id: 1,
            createdAt: '2026-10-01T06:13:00Z',
            action: 'LOGIN',
            entity: 'User',
            entityId: '1',
            user: { id: 1, name: 'Anna Keller', email: 'admin@yardflow.dev' },
            ip: '::1',
            before: null,
            after: { ok: true },
          },
        ]),
    });
    renderApp('/app/admin?tab=audit-log');
    await userEvent.type(await screen.findByLabelText('Action'), 'LOGIN');
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => url.includes('action=LOGIN'))).toBe(true),
    );
    expect(screen.getByRole('link', { name: /Export CSV/ })).toHaveAttribute(
      'href',
      '/api/v1/audit-logs.csv?action=LOGIN',
    );
    await userEvent.click(await screen.findByText('User #1'));
    expect(screen.getByRole('dialog', { name: 'LOGIN' })).toHaveTextContent('"ok": true');
  });
});

describe('search', () => {
  it('finds a container and opens its details', async () => {
    staffApi(PLANNER, {
      'GET /containers': () =>
        page([
          {
            id: 1,
            number: 'HNFU2045711',
            displayNumber: 'HNFU 204571 1',
            state: 'IN_YARD',
            positionCode: 'B-02-05-2',
          },
        ]),
      'GET /containers/HNFU2045711': () =>
        jsonResponse(200, {
          data: {
            number: 'HNFU2045711',
            displayNumber: 'HNFU 204571 1',
            state: 'IN_YARD',
            size: 'FT20',
            isHighCube: false,
            loadStatus: 'FULL',
            isDangerous: false,
            owner: OWNER,
            positionCode: 'B-02-05-2',
            dwellDays: 3,
            gateInAt: '2026-09-28T08:00:00Z',
            departedAt: null,
            hasHold: false,
            holds: [],
            invoices: [],
            history: [
              {
                type: 'GATE_IN',
                fromPosition: null,
                toPosition: 'B-02-05-2',
                at: '2026-09-28T08:00:00Z',
                by: { name: 'Jonas Reuter' },
              },
            ],
          },
        }),
    });
    renderApp('/app/work-orders');
    await userEvent.type(await screen.findByRole('combobox'), 'hnfu2045');
    await userEvent.click(await screen.findByRole('button', { name: /HNFU 204571 1/ }));
    const drawer = await screen.findByRole('dialog', { name: 'HNFU 204571 1' });
    expect(await within(drawer).findByText('Gate-in: outside → B-02-05-2')).toBeInTheDocument();
  });
});
