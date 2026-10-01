import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api.js';

export const PUBLIC_STATS_KEY = ['public', 'stats'];
const REFRESH_MS = 30_000;

async function fetchPublicStats() {
  const { data } = await apiRequest('/public/stats');
  return data;
}

export function usePublicStats() {
  return useQuery({
    queryKey: PUBLIC_STATS_KEY,
    queryFn: fetchPublicStats,
    refetchInterval: REFRESH_MS,
  });
}
