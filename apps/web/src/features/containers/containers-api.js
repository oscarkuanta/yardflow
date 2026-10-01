import { useQuery } from '@tanstack/react-query';
import { apiRequest, queryString } from '../../lib/api.js';
import { dataOf } from '../../lib/mutations.js';

export const SEARCH_RESULT_LIMIT = 6;

export function useContainerSearch(search) {
  return useQuery({
    queryKey: ['containers', 'search', search],
    queryFn: () =>
      apiRequest(
        `/containers${queryString({ search, pageSize: SEARCH_RESULT_LIMIT, sort: 'gateInAt:desc' })}`,
      ),
    enabled: search.length >= 3,
  });
}

export function useContainer(number) {
  return useQuery({
    queryKey: ['containers', 'detail', number],
    queryFn: () => dataOf(apiRequest(`/containers/${number}`)),
    enabled: Boolean(number),
  });
}

export const CONTAINER_STATE_LABELS = {
  EXPECTED: 'Expected',
  IN_YARD: 'In yard',
  DEPARTED: 'Departed',
};
