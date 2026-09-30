import { actorOf } from '../../lib/actor.js';

export function createTariffsController({ tariffsService }) {
  async function list(request, response) {
    response.json(await tariffsService.list(request.validated.query));
  }

  async function update(request, response) {
    const tariff = await tariffsService.update(request.validated.body, actorOf(request));
    response.json({ data: tariff });
  }

  return { list, update };
}
