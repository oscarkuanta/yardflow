import { actorOf } from '../../lib/actor.js';

export function createCompaniesController({ companiesService }) {
  async function list(request, response) {
    response.json(await companiesService.list(request.validated.query));
  }

  async function create(request, response) {
    const company = await companiesService.create(request.validated.body, actorOf(request));
    response.status(201).json({ data: company });
  }

  async function update(request, response) {
    const { id } = request.validated.params;
    const company = await companiesService.update(id, request.validated.body, actorOf(request));
    response.json({ data: company });
  }

  return { list, create, update };
}
