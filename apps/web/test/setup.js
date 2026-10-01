import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { fakeSocket } from './fake-socket.js';

vi.mock('socket.io-client', async () => {
  const { fakeIo } = await import('./fake-socket.js');
  return { io: fakeIo };
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

window.ResizeObserver = ResizeObserverStub;
window.open = vi.fn();

function matchMediaStub(query) {
  return {
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
}

window.matchMedia = vi.fn(matchMediaStub);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  fakeSocket.reset();
});
