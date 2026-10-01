import { formatContainerNumber } from '@yardflow/shared';
import { TERMINAL_NAME } from '../../config/terminal.js';
import { formatEuroCents, formatTerminalDateTime } from '../../lib/format.js';
import { PDF_COLORS, drawFields, drawTitle, renderPdf } from '../../lib/pdf.js';

const STATUS_LABELS = { UNPAID: 'Unpaid', PAID: 'Paid', VOID: 'Void' };

export function buildInvoiceModel(invoice) {
  const { container } = invoice;
  return {
    title: `Storage invoice ${invoice.number}`,
    terminalName: TERMINAL_NAME,
    fields: [
      ['Invoice number', invoice.number],
      ['Company', `${container.ownerCompany.name} (${container.ownerCompany.code})`],
      ['Container', formatContainerNumber(container.number)],
      [
        'Period',
        `${formatTerminalDateTime(invoice.periodFrom)} to ${formatTerminalDateTime(invoice.periodTo)}`,
      ],
      ['Days', String(invoice.days)],
      ['Free days', String(invoice.freeDays)],
      ['Chargeable days', String(invoice.chargeableDays)],
      ['Daily rate', formatEuroCents(invoice.dailyRateCents)],
      ['Status', STATUS_LABELS[invoice.status]],
    ],
    amount: formatEuroCents(invoice.amountCents),
    issuedAt: formatTerminalDateTime(invoice.createdAt),
  };
}

export function renderInvoicePdf(model) {
  return renderPdf(model.title, (document) => {
    drawTitle(document, model);
    drawFields(document, model.fields);
    document.fillColor(PDF_COLORS.muted).fontSize(11).text('Amount due', 50);
    document.fillColor(PDF_COLORS.text).fontSize(24).text(model.amount, 50);
    document.moveDown(1);
    document
      .fillColor(PDF_COLORS.muted)
      .fontSize(9)
      .text(`Issued ${model.issuedAt} (Europe/Berlin). All amounts in euro.`, 50);
  });
}
