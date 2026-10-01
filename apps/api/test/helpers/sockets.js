import { once } from 'node:events';
import { io } from 'socket.io-client';
import request from 'supertest';
import { TEST_PASSWORD } from './fixtures.js';

export async function startServer(app) {
  const server = app.listen(0);
  await once(server, 'listening');
  return server;
}

export async function sessionCookieFor(app, email) {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: TEST_PASSWORD });
  return response.headers['set-cookie'].map((cookie) => cookie.split(';')[0]).join('; ');
}

export function connectSocket(server, cookie) {
  return io(`http://localhost:${server.address().port}`, {
    transports: ['websocket'],
    extraHeaders: cookie ? { cookie } : {},
    reconnection: false,
    forceNew: true,
  });
}

export function waitForConnection(socket) {
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

export function waitForEvent(socket, eventName, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`No ${eventName} event`)), timeoutMs);
    socket.once(eventName, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

export function collectEvents(socket, eventName) {
  const received = [];
  socket.on(eventName, (payload) => received.push(payload));
  return received;
}

export function pause(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
