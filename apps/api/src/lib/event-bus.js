import { EventEmitter } from 'node:events';

export const YARD_CHANGED = 'yard:changed';
export const WORK_ORDER_CHANGED = 'workorder:changed';

export function createEventBus() {
  const emitter = new EventEmitter();
  return {
    publish(eventName, payload) {
      emitter.emit(eventName, payload);
    },
    subscribe(eventName, listener) {
      emitter.on(eventName, listener);
      return () => emitter.off(eventName, listener);
    },
  };
}
