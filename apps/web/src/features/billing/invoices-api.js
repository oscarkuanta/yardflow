import { useQuery } from '@tanstack/react-query';
import { apiRequest, queryString } from '../../lib/api.js';
import { dataOf, useApiMutation } from '../../lib/mutations.js';

export const INVOICE_STATUS_TONES = { UNPAID: 'warn', PAID: 'accent', VOID: 'neutral' };

export function useInvoices(params) {
  return useQuery({
    queryKey: ['invoices', params],
    queryFn: () => apiRequest(`/invoices${queryString(params)}`),
  });
}

export function useMarkInvoicePaid(options) {
  return useApiMutation({
    mutationFn: (invoice) =>
      dataOf(apiRequest(`/invoices/${invoice.id}/mark-paid`, { method: 'POST' })),
    invalidate: [['invoices'], ['containers']],
    successMessage: (_result, invoice) => `${invoice.number} marked paid`,
    ...options,
  });
}
