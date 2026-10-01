import { InvoiceStatus, containerNumberSchema } from '@yardflow/shared';
import { z } from 'zod';
import { listQuerySchema } from '../../lib/pagination.js';

export const listInvoicesQuery = listQuerySchema({
  sortFields: ['id', 'createdAt', 'amountCents', 'number'],
  defaultSort: 'createdAt:desc',
  filters: {
    status: z.enum(Object.values(InvoiceStatus)).optional(),
    containerNumber: containerNumberSchema.optional(),
    companyCode: z.string().trim().toUpperCase().length(3).optional(),
  },
});
