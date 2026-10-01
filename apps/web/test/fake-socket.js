const handlers = new Map();

export const fakeSocket = {
  on(eventName, handler) {
    const current = handlers.get(eventName) ?? new Set();
    current.add(handler);
    handlers.set(eventName, current);
  },
  off(eventName, handler) {
    handlers.get(eventName)?.delete(handler);
  },
  disconnect() {},
  emit(eventName, payload) {
    for (const handler of handlers.get(eventName) ?? []) {
      handler(payload);
    }
  },
  reset() {
    handlers.clear();
  },
};

export function fakeIo() {
  return fakeSocket;
}
