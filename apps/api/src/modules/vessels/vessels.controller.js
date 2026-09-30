import { actorOf } from '../../lib/actor.js';

export function createVesselsController({ vesselsService, itemsService, cargoService }) {
  async function list(request, response) {
    response.json(await vesselsService.list(request.validated.query));
  }

  async function detail(request, response) {
    response.json({ data: await vesselsService.detail(request.validated.params.id) });
  }

  async function create(request, response) {
    const visit = await vesselsService.create(request.validated.body, actorOf(request));
    response.status(201).json({ data: visit });
  }

  async function update(request, response) {
    const { id } = request.validated.params;
    response.json({
      data: await vesselsService.update(id, request.validated.body, actorOf(request)),
    });
  }

  async function addItem(request, response) {
    const { id } = request.validated.params;
    const item = await itemsService.addItem(id, request.validated.body, actorOf(request));
    response.status(201).json({ data: item });
  }

  async function importItems(request, response) {
    const { id } = request.validated.params;
    const result = await itemsService.importItems(id, request.body, actorOf(request));
    response.status(201).json({ data: result });
  }

  async function discharge(request, response) {
    const { id, itemId } = request.validated.params;
    const result = await cargoService.confirmDischarge(
      { visitId: id, itemId, target: request.validated.body.to },
      actorOf(request),
    );
    response.json({ data: result });
  }

  async function load(request, response) {
    const { id, itemId } = request.validated.params;
    const result = await cargoService.confirmLoad({ visitId: id, itemId }, actorOf(request));
    response.json({ data: result });
  }

  return { list, detail, create, update, addItem, importItems, discharge, load };
}
