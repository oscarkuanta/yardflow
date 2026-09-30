import { actorOf } from '../../lib/actor.js';

export function createBlocksController({ blocksService }) {
  async function list(request, response) {
    response.json(await blocksService.list(request.validated.query));
  }

  async function create(request, response) {
    const block = await blocksService.create(request.validated.body, actorOf(request));
    response.status(201).json({ data: block });
  }

  async function update(request, response) {
    const { id } = request.validated.params;
    const block = await blocksService.update(id, request.validated.body, actorOf(request));
    response.json({ data: block });
  }

  return { list, create, update };
}
