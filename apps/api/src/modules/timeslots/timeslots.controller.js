import { actorOf } from '../../lib/actor.js';

export function createTimeSlotsController({ timeSlotsService }) {
  async function list(request, response) {
    response.json({ data: await timeSlotsService.listForDate(request.validated.query.date) });
  }

  async function updateCapacity(request, response) {
    const slots = await timeSlotsService.updateCapacity(request.validated.body, actorOf(request));
    response.json({ data: slots });
  }

  return { list, updateCapacity };
}
