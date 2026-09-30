import { actorOf } from '../../lib/actor.js';

export function createYardController({ yardService }) {
  async function map(_request, response) {
    response.json({ data: await yardService.getMap() });
  }

  async function stack(request, response) {
    response.json({ data: await yardService.getStack(request.validated.params) });
  }

  async function suggestions(request, response) {
    response.json({ data: await yardService.suggest(request.validated.body) });
  }

  async function move(request, response) {
    response.json({ data: await yardService.move(request.validated.body, actorOf(request)) });
  }

  return { map, stack, suggestions, move };
}
