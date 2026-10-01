import { actorOf } from '../../lib/actor.js';

export function createInvoicesController({ invoicesService }) {
  async function list(request, response) {
    response.json(await invoicesService.list(request.validated.query, request.user));
  }

  async function markPaid(request, response) {
    const { id } = request.validated.params;
    response.json({ data: await invoicesService.markPaid(id, actorOf(request)) });
  }

  async function pdf(request, response) {
    const { id } = request.validated.params;
    const { number, content } = await invoicesService.pdf(id, request.user);
    response
      .type('application/pdf')
      .set('Content-Disposition', `inline; filename="${number}.pdf"`)
      .send(content);
  }

  return { list, markPaid, pdf };
}
