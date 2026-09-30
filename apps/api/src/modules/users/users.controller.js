import { actorOf } from '../../lib/actor.js';

export function createUsersController({ usersService }) {
  async function list(request, response) {
    response.json(await usersService.list(request.validated.query));
  }

  async function create(request, response) {
    const user = await usersService.create(request.validated.body, actorOf(request));
    response.status(201).json({ data: user });
  }

  async function update(request, response) {
    const { id } = request.validated.params;
    const user = await usersService.update(id, request.validated.body, actorOf(request));
    response.json({ data: user });
  }

  return { list, create, update };
}
