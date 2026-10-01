import { useQuery } from '@tanstack/react-query';
import { apiRequest, queryString } from '../../lib/api.js';
import { dataOf, useApiMutation } from '../../lib/mutations.js';

export const VESSEL_STATUS_TONES = {
  PLANNED: 'neutral',
  ARRIVED: 'info',
  WORKING: 'accent',
  DEPARTED: 'neutral',
};

export function useVesselVisits(params = {}) {
  return useQuery({
    queryKey: ['vessels', 'list', params],
    queryFn: () => apiRequest(`/vessel-visits${queryString({ pageSize: 50, ...params })}`),
  });
}

export function useVesselVisit(id) {
  return useQuery({
    queryKey: ['vessels', 'detail', id],
    queryFn: () => dataOf(apiRequest(`/vessel-visits/${id}`)),
  });
}

export function useCreateVisit(options) {
  return useApiMutation({
    mutationFn: (body) => dataOf(apiRequest('/vessel-visits', { method: 'POST', body })),
    invalidate: [['vessels']],
    successMessage: (visit) => `Visit created · ${visit.vesselName} ${visit.voyage}`,
    ...options,
  });
}

export function useUpdateVisit(id, options) {
  return useApiMutation({
    mutationFn: (body) => dataOf(apiRequest(`/vessel-visits/${id}`, { method: 'PATCH', body })),
    invalidate: [['vessels']],
    successMessage: (visit) => `${visit.vesselName} is now ${visit.status.toLowerCase()}`,
    ...options,
  });
}

export function useAddVisitItem(id, options) {
  return useApiMutation({
    mutationFn: (body) =>
      dataOf(apiRequest(`/vessel-visits/${id}/items`, { method: 'POST', body })),
    invalidate: [['vessels']],
    successMessage: (item) => `Added ${item.displayNumber}`,
    ...options,
  });
}

export function useImportVisitItems(id, options) {
  return useApiMutation({
    mutationFn: (csvText) =>
      dataOf(
        apiRequest(`/vessel-visits/${id}/items/import`, {
          method: 'POST',
          text: csvText,
          contentType: 'text/csv',
        }),
      ),
    invalidate: [['vessels'], ['containers']],
    successMessage: 'The list was imported',
    ...options,
  });
}

export function useDischargeItem(visitId, options) {
  return useApiMutation({
    mutationFn: ({ itemId, to }) =>
      dataOf(
        apiRequest(`/vessel-visits/${visitId}/items/${itemId}/discharge`, {
          method: 'POST',
          body: { to },
        }),
      ),
    invalidate: [['vessels'], ['yard'], ['containers']],
    successMessage: (result) => `Discharged ${result.containerNumber} to ${result.positionCode}`,
    ...options,
  });
}

export function useLoadItem(visitId, options) {
  return useApiMutation({
    mutationFn: ({ itemId }) =>
      dataOf(apiRequest(`/vessel-visits/${visitId}/items/${itemId}/load`, { method: 'POST' })),
    invalidate: [['vessels'], ['yard'], ['containers']],
    successMessage: (result) => `Loaded ${result.containerNumber} from ${result.fromPosition}`,
    ...options,
  });
}

export function visitAtBerth(visits) {
  return (
    visits.find((visit) => visit.status === 'WORKING') ??
    visits.find((visit) => visit.status === 'ARRIVED') ??
    null
  );
}
