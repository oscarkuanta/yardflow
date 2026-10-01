import { useQuery } from '@tanstack/react-query';
import { apiRequest, queryString } from '../../lib/api.js';
import { dataOf, useApiMutation } from '../../lib/mutations.js';

export const WORK_ORDER_PAGE_SIZE = 100;

export function useWorkOrders(params, options = {}) {
  return useQuery({
    queryKey: ['work-orders', params],
    queryFn: () =>
      apiRequest(`/work-orders${queryString({ pageSize: WORK_ORDER_PAGE_SIZE, ...params })}`),
    ...options,
  });
}

export function useCompleteWorkOrder() {
  return useApiMutation({
    mutationFn: (workOrder) =>
      dataOf(apiRequest(`/work-orders/${workOrder.id}/complete`, { method: 'POST' })),
    invalidate: [['work-orders'], ['yard'], ['reports']],
    successMessage: (_result, workOrder) =>
      `Relocation done · ${workOrder.containerNumber} to ${workOrder.toPosition}`,
  });
}

export function groupWorkOrders(workOrders) {
  const groups = new Map();
  for (const workOrder of workOrders) {
    const group = groups.get(workOrder.groupKey) ?? [];
    group.push(workOrder);
    groups.set(workOrder.groupKey, group);
  }
  return [...groups.entries()].map(([groupKey, orders]) => {
    const sorted = [...orders].sort((first, second) => first.sequence - second.sequence);
    const nextOpen = sorted.find((order) => order.status === 'OPEN') ?? null;
    return {
      groupKey,
      reason: sorted[0].reason,
      targetContainerNumber: sorted[0].targetContainerNumber,
      orders: sorted,
      nextOpenId: nextOpen?.id ?? null,
      createdAt: sorted[0].createdAt,
    };
  });
}
