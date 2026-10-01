import { useQuery } from '@tanstack/react-query';
import { apiRequest, queryString } from '../../lib/api.js';
import { dataOf, useApiMutation } from '../../lib/mutations.js';

export function useCustomsHolds(params) {
  return useQuery({
    queryKey: ['customs', params],
    queryFn: () => apiRequest(`/customs-holds${queryString(params)}`),
  });
}

const HOLD_INVALIDATIONS = [['customs'], ['yard'], ['containers'], ['reports']];

export function usePlaceHold(options) {
  return useApiMutation({
    mutationFn: (body) => dataOf(apiRequest('/customs-holds', { method: 'POST', body })),
    invalidate: HOLD_INVALIDATIONS,
    successMessage: (hold) => `Hold placed on ${hold.displayNumber}`,
    ...options,
  });
}

export function useReleaseHold(options) {
  return useApiMutation({
    mutationFn: (hold) =>
      dataOf(apiRequest(`/customs-holds/${hold.id}/release`, { method: 'POST' })),
    invalidate: HOLD_INVALIDATIONS,
    successMessage: (_result, hold) => `Hold released on ${hold.displayNumber}`,
    ...options,
  });
}
