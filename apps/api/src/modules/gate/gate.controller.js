import { actorOf } from '../../lib/actor.js';

export function createGateController({ gateService, transactionsService }) {
  async function verifyTruck(request, response) {
    const result = await gateService.verifyTruck(
      request.validated.body,
      actorOf(request),
      request.session,
    );
    response.json({ data: result });
  }

  async function gateIn(request, response) {
    const result = await gateService.gateIn(
      request.validated.body,
      actorOf(request),
      request.session,
    );
    response.status(201).json({ data: result });
  }

  async function checkGateOut(request, response) {
    const result = await gateService.checkGateOut(
      request.validated.body,
      actorOf(request),
      request.session,
    );
    response.json({ data: result });
  }

  async function completeGateOut(request, response) {
    const result = await gateService.completeGateOut(
      request.validated.body,
      actorOf(request),
      request.session,
    );
    response.status(201).json({ data: result });
  }

  async function listTransactions(request, response) {
    response.json(await transactionsService.list(request.validated.query));
  }

  async function eirPdf(request, response) {
    const { id } = request.validated.params;
    const pdf = await transactionsService.eirPdf(id, request.user);
    response
      .type('application/pdf')
      .set('Content-Disposition', `inline; filename="EIR-${id}.pdf"`)
      .send(pdf);
  }

  return { verifyTruck, gateIn, checkGateOut, completeGateOut, listTransactions, eirPdf };
}
