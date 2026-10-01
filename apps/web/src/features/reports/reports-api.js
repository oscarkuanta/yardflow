import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api.js';
import { dataOf } from '../../lib/mutations.js';

export const GATE_MOVE_DAYS = 14;

function reportQuery(name, path, enabled = true) {
  return {
    queryKey: ['reports', name],
    queryFn: () => dataOf(apiRequest(path)),
    enabled,
  };
}

export function useKpis(enabled = true) {
  return useQuery({ ...reportQuery('kpis', '/reports/kpis', enabled), refetchInterval: 60_000 });
}

export function useOccupancyReport() {
  return useQuery(reportQuery('occupancy', '/reports/occupancy'));
}

export function useGateMovesReport() {
  return useQuery(reportQuery('gate-moves', `/reports/gate-moves?days=${GATE_MOVE_DAYS}`));
}

export function useDwellReport() {
  return useQuery(reportQuery('dwell', '/reports/dwell'));
}
