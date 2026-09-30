import { actorOf } from '../../lib/actor.js';

export function createWorkOrdersController({ workOrdersService }) {
  async function list(request, response) {
    response.json(await workOrdersService.list(request.validated.query));
  }

  async function complete(request, response) {
    const { id } = request.validated.params;
    response.json({ data: await workOrdersService.complete(id, actorOf(request)) });
  }

  return { list, complete };
}
