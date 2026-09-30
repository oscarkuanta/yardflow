export function createPreAdvicesController({ preAdvicesService }) {
  async function list(request, response) {
    response.json(await preAdvicesService.list(request.validated.query, request.user));
  }

  async function create(request, response) {
    const preAdvice = await preAdvicesService.create(
      request.validated.body,
      request.user,
      request.ip,
    );
    response.status(201).json({ data: preAdvice });
  }

  async function regeneratePin(request, response) {
    const { id } = request.validated.params;
    const preAdvice = await preAdvicesService.regeneratePin(id, request.user, request.ip);
    response.json({ data: preAdvice });
  }

  async function cancel(request, response) {
    const { id } = request.validated.params;
    response.json({ data: await preAdvicesService.cancel(id, request.user, request.ip) });
  }

  return { list, create, regeneratePin, cancel };
}
