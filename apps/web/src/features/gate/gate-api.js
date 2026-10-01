import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryString } from '../../lib/api.js';
import { dataOf, useApiMutation } from '../../lib/mutations.js';

export function useGateTransactions(params) {
  return useQuery({
    queryKey: ['gate', 'transactions', params],
    queryFn: () => apiRequest(`/gate/transactions${queryString(params)}`),
  });
}

export function useVerifyTruck() {
  return useMutation({
    mutationFn: (body) => dataOf(apiRequest('/gate/verify-truck', { method: 'POST', body })),
  });
}

export function useGateIn(options) {
  return useApiMutation({
    mutationFn: (body) => dataOf(apiRequest('/gate/in', { method: 'POST', body })),
    invalidate: [['gate'], ['yard'], ['reports'], ['containers']],
    successMessage: (result) => `Gate-in complete · ${result.positionCode}`,
    ...options,
  });
}

export function useGateOutCheck() {
  return useApiMutation({
    mutationFn: (body) => dataOf(apiRequest('/gate/out/check', { method: 'POST', body })),
    invalidate: [['work-orders']],
  });
}

export function useGateOut(options) {
  return useApiMutation({
    mutationFn: (body) => dataOf(apiRequest('/gate/out', { method: 'POST', body })),
    invalidate: [['gate'], ['yard'], ['reports'], ['containers']],
    successMessage: (result) => `Gate-out complete · ${result.containerNumber}`,
    ...options,
  });
}
