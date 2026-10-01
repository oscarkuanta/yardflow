import { actorOf } from '../../lib/actor.js';

export function createCustomsController({ customsService }) {
  async function list(request, response) {
    response.json(await customsService.list(request.validated.query));
  }

  async function place(request, response) {
    const hold = await customsService.place(request.validated.body, actorOf(request));
    response.status(201).json({ data: hold });
  }

  async function release(request, response) {
    const { id } = request.validated.params;
    response.json({ data: await customsService.release(id, actorOf(request)) });
  }

  return { list, place, release };
}
