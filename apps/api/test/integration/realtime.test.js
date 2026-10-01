import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from '@jest/globals';
import {
  CONTAINER_CHANGED,
  GATE_EVENT,
  NOTIFICATION_NEW,
  VESSEL_CHANGED,
  WORK_ORDER_CHANGED,
  YARD_CHANGED,
  createEventBus,
} from '../../src/lib/event-bus.js';
import { STAFF_ROOM, attachRealtime, companyRoom, roomFor } from '../../src/realtime/socket.js';
import {
  USER_EMAILS,
  createCompany,
  createSmallYard,
  createUser,
  createUsersForAllRoles,
  loginAs,
  placeContainer,
  resetDatabase,
} from '../helpers/fixtures.js';
import {
  collectEvents,
  connectSocket,
  pause,
  sessionCookieFor,
  startServer,
  waitForConnection,
  waitForEvent,
} from '../helpers/sockets.js';
import { createTestContext } from '../helpers/test-app.js';

const OTHER_CUSTOMER_EMAIL = 'other.customer@test.example';
const QUIET_PERIOD_MS = 300;

describe('Socket.IO rooms and events (spec 10)', () => {
  const eventBus = createEventBus();
  const context = createTestContext({ eventBus });
  let server;
  let realtime;
  let sockets;
  let users;
  let company;
  let otherCompany;
  let yard;

  beforeAll(async () => {
    server = await startServer(context.app);
    realtime = attachRealtime({
      httpServer: server,
      app: context.app,
      prisma: context.prisma,
      config: context.config,
    });
  });

  beforeEach(async () => {
    sockets = [];
    await resetDatabase(context.prisma);
    ({ users, company } = await createUsersForAllRoles(context.prisma));
    otherCompany = await createCompany(context.prisma, { code: 'OTH', name: 'Other Freight' });
    await createUser(context.prisma, {
      role: 'CUSTOMER',
      email: OTHER_CUSTOMER_EMAIL,
      companyId: otherCompany.id,
    });
    yard = await createSmallYard(context.prisma);
  });

  afterEach(() => {
    for (const socket of sockets) {
      socket.disconnect();
    }
  });

  afterAll(async () => {
    await realtime.close();
    server.close();
    await context.close();
  });

  async function connectAs(email) {
    const socket = connectSocket(server, await sessionCookieFor(context.app, email));
    sockets.push(socket);
    return waitForConnection(socket);
  }

  test('rejects a socket without a session', async () => {
    const socket = connectSocket(server, null);
    sockets.push(socket);
    await expect(waitForConnection(socket)).rejects.toThrow('Not authenticated');
  });

  test('rejects a socket of a user who was deactivated after logging in', async () => {
    const cookie = await sessionCookieFor(context.app, USER_EMAILS.PLANNER);
    await context.prisma.user.update({
      where: { id: users.PLANNER.id },
      data: { isActive: false },
    });
    const socket = connectSocket(server, cookie);
    sockets.push(socket);
    await expect(waitForConnection(socket)).rejects.toThrow('Not authenticated');
  });

  test('sends a yard move to staff but not to customers', async () => {
    const planner = await connectAs(USER_EMAILS.PLANNER);
    const customer = await connectAs(USER_EMAILS.CUSTOMER);
    const customerYardEvents = collectEvents(customer, YARD_CHANGED);
    const container = await placeContainer(context.prisma, {
      block: yard.B,
      row: 1,
      bay: 1,
      tier: 1,
      companyId: company.id,
    });
    const agent = await loginAs(context.app, USER_EMAILS.PLANNER);
    const received = waitForEvent(planner, YARD_CHANGED);
    await agent
      .post('/api/v1/yard/moves')
      .send({ containerNumber: container.number, to: 'B-02-02' });
    expect((await received).changes).toEqual([
      { positionCode: 'B-01-01-1', containerNumber: container.number, action: 'REMOVED' },
      { positionCode: 'B-02-02-1', containerNumber: container.number, action: 'PLACED' },
    ]);
    await pause(QUIET_PERIOD_MS);
    expect(customerYardEvents).toEqual([]);
  });

  test.each([GATE_EVENT, WORK_ORDER_CHANGED, VESSEL_CHANGED])(
    'sends %s to every staff role and not to customers',
    async (eventName) => {
      const staffSockets = await Promise.all(
        [USER_EMAILS.ADMIN, USER_EMAILS.PLANNER, USER_EMAILS.GATE_OPERATOR].map(connectAs),
      );
      const customerEvents = collectEvents(await connectAs(USER_EMAILS.CUSTOMER), eventName);
      const deliveries = staffSockets.map((socket) => waitForEvent(socket, eventName));
      eventBus.publish(eventName, { id: 1 });
      expect(await Promise.all(deliveries)).toEqual([{ id: 1 }, { id: 1 }, { id: 1 }]);
      await pause(QUIET_PERIOD_MS);
      expect(customerEvents).toEqual([]);
    },
  );

  test('sends a hold notification and the container change to the owner company only', async () => {
    const container = await placeContainer(context.prisma, {
      block: yard.B,
      row: 1,
      bay: 1,
      tier: 1,
      companyId: company.id,
    });
    const owner = await connectAs(USER_EMAILS.CUSTOMER);
    const otherEvents = collectEvents(await connectAs(OTHER_CUSTOMER_EMAIL), NOTIFICATION_NEW);
    const staffEvents = collectEvents(await connectAs(USER_EMAILS.ADMIN), NOTIFICATION_NEW);
    const notification = waitForEvent(owner, NOTIFICATION_NEW);
    const change = waitForEvent(owner, CONTAINER_CHANGED);
    const admin = await loginAs(context.app, USER_EMAILS.ADMIN);
    await admin
      .post('/api/v1/customs-holds')
      .send({ containerNumber: container.number, reason: 'X-ray inspection requested' });
    expect(await notification).toMatchObject({
      type: 'CUSTOMS_HOLD_PLACED',
      containerNumber: container.number,
      isRead: false,
    });
    expect(await change).toEqual({
      containerNumber: container.number,
      state: 'IN_YARD',
      hasHold: true,
    });
    await pause(QUIET_PERIOD_MS);
    expect(otherEvents).toEqual([]);
    expect(staffEvents).toEqual([]);
  });

  test('disconnects the sockets of a user when an admin deactivates them', async () => {
    const customer = await connectAs(USER_EMAILS.CUSTOMER);
    const disconnected = waitForEvent(customer, 'disconnect');
    const admin = await loginAs(context.app, USER_EMAILS.ADMIN);
    await admin.patch(`/api/v1/users/${users.CUSTOMER.id}`).send({ isActive: false });
    expect(await disconnected).toBe('io server disconnect');
  });

  test('disconnects the customers of a company when it is deactivated', async () => {
    const customer = await connectAs(USER_EMAILS.CUSTOMER);
    const disconnected = waitForEvent(customer, 'disconnect');
    const admin = await loginAs(context.app, USER_EMAILS.ADMIN);
    await admin.patch(`/api/v1/companies/${company.id}`).send({ isActive: false });
    expect(await disconnected).toBe('io server disconnect');
  });
});

describe('room names', () => {
  test('puts staff into one room and customers into their company room', () => {
    expect(roomFor({ role: 'PLANNER', companyId: null })).toBe(STAFF_ROOM);
    expect(roomFor({ role: 'GATE_OPERATOR', companyId: null })).toBe('staff');
    expect(roomFor({ role: 'CUSTOMER', companyId: 7 })).toBe(companyRoom(7));
    expect(companyRoom(7)).toBe('company:7');
  });
});
