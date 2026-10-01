import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { io } from 'socket.io-client';

export const STAFF_EVENTS = ['yard:changed', 'gate:event', 'workorder:changed', 'vessel:changed'];

export const INVALIDATIONS = {
  'yard:changed': [['yard'], ['reports'], ['containers']],
  'gate:event': [['gate'], ['reports']],
  'workorder:changed': [['work-orders'], ['reports']],
  'vessel:changed': [['vessels']],
};

export function queryKeysFor(eventName) {
  return INVALIDATIONS[eventName] ?? [];
}

export function connectSocket() {
  return io({ withCredentials: true, transports: ['websocket', 'polling'] });
}

const RealtimeContext = createContext({ subscribe: () => () => {} });

export function RealtimeProvider({ connect = connectSocket, children }) {
  const queryClient = useQueryClient();
  const listeners = useRef(new Map());

  useEffect(() => {
    const socket = connect();
    const handlers = STAFF_EVENTS.map((eventName) => {
      const handler = (payload) => {
        for (const queryKey of queryKeysFor(eventName)) {
          queryClient.invalidateQueries({ queryKey });
        }
        for (const listener of listeners.current.get(eventName) ?? []) {
          listener(payload);
        }
      };
      socket.on(eventName, handler);
      return [eventName, handler];
    });
    return () => {
      for (const [eventName, handler] of handlers) {
        socket.off(eventName, handler);
      }
      socket.disconnect();
    };
  }, [connect, queryClient]);

  const value = useMemo(
    () => ({
      subscribe(eventName, listener) {
        const current = listeners.current.get(eventName) ?? new Set();
        current.add(listener);
        listeners.current.set(eventName, current);
        return () => current.delete(listener);
      },
    }),
    [],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtimeEvent(eventName, listener) {
  const { subscribe } = useContext(RealtimeContext);
  const listenerRef = useRef(listener);
  listenerRef.current = listener;
  useEffect(
    () => subscribe(eventName, (payload) => listenerRef.current(payload)),
    [eventName, subscribe],
  );
}
