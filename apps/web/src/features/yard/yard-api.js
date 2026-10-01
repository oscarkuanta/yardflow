import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api.js';
import { dataOf, useApiMutation } from '../../lib/mutations.js';
import { parseStackCode } from './yard-geometry.js';

export const YARD_MAP_KEY = ['yard', 'map'];

export function useYardMap() {
  return useQuery({ queryKey: YARD_MAP_KEY, queryFn: () => dataOf(apiRequest('/yard/map')) });
}

export function useStack(stackCode) {
  return useQuery({
    queryKey: ['yard', 'stack', stackCode],
    queryFn: () => {
      const { block, row, bay } = parseStackCode(stackCode);
      return dataOf(apiRequest(`/yard/stacks/${block}/${row}/${bay}`));
    },
    enabled: Boolean(stackCode),
  });
}

export function suggestionRequestFor(cargo, ownerCompanyId) {
  return {
    size: cargo.size,
    loadStatus: cargo.loadStatus,
    isDangerous: Boolean(cargo.isDangerous),
    ownerCompanyId: ownerCompanyId ?? null,
  };
}

export function useSlotSuggestions(request) {
  return useQuery({
    queryKey: ['yard', 'suggestions', request],
    queryFn: () => dataOf(apiRequest('/yard/suggestions', { method: 'POST', body: request })),
    enabled: Boolean(request),
    staleTime: 0,
  });
}

export function useMoveContainer(options = {}) {
  return useApiMutation({
    mutationFn: (body) => dataOf(apiRequest('/yard/moves', { method: 'POST', body })),
    invalidate: [['yard'], ['containers']],
    successMessage: (result) => `Moved to ${result.toPosition}`,
    ...options,
  });
}
