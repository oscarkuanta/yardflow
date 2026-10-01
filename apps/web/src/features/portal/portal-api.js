import { useQueries, useQuery } from '@tanstack/react-query';
import { apiRequest, queryString } from '../../lib/api.js';
import { dataOf, useApiMutation } from '../../lib/mutations.js';

export const BOOKING_LEAD_MINUTES = 60;
export const BOOKING_DAYS_SHOWN = 7;
export const CONTAINER_PAGE_SIZE = 100;
const MINUTE_MS = 60_000;

export const COUNT_FILTERS = [
  { key: 'inYard', label: 'In yard', params: { state: 'IN_YARD' } },
  { key: 'onHold', label: 'On hold', params: { state: 'IN_YARD', hasHold: 'true' } },
  { key: 'expected', label: 'Expected', params: { state: 'EXPECTED' } },
];

export function useContainerCounts() {
  const results = useQueries({
    queries: COUNT_FILTERS.map((filter) => ({
      queryKey: ['containers', 'count', filter.key],
      queryFn: () => apiRequest(`/containers${queryString({ ...filter.params, pageSize: 1 })}`),
    })),
  });
  return Object.fromEntries(
    COUNT_FILTERS.map((filter, index) => [filter.key, results[index].data?.total ?? null]),
  );
}

export function useMyContainers(params) {
  return useQuery({
    queryKey: ['containers', 'portal', params],
    queryFn: () =>
      apiRequest(
        `/containers${queryString({ pageSize: CONTAINER_PAGE_SIZE, sort: 'gateInAt:desc', ...params })}`,
      ),
  });
}

export function usePreAdvices(params) {
  return useQuery({
    queryKey: ['pre-advices', params],
    queryFn: () => apiRequest(`/pre-advices${queryString({ pageSize: 50, ...params })}`),
  });
}

export function useAvailableSlots(date) {
  return useQuery({
    queryKey: ['time-slots', date],
    queryFn: () => dataOf(apiRequest(`/time-slots?date=${date}`)),
    enabled: Boolean(date),
  });
}

const BOOKING_INVALIDATIONS = [['pre-advices'], ['time-slots'], ['invoices'], ['containers']];

export function useCreatePreAdvice(options) {
  return useApiMutation({
    mutationFn: (body) => dataOf(apiRequest('/pre-advices', { method: 'POST', body })),
    invalidate: BOOKING_INVALIDATIONS,
    ...options,
  });
}

export function useRegeneratePin(options) {
  return useApiMutation({
    mutationFn: (preAdvice) =>
      dataOf(apiRequest(`/pre-advices/${preAdvice.id}/regenerate-pin`, { method: 'POST' })),
    invalidate: [['pre-advices']],
    ...options,
  });
}

export function useCancelPreAdvice(options) {
  return useApiMutation({
    mutationFn: (preAdvice) =>
      dataOf(apiRequest(`/pre-advices/${preAdvice.id}/cancel`, { method: 'POST' })),
    invalidate: BOOKING_INVALIDATIONS,
    successMessage: (_result, preAdvice) => `${preAdvice.reference} cancelled`,
    ...options,
  });
}

export function useNotifications(params = {}) {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: () => apiRequest(`/notifications${queryString({ pageSize: 50, ...params })}`),
  });
}

export function useUnreadCount() {
  const { data } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => apiRequest('/notifications?unread=true&pageSize=1'),
  });
  return data?.unreadCount ?? 0;
}

export function useMarkRead() {
  return useApiMutation({
    mutationFn: (notification) =>
      dataOf(apiRequest(`/notifications/${notification.id}/read`, { method: 'POST' })),
    invalidate: [['notifications']],
  });
}

export function useMarkAllRead() {
  return useApiMutation({
    mutationFn: () => apiRequest('/notifications/read-all', { method: 'POST' }),
    invalidate: [['notifications']],
    successMessage: 'All alerts marked as read',
  });
}

export function useMyInvoices(params = {}) {
  return useQuery({
    queryKey: ['invoices', 'portal', params],
    queryFn: () => apiRequest(`/invoices${queryString({ pageSize: 100, ...params })}`),
  });
}

export function bookingDates(today, count = BOOKING_DAYS_SHOWN) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(`${today}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

export function slotAvailability(slot, now) {
  if (slot.capacity === 0) {
    return { bookable: false, reason: 'Closed' };
  }
  if (new Date(slot.startsAt).getTime() - now.getTime() < BOOKING_LEAD_MINUTES * MINUTE_MS) {
    return { bookable: false, reason: 'Too late' };
  }
  if (slot.isFull) {
    return { bookable: false, reason: 'Full' };
  }
  return { bookable: true, reason: `${slot.remaining} left` };
}

export function latestInvoiceByContainer(invoices) {
  const latest = new Map();
  for (const invoice of invoices) {
    const current = latest.get(invoice.containerNumber);
    if (!current || new Date(invoice.createdAt) > new Date(current.createdAt)) {
      latest.set(invoice.containerNumber, invoice);
    }
  }
  return latest;
}

export function activePreAdviceByContainer(preAdvices) {
  return new Map(
    preAdvices
      .filter((preAdvice) => preAdvice.status === 'ACTIVE')
      .map((preAdvice) => [preAdvice.containerNumber, preAdvice]),
  );
}

export function containerStatus(container) {
  if (container.hasHold) {
    return { label: 'Hold', tone: 'danger' };
  }
  if (container.state === 'EXPECTED') {
    return { label: 'Expected', tone: 'neutral' };
  }
  if (container.state === 'DEPARTED') {
    return { label: 'Departed', tone: 'neutral' };
  }
  return { label: 'In yard', tone: 'info' };
}
