import { describe, expect, test } from '@jest/globals';
import { buildInvoiceModel, renderInvoicePdf } from '../../src/modules/billing/invoice-pdf.js';

const invoice = {
  number: 'INV-2026-00042',
  periodFrom: new Date('2026-09-22T08:00:00Z'),
  periodTo: new Date('2026-09-30T09:00:00Z'),
  days: 9,
  freeDays: 5,
  chargeableDays: 4,
  dailyRateCents: 1500,
  amountCents: 6000,
  status: 'UNPAID',
  createdAt: new Date('2026-09-29T10:00:00Z'),
  container: {
    number: 'HNFU2045711',
    ownerCompany: { code: 'HNF', name: 'Hanse North Freight' },
  },
};

describe('invoice PDF', () => {
  test('lists every field section 11 asks for, with euro amounts', () => {
    const model = buildInvoiceModel(invoice);
    expect(model.title).toBe('Storage invoice INV-2026-00042');
    expect(Object.fromEntries(model.fields)).toEqual({
      'Invoice number': 'INV-2026-00042',
      Company: 'Hanse North Freight (HNF)',
      Container: 'HNFU 204571 1',
      Period: '22 Sept 2026, 10:00 to 30 Sept 2026, 11:00',
      Days: '9',
      'Free days': '5',
      'Chargeable days': '4',
      'Daily rate': '€15.00',
      Status: 'Unpaid',
    });
    expect(model.amount).toBe('€60.00');
  });

  test('renders a PDF document', async () => {
    const pdf = await renderInvoicePdf(buildInvoiceModel({ ...invoice, status: 'PAID' }));
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
