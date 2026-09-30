export function createContainersController({ containersService }) {
  async function list(request, response) {
    response.json(await containersService.list(request.validated.query, request.user));
  }

  async function detail(request, response) {
    const { number } = request.validated.params;
    response.json({ data: await containersService.detail(number, request.user) });
  }

  return { list, detail };
}
