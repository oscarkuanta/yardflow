export function createNotificationsController({ notificationsService }) {
  async function list(request, response) {
    response.json(await notificationsService.list(request.validated.query, request.user));
  }

  async function markRead(request, response) {
    const { id } = request.validated.params;
    response.json({ data: await notificationsService.markRead(id, request.user) });
  }

  async function markAllRead(request, response) {
    response.json({ data: await notificationsService.markAllRead(request.user) });
  }

  return { list, markRead, markAllRead };
}
