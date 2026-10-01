import { formatContainerNumber } from '@yardflow/shared';
import { conflict, notFound } from '../../lib/errors.js';
import { NOTIFICATION_NEW } from '../../lib/event-bus.js';
import { paginate } from '../../lib/pagination.js';
import { isCustomer } from '../../lib/scope.js';
import { createNotification } from '../notifications/notifications.js';
import { buildInvoiceModel, renderInvoicePdf } from './invoice-pdf.js';

const INVOICE_INCLUDE = {
  container: {
    select: {
      number: true,
      ownerCompanyId: true,
      ownerCompany: { select: { id: true, code: true, name: true } },
    },
  },
  paidMarkedBy: { select: { id: true, name: true } },
};

export function pdfUrl(invoiceId) {
  return `/api/v1/invoices/${invoiceId}/pdf`;
}

function toInvoiceResponse(invoice, showStaffDetails) {
  return {
    id: invoice.id,
    number: invoice.number,
    containerNumber: invoice.container.number,
    displayNumber: formatContainerNumber(invoice.container.number),
    company: invoice.container.ownerCompany,
    periodFrom: invoice.periodFrom,
    periodTo: invoice.periodTo,
    days: invoice.days,
    freeDays: invoice.freeDays,
    chargeableDays: invoice.chargeableDays,
    dailyRateCents: invoice.dailyRateCents,
    amountCents: invoice.amountCents,
    status: invoice.status,
    paidAt: invoice.paidAt,
    ...(showStaffDetails && { paidMarkedBy: invoice.paidMarkedBy ?? null }),
    createdAt: invoice.createdAt,
    pdfUrl: pdfUrl(invoice.id),
  };
}

function ownInvoicesScope(user) {
  return isCustomer(user) ? { container: { ownerCompanyId: user.companyId } } : {};
}

function containerFilter(query, user) {
  return {
    ...(isCustomer(user) && { ownerCompanyId: user.companyId }),
    ...(query.containerNumber && { number: query.containerNumber }),
    ...(query.companyCode && !isCustomer(user) && { ownerCompany: { code: query.companyCode } }),
  };
}

export function createInvoicesService({ prisma, auditService, eventBus, clock }) {
  async function list(query, user) {
    return paginate(prisma, prisma.storageInvoice, {
      where: { status: query.status, container: containerFilter(query, user) },
      include: INVOICE_INCLUDE,
      query,
      present: (invoice) => toInvoiceResponse(invoice, !isCustomer(user)),
    });
  }

  async function markPaid(id, actor) {
    const { invoice, notification } = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.storageInvoice.findUnique({
        where: { id },
        include: INVOICE_INCLUDE,
      });
      if (!existing) {
        throw notFound('Invoice not found');
      }
      if (existing.status !== 'UNPAID') {
        throw conflict(
          'INVOICE_NOT_UNPAID',
          `Invoice ${existing.number} is already ${existing.status}`,
        );
      }
      const saved = await transaction.storageInvoice.update({
        where: { id },
        data: { status: 'PAID', paidAt: clock(), paidMarkedById: actor.id },
        include: INVOICE_INCLUDE,
      });
      const paidNotification = await createNotification(transaction, {
        companyId: saved.container.ownerCompanyId,
        type: 'INVOICE_PAID',
        containerNumber: saved.container.number,
        details: { invoiceNumber: saved.number },
      });
      await auditService.record(
        {
          userId: actor.id,
          action: 'MARK_PAID',
          entity: 'StorageInvoice',
          entityId: id,
          before: { status: 'UNPAID' },
          after: { status: 'PAID', number: saved.number, amountCents: saved.amountCents },
          ip: actor.ip,
        },
        transaction,
      );
      return { invoice: saved, notification: paidNotification };
    });
    eventBus.publish(NOTIFICATION_NEW, notification);
    return toInvoiceResponse(invoice, true);
  }

  async function pdf(id, user) {
    const invoice = await prisma.storageInvoice.findFirst({
      where: { id, ...ownInvoicesScope(user) },
      include: INVOICE_INCLUDE,
    });
    if (!invoice) {
      throw notFound('Invoice not found');
    }
    return { number: invoice.number, content: await renderInvoicePdf(buildInvoiceModel(invoice)) };
  }

  return { list, markPaid, pdf };
}
