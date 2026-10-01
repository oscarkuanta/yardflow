import { useQueries, useQuery } from '@tanstack/react-query';
import { apiRequest, queryString } from '../../lib/api.js';
import { dataOf, useApiMutation } from '../../lib/mutations.js';

export function useListQuery(resource, params = {}) {
  return useQuery({
    queryKey: [resource, params],
    queryFn: () => apiRequest(`/${resource}${queryString(params)}`),
  });
}

export function useSaveResource(resource, { successMessage, onSuccess, invalidate = [] } = {}) {
  return useApiMutation({
    mutationFn: ({ id, body }) =>
      dataOf(
        apiRequest(id ? `/${resource}/${id}` : `/${resource}`, {
          method: id ? 'PATCH' : 'POST',
          body,
        }),
      ),
    invalidate: [[resource], ...invalidate],
    successMessage,
    onSuccess,
  });
}

export function useUpdateTariff(options) {
  return useApiMutation({
    mutationFn: (body) => dataOf(apiRequest('/tariffs', { method: 'PATCH', body })),
    invalidate: [['tariffs']],
    successMessage: 'Tariff saved',
    ...options,
  });
}

export function useWeekTimeSlots(dates) {
  return useQueries({
    queries: dates.map((date) => ({
      queryKey: ['time-slots', date],
      queryFn: () => dataOf(apiRequest(`/time-slots?date=${date}`)),
    })),
  });
}

export function useUpdateCapacity(options) {
  return useApiMutation({
    mutationFn: (body) => dataOf(apiRequest('/time-slots', { method: 'PATCH', body })),
    invalidate: [['time-slots']],
    successMessage: 'Capacity saved',
    ...options,
  });
}
